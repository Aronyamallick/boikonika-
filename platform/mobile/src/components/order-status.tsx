import { useTranslations } from 'use-intl';
import { Badge } from './ui';

const ORDER_TONE: Record<string, 'neutral' | 'primary' | 'secondary' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  confirmed: 'secondary',
  processing: 'secondary',
  shipped: 'primary',
  out_for_delivery: 'primary',
  delivered: 'success',
  cancelled: 'danger',
  returned: 'neutral',
  refunded: 'neutral',
};
const PAYMENT_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = { pending: 'warning', authorized: 'warning', paid: 'success', failed: 'danger', cancelled: 'neutral', refunded: 'neutral', partially_refunded: 'neutral' };

export function OrderStatus({ status }: { status: string }) {
  const t = useTranslations('status.order');
  return <Badge label={t(status as 'pending')} tone={ORDER_TONE[status] ?? 'neutral'} />;
}

export function PaymentStatus({ status }: { status: string }) {
  const t = useTranslations('status.payment');
  return <Badge label={t(status as 'pending')} tone={PAYMENT_TONE[status] ?? 'neutral'} />;
}
