import { spacing, type CmsPage } from '@boikonika/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useFormatter, useTranslations } from 'use-intl';
import { Markdown } from '@/components/markdown';
import { ErrorState, Heading, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { useLocalized } from '@/lib/format';
import { useApi } from '@/lib/use-api';

/** Terms, privacy and other information pages, written by staff in Markdown. */
export default function InfoPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTranslations('content');
  const format = useFormatter();
  const localized = useLocalized();
  const page = useApi<CmsPage>(`/pages/${slug}`, { persist: true });
  const title = page.data ? localized(page.data.title) : '';
  return (
    <Screen refreshing={page.refreshing} onRefresh={page.reload}>
      <Stack.Screen options={{ title }} />
      {page.offline ? <OfflineNotice /> : null}
      {page.data ? (
        <>
          <Heading level={1}>{title}</Heading>
          <Text size="xs" tone="subtle" style={{ marginTop: -spacing[2] }}>
            {t('updated', { date: format.dateTime(new Date(page.data.updatedAt), { dateStyle: 'long' }) })}
          </Text>
          <Markdown source={localized(page.data.body)} />
        </>
      ) : page.loading ? (
        <Loading />
      ) : (
        <ErrorState offline={page.error?.code === 'NETWORK'} onRetry={page.reload} />
      )}
    </Screen>
  );
}
