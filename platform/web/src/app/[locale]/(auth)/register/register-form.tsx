'use client';

import { displayNameError, isValidUsername, normalizeOtp, parseContact, passwordError, type AuthResult, type OtpSentResult } from '@boikonika/shared';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { CodeInput } from '@/components/auth/code-input';
import { PasswordInput } from '@/components/auth/password-input';
import { ResendButton } from '@/components/auth/resend-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { deviceId, safeNextPath } from '@/lib/device';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

export function RegisterForm() {
  const t = useTranslations();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const { status, signedIn } = useAuth();
  const toast = useToast();
  const { fromChecks, fromApi } = useFormErrors();

  const [form, setForm] = useState({ name: '', target: '', password: '', username: '', isStudent: false, acceptTerms: false });
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<OtpSentResult | null>(null);
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && !busy && !done) router.replace(next);
  }, [status, busy, done, next, router]);

  // Live username availability (debounced).
  useEffect(() => {
    const value = form.username.trim();
    if (!value || !isValidUsername(value)) return setUsernameState('idle');
    setUsernameState('checking');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ available: boolean }>('/auth/username-available', { query: { username: value }, signal: controller.signal, auth: false })
        .then((r) => setUsernameState(r.available ? 'available' : 'taken'))
        .catch(() => setUsernameState('idle'));
    }, 400);
    return () => (clearTimeout(timer), controller.abort());
  }, [form.username]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const payload = () => ({ ...form, username: form.username.trim() || undefined, deviceId: deviceId(), client: 'web' as const, rememberDevice: true });

  async function sendCode(): Promise<number | void> {
    const result = await api<OtpSentResult>('/auth/otp/request', { method: 'POST', body: { target: form.target, purpose: 'register' }, auth: false });
    setSent(result);
    return result.resendIn;
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setFormError('');
    try {
      await task();
    } catch (error) {
      const { fields, message } = fromApi(error);
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
      if (fields.target || fields.username || fields.name || fields.password) setSent(null);
    } finally {
      setBusy(false);
    }
  }

  function submitDetails(e: FormEvent) {
    e.preventDefault();
    const username = form.username.trim();
    const fieldErrors = fromChecks({
      name: displayNameError(form.name),
      target: !parseContact(form.target) && 'validation.identifier',
      password: passwordError(form.password),
      username: !!username && !isValidUsername(username) && 'validation.username',
      acceptTerms: !form.acceptTerms && 'validation.acceptTerms',
    });
    if (usernameState === 'taken') fieldErrors.username = t('auth.usernameTaken');
    if (Object.keys(fieldErrors).length) return setErrors(fieldErrors);
    void run(async () => void (await sendCode()));
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!normalizeOtp(code)) return setErrors({ code: t('validation.otp') });
    void run(async () => {
      const result = await api<AuthResult>('/auth/register', { method: 'POST', body: { ...payload(), code }, auth: false });
      setDone(true);
      signedIn(result);
      toast.show(t('auth.registerDone'));
      router.replace(next);
    });
  }

  if (sent) {
    return (
      <form onSubmit={submitCode} noValidate className="space-y-5">
        <ol className="flex items-center gap-2 text-xs font-semibold text-fg-subtle" aria-label={t('auth.stepVerify')}>
          <li className="text-success-soft-fg">1. {t('auth.stepDetails')} ✓</li>
          <li aria-current="step" className="text-primary">2. {t('auth.stepVerify')}</li>
        </ol>
        <p className="text-sm text-fg-muted" aria-live="polite">
          {t('auth.codeSentTo', { target: sent.sentTo })}{' '}
          <Button variant="link" onClick={() => (setSent(null), setCode(''))}>
            {t('auth.changeContact')}
          </Button>
        </p>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <Field label={t('auth.otpCode')} error={errors.code}>
          {(field) => <CodeInput {...field} value={code} onChange={(e) => (setCode(e.target.value), setErrors({}))} autoFocus />}
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          {t('auth.registerButton')}
        </Button>
        <div className="text-center">
          <ResendButton seconds={sent.resendIn} onResend={sendCode} />
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitDetails} noValidate className="space-y-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label={t('auth.name')} error={errors.name} required>
        {(field) => <Input {...field} value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />}
      </Field>
      <Field label={t('auth.identifier')} error={errors.target} hint={t('auth.phoneHint')} required>
        {(field) => <Input {...field} value={form.target} onChange={(e) => set('target', e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />}
      </Field>
      <Field label={t('auth.password')} error={errors.password} hint={t('auth.passwordHint')} required>
        {(field) => <PasswordInput {...field} value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />}
      </Field>
      <Field
        label={`${t('auth.username')} (${t('common.optional')})`}
        error={errors.username}
        hint={
          usernameState === 'checking' ? (
            t('auth.checking')
          ) : usernameState === 'available' ? (
            <span className="inline-flex items-center gap-1 text-success-soft-fg">
              <Check className="h-4 w-4" aria-hidden="true" /> {t('auth.usernameAvailable')}
            </span>
          ) : usernameState === 'taken' ? (
            <span className="inline-flex items-center gap-1 text-danger">
              <X className="h-4 w-4" aria-hidden="true" /> {t('auth.usernameTaken')}
            </span>
          ) : (
            t('auth.usernameHint')
          )
        }
      >
        {(field) => (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-fg-subtle" aria-hidden="true">
              @
            </span>
            <Input {...field} value={form.username} onChange={(e) => set('username', e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} className="pl-8" />
          </div>
        )}
      </Field>
      <Checkbox label={t('auth.iAmStudent')} checked={form.isStudent} onChange={(e) => set('isStudent', e.target.checked)} />
      <div className="space-y-1">
        <Checkbox
          label={t.rich('auth.acceptTermsRich', {
            terms: (chunks) => (
              <Link href="/pages/terms" className="font-semibold text-primary underline-offset-2 hover:underline" target="_blank">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/pages/privacy" className="font-semibold text-primary underline-offset-2 hover:underline" target="_blank">
                {chunks}
              </Link>
            ),
          })}
          checked={form.acceptTerms}
          onChange={(e) => set('acceptTerms', e.target.checked)}
          aria-invalid={errors.acceptTerms ? true : undefined}
        />
        {errors.acceptTerms ? (
          <p className="text-sm text-danger" role="alert">
            {errors.acceptTerms}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" loading={busy}>
        {t('auth.sendCode')}
      </Button>
    </form>
  );
}
