export type { CartItem, CartView, Address, ShippingOption, Quote, OrderSummary, OrderItem, OrderDetail, CheckoutResult } from '@boikonika/shared';

export const ORDER_TONE: Record<string, 'neutral' | 'primary' | 'secondary' | 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'info',
  shipped: 'primary',
  out_for_delivery: 'primary',
  delivered: 'success',
  cancelled: 'danger',
  returned: 'neutral',
  refunded: 'neutral',
};

export const PAYMENT_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  authorized: 'warning',
  paid: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  refunded: 'neutral',
  partially_refunded: 'neutral',
};

/** A random key per checkout attempt, so a retried "Place order" can never create a second order. */
export function idempotencyKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return `chk_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Seller order list tabs: statuses, plus `returns` (orders with a return request awaiting the seller). */
export const SELLER_ORDER_TABS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'returns', 'cancelled', ''] as const;
