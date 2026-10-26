import { radius, spacing, type BookCardData, type CategoryDetail } from '@boikonika/shared';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { useTranslations } from 'use-intl';
import { BookRow } from '@/components/books';
import { List } from '@/components/list';
import { EmptyState, ErrorState, Loading, OfflineNotice, Text } from '@/components/ui';
import { useLocalized } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useApi, useInfinite } from '@/lib/use-api';

export default function CategoryScreen() {
  const { path: segments } = useLocalSearchParams<{ path: string[] }>();
  const path = (Array.isArray(segments) ? segments : [segments]).join('/');
  const t = useTranslations();
  const { c } = useTheme();
  const localized = useLocalized();
  const category = useApi<CategoryDetail>(`/categories/${path}`, { persist: true });
  const books = useInfinite<BookCardData>('/books', { persist: true, query: { category: path, sort: 'popular', pageSize: 24 } });

  return (
    <>
      <Stack.Screen options={{ title: category.data ? localized(category.data.name) : '' }} />
      <List
        data={books.items}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BookRow book={item} />}
        gap={0}
        refreshing={books.refreshing}
        onRefresh={() => (category.reload(), books.reload())}
        onEndReached={books.loadMore}
        loadingMore={books.loadingMore}
        header={
          <>
            {books.offline ? <OfflineNotice /> : null}
            {category.data?.description ? (
              <Text tone="muted" style={{ marginBottom: spacing[3] }}>
                {localized(category.data.description)}
              </Text>
            ) : null}
            {category.data?.children.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[3] }}>
                {category.data.children.map((child) => (
                  <Pressable key={child.path} accessibilityRole="link" onPress={() => router.push(`/categories/${child.path}` as Href)} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radius.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
                    <Text size="sm">{localized(child.name)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </>
        }
        empty={books.loading ? <Loading /> : books.error ? <ErrorState offline={books.error.code === 'NETWORK'} onRetry={books.reload} /> : <EmptyState title={t('common.empty')} />}
      />
    </>
  );
}
