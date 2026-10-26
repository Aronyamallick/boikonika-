import { normalizeOtp, parseContact, spacing, type AuthResult, type OtpSentResult } from '@boikonika/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { CodeInput, PasswordInput } from '@/components/auth-form';
import { useToast } from '@/components/toast';
import { Button, Field, Heading, Input, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage, fieldErrors } from '@/lib/errors';

function Toggle({ value, onChange, label, error }: { value: boolean; onChange: (v: boolean) => void; label: string; error?: string }) {
  return (
    <View style={{ gap: spacing[1] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
        <Text style={{ flex: 1 }}>{label}</Text>
      </View>
      {error ? (
        <Text size="sm" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Sign-up: details first, then the code sent to the email or phone (proves it is real). */
export default function RegisterScreen() {
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const { status, device, complete } = useAuth();
  const [v, setV] = useState({ name: '', target: '', username: '', password: '', isStudent: false, acceptTerms: false });
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<OtpSentResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(key: K) => (value: (typeof v)[K]) => setV((s) => ({ ...s, [key]: value }));

  useEffect(() => {
    if (status === 'authenticated' && !busy) router.canGoBack() ? router.back() : router.replace('/');
  }, [status, busy]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    try {
      await fn();
    } catch (error) {
      const fields = fieldErrors(error);
      setErrors(fields);
      // Field problems (taken username, weak password) belong to step one.
      if (Object.keys(fields).some((k) => k !== 'code')) setSent(null);
      toast(errorMessage(error, t), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const sendCode = () =>
    run(async () => {
      const local: Record<string, string> = {};
      if (v.name.trim().length < 2) local.name = t('validation.required');
      if (!parseContact(v.target)) local.target = t('validation.identifier');
      if (v.password.length < 8) local.password = t('auth.passwordHint');
      if (!v.acceptTerms) local.acceptTerms = t('validation.acceptTerms');
      if (Object.keys(local).length) return setErrors(local);
      setSent(await api<OtpSentResult>('/auth/otp/request', { method: 'POST', body: { target: v.target, purpose: 'register', locale } }));
    });
  const register = () =>
    run(async () => {
      if (!normalizeOtp(code)) return setErrors({ code: t('validation.otp') });
      const result = await api<AuthResult>('/auth/register', { method: 'POST', body: { ...v, username: v.username.trim() || undefined, acceptTerms: true, code, locale, ...(await device()) } });
      await complete(result);
      toast(t('auth.registerDone'));
    });

  return (
    <Screen>
      <View style={{ gap: spacing[1] }}>
        <Heading level={1}>{t('auth.registerTitle')}</Heading>
        <Text tone="muted">{t('auth.registerSubtitle')}</Text>
      </View>
      {sent ? (
        <>
          <Text>{t('auth.otpSent', { target: sent.sentTo })}</Text>
          <Field label={t('auth.otpCode')} error={errors.code}>
            {(a) => <CodeInput {...a} invalid={a.invalid} value={code} onChangeText={setCode} autoFocus />}
          </Field>
          <Button title={t('auth.registerButton')} loading={busy} onPress={register} />
          <Button variant="ghost" title={t('auth.changeContact')} onPress={() => (setSent(null), setCode(''))} />
        </>
      ) : (
        <>
          <Field label={t('auth.name')} error={errors.name} required>
            {(a) => <Input {...a} invalid={a.invalid} value={v.name} onChangeText={set('name')} autoComplete="name" textContentType="name" />}
          </Field>
          <Field label={t('auth.identifier')} hint={t('auth.phoneHint')} error={errors.target} required>
            {(a) => <Input {...a} invalid={a.invalid} value={v.target} onChangeText={set('target')} autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />}
          </Field>
          <Field label={t('auth.username')} hint={t('auth.usernameHint')} error={errors.username}>
            {(a) => <Input {...a} invalid={a.invalid} value={v.username} onChangeText={set('username')} autoCapitalize="none" autoCorrect={false} />}
          </Field>
          <Field label={t('auth.password')} hint={t('auth.passwordHint')} error={errors.password} required>
            {(a) => <PasswordInput {...a} invalid={a.invalid} value={v.password} onChangeText={set('password')} autoComplete="new-password" textContentType="newPassword" />}
          </Field>
          <Toggle value={v.isStudent} onChange={set('isStudent')} label={t('auth.iAmStudent')} />
          <Toggle value={v.acceptTerms} onChange={set('acceptTerms')} label={t('auth.acceptTerms')} error={errors.acceptTerms} />
          <View style={{ flexDirection: 'row', gap: spacing[4] }}>
            <Pressable accessibilityRole="link" onPress={() => router.push('/pages/terms')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text size="sm" tone="primary">
                {t('nav.terms')}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push('/pages/privacy')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text size="sm" tone="primary">
                {t('nav.privacy')}
              </Text>
            </Pressable>
          </View>
          <Button title={t('auth.sendCode')} loading={busy} onPress={sendCode} />
        </>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1], flexWrap: 'wrap' }}>
        <Text tone="muted">{t('auth.haveAccount')}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text weight="semibold" tone="primary">
            {t('nav.login')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
