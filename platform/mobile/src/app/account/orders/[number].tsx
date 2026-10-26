import { formatMoney, radius, spacing, type OrderDetail } from '@boikonika/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Truck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFormatter, useLocale, useTranslations } from 'use-intl';
import { AddressLines } from '@/components/address';
import { Cover } from '@/components/books';
import { OrderStatus, PaymentStatus } from '@/components/order-status';
import { useToast } from '@/components/toast';
import { Button, Card, ErrorState, Field, Heading, Input, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { api, apiRequest } from '@/lib/api';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { openLink } from '@/lib/links';
import { idempotencyKey } from '@/lib/random';
import { useTheme } from '@/lib/theme';
import { useApi } from '@/lib/use-api';

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text tone={bold ? 'default' : 'muted'} weight={bold ? 'bold' : 'regular'}>
        {label}
      </Text>
      <Text weight={bold ? 'bold' : 'semibold'}>{value}</Text>
    </View>
  );
}

export default function OrderScreen() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const { c } = useTheme();
  const toast = useToast();
  const order = useApi<OrderDetail>(`/orders/${number}`, { persist: true });
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const money = (v: string) => formatMoney(v, locale, { hideZeroDecimals: true });
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const o = order.data;

  if (!o) return order.loading ? <Loading /> : <Screen><ErrorState offline={order.error?.code === 'NETWORK'} onRetry={order.reload} /></Screen>;

  const cancel = async () => {
    setBusy(true);
    setErrors({});
    try {
      const res = await apiRequest<OrderDetail>(`/orders/${o.number}/cancel`, { method: 'POST', body: { reason } });
      order.setData(res.data);
      setCancelling(false);
      toast(res.message);
    } catch (error) {
      setErrors(fieldErrors(error));
      toast(errorMessage(error, t), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const pay = async () => {
    setBusy(true);
    try {
      const res = await api<{ redirectUrl: string | null }>(`/orders/${o.number}/pay`, { method: 'POST', body: { paymentMethod: o.paymentMethod, idempotencyKey: idempotencyKey() } });
      if (res.redirectUrl) await WebBrowser.openBrowserAsync(res.redirectUrl);
      order.reload();
    } catch (error) {
      toast(errorMessage(error, t), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen refreshing={order.refreshing} onRefresh={order.reload}>
      <Stack.Screen options={{ title: t('orders.number', { number: o.number }) }} />
      {order.offline ? <OfflineNotice /> : null}
      <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
        <OrderStatus status={o.status} />
        <PaymentStatus status={o.paymentStatus} />
      </View>
      <Text size="sm" tone="muted">
        {t('orders.placedOn', { date: date(o.placedAt) })} · {t(`payment.${o.paymentMethod}` as 'payment.cod')}
      </Text>
      {o.cancelReason ? <Text tone="danger">{t('orders.cancelledReason', { reason: o.cancelReason })}</Text> : null}
      {o.canPay ? (
        <Card style={{ gap: spacing[2], backgroundColor: c.warningSoft, borderColor: c.warningSoft }}>
          {o.paymentDueAt ? <Text size="sm" style={{ color: c.warningSoftFg }}>{t('orders.payBy', { time: date(o.paymentDueAt) })}</Text> : null}
          <Button title={t('orders.payNow')} loading={busy} onPress={pay} />
        </Card>
      ) : null}

      {o.sellerOrders.map((so, i) => (
        <Card key={so.id} style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] }}>
            <Text size="sm" weight="semibold" style={{ flex: 1 }}>
              {o.sellerOrders.length > 1 ? `${t('orders.parcel', { n: i + 1, total: o.sellerOrders.length })} · ` : ''}
              {t('orders.from', { store: so.store.name })}
            </Text>
            <OrderStatus status={so.status} />
          </View>
          {so.items.map((item) => (
            <Pressable key={item.id} accessibilityRole={item.path ? 'link' : undefined} disabled={!item.path} onPress={() => item.path && void openLink(item.path)} style={{ flexDirection: 'row', gap: spacing[3] }}>
              <Cover uri={item.imageUrl} title={item.title} width={48} rounded={radius.sm} />
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="semibold" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text size="xs" tone="muted">
                  {item.isDigital ? t('digital.ebook') : item.variantName ?? ''} · ×{item.quantity}
                </Text>
              </View>
              <Text size="sm" weight="semibold">
                {money(item.lineTotal)}
              </Text>
            </Pressable>
          ))}
          {so.shipment ? (
            <View style={{ gap: spacing[2], padding: spacing[3], borderRadius: radius.md, backgroundColor: c.bgSubtle }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <Truck size={18} color={c.primary} />
                <Text size="sm" weight="semibold" style={{ flex: 1 }}>
                  {so.shipment.courier}
                  {so.shipment.trackingNumber ? ` · ${so.shipment.trackingNumber}` : ''}
                </Text>
              </View>
              {so.shipment.events.slice(0, 5).map((e, k) => (
                <Text key={k} size="xs" tone="muted">
                  {date(e.at)} — {t(`status.shipment.${e.status}` as 'status.shipment.pending')}
                  {e.location ? ` · ${e.location}` : ''}
                </Text>
              ))}
              {so.shipment.trackingUrl ? <Button small variant="outline" title={t('orders.trackParcel')} onPress={() => void WebBrowser.openBrowserAsync(so.shipment!.trackingUrl!)} /> : null}
            </View>
          ) : null}
        </Card>
      ))}

      <Card style={{ gap: spacing[2] }}>
        <Heading level={3}>{t('orders.summary')}</Heading>
        <Row label={t('orders.subtotal')} value={money(o.totals.itemsSubtotal)} />
        {Number(o.totals.discountTotal) > 0 ? <Row label={t('orders.discount')} value={`−${money(o.totals.discountTotal)}`} /> : null}
        <Row label={t('orders.shipping')} value={money(o.totals.shippingTotal)} />
        <Row label={t('orders.grandTotal')} value={money(o.totals.grandTotal)} bold />
        {Number(o.totals.refundedTotal) > 0 ? <Row label={t('orders.refunded')} value={money(o.totals.refundedTotal)} /> : null}
      </Card>

      <Card style={{ gap: spacing[2] }}>
        <Heading level={3}>{t('orders.deliveryAddress')}</Heading>
        <AddressLines address={o.shippingAddress} />
      </Card>

      {o.history.length ? (
        <View style={{ gap: spacing[2] }}>
          <Heading level={3}>{t('orders.timeline')}</Heading>
          {o.history.map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing[3] }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 8, backgroundColor: i === 0 ? c.primary : c.borderStrong }} />
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="semibold">
                  {t.has(`orders.events.${h.status}`) ? t(`orders.events.${h.status}` as 'orders.events.placed') : t.has(`status.order.${h.status}`) ? t(`status.order.${h.status}` as 'status.order.pending') : h.status}
                </Text>
                <Text size="xs" tone="muted">
                  {date(h.at)}
                  {h.note ? ` · ${h.note}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {o.canCancel ? (
        cancelling ? (
          <Card style={{ gap: spacing[3] }}>
            <Heading level={3}>{t('orders.cancelTitle')}</Heading>
            <Text size="sm" tone="muted">
              {t('orders.cancelHint')}
            </Text>
            <Field label={t('orders.cancelReason')} error={errors.reason} required>
              {(a) => <Input {...a} value={reason} onChangeText={setReason} multiline maxLength={500} />}
            </Field>
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Button variant="danger" title={t('orders.cancel')} loading={busy} onPress={cancel} style={{ flex: 1 }} />
              <Button variant="outline" title={t('orders.keep')} onPress={() => setCancelling(false)} />
            </View>
          </Card>
        ) : (
          <Button variant="outline" title={t('orders.cancel')} onPress={() => setCancelling(true)} />
        )
      ) : null}
    </Screen>
  );
}
