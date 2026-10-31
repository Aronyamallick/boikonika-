import { sql } from 'drizzle-orm';
import { check, char, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, currency, id, money, timestamps } from './_columns';
import { payoutStatusEnum, paymentMethodEnum, paymentStatusEnum, refundStatusEnum } from './enums';
import { users } from './identity';
import { sellerPayoutAccounts, sellers } from './marketplace';
import { orders, returnRequests, sellerOrders } from './orders';

/**
 * A payment attempt for an order through one gateway. Raw card data never touches our servers —
 * gateways host the card form; we keep only gateway references and sanitised payloads.
 */
export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    method: paymentMethodEnum('method').notNull(),
    provider: varchar('provider', { length: 30 }).notNull(), // cod | bkash | sslcommerz | nagad | sandbox
    status: paymentStatusEnum('status').notNull().default('pending'),
    amount: money('amount').notNull(),
    refundedAmount: money('refunded_amount').notNull().default('0'),
    currency: currency(),
    providerPaymentId: varchar('provider_payment_id', { length: 191 }),
    providerTransactionId: varchar('provider_transaction_id', { length: 191 }),
    redirectUrl: text('redirect_url'),
    idempotencyKey: varchar('idempotency_key', { length: 80 }).notNull(),
    failureReason: text('failure_reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('payments_idempotency_unique').on(t.idempotencyKey),
    uniqueIndex('payments_provider_payment_unique').on(t.provider, t.providerPaymentId).where(sql`${t.providerPaymentId} is not null`),
    index('payments_order_idx').on(t.orderId),
    index('payments_status_idx').on(t.status, t.createdAt),
    check('payments_amount_positive', sql`${t.amount} >= 0`),
    check('payments_refund_le_amount', sql`${t.refundedAmount} <= ${t.amount}`),
  ],
);

/**
 * Every gateway interaction (initiate, callback, IPN, verify, refund). `providerEventId` is unique per
 * provider, so a duplicate callback/IPN is detected and ignored instead of being applied twice.
 */
export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: id(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 30 }).notNull(),
    kind: varchar('kind', { length: 20 }).notNull(), // initiate | callback | ipn | verify | refund
    providerEventId: varchar('provider_event_id', { length: 191 }),
    status: varchar('status', { length: 30 }).notNull(),
    amount: money('amount'),
    payloadSha256: char('payload_sha256', { length: 64 }),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('payment_transactions_provider_event_unique').on(t.provider, t.providerEventId).where(sql`${t.providerEventId} is not null`),
    index('payment_transactions_payment_idx').on(t.paymentId, t.createdAt),
  ],
);

export const refunds = pgTable(
  'refunds',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    sellerOrderId: uuid('seller_order_id').references(() => sellerOrders.id, { onDelete: 'restrict' }),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'restrict' }),
    returnRequestId: uuid('return_request_id').references(() => returnRequests.id, { onDelete: 'set null' }),
    amount: money('amount').notNull(),
    currency: currency(),
    reason: text('reason').notNull(),
    status: refundStatusEnum('status').notNull().default('requested'),
    method: varchar('method', { length: 20 }).notNull().default('original'), // original | bkash | bank | store_credit
    providerRefundId: varchar('provider_refund_id', { length: 191 }),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    failureReason: text('failure_reason'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('refunds_order_idx').on(t.orderId), index('refunds_status_idx').on(t.status), check('refunds_amount_positive', sql`${t.amount} > 0`)],
);

/** Money owed to a seller for delivered sub-orders, net of platform commission and refunds. */
export const payouts = pgTable(
  'payouts',
  {
    id: id(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'restrict' }),
    payoutAccountId: uuid('payout_account_id').references(() => sellerPayoutAccounts.id, { onDelete: 'set null' }),
    amount: money('amount').notNull(),
    currency: currency(),
    status: payoutStatusEnum('status').notNull().default('pending'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    reference: varchar('reference', { length: 120 }),
    note: text('note'),
    processedBy: uuid('processed_by').references(() => users.id, { onDelete: 'set null' }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('payouts_seller_idx').on(t.sellerId, t.createdAt), index('payouts_status_idx').on(t.status), check('payouts_amount_positive', sql`${t.amount} > 0`)],
);

/** Which seller orders a payout covers — the unique index guarantees nothing is paid out twice. */
export const payoutItems = pgTable(
  'payout_items',
  {
    id: id(),
    payoutId: uuid('payout_id')
      .notNull()
      .references(() => payouts.id, { onDelete: 'cascade' }),
    sellerOrderId: uuid('seller_order_id')
      .notNull()
      .references(() => sellerOrders.id, { onDelete: 'restrict' }),
    amount: money('amount').notNull(),
  },
  (t) => [uniqueIndex('payout_items_seller_order_unique').on(t.sellerOrderId), index('payout_items_payout_idx').on(t.payoutId)],
);

