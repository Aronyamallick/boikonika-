import { LIBRARY_SHELVES, localizeDigits, radius, spacing, type BookDetail, type BookOffer, type DownloadLink, type LibraryShelf } from '@boikonika/shared';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, Download, Heart, ShoppingCart } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale, useTranslations } from 'use-intl';
import { BookCard, Cover, Price, Rating, Shelf } from '@/components/books';
import { Chips } from '@/components/chips';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, ErrorState, Heading, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { api, apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { errorMessage } from '@/lib/errors';
import { useLocalized } from '@/lib/format';
import { openLink } from '@/lib/links';
import { useTheme } from '@/lib/theme';
import { useApi } from '@/lib/use-api';

type ShelfInfo = { shelf: LibraryShelf; percent: number; hasDigitalAccess: boolean } | null;

function OfferRow({ offer, book, onAdd, adding }: { offer: BookOffer; book: BookDetail; onAdd: (o: BookOffer) => void; adding: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = book.formats.find((f) => f.id === offer.formatId);
  const soldOut = !offer.isDigital && offer.stock <= 0;
  return (
    <View style={{ gap: spacing[2], paddingVertical: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: spacing[1], flexWrap: 'wrap' }}>
            {offer.isDigital ? <Badge label={t('digital.ebook')} tone="primary" /> : <Badge label={t(`book.conditions.${offer.condition}` as 'book.conditions.new')} tone={offer.condition === 'new' ? 'neutral' : 'secondary'} />}
            {format && !offer.isDigital ? <Badge label={t(`book.formats.${format.format}` as 'book.formats.paperback')} /> : null}
          </View>
          <Text size="sm" tone="muted">
            {t('book.soldBy', { seller: offer.store.name })}
            {offer.store.district ? ` · ${offer.store.district}` : ''}
          </Text>
          {offer.conditionNote ? (
            <Text size="xs" tone="subtle">
              {offer.conditionNote}
            </Text>
          ) : null}
          {!offer.isDigital && offer.stock > 0 && offer.stock <= 5 ? (
            <Text size="xs" tone="danger">
              {t('common.onlyLeft', { count: offer.stock })}
            </Text>
          ) : null}
        </View>
        <Price amount={offer.price} compareAt={offer.compareAtPrice} />
      </View>
      <Button small title={soldOut ? t('cart.outOfStock') : t('cart.addToCart')} icon={ShoppingCart} disabled={soldOut || !offer.variantId} loading={adding} onPress={() => onAdd(offer)} />
    </View>
  );
}

export default function BookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const localized = useLocalized();
  const toast = useToast();
  const cart = useCart();
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  const book = useApi<BookDetail>(`/books/${slug}`, { persist: true });
  const [shelf, setShelf] = useState<ShelfInfo>(null);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const data = book.data;

  const loadMine = useCallback(() => {
    if (!signedIn || !data) return;
    api<ShelfInfo>(`/me/library/${data.id}`).then(setShelf, () => undefined);
    api<{ books: string[] }>('/me/wishlist/contains', { query: { books: data.id } }).then((r) => setSaved(r.books.includes(data.id)), () => undefined);
  }, [signedIn, data]);
  useEffect(loadMine, [loadMine]);

  const best = useMemo(() => data?.offers.filter((o) => o.variantId && (o.isDigital || o.stock > 0)).sort((a, b) => Number(a.price) - Number(b.price))[0], [data]);

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        {book.loading ? <Loading /> : <ErrorState offline={book.error?.code === 'NETWORK'} onRetry={book.reload} />}
      </Screen>
    );
  }

  const authors = data.contributors.filter((p) => p.role === 'author');
  const needAccount = () => {
    if (signedIn) return false;
    router.push('/login');
    return true;
  };
  const add = async (offer: BookOffer) => {
    if (!offer.variantId) return;
    setAdding(offer.variantId);
    try {
      toast(await cart.add(offer.variantId, 1));
    } catch (error) {
      toast(errorMessage(error, t), 'danger');
    } finally {
      setAdding(null);
    }
  };
  const act = async (fn: () => Promise<string | undefined>) => {
    setBusy(true);
    try {
      const message = await fn();
      if (message) toast(message);
    } catch (error) {
      toast(errorMessage(error, t), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const toggleWishlist = () =>
    !needAccount() &&
    act(async () => {
      const res = await apiRequest(`/me/wishlist/books/${data.id}`, { method: saved ? 'DELETE' : 'PUT' });
      setSaved(!saved);
      return res.message;
    });
  const putOnShelf = (next: LibraryShelf) =>
    act(async () => {
      const res = await apiRequest(`/me/library/${data.id}`, { method: 'PUT', body: { shelf: next } });
      loadMine();
      return res.message;
    });
  const getFree = () =>
    !needAccount() &&
    act(async () => {
      const res = await apiRequest(`/me/library/${data.id}/free`, { method: 'POST' });
      loadMine();
      return res.message;
    });
  // Signed links expire within minutes, so one is fetched each time and handed to the browser to save.
  const download = () =>
    act(async () => {
      const link = await api<DownloadLink>(`/me/library/${data.id}/download`, { method: 'POST' });
      await WebBrowser.openBrowserAsync(link.url);
      return t('digital.downloadStarted', { file: link.fileName });
    });

  const details: Array<[string, string | null | undefined]> = [
    [t('book.language'), t(`book.languages.${data.language}` as 'book.languages.bn')],
    [t('book.publisher'), data.formats[0]?.publisher?.name],
    [t('book.pages'), data.formats[0]?.pages ? localizeDigits(data.formats[0].pages, locale) : null],
    [t('book.isbn'), data.formats[0]?.isbn13 ?? data.formats[0]?.isbn10],
    [t('book.edition'), data.formats[0]?.edition],
    [t('book.publicationYear'), data.formats[0]?.publicationYear ? localizeDigits(data.formats[0].publicationYear, locale) : null],
  ];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: data.title }} />
      <Screen refreshing={book.refreshing} onRefresh={() => (book.reload(), loadMine())} style={{ paddingBottom: insets.bottom + 96 }}>
        {book.offline ? <OfflineNotice /> : null}
        <View style={{ flexDirection: 'row', gap: spacing[4] }}>
          <Cover uri={data.coverUrl} title={data.title} width={120} />
          <View style={{ flex: 1, gap: spacing[1] }}>
            <Heading level={2}>{data.title}</Heading>
            {data.subtitle ? <Text tone="muted">{data.subtitle}</Text> : null}
            {authors.length ? (
              <Text size="sm">
                {authors.map((a, i) => (
                  <Text key={a.id} size="sm" tone="primary" accessibilityRole="link" onPress={() => void openLink(`/authors/${a.slug}`)}>
                    {i ? ', ' : ''}
                    {a.name}
                  </Text>
                ))}
              </Text>
            ) : null}
            <Rating value={data.rating.average} count={data.rating.count} />
            <View style={{ flexDirection: 'row', gap: spacing[1], flexWrap: 'wrap', marginTop: spacing[1] }}>
              {data.picks.editors ? <Badge label={t('landing.editorsPicks')} tone="accent" /> : null}
              {data.picks.students ? <Badge label={t('landing.studentPicks')} tone="secondary" /> : null}
              {data.picks.teachers ? <Badge label={t('landing.teacherPicks')} tone="secondary" /> : null}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
          <Button small variant="outline" icon={Heart} title={saved ? t('book.inWishlist') : t('book.addToWishlist')} onPress={toggleWishlist} disabled={busy} />
          {data.previews.length || data.tableOfContents?.length ? <Button small variant="outline" icon={BookOpen} title={t('book.preview')} onPress={() => void openLink(`/books/${data.slug}/preview`)} /> : null}
          {shelf?.hasDigitalAccess ? <Button small variant="secondary" icon={Download} title={t('digital.download')} loading={busy} onPress={download} /> : data.digital?.free ? <Button small variant="secondary" icon={Download} title={t('digital.getFree')} loading={busy} onPress={getFree} /> : null}
        </View>

        {signedIn ? (
          <View style={{ gap: spacing[2] }}>
            <Text size="sm" weight="semibold">
              {shelf ? t('library.shelfFor') : t('library.addToLibrary')}
            </Text>
            <Chips label={t('library.shelfFor')} value={shelf?.shelf ?? ('' as LibraryShelf)} onChange={putOnShelf} options={LIBRARY_SHELVES.filter((s) => s !== 'purchased').map((s) => ({ value: s, label: t(`library.shelves.${s}`) }))} />
          </View>
        ) : null}

        <Card>
          <Heading level={3}>{t('book.offers')}</Heading>
          {data.offers.length ? (
            data.offers.map((o, i) => (
              <View key={`${o.productId}:${o.variantId}`} style={i ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
                <OfferRow offer={o} book={data} onAdd={add} adding={adding === o.variantId} />
              </View>
            ))
          ) : (
            <Text tone="muted" style={{ marginTop: spacing[2] }}>
              {t('catalog.unavailable')}
            </Text>
          )}
        </Card>

        {data.description ? (
          <View style={{ gap: spacing[2] }}>
            <Heading level={3}>{t('book.description')}</Heading>
            <Text numberOfLines={expanded ? undefined : 6}>{data.description}</Text>
            {data.description.length > 300 ? (
              <Pressable accessibilityRole="button" onPress={() => setExpanded((e) => !e)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text weight="semibold" tone="primary">
                  {expanded ? t('common.seeLess') : t('common.seeMore')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: spacing[2] }}>
          <Heading level={3}>{t('book.details')}</Heading>
          {details
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <View key={label} style={{ flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[1], borderBottomWidth: 1, borderBottomColor: c.border }}>
                <Text size="sm" tone="muted" style={{ width: 120 }}>
                  {label}
                </Text>
                <Text size="sm" style={{ flex: 1 }}>
                  {value}
                </Text>
              </View>
            ))}
        </View>

        {data.categories.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {data.categories.map((cat) => (
              <Pressable key={cat.path} accessibilityRole="link" onPress={() => router.push(`/categories/${cat.path}` as Href)} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radius.full, backgroundColor: c.bgSubtle }}>
                <Text size="sm">{localized(cat.name)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Shelf title={t('book.similar')} items={data.related} keyOf={(b) => b.id} renderItem={(b) => <BookCard book={b} />} />
      </Screen>

      {best ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: insets.bottom + spacing[3], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <View style={{ flex: 1 }}>
            <Price amount={best.price} compareAt={best.compareAtPrice} size="lg" />
            <Text size="xs" tone="muted" numberOfLines={1}>
              {t('book.soldBy', { seller: best.store.name })}
            </Text>
          </View>
          <Button title={t('cart.addToCart')} icon={ShoppingCart} loading={adding === best.variantId} onPress={() => add(best)} />
        </View>
      ) : null}
    </View>
  );
}
