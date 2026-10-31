import { router, Stack } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { useTranslations } from 'use-intl';
import { Button, EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  const t = useTranslations('common');
  return (
    <Screen>
      <Stack.Screen options={{ title: t('notFoundTitle') }} />
      <EmptyState icon={Compass} title={t('notFoundTitle')} text={t('notFoundText')} action={<Button small title={t('goHome')} onPress={() => router.replace('/')} />} />
    </Screen>
  );
}
