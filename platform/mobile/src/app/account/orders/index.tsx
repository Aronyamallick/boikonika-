import { formatMoney, radius, spacing, type OrderSummary } from '@boikonika/shared';
import { router, Stack, type Href } from 'expo-router';
import { Package } from 'lucide-react-native';
import { View } from 'react-native';
import { useFormatter, useLocale, useTranslations } from 'use-intl';
import { Cover } from '@/components/books';
import { List } from '@/components/list';
import { OrderStatus } from '@/components/order-status';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button, Card, EmptyState, ErrorState, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useInfinite } from '@/lib/use-api';

export default function OrdersScreen() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const { status } = useAuth();
  const orders = useInfinite<OrderSummary>(status === 'authenticated' ? '/orders' : null, { persist: true, query: { pageSize: 20 } });

  if (status === 'anonymous') return <Screen><SignInPrompt /></Screen>;
  return (
    <>
      <Stack.Screen options={{ title: t('orders.title') }} />
      <List
        data={orders.items}
        keyExtractor={(o) => o.id}
        refreshing={orders.refreshing}
        onRefresh={orders.reload}
        onEndReached={orders.loadMore}
        loadingMore={orders.loadingMore}
        header={orders.offline ? <OfflineNotice /> : null}
        renderItem={({ item: o }) => (
          <Card onPress={() => router.push(`/account/orders/${o.number}` as Href)} accessibilityLabel={t('orders.number', { number: o.number })} style={{ gap: spacing[2] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] }}>
              <Text weight="semibold">{t('orders.number', { number: o.number })}</Text>
              <OrderStatus status={o.status} />
            </View>
            <Text size="sm" tone="muted">
              {t('orders.placedOn', { date: format.dateTime(new Date(o.placedAt), { dateStyle: 'medium' }) })} · {t('common.items', { count: o.itemCount })}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              {o.preview.slice(0, 4).map((p, i) => (
                <Cover key={i} uri={p.imageUrl} title={p.title} width={36} rounded={radius.sm} />
              ))}
              <View style={{ flex: 1 }} />
              <Text weight="bold">{formatMoney(o.grandTotal, locale, { hideZeroDecimals: true })}</Text>
            </View>
          </Card>
        )}
        empty={orders.loading ? <Loading /> : orders.error ? <ErrorState offline={orders.error.code === 'NETWORK'} onRetry={orders.reload} /> : <EmptyState icon={Package} title={t('orders.empty')} text={t('orders.emptyText')} action={<Button small title={t('cart.continueShopping')} onPress={() => router.push('/books')} />} />}
      />
    </>
  );
}
