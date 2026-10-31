import { router } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { spacing } from '@boikonika/shared';
import { Button, EmptyState } from './ui';

/** Shown in place of screens that need an account. */
export function SignInPrompt({ title, text }: { title?: string; text?: string }) {
  const t = useTranslations();
  return (
    <EmptyState
      icon={LogIn}
      title={title ?? t('auth.loginRequired')}
      text={text ?? t('landing.ctaText')}
      action={
        <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>
          <Button title={t('nav.login')} small onPress={() => router.push('/login')} />
          <Button title={t('nav.register')} small variant="outline" onPress={() => router.push('/register')} />
        </View>
      }
    />
  );
}
