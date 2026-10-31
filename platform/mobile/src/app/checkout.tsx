import { formatMoney, radius, spacing, type Address, type CheckoutResult, type Quote, type ShippingOption } from '@boikonika/shared';
import { router, useFocusEffect, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { AddressLines } from '@/components/address';
import { useToast } from '@/components/toast';
import { Button, Card, EmptyState, Field, Heading, Input, Loading, Screen, Text } from '@/components/ui';
import { ApiError, api, apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { errorMessage } from '@/lib/errors';
import { useLocalized } from '@/lib/format';
import { idempotencyKey } from '@/lib/random';
import { useTheme } from '@/lib/theme';
import { SignInPrompt } from '@/components/sign-in-prompt';

function Choice({ selected, disabled, onPress, children, label }: { selected: boolean; disabled?: boolean; onPress: () => void; children: ReactNode; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flexDirection: 'row', gap: spacing[3], padding: spacing[3], borderRadius: radius.md, borderWidth: selected ? 2 : 1, borderColor: selected ? c.primary : c.border, backgroundColor: c.surface, opacity: disabled ? 0.55 : 1 }}
    >
      <View style={{ width: 20, height: 20, marginTop: 2, borderRadius: 10, borderWidth: 2, borderColor: selected ? c.primary : c.borderInput, alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
    </Pressable>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] }}>
      <Text tone={bold ? 'default' : 'muted'} weight={bold ? 'bold' : 'regular'}>
        {label}
      </Text>
      <Text weight={bold ? 'bold' : 'semibold'}>{value}</Text>
    </View>
  );
}

/** One screen: address, delivery, payment, coupon and the price the API quotes for them. */
export default function CheckoutScreen() {
  const t = useTranslations();
  const locale = useLocale();
  const localized = useLocalized();
  const toast = useToast();
  const { status } = useAuth();
  const { cart, loading: cartLoading, reload: reloadCart } = useCart();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [shipping, setShipping] = useState<ShippingOption[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(idempotencyKey());
  const money = (v: string) => formatMoney(v, locale, { hideZeroDecimals: true });

  // Back from "Add address": pick up the new one.
  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated') return;
      api<Address[]>('/me/addresses').then(
        (list) => {
          setAddresses(list);
          setAddressId((current) => (current && list.some((a) => a.id === current) ? current : (list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null)));
        },
        () => setAddresses([]),
      );
    }, [status]),
  );
  useEffect(() => {
    api<{ shippingMethods: ShippingOption[] }>('/checkout/options').then((o) => setShipping(o.shippingMethods), () => undefined);
  }, []);
  useEffect(() => {
    if (cart?.couponCode && coupon === null) (setCoupon(cart.couponCode), setCouponInput(cart.couponCode));
  }, [cart?.couponCode, coupon]);

  const requote = useCallback(async () => {
    try {
      const q = await api<Quote>('/checkout/quote', { method: 'POST', body: { addressId: addressId ?? undefined, shippingMethod, couponCode: coupon ?? undefined } });
      setQuote(q);
      setPaymentMethod((current) => (current && q.paymentMethods.some((m) => m.method === current && m.available) ? current : (q.paymentMethods.find((m) => m.available)?.method ?? null)));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [addressId, shippingMethod, coupon, t]);
  useEffect(() => {
    if (addresses !== null) void requote();
  }, [addresses, requote, cart?.summary.itemCount]);

  const place = async () => {
    if (!quote || !addressId || !paymentMethod) return;
    setError(null);
    setPlacing(true);
    try {
      const res = await apiRequest<CheckoutResult>('/checkout', {
        method: 'POST',
        body: { addressId, shippingMethod, paymentMethod, couponCode: coupon ?? undefined, note: note.trim() || undefined, idempotencyKey: key.current, expectedTotal: quote.totals.grandTotal },
      });
      void reloadCart();
      const { order, payment } = res.data;
      toast(res.message);
      // Online payments finish on the payment provider's secure page; the order page then shows the outcome.
      if (payment?.redirectUrl) await WebBrowser.openBrowserAsync(payment.redirectUrl);
      router.replace(`/account/orders/${order.number}` as Href);
    } catch (err) {
      setError(errorMessage(err, t));
      // Prices or stock moved: show the fresh numbers, with a new key for the corrected order.
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        key.current = idempotencyKey();
        void reloadCart();
        void requote();
      }
    } finally {
      setPlacing(false);
    }
  };

  if (status === 'anonymous')
    return (
      <Screen>
        <SignInPrompt title={t('checkout.signIn')} />
      </Screen>
    );
  if (cartLoading || addresses === null) return <Loading />;
  if (!cart || cart.summary.itemCount === 0)
    return (
      <Screen>
        <EmptyState title={t('checkout.emptyCart')} action={<Button small title={t('cart.continueShopping')} onPress={() => router.replace('/books')} />} />
      </Screen>
    );

  const digitalOnly = quote?.totals.digitalOnly;
  return (
    <Screen>
      <View style={{ gap: spacing[3] }}>
        <Heading level={3}>{digitalOnly ? t('digital.billingAddressTitle') : t('checkout.addressStep')}</Heading>
        {digitalOnly ? <Text size="sm" tone="muted">{t('digital.billingAddress')}</Text> : null}
        {addresses.length === 0 ? <Text tone="muted">{t('checkout.noAddress')}</Text> : null}
        <View accessibilityRole="radiogroup" style={{ gap: spacing[2] }}>
          {addresses.map((a) => (
            <Choice key={a.id} selected={a.id === addressId} onPress={() => setAddressId(a.id)} label={`${t(`addresses.labels.${a.label}`)}: ${a.recipientName}`}>
              <Text size="xs" weight="semibold" tone="primary">
                {t(`addresses.labels.${a.label}`)}
              </Text>
              <AddressLines address={a} />
            </Choice>
          ))}
        </View>
        <Button small variant="outline" icon={Plus} title={t('checkout.addAddress')} onPress={() => router.push('/account/addresses?add=1')} style={{ alignSelf: 'flex-start' }} />
      </View>

      {!digitalOnly && shipping.length ? (
        <View style={{ gap: spacing[3] }}>
          <Heading level={3}>{t('checkout.shippingStep')}</Heading>
          <View accessibilityRole="radiogroup" style={{ gap: spacing[2] }}>
            {shipping.map((s) => (
              <Choice key={s.code} selected={s.code === shippingMethod} onPress={() => setShippingMethod(s.code)} label={localized(s.name)}>
                <Text weight="semibold">{localized(s.name)}</Text>
                <Text size="sm" tone="muted">
                  {t('checkout.days', { min: s.minDays, max: s.maxDays })} · {t('checkout.insideDhaka', { inside: money(s.insideDhakaFee).replace('৳', ''), outside: money(s.outsideDhakaFee).replace('৳', '') })}
                </Text>
              </Choice>
            ))}
          </View>
        </View>
      ) : null}

      {quote ? (
        <View style={{ gap: spacing[3] }}>
          <Heading level={3}>{t('checkout.paymentStep')}</Heading>
          <View accessibilityRole="radiogroup" style={{ gap: spacing[2] }}>
            {quote.paymentMethods.map((m) => (
              <Choice key={m.method} selected={m.method === paymentMethod} disabled={!m.available} onPress={() => setPaymentMethod(m.method)} label={t(`payment.${m.method}` as 'payment.cod')}>
                <Text weight="semibold">{t(`payment.${m.method}` as 'payment.cod')}</Text>
                <Text size="sm" tone="muted">
                  {!m.available ? (m.reason ?? t('checkout.unavailable')) : m.method === 'cod' ? t('checkout.codHint') : m.method === 'sandbox' ? t('checkout.sandboxHint') : t('checkout.onlineHint')}
                </Text>
              </Choice>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label={t('checkout.coupon')} error={quote?.coupon && !quote.coupon.applied ? quote.coupon.message : undefined}>
            {(a) => <Input {...a} value={couponInput} onChangeText={setCouponInput} autoCapitalize="characters" autoCorrect={false} />}
          </Field>
        </View>
        <Button small variant="outline" title={coupon ? t('checkout.removeCoupon') : t('checkout.apply')} onPress={() => (coupon ? (setCoupon(''), setCouponInput('')) : setCoupon(couponInput.trim().toUpperCase() || null))} style={{ minHeight: 48 }} />
      </View>
      {quote?.coupon?.applied ? (
        <Text size="sm" tone="success">
          {t('checkout.couponApplied', { code: quote.coupon.code })}
        </Text>
      ) : null}

      <Field label={t('checkout.note')}>{(a) => <Input {...a} value={note} onChangeText={setNote} placeholder={t('checkout.notePlaceholder')} multiline maxLength={500} />}</Field>

      {quote ? (
        <Card style={{ gap: spacing[2] }}>
          <SummaryRow label={t('checkout.items', { count: quote.totals.itemCount })} value={money(quote.totals.itemsSubtotal)} />
          {Number(quote.totals.discountTotal) > 0 ? <SummaryRow label={t('checkout.discount')} value={`−${money(quote.totals.discountTotal)}`} /> : null}
          {!digitalOnly ? <SummaryRow label={t('checkout.shipping')} value={quote.totals.shippingPending ? t('checkout.pending') : Number(quote.totals.shippingTotal) === 0 ? t('checkout.free') : money(quote.totals.shippingTotal)} /> : null}
          <SummaryRow label={t('checkout.total')} value={money(quote.totals.grandTotal)} bold />
          {quote.problems.length ? (
            <Text size="sm" tone="danger">
              {t('cart.problems')}
            </Text>
          ) : null}
        </Card>
      ) : (
        <Loading />
      )}
      {error ? (
        <Text tone="danger" accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}
      <Button
        title={placing ? t('checkout.placing') : paymentMethod && paymentMethod !== 'cod' ? t('checkout.placeAndPay') : t('checkout.placeOrder')}
        loading={placing}
        disabled={!quote || !addressId || !paymentMethod || quote.problems.length > 0}
        onPress={place}
      />
      <Text size="xs" tone="subtle">
        {t('checkout.terms')}
      </Text>
    </Screen>
  );
}
