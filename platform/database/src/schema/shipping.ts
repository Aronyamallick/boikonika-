import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, currency, i18n, id, money, timestamps } from './_columns';
import { shipmentStatusEnum } from './enums';
import { users } from './identity';
import { sellers } from './marketplace';
import { sellerOrders } from './orders';

/**
 * Shipping options: platform-managed (sellerId null) or a seller's own delivery.
 * Fees differ inside/outside Dhaka, the common pattern for Bangladeshi couriers.
 */
export const shippingMethods = pgTable(
  'shipping_methods',
  {
    id: id(),
    sellerId: uuid('seller_id').references(() => sellers.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 40 }).notNull(),
    name: i18n('name').notNull(),
    courier: varchar('courier', { length: 30 }).notNull().default('manual'), // manual | pathao | steadfast | redx | sundarban | paperfly
    insideDhakaFee: money('inside_dhaka_fee').notNull(),
    outsideDhakaFee: money('outside_dhaka_fee').notNull(),
    perExtraKgFee: money('per_extra_kg_fee').notNull().default('0'),
    freeShippingThreshold: money('free_shipping_threshold'),
    currency: currency(),
    minDays: smallint('min_days').notNull().default(1),
    maxDays: smallint('max_days').notNull().default(5),
    supportsCod: boolean('supports_cod').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    position: smallint('position').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('shipping_methods_code_unique').on(t.sellerId, t.code),
    check('shipping_methods_fees_non_negative', sql`${t.insideDhakaFee} >= 0 and ${t.outsideDhakaFee} >= 0`),
    check('shipping_methods_days_valid', sql`${t.minDays} >= 0 and ${t.maxDays} >= ${t.minDays}`),
  ],
);

export const shipments = pgTable(
  'shipments',
  {
    id: id(),
    sellerOrderId: uuid('seller_order_id')
      .notNull()
      .references(() => sellerOrders.id, { onDelete: 'cascade' }),
    shippingMethodId: uuid('shipping_method_id').references(() => shippingMethods.id, { onDelete: 'set null' }),
    courier: varchar('courier', { length: 30 }).notNull().default('manual'),
    trackingNumber: varchar('tracking_number', { length: 80 }),
    trackingUrl: text('tracking_url'),
    status: shipmentStatusEnum('status').notNull().default('pending'),
    codAmount: money('cod_amount').notNull().default('0'),
    weightGrams: integer('weight_grams'),
    assignedStaffId: uuid('assigned_staff_id').references(() => users.id, { onDelete: 'set null' }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('shipments_seller_order_idx').on(t.sellerOrderId),
    uniqueIndex('shipments_tracking_unique').on(t.courier, t.trackingNumber).where(sql`${t.trackingNumber} is not null`),
    index('shipments_staff_idx').on(t.assignedStaffId, t.status),
  ],
);

export const shipmentTracking = pgTable(
  'shipment_tracking',
  {
    id: id(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    status: shipmentStatusEnum('status').notNull(),
    location: varchar('location', { length: 160 }),
    note: text('note'),
    source: varchar('source', { length: 20 }).notNull().default('manual'), // manual | courier_webhook | staff_app
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index('shipment_tracking_shipment_idx').on(t.shipmentId, t.occurredAt)],
);
