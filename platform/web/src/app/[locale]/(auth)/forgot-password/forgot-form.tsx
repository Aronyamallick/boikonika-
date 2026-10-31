'use client';

import { normalizeOtp, parseContact, passwordError, type OtpSentResult } from '@boikonika/shared';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { CodeInput } from '@/components/auth/code-input';
import { PasswordInput } from '@/components/auth/password-input';
import { ResendButton } from '@/components/auth/resend-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

export function ForgotPasswordForm() {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [target, setTarget] = useState('');
  const [sent, setSent] = useState<OtpSentResult | null>(null);
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setFormError('');
    try {
      await task();
    } catch (error) {
      const { fields, message } = fromApi(error);
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(): Promise<number | void> {
    const { data, message } = await apiRequest<OtpSentResult>('/auth/password/forgot', { method: 'POST', body: { target }, auth: false });
    setSent(data);
    setNotice(message);
    return data.resendIn;
  }

  function submitTarget(e: FormEvent) {
    e.preventDefault();
    if (!parseContact(target)) return setErrors({ target: t('validation.identifier') });
    setErrors({});
    void run(async () => void (await sendCode()));
  }

  function submitReset(e: FormEvent) {
    e.preventDefault();
    const fieldErrors: FieldErrors = {};
    if (!normalizeOtp(code)) fieldErrors.code = t('validation.otp');
    if (passwordError(password)) fieldErrors.password = t('validation.passwordWeak');
    else if (password !== confirm) fieldErrors.confirm = t('auth.confirmPasswordMismatch');
    if (Object.keys(fieldErrors).length) return setErrors(fieldErrors);
    void run(async () => {
      const { message } = await apiRequest('/auth/password/reset', { method: 'POST', body: { target, code, password }, auth: false });
      toast.show(message);
      router.replace('/login');
    });
  }

  if (!sent) {
    return (
      <form onSubmit={submitTarget} noValidate className="space-y-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <Field label={t('auth.identifier')} error={errors.target} hint={t('auth.phoneHint')} required>
          {(field) => <Input {...field} value={target} onChange={(e) => setTarget(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus />}
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          {t('auth.sendCode')}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitReset} noValidate className="space-y-4">
      <Alert tone="info">{notice}</Alert>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label={t('auth.otpCode')} error={errors.code} required>
        {(field) => <CodeInput {...field} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}
      </Field>
      <Field label={t('auth.newPassword')} error={errors.password} hint={t('auth.passwordHint')} required>
        {(field) => <PasswordInput {...field} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}
      </Field>
      <Field label={t('auth.confirmPassword')} error={errors.confirm} required>
        {(field) => <PasswordInput {...field} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />}
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        {t('common.save')}
      </Button>
      <div className="text-center">
        <ResendButton seconds={sent.resendIn} onResend={sendCode} />
      </div>
    </form>
  );
}
