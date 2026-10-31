import { formatMoney, localizeDigits, MAX_CART_QUANTITY, radius, spacing, type CartItem } from '@boikonika/shared';
import { router, type Href } from 'expo-router';
import { Minus, Plus, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale, useTranslations } from 'use-intl';
import { Cover } from '@/components/books';
import { useToast } from '@/components/toast';
import { Button, Card, EmptyState, Heading, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/lib/theme';

function Stepper({ item, onChange, disabled }: { item: CartItem; onChange: (q: number) => void; disabled: boolean }) {
  const t = useTranslations('cart');
  const { c } = useTheme();
  const locale = useLocale();
  const max = Math.min(MAX_CART_QUANTITY, Math.max(item.available, 1));
  const button = (Icon: typeof Plus, label: string, next: number, off: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={off || disabled} onPress={() => onChange(next)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: off || disabled ? 0.4 : 1 }}>
      <Icon size={18} color={c.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.borderInput, borderRadius: radius.md }} accessibilityLabel={t('quantityOf', { title: item.title })}>
      {button(Minus, t('decrease'), item.quantity - 1, item.quantity <= 1)}
      <Text weight="semibold" style={{ minWidth: 28, textAlign: 'center' }}>
        {localizeDigits(item.quantity, locale)}
      </Text>
      {button(Plus, t('increase'), item.quantity + 1, item.quantity >= max)}
    </View>
  );
}

function Line({ item }: { item: CartItem }) {
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      toast(errorMessage(error, t), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const href = (item.bookSlug ? `/books/${item.bookSlug}` : null) as Href | null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[3] }}>
      <Pressable accessibilityRole="link" accessibilityLabel={item.title} disabled={!href} onPress={() => href && router.push(href)}>
        <Cover uri={item.imageUrl} title={item.title} width={64} rounded={radius.sm} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Text weight="semibold" numberOfLines={2}>
          {item.title}
        </Text>
        <Text size="xs" tone="muted">
          {item.isDigital ? t('digital.ebook') : item.condition ? t(`book.conditions.${item.condition}` as 'book.conditions.new') : item.variantName}
        </Text>
        <Text weight="bold">{formatMoney(item.lineTotal, locale, { hideZeroDecimals: true })}</Text>
        {item.state === 'unavailable' ? (
          <Text size="sm" tone="danger">
            {t('cart.unavailable')}
          </Text>
        ) : item.state === 'insufficient' ? (
          <Text size="sm" tone="danger">
            {t('cart.onlyLeft', { count: item.available })}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap', marginTop: spacing[1] }}>
          {item.savedForLater ? (
            <Button small variant="outline" title={t('cart.moveToCart')} disabled={busy} onPress={() => run(() => cart.update(item.variantId, { savedForLater: false }))} />
          ) : (
            <>
              {item.isDigital ? null : <Stepper item={item} disabled={busy} onChange={(quantity) => run(() => cart.update(item.variantId, { quantity }))} />}
              <Button small variant="ghost" title={t('cart.saveForLater')} disabled={busy} onPress={() => run(() => cart.update(item.variantId, { savedForLater: true }))} />
            </>
          )}
          <Button small variant="ghost" title={t('cart.remove')} disabled={busy} onPress={() => run(() => cart.remove(item.variantId))} />
        </View>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const t = useTranslations();
  const locale = useLocale();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { cart, loading, reload } = useCart();
  const { status } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  if (loading && !cart) return <Loading />;
  const empty = !cart || (cart.groups.length === 0 && cart.saved.length === 0);
  const hasItems = !!cart && cart.summary.itemCount > 0;

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={async () => (setRefreshing(true), await reload(), setRefreshing(false))} style={{ paddingBottom: insets.bottom + 120 }}>
        {empty ? (
          <EmptyState icon={ShoppingCart} title={t('cart.empty')} text={t('cart.emptyText')} action={<Button small title={t('cart.continueShopping')} onPress={() => router.push('/books')} />} />
        ) : (
          <>
            {cart.summary.hasProblems ? (
              <Card style={{ backgroundColor: c.warningSoft, borderColor: c.warningSoft }}>
                <Text size="sm" style={{ color: c.warningSoftFg }}>
                  {t('cart.problems')}
                </Text>
              </Card>
            ) : null}
            {cart.groups.map((g) => (
              <Card key={g.seller.id}>
                <Text size="sm" tone="muted">
                  {t('book.soldBy', { seller: g.seller.name })}
                </Text>
                {g.items.map((item, i) => (
                  <View key={item.variantId} style={i ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
                    <Line item={item} />
                  </View>
                ))}
              </Card>
            ))}
            {cart.saved.length ? (
              <View style={{ gap: spacing[2] }}>
                <Heading level={3}>{t('cart.savedForLater', { count: cart.saved.length })}</Heading>
                <Card>
                  {cart.saved.map((item, i) => (
                    <View key={item.variantId} style={i ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
                      <Line item={item} />
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}
            <Text size="sm" tone="muted">
              {t('cart.shippingAtCheckout')}
            </Text>
          </>
        )}
      </Screen>
      {hasItems ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: insets.bottom + spacing[3], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text tone="muted">
              {t('cart.subtotal')} · {t('cart.itemCount', { count: cart.summary.itemCount })}
            </Text>
            <Text weight="bold">{formatMoney(cart.summary.subtotal, locale, { hideZeroDecimals: true })}</Text>
          </View>
          <Button title={status === 'authenticated' ? t('cart.checkout') : t('checkout.signIn')} disabled={cart.summary.hasProblems} onPress={() => router.push(status === 'authenticated' ? '/checkout' : '/login')} />
        </View>
      ) : null}
    </View>
  );
}
