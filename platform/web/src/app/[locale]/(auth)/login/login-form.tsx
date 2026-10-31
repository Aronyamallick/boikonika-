'use client';

import { normalizeOtp, parseContact, parseIdentifier, type AuthResult, type OtpSentResult, type TwoFactorChallenge } from '@boikonika/shared';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { CodeInput } from '@/components/auth/code-input';
import { GoogleButton } from '@/components/auth/google-button';
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

type Mode = 'password' | 'code';

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const { status, signedIn } = useAuth();
  const toast = useToast();
  const { fromChecks, fromApi } = useFormErrors();

  const [mode, setMode] = useState<Mode>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState<OtpSentResult | null>(null);
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && !busy) router.replace(next);
  }, [status, busy, next, router]);

  const finish = useCallback(
    (result: AuthResult | TwoFactorChallenge) => {
      if ('twoFactorRequired' in result) {
        setChallenge(result);
        setCode('');
        setErrors({});
        setFormError('');
        return;
      }
      signedIn(result);
      toast.show(t('auth.welcomeBack', { name: result.user.displayName }));
      router.replace(next);
    },
    [next, router, signedIn, t, toast],
  );

  const fail = useCallback(
    (error: unknown) => {
      const { fields, message } = fromApi(error);
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
    },
    [fromApi],
  );

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setFormError('');
    try {
      await task();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  const device = () => ({ deviceId: deviceId(), client: 'web' as const, rememberDevice: remember });

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    const invalid = fromChecks({ identifier: !parseIdentifier(identifier) && 'validation.identifier', password: !password && 'validation.required' });
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    void run(async () => finish(await api<AuthResult | TwoFactorChallenge>('/auth/login', { method: 'POST', body: { identifier, password, ...device() } })));
  }

  async function sendCode(): Promise<number | void> {
    if (!parseContact(identifier)) {
      setErrors({ identifier: t('validation.identifier') });
      return;
    }
    setErrors({});
    const sent = await api<OtpSentResult>('/auth/otp/request', { method: 'POST', body: { target: identifier, purpose: 'login' } });
    setCodeSent(sent);
    return sent.resendIn;
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!codeSent) return void run(async () => void (await sendCode()));
    if (!normalizeOtp(code)) return setErrors({ code: t('validation.otp') });
    void run(async () => finish(await api<AuthResult | TwoFactorChallenge>('/auth/login/otp', { method: 'POST', body: { target: identifier, code, ...device() } })));
  }

  function submitTwoFactor(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    if (!useRecovery && !normalizeOtp(code)) return setErrors({ code: t('validation.otp') });
    void run(async () =>
      finish(await api<AuthResult>('/auth/login/2fa', { method: 'POST', body: { challengeToken: challenge.challengeToken, ...(useRecovery ? { recoveryCode: code } : { code }) } })),
    );
  }

  if (challenge) {
    return (
      <form onSubmit={submitTwoFactor} noValidate className="space-y-5">
        <div>
          <h2 className="text-lg font-bold">{t('auth.twoFactorTitle')}</h2>
          <p className="mt-1 text-sm text-fg-muted">{useRecovery ? t('security.recoveryText') : t('auth.twoFactorText')}</p>
        </div>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <Field label={useRecovery ? t('auth.recoveryCode') : t('auth.authCode')} error={errors.code ?? errors.recoveryCode}>
          {(field) =>
            useRecovery ? (
              <Input {...field} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="ABCD-1234" autoFocus />
            ) : (
              <CodeInput {...field} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            )
          }
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          {t('auth.verify')}
        </Button>
        <div className="flex justify-between gap-3 text-sm">
          <Button variant="link" onClick={() => (setUseRecovery((v) => !v), setCode(''), setErrors({}))}>
            {useRecovery ? t('auth.useAuthenticator') : t('auth.twoFactorRecovery')}
          </Button>
          <Button variant="link" onClick={() => (setChallenge(null), setCode(''))}>
            {t('auth.backToLogin')}
          </Button>
        </div>
      </form>
    );
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${active ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'}`;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg bg-subtle p-1" role="group" aria-label={t('auth.loginTitle')}>
        <button type="button" className={tabClass(mode === 'password')} aria-pressed={mode === 'password'} onClick={() => (setMode('password'), setErrors({}), setFormError(''))}>
          {t('auth.loginWithPassword')}
        </button>
        <button type="button" className={tabClass(mode === 'code')} aria-pressed={mode === 'code'} onClick={() => (setMode('code'), setErrors({}), setFormError(''))}>
          {t('auth.loginWithCode')}
        </button>
      </div>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      {mode === 'password' ? (
        <form onSubmit={submitPassword} noValidate className="space-y-4">
          <Field label={t('auth.identifier')} error={errors.identifier} required>
            {(field) => <Input {...field} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} />}
          </Field>
          <Field label={t('auth.password')} error={errors.password} required>
            {(field) => <PasswordInput {...field} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Checkbox label={t('auth.rememberDevice')} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
              {t('auth.forgotPassword')}
            </Link>
          </div>
          <Button type="submit" className="w-full" loading={busy}>
            {t('auth.loginButton')}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate className="space-y-4">
          <p className="text-sm text-fg-muted">{t('auth.codeLoginText')}</p>
          <Field label={t('auth.identifier')} error={errors.identifier} required hint={t('auth.phoneHint')}>
            {(field) => (
              <div className="flex gap-2">
                <Input {...field} value={identifier} onChange={(e) => (setIdentifier(e.target.value), setCodeSent(null))} autoComplete="username" autoCapitalize="none" spellCheck={false} readOnly={!!codeSent} />
                {codeSent ? (
                  <Button variant="outline" onClick={() => (setCodeSent(null), setCode(''))}>
                    {t('auth.changeContact')}
                  </Button>
                ) : null}
              </div>
            )}
          </Field>
          {codeSent ? (
            <>
              <p className="text-sm text-fg-muted" aria-live="polite">
                {t('auth.codeSentTo', { target: codeSent.sentTo })}
              </p>
              <Field label={t('auth.otpCode')} error={errors.code}>
                {(field) => <CodeInput {...field} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}
              </Field>
              <ResendButton seconds={codeSent.resendIn} onResend={sendCode} />
            </>
          ) : null}
          <Button type="submit" className="w-full" loading={busy}>
            {codeSent ? t('auth.loginButton') : t('auth.sendCode')}
          </Button>
        </form>
      )}

      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
        <>
          <div className="flex items-center gap-3 text-xs text-fg-subtle" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {t('auth.orContinueWith')}
            <span className="h-px flex-1 bg-line" />
          </div>
          <GoogleButton onResult={finish} onError={fail} />
        </>
      ) : null}
    </div>
  );
}
