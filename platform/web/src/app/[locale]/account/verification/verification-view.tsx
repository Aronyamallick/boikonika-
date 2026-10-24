'use client';

import { isValidNid, KYC_NUMBERED_DOCUMENTS, KYC_PURPOSES, KYC_REQUIREMENTS, KYC_UPLOAD, missingKycDocuments, type KycDocumentType, type KycPurpose, type KycStatus } from '@boikonika/shared';
import { BadgeCheck, FileText, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Alert } from '@/components/ui/alert';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { apiRequest, api } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface Verification {
  id: string;
  purpose: KycPurpose;
  requestedRole: string;
  status: KycStatus;
  legalName: string;
  rejectionReason: string | null;
  submittedAt: string;
  documents: Array<{ id: string; type: KycDocumentType; side: string; numberLast4: string | null; purged: boolean }>;
  timeline: Array<{ event: string; status: string | null; at: string }>;
}

interface DocRow {
  key: number;
  type: KycDocumentType;
  side: 'front' | 'back' | 'single';
  number: string;
  file: File | null;
}

const STATUS_TONE: Record<KycStatus, Tone> = { pending: 'info', under_review: 'warning', approved: 'success', rejected: 'danger', resubmission_required: 'warning' };
let rowKey = 0;

function initialRows(purpose: KycPurpose): DocRow[] {
  return KYC_REQUIREMENTS[purpose].required.flatMap((group): DocRow[] => {
    const type = group[0]!;
    if (type === 'nid' || type === 'driving_license') {
      return [
        { key: ++rowKey, type, side: 'front', number: '', file: null },
        { key: ++rowKey, type, side: 'back', number: '', file: null },
      ];
    }
    return [{ key: ++rowKey, type, side: 'single', number: '', file: null }];
  });
}

export function VerificationView() {
  const t = useTranslations('verification');
  const [items, setItems] = useState<Verification[] | null>(null);
  const [purpose, setPurpose] = useState<KycPurpose | null>(null);
  const load = useCallback(() => {
    api<Verification[]>('/kyc/verifications').then(setItems, () => setItems([]));
  }, []);
  useEffect(load, [load]);

  const open = new Set((items ?? []).filter((v) => v.status === 'pending' || v.status === 'under_review').map((v) => v.purpose));

  return (
    <div className="space-y-8">
      {items === null ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length ? (
        <section aria-labelledby="my-requests" className="space-y-3">
          <h2 id="my-requests" className="text-lg font-bold">
            {t('myRequests')}
          </h2>
          {items.map((v) => (
            <RequestCard key={v.id} item={v} onResubmit={() => setPurpose(v.purpose)} />
          ))}
        </section>
      ) : (
        <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-fg-muted">{t('none')}</p>
      )}

      <section aria-labelledby="new-request" className="space-y-4">
        <h2 id="new-request" className="text-lg font-bold">
          {t('newRequest')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('purpose')}>
          {KYC_PURPOSES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={purpose === p}
              disabled={open.has(p)}
              onClick={() => setPurpose(p)}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60',
                purpose === p ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:bg-subtle',
              )}
            >
              <span className="flex items-center gap-2 font-semibold text-fg">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                {t(`purpose_${p}`)}
              </span>
              <span className="mt-1 block text-sm text-fg-muted">{t(`purposeText_${p}`)}</span>
            </button>
          ))}
        </div>
        {purpose ? <RequestForm key={purpose} purpose={purpose} onDone={() => (setPurpose(null), load())} /> : null}
      </section>
    </div>
  );
}

function RequestCard({ item, onResubmit }: { item: Verification; onResubmit: () => void }) {
  const t = useTranslations();
  const format = useFormatter();
  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-fg">
          {t(`verification.purpose_${item.purpose}`)} · {t(`roles.${item.requestedRole}`)}
        </h3>
        <Badge tone={STATUS_TONE[item.status]}>{t(`status.kyc.${item.status}`)}</Badge>
      </div>
      {item.rejectionReason ? (
        <Alert tone={item.status === 'rejected' ? 'danger' : 'warning'} className="mt-3" title={t('verification.reason')}>
          {item.rejectionReason}
        </Alert>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-2 text-xs text-fg-muted">
        {item.documents.map((d) => (
          <li key={d.id} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {t(`verification.doc_${d.type}`)}
            {d.numberLast4 ? ` ••${d.numberLast4}` : ''}
          </li>
        ))}
      </ul>
      <ol className="mt-3 space-y-1 border-l-2 border-line pl-4 text-sm" aria-label={t('verification.timeline')}>
        {item.timeline.map((e, i) => (
          <li key={i} className="text-fg-muted">
            <span className="font-semibold text-fg">{t.has(`verification.event_${e.event}`) ? t(`verification.event_${e.event}`) : e.event}</span> · {format.dateTime(new Date(e.at), { dateStyle: 'medium', timeStyle: 'short' })}
          </li>
        ))}
      </ol>
      {item.status === 'approved' ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-success-soft-fg">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          {t('profile.verified', { role: t(`roles.${item.requestedRole}`) })}
        </p>
      ) : null}
      {item.status === 'resubmission_required' || item.status === 'rejected' ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onResubmit}>
          {t('verification.resubmit')}
        </Button>
      ) : null}
    </article>
  );
}

function RequestForm({ purpose, onDone }: { purpose: KycPurpose; onDone: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { user } = useAuth();
  const { fromApi } = useFormErrors();
  const requirement = KYC_REQUIREMENTS[purpose];
  const allowedTypes = useMemo(() => [...new Set([...requirement.required.flat(), ...requirement.optional])], [requirement]);
  const [role, setRole] = useState(requirement.roles[0]!);
  const [form, setForm] = useState({ legalName: user?.displayName ?? '', dateOfBirth: '', businessName: '', institutionName: '', address: '' });
  const [rows, setRows] = useState<DocRow[]>(() => initialRows(purpose));
  const [declarations, setDeclarations] = useState({ accurate: false, authorised: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const setRow = (key: number, patch: Partial<DocRow>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const missing = missingKycDocuments(purpose, rows.filter((r) => r.file).map((r) => r.type));
  const orgField = purpose === 'institution' ? 'institutionName' : 'businessName';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors: FieldErrors = {};
    if (form.legalName.trim().length < 2) fieldErrors.legalName = t('validation.nameLength');
    if (requirement.needsOrganisation && !form[orgField].trim()) fieldErrors[orgField] = t('validation.required');
    rows.forEach((r, i) => {
      if (!r.file) fieldErrors[`documents.${i}.file`] = t('validation.required');
      else if (r.file.size > KYC_UPLOAD.maxBytes) fieldErrors[`documents.${i}.file`] = t('validation.fileTooLarge', { max: '8 MB' });
      if (r.type === 'nid' && r.number && !isValidNid(r.number.replace(/[\s-]/g, ''))) fieldErrors[`documents.${i}.number`] = t('validation.nid');
    });
    if (missing.length) fieldErrors.documents = t('validation.fileMissing');
    if (!declarations.accurate || !declarations.authorised) fieldErrors.declarations = t('validation.declaration');
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;

    const data = {
      purpose,
      requestedRole: role,
      legalName: form.legalName,
      dateOfBirth: form.dateOfBirth || undefined,
      businessName: form.businessName || undefined,
      institutionName: form.institutionName || undefined,
      address: form.address || undefined,
      documents: rows.map((r) => ({ type: r.type, side: r.side, number: r.number || undefined })),
      declarations,
    };
    const body = new FormData();
    body.append('data', JSON.stringify(data));
    rows.forEach((r) => body.append('documents', r.file!));
    setBusy(true);
    setMessage('');
    try {
      const res = await apiRequest('/kyc/verifications', { method: 'POST', body });
      toast.show(res.message);
      onDone();
    } catch (err) {
      const { fields, message: m } = fromApi(err);
      setErrors(fields);
      setMessage(m);
    } finally {
      setBusy(false);
    }
  }

  const groupLabel = (group: KycDocumentType[]) => group.map((type) => t(`verification.doc_${type}`)).join(` ${t('common.or')} `);

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      {message ? <Alert tone="danger">{message}</Alert> : null}
      {requirement.roles.length > 1 ? (
        <Field label={t('verification.sellerType')}>
          {(f) => (
            <Select {...f} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              {requirement.roles.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('verification.legalName')} error={errors.legalName} required className="sm:col-span-2">
          {(f) => <Input {...f} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} autoComplete="name" />}
        </Field>
        {purpose === 'seller' || requirement.needsOrganisation ? (
          <Field label={purpose === 'institution' ? t('verification.institutionName') : t('verification.businessName')} error={errors[orgField]} required={requirement.needsOrganisation}>
            {(f) => <Input {...f} value={form[orgField]} onChange={(e) => setForm({ ...form, [orgField]: e.target.value })} autoComplete="organization" />}
          </Field>
        ) : null}
        <Field label={t('verification.dateOfBirth')} error={errors.dateOfBirth}>
          {(f) => <Input {...f} type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} autoComplete="bday" />}
        </Field>
        <Field label={t('verification.address')} error={errors.address} className="sm:col-span-2">
          {(f) => <Input {...f} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" />}
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-base font-bold text-fg">{t('verification.documents')}</legend>
        <p className="text-sm text-fg-muted">{t('verification.documentsHint')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-fg-muted">
          {requirement.required.map((group, i) => (
            <li key={i} className={missing.includes(group) ? '' : 'text-success-soft-fg'}>
              {t('verification.needs')}: {groupLabel(group)}
            </li>
          ))}
        </ul>
        {errors.documents ? (
          <p className="text-sm text-danger" role="alert">
            {errors.documents}
          </p>
        ) : null}
        {rows.map((row, i) => (
          <div key={row.key} className="grid gap-3 rounded-xl bg-subtle p-4 sm:grid-cols-[1.4fr_1fr_1.2fr_auto] sm:items-end">
            <Field label={t('verification.documentType')}>
              {(f) => (
                <Select {...f} value={row.type} onChange={(e) => setRow(row.key, { type: e.target.value as KycDocumentType })}>
                  {allowedTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(`verification.doc_${type}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('verification.side')}>
              {(f) => (
                <Select {...f} value={row.side} onChange={(e) => setRow(row.key, { side: e.target.value as DocRow['side'] })}>
                  {(['front', 'back', 'single'] as const).map((side) => (
                    <option key={side} value={side}>
                      {t(`verification.side_${side}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {KYC_NUMBERED_DOCUMENTS.includes(row.type) && row.side !== 'back' ? (
              <Field label={t('verification.number')} hint={t('verification.numberHint')} error={errors[`documents.${i}.number`]}>
                {(f) => <Input {...f} value={row.number} onChange={(e) => setRow(row.key, { number: e.target.value })} inputMode={row.type === 'nid' ? 'numeric' : 'text'} autoComplete="off" />}
              </Field>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Button variant="ghost" size="icon" aria-label={t('verification.remove')} onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))} disabled={rows.length <= 1}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Field label={t('verification.chooseFile')} error={errors[`documents.${i}.file`]} className="sm:col-span-4">
              {(f) => (
                <input
                  {...f}
                  type="file"
                  accept={KYC_UPLOAD.mimeTypes.join(',')}
                  onChange={(e) => setRow(row.key, { file: e.target.files?.[0] ?? null })}
                  className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-4 file:py-2 file:font-semibold file:text-primary-soft-fg"
                />
              )}
            </Field>
          </div>
        ))}
        {rows.length < KYC_UPLOAD.maxFiles ? (
          <Button variant="outline" size="sm" onClick={() => setRows((all) => [...all, { key: ++rowKey, type: allowedTypes[0]!, side: 'single', number: '', file: null }])}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('verification.addDocument')}
          </Button>
        ) : null}
      </fieldset>

      <div className="space-y-2">
        <Checkbox label={t('verification.declareAccurate')} checked={declarations.accurate} onChange={(e) => setDeclarations({ ...declarations, accurate: e.target.checked })} />
        <Checkbox label={t('verification.declareAuthorised')} checked={declarations.authorised} onChange={(e) => setDeclarations({ ...declarations, authorised: e.target.checked })} />
        {errors.declarations ? (
          <p className="text-sm text-danger" role="alert">
            {errors.declarations}
          </p>
        ) : null}
      </div>
      <Button type="submit" loading={busy}>
        {t('verification.submit')}
      </Button>
    </form>
  );
}
