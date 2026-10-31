'use client';

import { CONTACT_TOPICS, type ContactTopic } from '@boikonika/shared';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

export function ContactForm({ initialTopic, initialOrder }: { initialTopic?: string; initialOrder?: string }) {
  const t = useTranslations('contact');
  const { user } = useAuth();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    topic: ((CONTACT_TOPICS as readonly string[]).includes(initialTopic ?? '') ? initialTopic : 'order') as ContactTopic,
    orderNumber: initialOrder ?? '',
    message: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Signed-in people start with their own name and email filled in.
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.displayName, email: f.email || (user.emailVerified ? (user.email ?? '') : '') }));
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(undefined);
    setBusy(true);
    try {
      const res = await apiRequest<{ reference: string }>('/contact', {
        method: 'POST',
        body: { name: form.name, email: form.email || undefined, phone: form.phone || undefined, topic: form.topic, orderNumber: form.orderNumber || undefined, message: form.message },
      });
      setSent(res.data.reference);
    } catch (err) {
      const parsed = fromApi(err);
      setErrors(parsed.fields);
      if (!Object.keys(parsed.fields).length) setFormError(parsed.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div role="status" className="mt-6 rounded-xl border border-success/40 bg-success-soft p-6 text-success-soft-fg">
        <CheckCircle2 className="mb-2 h-8 w-8" aria-hidden="true" />
        <h2 className="text-lg font-bold">{t('sentTitle')}</h2>
        <p className="mt-1">{form.email ? t('sentText', { ref: sent, email: form.email }) : t('sentTextAccount', { ref: sent })}</p>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('name')} error={errors.name} required>
          {(p) => <Input {...p} value={form.name} onChange={set('name')} autoComplete="name" maxLength={120} />}
        </Field>
        <Field label={t('email')} hint={user ? t('emailHintAccount') : t('emailHint')} error={errors.email} required={!user}>
          {(p) => <Input {...p} type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={254} />}
        </Field>
        <Field label={t('phone')} error={errors.phone}>
          {(p) => <Input {...p} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" maxLength={20} />}
        </Field>
        <Field label={t('topic')} error={errors.topic} required>
          {(p) => (
            <Select {...p} value={form.topic} onChange={set('topic')}>
              {CONTACT_TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {t(`topics.${topic}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {form.topic === 'order' || form.topic === 'payment' ? (
        <Field label={t('orderNumber')} hint={t('orderNumberHint')} error={errors.orderNumber}>
          {(p) => <Input {...p} value={form.orderNumber} onChange={set('orderNumber')} maxLength={40} className="max-w-60" />}
        </Field>
      ) : null}
      <Field label={t('message')} hint={t('messageHint')} error={errors.message} required>
        {(p) => <Textarea {...p} value={form.message} onChange={set('message')} rows={6} maxLength={3000} />}
      </Field>
      <p className="text-xs text-fg-subtle">{t('privacy')}</p>
      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}
      <Button type="submit" loading={busy}>
        {t('send')}
      </Button>
    </form>
  );
}
