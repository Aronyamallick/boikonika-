import { normalizeOtp, parseContact, spacing, type OtpSentResult } from '@boikonika/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { CodeInput, PasswordInput } from '@/components/auth-form';
import { useToast } from '@/components/toast';
import { Button, Field, Heading, Input, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage, fieldErrors } from '@/lib/errors';

export default function ForgotPasswordScreen() {
  const t = useTranslations('auth');
  const tAll = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const [target, setTarget] = useState('');
  const [sent, setSent] = useState<OtpSentResult | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    try {
      await fn();
    } catch (error) {
      setErrors(fieldErrors(error));
      toast(errorMessage(error, tAll), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const send = () =>
    run(async () => {
      if (!parseContact(target)) return setErrors({ target: tAll('validation.identifier') });
      setSent(await api<OtpSentResult>('/auth/password/forgot', { method: 'POST', body: { target, locale } }));
    });
  const reset = () =>
    run(async () => {
      if (!normalizeOtp(code)) return setErrors({ code: tAll('validation.otp') });
      await api('/auth/password/reset', { method: 'POST', body: { target, code, password } });
      toast(t('resetDone'));
      router.replace('/login');
    });

  return (
    <Screen>
      <View style={{ gap: spacing[1] }}>
        <Heading level={1}>{t('resetTitle')}</Heading>
        <Text tone="muted">{sent ? t('codeSentTo', { target: sent.sentTo }) : t('resetText')}</Text>
      </View>
      <Field label={t('identifier')} error={errors.target} required>
        {(a) => <Input {...a} invalid={a.invalid} value={target} onChangeText={setTarget} editable={!sent} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="username" />}
      </Field>
      {sent ? (
        <>
          <Field label={t('otpCode')} error={errors.code}>
            {(a) => <CodeInput {...a} invalid={a.invalid} value={code} onChangeText={setCode} />}
          </Field>
          <Field label={t('newPassword')} hint={t('passwordHint')} error={errors.password} required>
            {(a) => <PasswordInput {...a} invalid={a.invalid} value={password} onChangeText={setPassword} autoComplete="new-password" textContentType="newPassword" />}
          </Field>
          <Button title={tAll('common.save')} loading={busy} onPress={reset} />
        </>
      ) : (
        <Button title={t('sendCode')} loading={busy} onPress={send} />
      )}
    </Screen>
  );
}
