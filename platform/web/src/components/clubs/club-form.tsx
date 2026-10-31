'use client';

import { CLUB_TYPES, JOIN_POLICIES, STUDY_SUBJECTS } from '@boikonika/shared';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { FormSection } from '@/components/seller/form-parts';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import type { ClubDetail } from '@/lib/clubs';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

const INSTITUTION = ['school', 'college', 'university'];

/** Create a club or study group, or edit one's settings (owners change type and joining). */
export function ClubForm({ club, defaultPurpose = 'reading', onSaved }: { club?: ClubDetail; defaultPurpose?: 'reading' | 'study'; onSaved?: (c: ClubDetail) => void }) {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({
    name: club?.name ?? '',
    description: club?.description ?? '',
    purpose: club?.purpose ?? defaultPurpose,
    subject: club?.subject ?? '',
    type: club?.type ?? 'public',
    institutionName: club?.institutionName ?? '',
    joinPolicy: club?.joinPolicy ?? 'open',
    rules: club?.rules ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const ownerFields = !club || club.isOwner;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: FieldErrors = {};
    if (form.name.trim().length < 3) found.name = t('validation.required');
    if (form.purpose === 'study' && !form.subject) found.subject = t('validation.required');
    if (INSTITUTION.includes(form.type) && !form.institutionName.trim()) found.institutionName = t('validation.required');
    if (form.type === 'private' && form.joinPolicy === 'open') found.joinPolicy = t('validation.privateClubPolicy');
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      name: form.name,
      description: form.description,
      purpose: form.purpose,
      subject: form.purpose === 'study' ? form.subject : undefined,
      institutionName: INSTITUTION.includes(form.type) ? form.institutionName : undefined,
      rules: form.rules,
      ...(ownerFields ? { type: form.type, joinPolicy: form.joinPolicy } : {}),
    };
    setBusy(true);
    try {
      const res = club ? await apiRequest<ClubDetail>(`/clubs/${club.slug}`, { method: 'PATCH', body }) : await apiRequest<ClubDetail>('/clubs', { method: 'POST', body });
      toast.show(res.message, 'success');
      if (onSaved) onSaved(res.data);
      else router.push(`/clubs/${res.data.slug}`);
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      if (!Object.keys(fields).length) toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-6">
      <FormSection title={t('clubs.about')}>
        <Field label={t('clubs.name')} required error={errors.name}>
          {(p) => <Input {...p} value={form.name} onChange={set('name')} maxLength={160} />}
        </Field>
        <Field label={t('clubs.description')} error={errors.description}>
          {(p) => <Textarea {...p} value={form.description} onChange={set('description')} rows={4} maxLength={2000} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('clubs.purpose')}>
            {(p) => (
              <Select {...p} value={form.purpose} onChange={set('purpose')}>
                <option value="reading">{t('clubs.purposes.reading')}</option>
                <option value="study">{t('clubs.purposes.study')}</option>
              </Select>
            )}
          </Field>
          {form.purpose === 'study' ? (
            <Field label={t('community.subject')} required error={errors.subject}>
              {(p) => (
                <Select {...p} value={form.subject} onChange={set('subject')}>
                  <option value="">—</option>
                  {STUDY_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`subjects.${s}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
        </div>
        <Field label={t('clubs.rules')} hint={t('clubs.rulesHint')} error={errors.rules}>
          {(p) => <Textarea {...p} value={form.rules} onChange={set('rules')} rows={3} maxLength={3000} />}
        </Field>
      </FormSection>
      <FormSection title={t('clubs.access')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('clubs.type')} hint={ownerFields ? undefined : t('clubs.ownerOnlyHint')}>
            {(p) => (
              <Select {...p} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof f.type, joinPolicy: e.target.value === 'private' && f.joinPolicy === 'open' ? 'request' : f.joinPolicy }))} disabled={!ownerFields}>
                {CLUB_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {t(`clubs.types.${k}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('clubs.joinPolicy')} error={errors.joinPolicy}>
            {(p) => (
              <Select {...p} value={form.joinPolicy} onChange={set('joinPolicy')} disabled={!ownerFields}>
                {JOIN_POLICIES.map((k) => (
                  <option key={k} value={k} disabled={form.type === 'private' && k === 'open'}>
                    {t(`clubs.policies.${k}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {INSTITUTION.includes(form.type) ? (
          <Field label={t('clubs.institution')} required error={errors.institutionName}>
            {(p) => <Input {...p} value={form.institutionName} onChange={set('institutionName')} maxLength={200} />}
          </Field>
        ) : null}
        <p className="text-sm text-fg-muted">{t(`clubs.typeHelp.${form.type}`)}</p>
      </FormSection>
      <Button type="submit" loading={busy}>
        {club ? t('common.save') : t('clubs.create')}
      </Button>
    </form>
  );
}
