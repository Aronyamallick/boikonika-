import { type ArticleDetail } from '@boikonika/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslations } from 'use-intl';
import { Markdown } from '@/components/markdown';
import { ErrorState, Heading, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { useApi } from '@/lib/use-api';

export default function HelpArticle() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTranslations('content');
  const article = useApi<ArticleDetail>(`/articles/${slug}`, { persist: true });
  const a = article.data;
  return (
    <Screen refreshing={article.refreshing} onRefresh={article.reload}>
      <Stack.Screen options={{ title: a?.title ?? '' }} />
      {article.offline ? <OfflineNotice /> : null}
      {a ? (
        <>
          <Heading level={1}>{a.title}</Heading>
          <Text size="xs" tone="subtle">
            {t('readMinutes', { count: a.readMinutes })}
          </Text>
          <Markdown source={a.body} />
        </>
      ) : article.loading ? (
        <Loading />
      ) : (
        <ErrorState offline={article.error?.code === 'NETWORK'} onRetry={article.reload} />
      )}
    </Screen>
  );
}
