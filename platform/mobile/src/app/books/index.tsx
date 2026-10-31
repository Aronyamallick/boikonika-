import { CATALOG_SORTS, type BookCardData } from '@boikonika/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { BookRow } from '@/components/books';
import { Chips } from '@/components/chips';
import { List } from '@/components/list';
import { EmptyState, ErrorState, Loading, OfflineNotice } from '@/components/ui';
import { useInfinite } from '@/lib/use-api';

type Sort = (typeof CATALOG_SORTS)[number];
/** Filters the website's links pass along (shelves on the home page, categories, search). */
const PASSED = ['q', 'category', 'pick', 'free', 'discounted', 'condition', 'minRating', 'language', 'author', 'publisher'] as const;

export default function BooksScreen() {
  const t = useTranslations();
  const params = useLocalSearchParams<Record<string, string>>();
  const [sort, setSort] = useState<Sort>((CATALOG_SORTS as readonly string[]).includes(params.sort ?? '') ? (params.sort as Sort) : params.q ? 'relevance' : 'popular');
  const filters = Object.fromEntries(PASSED.filter((k) => params[k]).map((k) => [k, params[k]!]));
  const books = useInfinite<BookCardData>('/books', { persist: !params.q, query: { ...filters, sort, pageSize: 24 } });
  const sortLabels: Record<string, string> = { relevance: t('search.sortRelevance'), newest: t('search.sortNewest'), price_asc: t('search.sortPriceLow'), price_desc: t('search.sortPriceHigh'), rating: t('search.sortRating'), popular: t('search.sortBestSelling') };

  return (
    <>
      <Stack.Screen options={{ title: params.title ?? t('nav.books') }} />
      <List
        data={books.items}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BookRow book={item} />}
        gap={0}
        refreshing={books.refreshing}
        onRefresh={books.reload}
        onEndReached={books.loadMore}
        loadingMore={books.loadingMore}
        header={
          <>
            <Chips label={t('common.sort')} value={sort} onChange={setSort} options={CATALOG_SORTS.filter((s) => sortLabels[s] && (s !== 'relevance' || params.q)).map((s) => ({ value: s, label: sortLabels[s]! }))} />
            {books.offline ? <OfflineNotice /> : null}
          </>
        }
        empty={books.loading ? <Loading /> : books.error ? <ErrorState offline={books.error.code === 'NETWORK'} onRetry={books.reload} /> : <EmptyState title={t('common.empty')} />}
      />
    </>
  );
}
