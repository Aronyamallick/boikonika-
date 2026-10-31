import { addMoney, fromMinor, toMinor, type OrderStatus } from '@boikonika/shared';

const PROGRESS: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

/**
 * The buyer-facing status of an order made of several seller sub-orders: cancelled when all are,
 * otherwise the least advanced live sub-order (so "delivered" means everything arrived).
 */
export function deriveOrderStatus(statuses: OrderStatus[]): OrderStatus {
  const live = statuses.filter((s) => s !== 'cancelled');
  if (!live.length) return 'cancelled';
  if (live.every((s) => s === 'refunded')) return 'refunded';
  if (live.every((s) => s === 'returned' || s === 'refunded')) return 'returned';
  const moving = live.filter((s) => PROGRESS.includes(s));
  if (!moving.length) return 'delivered';
  return moving.reduce((least, s) => (PROGRESS.indexOf(s) < PROGRESS.indexOf(least) ? s : least));
}

/** What the buyer pays for one seller's part: items − discounts + shipping. */
export function sellerOrderTotal(so: { itemsSubtotal: string; discountTotal: string; shippingFee: string }): string {
  return fromMinor(toMinor(so.itemsSubtotal) - toMinor(so.discountTotal) + toMinor(so.shippingFee));
}

export const sum = (values: string[]) => addMoney('0', ...values);
