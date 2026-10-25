'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field';
import { apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

export function CopyrightForm({ initialUrl }: { initialUrl: string }) {
  const t = useTranslations('copyrightForm');
  const { user } = useAuth();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({
    claimantName: user?.displayName ?? '',
    claimantEmail: user?.email ?? '',
    claimantPhone: '',
    rightsHolder: '',
    contentUrl: initialUrl,
    workDescription: '',
    evidence: '',
    signature: '',
  });
  const [goodFaith, setGoodFaith] = useState(false);
  const [accurate, setAccurate] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(undefined);
    setBusy(true);
    try {
      const evidenceUrls = form.evidence
        .split(/\s+/)
        .map((u) => u.trim())
        .filter(Boolean);
      const res = await apiRequest<{ reference: string }>('/copyright/claims', {
        method: 'POST',
        body: {
          claimantName: form.claimantName,
          claimantEmail: form.claimantEmail,
          claimantPhone: form.claimantPhone || undefined,
          rightsHolder: form.rightsHolder,
          contentUrl: form.contentUrl.trim(),
          workDescription: form.workDescription,
          evidenceUrls,
          goodFaithStatement: goodFaith,
          accuracyStatement: accurate,
          signature: form.signature,
        },
      });
      setReference(res.data.reference);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const parsed = fromApi(err);
      // evidenceUrls.N errors belong to the single evidence box.
      const fields = Object.fromEntries(Object.entries(parsed.fields).map(([k, v]) => [k.startsWith('evidenceUrls') ? 'evidence' : k, v]));
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(parsed.message);
    } finally {
      setBusy(false);
    }
  };

  if (reference)
    return (
      <div role="status" className="mt-6 rounded-xl border border-success/40 bg-success-soft p-6 text-success-soft-fg">
        <CheckCircle2 className="mb-2 h-8 w-8" aria-hidden="true" />
        <h2 className="text-lg font-bold">{t('sentTitle')}</h2>
        <p className="mt-1">{t('sentText', { ref: reference, email: form.claimantEmail })}</p>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-6">
      <fieldset className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <legend className="px-1 font-bold">{t('aboutYou')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('name')} error={errors.claimantName} required>
            {(p) => <Input {...p} value={form.claimantName} onChange={set('claimantName')} autoComplete="name" maxLength={160} />}
          </Field>
          <Field label={t('email')} hint={t('emailHint')} error={errors.claimantEmail} required>
            {(p) => <Input {...p} type="email" value={form.claimantEmail} onChange={set('claimantEmail')} autoComplete="email" maxLength={254} />}
          </Field>
          <Field label={t('phone')} error={errors.claimantPhone}>
            {(p) => <Input {...p} type="tel" value={form.claimantPhone} onChange={set('claimantPhone')} autoComplete="tel" maxLength={20} />}
          </Field>
          <Field label={t('rightsHolder')} hint={t('rightsHolderHint')} error={errors.rightsHolder} required>
            {(p) => <Input {...p} value={form.rightsHolder} onChange={set('rightsHolder')} maxLength={200} />}
          </Field>
        </div>
      </fieldset>
      <fieldset className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <legend className="px-1 font-bold">{t('aboutWork')}</legend>
        <Field label={t('contentUrl')} hint={t('contentUrlHint')} error={errors.contentUrl} required>
          {(p) => <Input {...p} type="url" inputMode="url" value={form.contentUrl} onChange={set('contentUrl')} placeholder="https://" maxLength={500} />}
        </Field>
        <Field label={t('work')} hint={t('workHint')} error={errors.workDescription} required>
          {(p) => <Textarea {...p} value={form.workDescription} onChange={set('workDescription')} rows={5} maxLength={3000} />}
        </Field>
        <Field label={t('evidence')} hint={t('evidenceHint')} error={errors.evidence}>
          {(p) => <Textarea {...p} value={form.evidence} onChange={set('evidence')} rows={3} placeholder="https://" />}
        </Field>
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <legend className="px-1 font-bold">{t('declarations')}</legend>
        <Checkbox label={t('goodFaith')} checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} aria-invalid={errors.goodFaithStatement ? true : undefined} />
        {errors.goodFaithStatement ? <p className="pl-7 text-sm text-danger" role="alert">{errors.goodFaithStatement}</p> : null}
        <Checkbox label={t('accurate')} checked={accurate} onChange={(e) => setAccurate(e.target.checked)} aria-invalid={errors.accuracyStatement ? true : undefined} />
        {errors.accuracyStatement ? <p className="pl-7 text-sm text-danger" role="alert">{errors.accuracyStatement}</p> : null}
        <Field label={t('signature')} hint={t('signatureHint')} error={errors.signature} required>
          {(p) => <Input {...p} value={form.signature} onChange={set('signature')} maxLength={160} />}
        </Field>
      </fieldset>
      <p className="text-sm text-fg-subtle">{t('privacy')}</p>
      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}
      <Button type="submit" loading={busy} size="lg">
        {t('send')}
      </Button>
    </form>
  );
}
