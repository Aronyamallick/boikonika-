import { radius, spacing, type SearchResults, type Suggestion } from '@boikonika/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { BookRow, SectionHeader } from '@/components/books';
import { Avatar } from '@/components/community';
import { EmptyState, ErrorState, Input, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { openLink } from '@/lib/links';
import { useTheme } from '@/lib/theme';
import { useApi } from '@/lib/use-api';

/** Search books, authors and ISBNs in Bangla or English, with suggestions while typing. */
export default function SearchScreen() {
  const t = useTranslations();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [query, setQuery] = useState(params.q ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const results = useApi<SearchResults>(query ? '/search' : null, { query: { q: query } });

  useEffect(() => {
    if (text === query) return setSuggestions([]);
    const handle = setTimeout(() => {
      api<{ items: Suggestion[] }>('/search/suggest', { query: { q: text } }).then((r) => setSuggestions(text.trim().length >= 2 ? r.items : []), () => setSuggestions([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [text, query]);

  const submit = (q: string) => {
    setText(q);
    setQuery(q.trim());
    setSuggestions([]);
  };
  const pick = (s: Suggestion) => {
    if (s.kind === 'book') router.push(`/books/${s.slug}`);
    else if (s.kind === 'author') void openLink(`/authors/${s.slug}`);
    else if (s.kind === 'product') void openLink(`/products/${s.slug}`);
    else submit(s.label);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('common.search') }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <View style={{ flex: 1 }}>
          <Input
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => submit(text)}
            placeholder={t('search.placeholder')}
            accessibilityLabel={t('search.placeholder')}
            returnKeyType="search"
            autoFocus={!params.q}
            autoCorrect={false}
            style={{ borderRadius: radius.full, paddingHorizontal: spacing[4], paddingRight: spacing[10] }}
          />
          {text ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.clearFilters')} onPress={() => (setText(''), setQuery(''))} hitSlop={8} style={{ position: 'absolute', right: spacing[3], top: 14 }}>
              <X size={20} color={c.textSubtle} />
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.search')} onPress={() => submit(text)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Search size={20} color={c.primaryFg} />
        </Pressable>
      </View>

      {suggestions.length ? (
        <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
          {suggestions.map((s) => (
            <Pressable key={`${s.kind}:${s.slug}:${s.label}`} accessibilityRole="button" onPress={() => pick(s)} style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing[4], backgroundColor: pressed ? c.bgSubtle : c.surface, borderBottomWidth: 1, borderBottomColor: c.border })}>
              <Text numberOfLines={1}>{s.label}</Text>
              {s.detail ? (
                <Text size="xs" tone="muted" numberOfLines={1}>
                  {s.detail}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {!query ? null : results.loading ? (
        <Loading />
      ) : results.error ? (
        <ErrorState offline={results.error.code === 'NETWORK'} onRetry={results.reload} />
      ) : results.data && !results.data.books.length && !results.data.authors.length ? (
        <EmptyState icon={Search} title={t('search.noResults', { query })} text={t('search.noResultsText')} />
      ) : results.data ? (
        <>
          {results.data.authors.length ? (
            <View style={{ gap: spacing[2] }}>
              <SectionHeader title={t('book.authors')} />
              {results.data.authors.slice(0, 4).map((a) => (
                <Pressable key={a.slug} accessibilityRole="link" onPress={() => void openLink(`/authors/${a.slug}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 52 }}>
                  <Avatar name={a.name} uri={a.photoUrl} />
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold">{a.name}</Text>
                    <Text size="xs" tone="muted">
                      {t('common.books', { count: a.bookCount })}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          {results.data.books.length ? (
            <View>
              <SectionHeader title={t('nav.books')} actionLabel={t('common.viewAll')} onAction={() => router.push(`/books?q=${encodeURIComponent(query)}`)} />
              {results.data.books.map((b) => (
                <BookRow key={b.id} book={b} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
