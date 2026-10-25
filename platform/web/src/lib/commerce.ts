/** Commerce response shapes (mirrors the API). */
export interface CartItem {
  variantId: string;
  productId: string;
  productSlug: string;
  type: 'book' | 'general';
  bookId: string | null;
  bookSlug: string | null;
  title: string;
  variantName: string;
  condition: string | null;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: string;
  compareAtPrice: string | null;
  quantity: number;
  savedForLater: boolean;
  available: number;
  state: 'ok' | 'unavailable' | 'insufficient';
  lineTotal: string;
  seller: { id: string; name: string; slug: string };
}

export interface CartView {
  guestToken: string | null;
  couponCode: string | null;
  groups: Array<{ seller: { id: string; name: string; slug: string; district: string | null }; items: CartItem[]; subtotal: string }>;
  saved: CartItem[];
  summary: { itemCount: number; subtotal: string; hasProblems: boolean };
}

export interface Address {
  id: string;
  label: 'home' | 'office' | 'other';
  recipientName: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  union: string | null;
  area: string;
  addressLine: string;
  postcode: string | null;
  isDefault: boolean;
}

export interface ShippingOption {
  code: string;
  name: { bn: string; en: string };
  insideDhakaFee: string;
  outsideDhakaFee: string;
  freeShippingThreshold: string | null;
  minDays: number;
  maxDays: number;
  supportsCod: boolean;
}

export interface Quote {
  groups: Array<{
    seller: { id: string; name: string; slug: string };
    itemsSubtotal: string;
    itemDiscount: string;
    shippingFee: string;
    shippingDiscount: string;
    total: string;
    items: Array<{ variantId: string; title: string; variantName: string; condition: string | null; imageUrl: string | null; quantity: number; unitPrice: string; discount: string; lineTotal: string }>;
  }>;
  problems: Array<{ variantId: string; title: string; state: string; available: number }>;
  coupon: { code: string; applied: boolean; discount: string; message?: string } | null;
  totals: { itemCount: number; itemsSubtotal: string; discountTotal: string; shippingTotal: string; grandTotal: string; shippingPending: boolean };
  paymentMethods: Array<{ method: string; provider: string; available: boolean; reason?: string }>;
}

export interface OrderSummary {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  grandTotal: string;
  placedAt: string;
  paymentDueAt: string | null;
  itemCount: number;
  preview: Array<{ title: string; imageUrl: string | null }>;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  bookId: string | null;
  title: string;
  variantName: string | null;
  condition: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  lineTotal: string;
  refundedQuantity: number;
  /** Book or product page (where the item is reviewed); null when the listing is gone. */
  path: string | null;
}

export interface OrderDetail {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totals: { itemsSubtotal: string; discountTotal: string; shippingTotal: string; grandTotal: string; refundedTotal: string };
  couponCode: string | null;
  shippingAddress: Omit<Address, 'id' | 'label' | 'isDefault'>;
  note: string | null;
  placedAt: string;
  paidAt: string | null;
  paymentDueAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  canPay: boolean;
  payment: { id: string; method: string; status: string; redirectUrl: string | null; failureReason: string | null } | null;
  sellerOrders: Array<{
    id: string;
    number: string;
    status: string;
    store: { name: string; slug: string };
    itemsSubtotal: string;
    discountTotal: string;
    shippingFee: string;
    total: string;
    shippedAt: string | null;
    deliveredAt: string | null;
    cancelReason: string | null;
    returnableUntil: string | null;
    shipment: { courier: string; trackingNumber: string | null; trackingUrl: string | null; status: string; events: Array<{ status: string; note: string | null; location: string | null; at: string }> } | null;
    items: OrderItem[];
  }>;
  refunds: Array<{ id: string; sellerOrderId: string | null; amount: string; status: string; reason: string; createdAt: string; processedAt: string | null }>;
  returns: Array<{ id: string; sellerOrderId: string; status: string; reason: string; details: string | null; sellerNote: string | null; items: Array<{ orderItemId: string; quantity: number }>; createdAt: string }>;
  history: Array<{ status: string; note: string | null; actorRole: string | null; sellerOrderId: string | null; at: string }>;
}

export interface CheckoutResult {
  order: { id: string; number: string; status: string; paymentStatus: string; paymentMethod: string; grandTotal: string; paymentDueAt: string | null };
  payment: { id: string; method: string; status: string; redirectUrl: string | null; failureReason: string | null } | null;
}

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
