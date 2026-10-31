import { formatMoney, localizeDigits, radius, spacing, type BookCardData } from '@boikonika/shared';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { BookOpen, Star } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { useTheme } from '@/lib/theme';
import { Badge, Heading, Text } from './ui';

/** A book cover, or a calm placeholder with the title when the book has no cover yet. */
export function Cover({ uri, title, width, rounded = radius.md }: { uri: string | null | undefined; title: string; width: number; rounded?: number }) {
  const { c } = useTheme();
  const height = Math.round(width * 1.5);
  if (!uri) {
    return (
      <View style={{ width, height, borderRadius: rounded, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', padding: spacing[2] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <BookOpen size={Math.min(28, width / 3)} color={c.primarySoftFg} />
        {width > 70 ? (
          <Text size="xs" weight="semibold" numberOfLines={3} style={{ color: c.primarySoftFg, textAlign: 'center', marginTop: spacing[1] }}>
            {title}
          </Text>
        ) : null}
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width, height, borderRadius: rounded, backgroundColor: c.skeleton }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors alt="" />;
}

export function Price({ amount, compareAt, size = 'base' }: { amount: string; compareAt?: string | null; size?: 'sm' | 'base' | 'lg' | 'xl' }) {
  const locale = useLocale();
  const showCompare = compareAt && Number(compareAt) > Number(amount);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], flexWrap: 'wrap' }}>
      <Text size={size} weight="bold">
        {formatMoney(amount, locale, { hideZeroDecimals: true })}
      </Text>
      {showCompare ? (
        <Text size="xs" tone="subtle" style={{ textDecorationLine: 'line-through' }}>
          {formatMoney(compareAt, locale, { hideZeroDecimals: true })}
        </Text>
      ) : null}
    </View>
  );
}

export function Rating({ value, count }: { value: number; count: number }) {
  const { c } = useTheme();
  const t = useTranslations('book');
  const locale = useLocale();
  if (!count) return null;
  const rating = localizeDigits(value.toFixed(1), locale);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`${t('rating', { rating })}, ${t('ratingsCount', { count })}`}>
      <Star size={13} color={c.accent} fill={c.accent} />
      <Text size="xs" tone="muted">
        {rating} ({localizeDigits(count, locale)})
      </Text>
    </View>
  );
}

function BookPrice({ book }: { book: BookCardData }) {
  const t = useTranslations();
  const locale = useLocale();
  if (book.minPrice && book.inStock) {
    if (book.offerCount > 1)
      return (
        <Text size="sm" tone="muted">
          {t.rich('catalog.from', { price: formatMoney(book.minPrice, locale, { hideZeroDecimals: true }), b: (chunks) => <Text size="sm" weight="bold">{chunks}</Text> })}
        </Text>
      );
    return <Price amount={book.minPrice} compareAt={book.compareAtPrice} size="sm" />;
  }
  if (book.isFree)
    return (
      <Text size="sm" weight="bold" tone="success">
        {t('common.free')}
      </Text>
    );
  return (
    <Text size="xs" tone="subtle">
      {t('catalog.unavailable')}
    </Text>
  );
}

const openBook = (slug: string) => router.push(`/books/${slug}` as Href);

/** A book tile for shelves: one tap target named by the title and authors. */
export function BookCard({ book, width = 128 }: { book: BookCardData; width?: number }) {
  const t = useTranslations();
  const authors = book.authors.map((a) => a.name).join(', ');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={authors ? `${book.title}, ${t('common.by', { name: authors })}` : book.title}
      onPress={() => openBook(book.slug)}
      style={({ pressed }) => ({ width, gap: 4, opacity: pressed ? 0.8 : 1 })}
    >
      <Cover uri={book.coverUrl} title={book.title} width={width} />
      <Text size="sm" weight="semibold" numberOfLines={2} style={{ marginTop: spacing[1] }}>
        {book.title}
      </Text>
      {authors ? (
        <Text size="xs" tone="muted" numberOfLines={1}>
          {authors}
        </Text>
      ) : null}
      <Rating value={book.ratingAvg} count={book.ratingCount} />
      <BookPrice book={book} />
    </Pressable>
  );
}

/** A book as a list row (search results, category lists). */
export function BookRow({ book }: { book: BookCardData }) {
  const t = useTranslations();
  const { c } = useTheme();
  const authors = book.authors.map((a) => a.name).join(', ');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={authors ? `${book.title}, ${t('common.by', { name: authors })}` : book.title}
      onPress={() => openBook(book.slug)}
      style={({ pressed }) => ({ flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border, opacity: pressed ? 0.8 : 1 })}
    >
      <Cover uri={book.coverUrl} title={book.title} width={64} rounded={radius.sm} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold" numberOfLines={2}>
          {book.title}
        </Text>
        {authors ? (
          <Text size="sm" tone="muted" numberOfLines={1}>
            {authors}
          </Text>
        ) : null}
        <Rating value={book.ratingAvg} count={book.ratingCount} />
        <View style={{ flexDirection: 'row', gap: spacing[1], flexWrap: 'wrap' }}>
          {book.isFree ? <Badge label={t('catalog.freeBadge')} tone="success" /> : null}
          {book.hasUsed ? <Badge label={t('catalog.used')} tone="secondary" /> : null}
        </View>
        <BookPrice book={book} />
      </View>
    </Pressable>
  );
}

/** A titled, horizontally scrolling row, with an optional "View all". */
export function Shelf<T>({ title, subtitle, items, renderItem, keyOf, onViewAll, itemWidth = 128 }: { title: string; subtitle?: string; items: T[]; renderItem: (item: T) => ReactNode; keyOf: (item: T) => string; onViewAll?: () => void; itemWidth?: number }) {
  const t = useTranslations('common');
  if (!items.length) return null;
  return (
    <View style={{ gap: spacing[3] }}>
      <SectionHeader title={title} subtitle={subtitle} actionLabel={onViewAll ? t('viewAll') : undefined} onAction={onViewAll} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={keyOf}
        renderItem={({ item }) => <View style={{ width: itemWidth }}>{renderItem(item)}</View>}
        ItemSeparatorComponent={() => <View style={{ width: spacing[3] }} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing[4] }}
        style={{ marginHorizontal: -spacing[4] }}
        initialNumToRender={4}
      />
    </View>
  );
}

export function SectionHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3] }}>
      <View style={{ flex: 1 }}>
        <Heading level={3}>{title}</Heading>
        {subtitle ? (
          <Text size="sm" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text size="sm" weight="semibold" tone="primary">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
