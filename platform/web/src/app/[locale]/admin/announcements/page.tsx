'use client';

import { BROADCAST_AUDIENCES, type BroadcastAudience } from '@boikonika/shared';
import { Megaphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

const empty = { titleBn: '', titleEn: '', bodyBn: '', bodyEn: '', link: '', audience: 'everyone' as BroadcastAudience };

/** Staff announcements in both languages, to everyone or one group; a few per hour at most. */
export default function AdminAnnouncementsPage() {
  const t = useTranslations('adminAnnouncements');
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirming) return setConfirming(true);
    setBusy(true);
    setErrors({});
    try {
      const res = await apiRequest('/admin/notifications/broadcast', {
        method: 'POST',
        body: { title: { bn: form.titleBn, en: form.titleEn }, body: { bn: form.bodyBn, en: form.bodyEn }, link: form.link.trim() || undefined, audience: form.audience },
      });
      toast.show(res.message, 'success');
      setForm(empty);
    } catch (err) {
      const parsed = fromApi(err);
      setErrors(parsed.fields);
      toast.show(parsed.message, 'danger');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <RequirePermission permission="notifications.broadcast">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Megaphone className="h-6 w-6 text-primary" aria-hidden="true" />
        {t('title')}
      </h1>
      <p className="mb-5 mt-1 max-w-2xl text-fg-muted">{t('text')}</p>
      <form onSubmit={submit} className="max-w-3xl space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('titleBn')} error={errors['title.bn']} required>
            {(p) => <Input {...p} lang="bn" value={form.titleBn} onChange={set('titleBn')} maxLength={120} />}
          </Field>
          <Field label={t('titleEn')} error={errors['title.en']} required>
            {(p) => <Input {...p} lang="en" value={form.titleEn} onChange={set('titleEn')} maxLength={120} />}
          </Field>
          <Field label={t('bodyBn')} error={errors['body.bn']} required>
            {(p) => <Textarea {...p} lang="bn" value={form.bodyBn} onChange={set('bodyBn')} rows={4} maxLength={500} />}
          </Field>
          <Field label={t('bodyEn')} error={errors['body.en']} required>
            {(p) => <Textarea {...p} lang="en" value={form.bodyEn} onChange={set('bodyEn')} rows={4} maxLength={500} />}
          </Field>
          <Field label={t('link')} hint={t('linkHint')} error={errors.link}>
            {(p) => <Input {...p} value={form.link} onChange={set('link')} placeholder="/books" maxLength={300} />}
          </Field>
          <Field label={t('audience')} error={errors.audience}>
            {(p) => (
              <Select {...p} value={form.audience} onChange={set('audience')}>
                {BROADCAST_AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {t(`audiences.${a}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <p className="text-sm text-fg-muted">{t('channelsNote')}</p>
        {confirming ? <Alert tone="warning">{t('confirm', { audience: t(`audiences.${form.audience}`) })}</Alert> : null}
        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            {confirming ? t('sendNow') : t('send')}
          </Button>
          {confirming ? (
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('cancel')}
            </Button>
          ) : null}
        </div>
      </form>
    </RequirePermission>
  );
}
