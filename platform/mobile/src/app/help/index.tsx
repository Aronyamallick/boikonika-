import { radius, spacing, type ArticleCard, type Faq } from '@boikonika/shared';
import { router, Stack, type Href } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { SectionHeader } from '@/components/books';
import { Markdown } from '@/components/markdown';
import { Button, Card, ErrorState, Input, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useLocalized } from '@/lib/format';
import { openLink } from '@/lib/links';
import { useTheme } from '@/lib/theme';
import { useApi } from '@/lib/use-api';

function FaqItem({ faq }: { faq: Faq }) {
  const { c } = useTheme();
  const localized = useLocalized();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 52, paddingVertical: spacing[2] }}>
        <Text weight="semibold" style={{ flex: 1 }}>
          {localized(faq.question)}
        </Text>
        {open ? <ChevronUp size={18} color={c.textMuted} /> : <ChevronDown size={18} color={c.textMuted} />}
      </Pressable>
      {open ? (
        <View style={{ paddingBottom: spacing[3] }}>
          <Markdown source={localized(faq.answer)} />
        </View>
      ) : null}
    </View>
  );
}

export default function HelpScreen() {
  const t = useTranslations('help');
  const tAll = useTranslations();
  const faqs = useApi<Faq[]>('/faqs', { persist: true });
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ faqs: Faq[]; articles: ArticleCard[] } | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const search = () => {
    if (q.trim().length < 2) return setResults(null);
    api<{ faqs: Faq[]; articles: ArticleCard[] }>('/help/search', { query: { q } }).then((r) => (setResults(r), setSearchFailed(false)), () => setSearchFailed(true));
  };
  const groups = (faqs.data ?? []).reduce<Record<string, Faq[]>>((acc, f) => ((acc[f.category] ??= []).push(f), acc), {});

  return (
    <Screen refreshing={faqs.refreshing} onRefresh={faqs.reload}>
      <Stack.Screen options={{ title: t('eyebrow') }} />
      <Input value={q} onChangeText={setQ} onSubmitEditing={search} placeholder={t('searchPlaceholder')} accessibilityLabel={t('searchLabel')} returnKeyType="search" style={{ borderRadius: radius.full, paddingHorizontal: spacing[4] }} />
      {searchFailed ? <Text tone="danger">{t('searchError')}</Text> : null}
      {results ? (
        <View style={{ gap: spacing[2] }}>
          <Text size="sm" tone="muted">
            {t('resultCount', { count: results.faqs.length + results.articles.length })}
          </Text>
          {results.articles.map((a) => (
            <Card key={a.id} onPress={() => router.push(`/help/${a.slug}` as Href)} accessibilityLabel={a.title}>
              <Text weight="semibold">{a.title}</Text>
              <Text size="sm" tone="muted" numberOfLines={2}>
                {a.excerpt}
              </Text>
            </Card>
          ))}
          {results.faqs.map((f) => (
            <FaqItem key={f.id} faq={f} />
          ))}
          {!results.faqs.length && !results.articles.length ? <Button small variant="outline" title={t('askUs')} onPress={() => void openLink('/contact')} style={{ alignSelf: 'flex-start' }} /> : null}
        </View>
      ) : null}
      {faqs.offline ? <OfflineNotice /> : null}
      {faqs.loading && !faqs.data ? <Loading /> : null}
      {faqs.error && !faqs.data ? <ErrorState offline={faqs.error.code === 'NETWORK'} onRetry={faqs.reload} /> : null}
      {Object.entries(groups).map(([category, items]) => (
        <View key={category}>
          <SectionHeader title={tAll.has(`help.categories.${category}`) ? t(`categories.${category}` as 'categories.general') : category} />
          {items.map((f) => (
            <FaqItem key={f.id} faq={f} />
          ))}
        </View>
      ))}
      <Card style={{ gap: spacing[2] }}>
        <Text weight="semibold">{t('stillStuck')}</Text>
        <Text size="sm" tone="muted">
          {t('stillStuckText')}
        </Text>
        <Button small title={tAll('nav.contact')} onPress={() => void openLink('/contact')} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </Screen>
  );
}
