import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, currency, id, money, timestamps } from './_columns';
import { books } from './catalog';
import { coupons } from './commerce';
import { bookConditionEnum, orderStatusEnum, paymentMethodEnum, paymentStatusEnum, returnStatusEnum } from './enums';
import { users } from './identity';
import { productVariants, products, sellers } from './marketplace';

export interface AddressSnapshot {
  recipientName: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  union?: string | null;
  area: string;
  addressLine: string;
  postcode?: string | null;
}

/**
 * Customer order (what the buyer sees). It is split into one seller_order per seller; every money
 * column is NUMERIC with an explicit currency. Address is snapshotted so later edits don't rewrite history.
 */
export const orders = pgTable(
  'orders',
  {
    id: id(),
    number: varchar('number', { length: 24 }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: orderStatusEnum('status').notNull().default('pending'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    currency: currency(),
    itemsSubtotal: money('items_subtotal').notNull(),
    discountTotal: money('discount_total').notNull().default('0'),
    shippingTotal: money('shipping_total').notNull().default('0'),
    taxTotal: money('tax_total').notNull().default('0'),
    grandTotal: money('grand_total').notNull(),
    refundedTotal: money('refunded_total').notNull().default('0'),
    couponId: uuid('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
    couponCode: varchar('coupon_code', { length: 40 }),
    shippingAddress: jsonb('shipping_address').$type<AddressSnapshot>().notNull(),
    customerNote: varchar('customer_note', { length: 500 }),
    /** Client-supplied key: retrying a checkout request never creates a second order. */
    idempotencyKey: varchar('idempotency_key', { length: 80 }),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    /** Unpaid online orders are cancelled and stock released after this time. */
    paymentDueAt: timestamp('payment_due_at', { withTimezone: true }),
    ip: varchar('ip', { length: 45 }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('orders_number_unique').on(t.number),
    uniqueIndex('orders_user_idempotency_unique').on(t.userId, t.idempotencyKey).where(sql`${t.idempotencyKey} is not null`),
    index('orders_user_placed_idx').on(t.userId, t.placedAt),
    index('orders_status_idx').on(t.status, t.placedAt),
    index('orders_payment_due_idx').on(t.paymentDueAt).where(sql`${t.paymentStatus} = 'pending' and ${t.paymentMethod} <> 'cod'`),
    check('orders_totals_non_negative', sql`${t.itemsSubtotal} >= 0 and ${t.discountTotal} >= 0 and ${t.shippingTotal} >= 0 and ${t.grandTotal} >= 0`),
    check('orders_grand_total_consistent', sql`${t.grandTotal} = ${t.itemsSubtotal} - ${t.discountTotal} + ${t.shippingTotal} + ${t.taxTotal}`),
    check('orders_refund_le_total', sql`${t.refundedTotal} <= ${t.grandTotal}`),
  ],
);

/** The part of an order a single seller fulfils; sellers only ever see their own seller_orders. */
export const sellerOrders = pgTable(
  'seller_orders',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'restrict' }),
    number: varchar('number', { length: 28 }).notNull(),
    status: orderStatusEnum('status').notNull().default('pending'),
    currency: currency(),
    itemsSubtotal: money('items_subtotal').notNull(),
    discountTotal: money('discount_total').notNull().default('0'),
    shippingFee: money('shipping_fee').notNull().default('0'),
    commissionPercent: numeric('commission_percent', { precision: 5, scale: 2 }).notNull(),
    commissionAmount: money('commission_amount').notNull(),
    sellerEarning: money('seller_earning').notNull(),
    refundedTotal: money('refunded_total').notNull().default('0'),
    shippingMethodId: uuid('shipping_method_id'),
    usesPlatformShipping: boolean('uses_platform_shipping').notNull().default(true),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('seller_orders_number_unique').on(t.number),
    uniqueIndex('seller_orders_order_seller_unique').on(t.orderId, t.sellerId),
    index('seller_orders_seller_status_idx').on(t.sellerId, t.status, t.createdAt),
    check('seller_orders_amounts_non_negative', sql`${t.itemsSubtotal} >= 0 and ${t.commissionAmount} >= 0 and ${t.sellerEarning} >= 0`),
  ],
);

/** Line items with full price/title snapshots (the product may change or be deleted later). */
export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    sellerOrderId: uuid('seller_order_id')
      .notNull()
      .references(() => sellerOrders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 300 }).notNull(),
    variantName: varchar('variant_name', { length: 160 }),
    sku: varchar('sku', { length: 64 }).notNull(),
    imageKey: text('image_key'),
    condition: bookConditionEnum('condition'),
    isDigital: boolean('is_digital').notNull().default(false),
    quantity: integer('quantity').notNull(),
    unitPrice: money('unit_price').notNull(),
    discountAmount: money('discount_amount').notNull().default('0'),
    lineTotal: money('line_total').notNull(),
    refundedQuantity: integer('refunded_quantity').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    index('order_items_seller_order_idx').on(t.sellerOrderId),
    index('order_items_book_idx').on(t.bookId),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
    check('order_items_refunded_le_quantity', sql`${t.refundedQuantity} between 0 and ${t.quantity}`),
    check('order_items_line_total_consistent', sql`${t.lineTotal} = ${t.unitPrice} * ${t.quantity} - ${t.discountAmount}`),
  ],
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    sellerOrderId: uuid('seller_order_id').references(() => sellerOrders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatusEnum('from_status'),
    toStatus: orderStatusEnum('to_status').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: varchar('actor_role', { length: 20 }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('order_status_history_order_idx').on(t.orderId, t.createdAt)],
);

export const returnRequests = pgTable(
  'return_requests',
  {
    id: id(),
    sellerOrderId: uuid('seller_order_id')
      .notNull()
      .references(() => sellerOrders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: returnStatusEnum('status').notNull().default('requested'),
    reason: varchar('reason', { length: 40 }).notNull(), // damaged | wrong_item | not_as_described | changed_mind | other
    details: text('details'),
    photoKeys: text('photo_keys').array(),
    sellerNote: text('seller_note'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('return_requests_seller_order_idx').on(t.sellerOrderId), index('return_requests_status_idx').on(t.status)],
);

export const returnItems = pgTable(
  'return_items',
  {
    id: id(),
    returnRequestId: uuid('return_request_id')
      .notNull()
      .references(() => returnRequests.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    restock: boolean('restock').notNull().default(true),
  },
  (t) => [uniqueIndex('return_items_request_item_unique').on(t.returnRequestId, t.orderItemId), check('return_items_quantity_positive', sql`${t.quantity} > 0`)],
);
