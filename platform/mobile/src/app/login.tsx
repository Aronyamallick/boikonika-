import { normalizeOtp, parseContact, spacing, type AuthResult, type OtpSentResult, type TwoFactorChallenge } from '@boikonika/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { CodeInput, PasswordInput } from '@/components/auth-form';
import { Chips } from '@/components/chips';
import { useToast } from '@/components/toast';
import { Button, Field, Heading, Input, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage, fieldErrors } from '@/lib/errors';

type Mode = 'password' | 'code';

export default function LoginScreen() {
  const t = useTranslations();
  const toast = useToast();
  const { status, device, complete } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<OtpSentResult | null>(null);
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && !busy) router.canGoBack() ? router.back() : router.replace('/');
  }, [status, busy]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    try {
      await fn();
    } catch (error) {
      setErrors(fieldErrors(error));
      toast(errorMessage(error, t), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const finish = async (result: AuthResult | TwoFactorChallenge) => {
    const pending = await complete(result);
    if (pending) return setChallenge(pending);
    toast(t('auth.welcomeBack', { name: (result as AuthResult).user.displayName }));
  };

  const signIn = () => run(async () => finish(await api<AuthResult | TwoFactorChallenge>('/auth/login', { method: 'POST', body: { identifier, password, ...(await device()) } })));
  const sendCode = () =>
    run(async () => {
      if (!parseContact(identifier)) return setErrors({ identifier: t('validation.identifier') });
      setSent(await api<OtpSentResult>('/auth/otp/request', { method: 'POST', body: { target: identifier, purpose: 'login' } }));
    });
  const signInWithCode = () =>
    run(async () => {
      if (!normalizeOtp(code)) return setErrors({ code: t('validation.otp') });
      await finish(await api<AuthResult | TwoFactorChallenge>('/auth/login/otp', { method: 'POST', body: { target: identifier, code, ...(await device()) } }));
    });
  const verify2fa = () =>
    run(async () => {
      if (!challenge) return;
      await finish(await api<AuthResult>('/auth/login/2fa', { method: 'POST', body: { challengeToken: challenge.challengeToken, ...(recovery ? { recoveryCode: code } : { code }) } }));
    });

  if (challenge)
    return (
      <Screen>
        <Heading level={2}>{t('auth.twoFactorTitle')}</Heading>
        <Text tone="muted">{recovery ? t('security.recoveryText') : t('auth.twoFactorText')}</Text>
        <Field label={recovery ? t('auth.recoveryCode') : t('auth.authCode')} error={errors.code ?? errors.recoveryCode}>
          {(a) => (recovery ? <Input {...a} value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ABCD-1234" autoFocus /> : <CodeInput {...a} value={code} onChangeText={setCode} autoFocus />)}
        </Field>
        <Button title={t('auth.verify')} loading={busy} onPress={verify2fa} />
        <Button variant="ghost" title={recovery ? t('auth.useAuthenticator') : t('auth.twoFactorRecovery')} onPress={() => (setRecovery((r) => !r), setCode(''))} />
        <Button variant="ghost" title={t('auth.backToLogin')} onPress={() => (setChallenge(null), setCode(''))} />
      </Screen>
    );

  return (
    <Screen>
      <View style={{ gap: spacing[1] }}>
        <Heading level={1}>{t('auth.loginTitle')}</Heading>
        <Text tone="muted">{t('auth.loginSubtitle')}</Text>
      </View>
      <Chips label={t('auth.loginTitle')} value={mode} onChange={(m) => (setMode(m), setErrors({}))} options={[{ value: 'password', label: t('auth.loginWithPassword') }, { value: 'code', label: t('auth.loginWithCode') }]} />
      <Field label={t('auth.identifier')} hint={mode === 'code' ? t('auth.phoneHint') : undefined} error={errors.identifier} required>
        {(a) => <Input {...a} invalid={a.invalid} value={identifier} onChangeText={(v) => (setIdentifier(v), setSent(null))} autoComplete="username" textContentType="username" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!sent} />}
      </Field>
      {mode === 'password' ? (
        <>
          <Field label={t('auth.password')} error={errors.password} required>
            {(a) => <PasswordInput {...a} invalid={a.invalid} value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" onSubmitEditing={signIn} />}
          </Field>
          <Pressable accessibilityRole="link" onPress={() => router.push('/forgot-password')} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <Text weight="semibold" tone="primary">
              {t('auth.forgotPassword')}
            </Text>
          </Pressable>
          <Button title={t('auth.loginButton')} loading={busy} onPress={signIn} />
        </>
      ) : (
        <>
          <Text size="sm" tone="muted">
            {sent ? t('auth.codeSentTo', { target: sent.sentTo }) : t('auth.codeLoginText')}
          </Text>
          {sent ? (
            <>
              <Field label={t('auth.otpCode')} error={errors.code}>
                {(a) => <CodeInput {...a} invalid={a.invalid} value={code} onChangeText={setCode} autoFocus />}
              </Field>
              <Button title={t('auth.loginButton')} loading={busy} onPress={signInWithCode} />
              <Button variant="ghost" title={t('auth.changeContact')} onPress={() => (setSent(null), setCode(''))} />
            </>
          ) : (
            <Button title={t('auth.sendCode')} loading={busy} onPress={sendCode} />
          )}
        </>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1], flexWrap: 'wrap' }}>
        <Text tone="muted">{t('auth.noAccount')}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/register')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text weight="semibold" tone="primary">
            {t('auth.newToBoikonika')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
