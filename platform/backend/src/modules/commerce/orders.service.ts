import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  couponUsages,
  coupons,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  refreshBookOffers,
  refreshProductStock,
  sellerOrders,
  sellers,
  shipments,
  shipmentTracking,
  type AddressSnapshot,
  type Database,
  type DbOrTx,
} from '@boikonika/database';
import { compareMoney, fromMinor, toMinor, type checkoutSchema, type OrderStatus, type PaymentMethod } from '@boikonika/shared';
import { and, asc, desc, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { AppException } from '../../common/errors/app-exception';
import { isUniqueViolation } from '../../common/errors/pg';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { StorageService } from '../../infra/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { CartService } from './cart.service';
import { recordDelivery, revokeDigitalAccess } from './delivery';
import { releaseStock, reserveStock } from './inventory';
import { newOrderNumber } from './order-number';
import { deriveOrderStatus, sellerOrderTotal } from './order-status';
import type { GatewayResult } from './payments/gateway';
import { PaymentsService, type PaymentRow } from './payments/payments.service';
import { PricingService } from './pricing.service';
import { RefundsService } from './refunds.service';

type CheckoutInput = z.output<typeof checkoutSchema>;
type OrderRow = typeof orders.$inferSelect;
export type Actor = { id: string | null; role: 'buyer' | 'seller' | 'admin' | 'system' };

/** Runs a cron body on one API instance at a time. */
export async function withCronLock(redis: Redis, key: string, seconds: number, fn: () => Promise<void>): Promise<void> {
  const ok = await redis.set(`lock:cron:${key}`, '1', 'EX', seconds, 'NX').catch(() => null);
  if (!ok) return;
  try {
    await fn();
  } finally {
    await redis.del(`lock:cron:${key}`).catch(() => undefined);
  }
}

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger('Orders');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly cart: CartService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    this.payments.onSettled((payment, result, tx) => this.onPaymentSettled(payment, result, tx));
  }

  // ------------------------------------------------------------------ checkout

  /**
   * Places the order: re-prices the cart from live data, splits it per seller, reserves stock, records
   * the coupon and creates the payment attempt, all in one transaction. Retrying with the same
   * idempotency key returns the same order instead of charging twice.
   */
  async checkout(userId: string, input: CheckoutInput, ip?: string) {
    const existing = await this.byIdempotency(userId, input.idempotencyKey);
    if (existing) return this.checkoutResult(existing);

    let placed: { order: OrderRow; paymentId: string; sellerIds: string[] };
    try {
      placed = await this.db.transaction(async (tx) => {
        const cart = await this.cart.resolve({ userId }, false, tx);
        if (!cart) throw new AppException('BAD_REQUEST', 'api.commerce.cartEmpty');
        // One checkout per cart at a time.
        await tx.execute(sql`select id from carts where id = ${cart.id} for update`);
        const again = await this.byIdempotency(userId, input.idempotencyKey, tx);
        if (again) return { order: again, paymentId: '', sellerIds: [] };

        const lines = await this.cart.lines(cart.id, tx);
        const quote = await this.pricing.quote({ userId, lines, addressId: input.addressId, shippingMethod: input.shippingMethod, couponCode: input.couponCode ?? cart.couponCode }, tx);
        if (!quote.groups.length && !quote.problems.length) throw new AppException('BAD_REQUEST', 'api.commerce.cartEmpty');
        if (quote.problems.length) {
          throw new AppException('CONFLICT', 'api.commerce.cartChanged', quote.problems.map((p) => ({ field: 'items', code: p.state, message: p.state === 'insufficient' ? 'api.commerce.onlyAvailableShort' : 'api.commerce.itemUnavailable', meta: { variantId: p.variantId } })));
        }
        if (!quote.address) throw AppException.validation([{ field: 'addressId', code: 'required', message: 'validation.addressRequired' }]);
        if (!quote.shippingMethod) throw AppException.validation([{ field: 'shippingMethod', code: 'invalid', message: 'validation.invalidChoice' }]);
        if (input.couponCode && !quote.coupon?.applied) {
          throw new AppException('VALIDATION_FAILED', quote.coupon?.message ?? 'api.commerce.couponInvalid', [{ field: 'couponCode', code: 'invalid', message: quote.coupon?.message ?? 'api.commerce.couponInvalid' }]).withParams(quote.coupon?.params ?? {});
        }
        const ebooks = quote.groups.flatMap((g) => g.lines).filter((l) => l.isDigital && l.bookId);
        if (ebooks.length) {
          const owned = await tx.execute<{ book_id: string }>(sql`
            select book_id from user_library where user_id = ${userId} and has_digital_access and book_id in (${sql.join(ebooks.map((l) => sql`${l.bookId}::uuid`), sql`, `)})`);
          if (owned.rows.length) {
            throw new AppException('CONFLICT', 'api.digital.alreadyOwned', owned.rows.map((r) => ({ field: 'items', code: 'owned', message: 'api.digital.alreadyOwned', meta: { variantId: ebooks.find((l) => l.bookId === r.book_id)!.variantId } })));
          }
        }
        const method = quote.paymentMethods.find((m) => m.method === input.paymentMethod);
        if (!method?.available) throw AppException.validation([{ field: 'paymentMethod', code: 'unavailable', message: method?.reason ?? 'api.commerce.methodUnavailable' }]);
        if (input.expectedTotal && compareMoney(input.expectedTotal, quote.totals.grandTotal) !== 0) {
          throw new AppException('CONFLICT', 'api.commerce.priceChanged').withParams({ total: quote.totals.grandTotal });
        }

        const online = input.paymentMethod !== 'cod';
        const now = new Date();
        const windowMinutes = await this.settings.number('orders.paymentWindowMinutes', 30);
        const dueAt = online ? new Date(now.getTime() + windowMinutes * 60_000) : null;
        const address = quote.address;
        const snapshot: AddressSnapshot = {
          recipientName: address.recipientName,
          phone: address.phone,
          division: address.division,
          district: address.district,
          upazila: address.upazila,
          union: address.union,
          area: address.area,
          addressLine: address.addressLine,
          postcode: address.postcode,
        };
        const appliedCoupon = quote.coupon?.applied ? quote.coupon : null;
        const [order] = await tx
          .insert(orders)
          .values({
            number: newOrderNumber(now),
            userId,
            paymentMethod: input.paymentMethod,
            itemsSubtotal: quote.totals.itemsSubtotal,
            discountTotal: quote.totals.discountTotal,
            shippingTotal: quote.totals.shippingTotal,
            grandTotal: quote.totals.grandTotal,
            couponId: appliedCoupon?.couponId ?? null,
            couponCode: appliedCoupon?.code ?? null,
            shippingAddress: snapshot,
            customerNote: input.note ?? null,
            idempotencyKey: input.idempotencyKey,
            paymentDueAt: dueAt,
            ip: ip?.slice(0, 45) ?? null,
          })
          .returning();

        const defaultCommission = await this.settings.number('commission.defaultPercent', this.config.PLATFORM_COMMISSION_PERCENT);
        const [methodRow] = await tx.execute<{ id: string }>(sql`select id from shipping_methods where seller_id is null and code = ${input.shippingMethod}`).then((r) => r.rows);
        for (const [index, group] of quote.groups.entries()) {
          const percent = group.seller.commissionPercent !== null ? Number(group.seller.commissionPercent) : defaultCommission;
          const sellerFunded = appliedCoupon?.sellerId === group.seller.id ? group.itemDiscount : '0.00';
          const { commission, earning } = PricingService.commission(group.itemsSubtotal, sellerFunded, percent);
          const [so] = await tx
            .insert(sellerOrders)
            .values({
              orderId: order!.id,
              sellerId: group.seller.id,
              number: `${order!.number}-${index + 1}`,
              itemsSubtotal: group.itemsSubtotal,
              discountTotal: fromMinor(toMinor(group.itemDiscount) + toMinor(group.shippingDiscount)),
              shippingFee: group.shippingFee,
              commissionPercent: percent.toFixed(2),
              commissionAmount: commission,
              sellerEarning: earning,
              shippingMethodId: methodRow?.id ?? null,
            })
            .returning({ id: sellerOrders.id });
          await tx.insert(orderItems).values(
            group.lines.map((l) => ({
              orderId: order!.id,
              sellerOrderId: so!.id,
              productId: l.productId,
              variantId: l.variantId,
              bookId: l.bookId,
              title: l.title,
              variantName: l.variantName,
              sku: l.sku ?? `V-${l.variantId.slice(0, 8)}`,
              imageKey: l.imageKey,
              condition: l.condition as 'new' | null,
              isDigital: l.isDigital,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discount,
              lineTotal: fromMinor(toMinor(l.lineTotal) - toMinor(l.discount)),
            })),
          );
        }
        await tx.insert(orderStatusHistory).values({ orderId: order!.id, toStatus: 'pending', actorId: userId, actorRole: 'buyer' });

        const bought = quote.groups.flatMap((g) => g.lines);
        await reserveStock(tx, bought.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), { type: 'order', id: order!.id, actorId: userId });

        if (appliedCoupon?.couponId) {
          const used = await tx
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(and(eq(coupons.id, appliedCoupon.couponId), sql`(${coupons.usageLimit} is null or ${coupons.usedCount} < ${coupons.usageLimit})`))
            .returning({ id: coupons.id });
          if (!used.length) throw new AppException('CONFLICT', 'api.commerce.couponUsedUp');
          // Per-user limits are re-checked under a lock so two tabs can't both use a single-use coupon.
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`coupon:${appliedCoupon.couponId}:${userId}`}))`);
          const [{ n } = { n: 0 }] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from coupon_usages where coupon_id = ${appliedCoupon.couponId} and user_id = ${userId}`).then((r) => r.rows);
          const [limit] = await tx.select({ perUser: coupons.perUserLimit }).from(coupons).where(eq(coupons.id, appliedCoupon.couponId));
          if (n >= (limit?.perUser ?? 1)) throw new AppException('CONFLICT', 'api.commerce.couponAlreadyUsed');
          await tx.insert(couponUsages).values({ couponId: appliedCoupon.couponId, userId, orderId: order!.id, discountAmount: appliedCoupon.discount });
        }

        const payment = await this.payments.create(tx, { orderId: order!.id, method: input.paymentMethod, amount: quote.totals.grandTotal, idempotencyKey: `${order!.id}:1`, expiresAt: dueAt });
        await this.cart.clearPurchased(tx, cart.id, bought.map((l) => l.variantId));
        await refreshProductStock(tx, [...new Set(bought.map((l) => l.productId))]);
        await refreshBookOffers(tx, [...new Set(bought.map((l) => l.bookId).filter((id): id is string => !!id))]);
        await this.audit.record({ action: 'order.place', entityType: 'order', entityId: order!.id, actorId: userId, after: { number: order!.number, total: order!.grandTotal, method: input.paymentMethod } }, tx);
        return { order: order!, paymentId: payment.id, sellerIds: quote.groups.map((g) => g.seller.id) };
      });
    } catch (error) {
      // A concurrent retry with the same key won the race: return its order.
      if (isUniqueViolation(error, 'orders_user_idempotency_unique')) {
        const winner = await this.byIdempotency(userId, input.idempotencyKey);
        if (winner) return this.checkoutResult(winner);
      }
      throw error;
    }

    if (!placed.paymentId) return this.checkoutResult(placed.order);
    await this.notifications.notify(userId, { type: 'order', titleKey: 'api.orders.placedTitle', bodyKey: 'api.orders.placedBody', params: { number: placed.order.number, total: placed.order.grandTotal }, link: `/account/orders/${placed.order.number}` }).catch(() => undefined);
    if (placed.order.paymentMethod === 'cod') await this.notifySellersOfNewOrder(placed.order.id);
    else {
      try {
        await this.payments.initiate(placed.paymentId);
      } catch (error) {
        this.logger.warn(`Payment start failed for ${placed.order.number}: ${(error as Error).message}`);
      }
    }
    return this.checkoutResult(placed.order);
  }

  private async byIdempotency(userId: string, key: string, tx: DbOrTx = this.db): Promise<OrderRow | null> {
    const [row] = await tx.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.idempotencyKey, key)));
    return row ?? null;
  }

  /** The order plus what the buyer must do next (go to the gateway, or nothing for COD). */
  private async checkoutResult(order: OrderRow) {
    const [payment] = await this.db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt)).limit(1);
    return {
      order: { id: order.id, number: order.number, status: order.status, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod, grandTotal: order.grandTotal, paymentDueAt: order.paymentDueAt?.toISOString() ?? null },
      payment: payment ? { id: payment.id, method: payment.method, status: payment.status, redirectUrl: payment.status === 'pending' ? payment.redirectUrl : null, failureReason: payment.failureReason } : null,
    };
  }

  /** "Pay now" again for an unpaid online order (after a failed or abandoned attempt). */
  async payAgain(userId: string, number: string, method: PaymentMethod, key: string) {
    const order = await this.ownOrder(userId, number);
    if (order.status === 'cancelled' || order.paymentStatus !== 'pending') throw new AppException('CONFLICT', 'api.commerce.paymentNotNeeded');
    if (method === 'cod') throw AppException.validation([{ field: 'paymentMethod', code: 'invalid', message: 'api.commerce.methodUnavailable' }]);
    const payment = await this.db.transaction(async (tx) => {
      const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for('update');
      if (!locked || locked.status === 'cancelled' || locked.paymentStatus !== 'pending') throw new AppException('CONFLICT', 'api.commerce.paymentNotNeeded');
      // Earlier attempts that never completed are closed so only one can succeed.
      await tx.update(payments).set({ status: 'cancelled', failureReason: 'superseded' }).where(and(eq(payments.orderId, order.id), eq(payments.status, 'pending')));
      // Give the buyer a few minutes to finish this attempt.
      const minDue = new Date(Date.now() + 10 * 60_000);
      await tx.update(orders).set({ paymentMethod: method, paymentDueAt: locked.paymentDueAt && locked.paymentDueAt > minDue ? locked.paymentDueAt : minDue }).where(eq(orders.id, order.id));
      return this.payments.create(tx, { orderId: order.id, method, amount: fromMinor(toMinor(locked.grandTotal) - toMinor(locked.refundedTotal)), idempotencyKey: `${order.id}:${key}`, expiresAt: minDue });
    });
    const { redirectUrl } = await this.payments.initiate(payment.id);
    return { paymentId: payment.id, redirectUrl };
  }

  // ------------------------------------------------------------------ payment results

  private async onPaymentSettled(payment: PaymentRow, result: GatewayResult, tx: DbOrTx): Promise<void> {
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.orderId)).for('update');
    if (!order) return;
    if (result.status !== 'paid') {
      await tx.insert(orderStatusHistory).values({ orderId: order.id, toStatus: order.status, actorRole: 'system', note: `payment_${result.status}${result.failureReason ? `: ${result.failureReason}` : ''}`.slice(0, 300) });
      return;
    }
    const now = new Date();
    await tx.update(orders).set({ paymentStatus: 'paid', paidAt: now, paymentMethod: payment.method, paymentDueAt: null, updatedAt: now }).where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values({ orderId: order.id, toStatus: order.status, actorRole: 'system', note: `payment_received:${payment.method}` });
    if (order.status === 'cancelled') {
      // Money arrived after the order expired: give it back automatically.
      await this.refunds.create(tx, { orderId: order.id, paymentId: payment.id, amount: payment.amount, reason: 'Payment received after the order was cancelled', requestedBy: null });
      return;
    }
    await this.notifications.notify(order.userId, { type: 'order', titleKey: 'api.orders.paidTitle', bodyKey: 'api.orders.paidBody', params: { number: order.number, total: payment.amount }, link: `/account/orders/${order.number}` }, tx);
    if (await this.deliverDigital(tx, order)) {
      await this.notifications.notify(order.userId, { type: 'delivery', titleKey: 'api.digital.readyTitle', bodyKey: 'api.digital.readyBody', params: { number: order.number }, link: '/library?digital=1' }, tx);
    }
    await this.notifySellersOfNewOrder(order.id, tx);
  }

  /**
   * Paid e-books are delivered on the spot: each buyer gets the file in their library, and a seller
   * order holding only e-books is complete. Returns whether anything digital was delivered.
   */
  private async deliverDigital(tx: DbOrTx, order: OrderRow): Promise<boolean> {
    const items = await tx.select().from(orderItems).where(and(eq(orderItems.orderId, order.id), eq(orderItems.isDigital, true)));
    if (!items.length) return false;
    const subs = await tx.select().from(sellerOrders).where(eq(sellerOrders.orderId, order.id)).for('update');
    const all = await tx.select({ sellerOrderId: orderItems.sellerOrderId, isDigital: orderItems.isDigital }).from(orderItems).where(eq(orderItems.orderId, order.id));
    const now = new Date();
    const delivered = new Set<string>();
    for (const so of subs) {
      const lines = all.filter((i) => i.sellerOrderId === so.id);
      if (!lines.length || !lines.every((i) => i.isDigital) || !['pending', 'confirmed'].includes(so.status)) continue;
      await tx.update(sellerOrders).set({ status: 'delivered', confirmedAt: so.confirmedAt ?? now, deliveredAt: now, updatedAt: now }).where(eq(sellerOrders.id, so.id));
      await tx.insert(orderStatusHistory).values({ orderId: order.id, sellerOrderId: so.id, fromStatus: so.status, toStatus: 'delivered', actorRole: 'system', note: 'digital_delivery' });
      delivered.add(so.id);
    }
    // Counters move with the completed e-book orders; e-books inside a parcel order are counted when it arrives.
    await recordDelivery(tx, order.userId, items.filter((i) => delivered.has(i.sellerOrderId)));
    for (const i of items.filter((x) => !delivered.has(x.sellerOrderId) && x.bookId)) {
      await tx.execute(sql`
        insert into user_library (user_id, book_id, shelf, source, order_item_id, has_digital_access) values (${order.userId}, ${i.bookId}, 'purchased', 'purchase', ${i.id}, true)
        on conflict (user_id, book_id) do update set order_item_id = excluded.order_item_id, source = 'purchase', has_digital_access = true, updated_at = now()`);
    }
    if (delivered.size) {
      const statuses = subs.map((s) => (delivered.has(s.id) ? 'delivered' : s.status));
      await tx.update(orders).set({ status: deriveOrderStatus(statuses), updatedAt: now }).where(eq(orders.id, order.id));
    }
    return true;
  }

  private async notifySellersOfNewOrder(orderId: string, tx: DbOrTx = this.db): Promise<void> {
    const rows = await tx
      .select({ userId: sellers.userId, number: sellerOrders.number, id: sellerOrders.id })
      .from(sellerOrders)
      .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
      .where(and(eq(sellerOrders.orderId, orderId), ne(sellerOrders.status, 'cancelled')));
    for (const r of rows) {
      await this.notifications.notify(r.userId, { type: 'order', titleKey: 'api.orders.newSellerOrderTitle', bodyKey: 'api.orders.newSellerOrderBody', params: { number: r.number }, link: `/seller/orders/${r.id}` }, tx).catch(() => undefined);
    }
  }

  // ------------------------------------------------------------------ buyer views

  async ownOrder(userId: string, number: string): Promise<OrderRow> {
    const [order] = await this.db.select().from(orders).where(and(eq(orders.number, number), eq(orders.userId, userId)));
    if (!order) throw AppException.notFound('Order');
    return order;
  }

  async listForBuyer(userId: string, page: number, pageSize: number) {
    const [rows, [{ total } = { total: 0 }]] = await Promise.all([
      this.db.execute<Record<string, unknown>>(sql`
        select o.id, o.number, o.status, o.payment_status, o.payment_method, o.grand_total, o.placed_at, o.payment_due_at,
          (select count(*)::int from order_items oi where oi.order_id = o.id) as line_count,
          (select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = o.id) as item_count,
          (select json_agg(x) from (select oi.title, oi.image_key from order_items oi where oi.order_id = o.id order by oi.created_at limit 3) x) as preview
        from orders o where o.user_id = ${userId} order by o.placed_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`),
      this.db.select({ total: sql<number>`count(*)::int` }).from(orders).where(eq(orders.userId, userId)),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id,
        number: r.number,
        status: r.status,
        paymentStatus: r.payment_status,
        paymentMethod: r.payment_method,
        grandTotal: r.grand_total,
        placedAt: new Date(r.placed_at as string).toISOString(),
        paymentDueAt: r.payment_due_at ? new Date(r.payment_due_at as string).toISOString() : null,
        itemCount: r.item_count,
        preview: ((r.preview as Array<{ title: string; image_key: string | null }> | null) ?? []).map((p) => ({ title: p.title, imageUrl: this.storage.publicUrl(p.image_key) })),
      })),
      meta: { page, pageSize, total },
    };
  }

  /** Full order for its buyer (or staff): sub-orders, items, shipments with tracking, payments, refunds. */
  async detail(order: OrderRow) {
    const [subOrders, items, tracking, paymentRows, refundRows, returnRows, history, slugRows] = await Promise.all([
      this.db.execute<Record<string, unknown>>(sql`
        select so.*, st.name as store_name, st.slug as store_slug, st.phone as store_phone
        from seller_orders so left join seller_stores st on st.seller_id = so.seller_id where so.order_id = ${order.id} order by so.number`),
      this.db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.createdAt)),
      this.db
        .select({ shipment: shipments, event: shipmentTracking })
        .from(shipments)
        .innerJoin(sellerOrders, eq(sellerOrders.id, shipments.sellerOrderId))
        .leftJoin(shipmentTracking, eq(shipmentTracking.shipmentId, shipments.id))
        .where(eq(sellerOrders.orderId, order.id))
        .orderBy(asc(shipmentTracking.occurredAt)),
      this.db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt)),
      this.db.execute<Record<string, unknown>>(sql`select id, seller_order_id, amount, status, reason, created_at, processed_at from refunds where order_id = ${order.id} order by created_at desc`),
      this.db.execute<Record<string, unknown>>(sql`
        select r.id, r.seller_order_id, r.status, r.reason, r.details, r.seller_note, r.created_at,
          (select json_agg(json_build_object('orderItemId', ri.order_item_id, 'quantity', ri.quantity)) from return_items ri where ri.return_request_id = r.id) as items
        from return_requests r join seller_orders so on so.id = r.seller_order_id where so.order_id = ${order.id} order by r.created_at desc`),
      this.db.select().from(orderStatusHistory).where(and(eq(orderStatusHistory.orderId, order.id), isNotNull(orderStatusHistory.actorRole))).orderBy(asc(orderStatusHistory.createdAt)),
      this.db.execute<{ id: string; book_slug: string | null; product_slug: string | null }>(sql`
        select oi.id, b.slug as book_slug, p.slug as product_slug from order_items oi
        left join books b on b.id = oi.book_id and b.deleted_at is null left join products p on p.id = oi.product_id and p.deleted_at is null
        where oi.order_id = ${order.id}`),
    ]);
    // Books are reviewed on the book page (shared by every seller), other products on their own page.
    const reviewPath = new Map(slugRows.rows.map((r) => [r.id, r.book_slug ? `/books/${r.book_slug}` : r.product_slug ? `/products/${r.product_slug}` : null]));
    const returnWindowDays = await this.settings.number('orders.returnWindowDays', 7);
    const shipmentsBySo = new Map<string, { courier: string; trackingNumber: string | null; trackingUrl: string | null; status: string; events: Array<{ status: string; note: string | null; location: string | null; at: string }> }>();
    for (const { shipment, event } of tracking) {
      const entry = shipmentsBySo.get(shipment.sellerOrderId) ?? { courier: shipment.courier, trackingNumber: shipment.trackingNumber, trackingUrl: shipment.trackingUrl, status: shipment.status, events: [] };
      if (event) entry.events.push({ status: event.status, note: event.note, location: event.location, at: event.occurredAt.toISOString() });
      shipmentsBySo.set(shipment.sellerOrderId, entry);
    }
    const latestPayment = paymentRows[0];
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totals: { itemsSubtotal: order.itemsSubtotal, discountTotal: order.discountTotal, shippingTotal: order.shippingTotal, grandTotal: order.grandTotal, refundedTotal: order.refundedTotal },
      couponCode: order.couponCode,
      shippingAddress: order.shippingAddress,
      note: order.customerNote,
      placedAt: order.placedAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      paymentDueAt: order.paymentDueAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      cancelReason: order.cancelReason,
      canCancel: order.status !== 'cancelled' && subOrders.rows.every((so) => ['pending', 'confirmed', 'cancelled'].includes(so.status as string)),
      canPay: order.status !== 'cancelled' && order.paymentStatus === 'pending' && order.paymentMethod !== 'cod',
      payment: latestPayment ? { id: latestPayment.id, method: latestPayment.method, status: latestPayment.status, redirectUrl: latestPayment.status === 'pending' ? latestPayment.redirectUrl : null, failureReason: latestPayment.failureReason } : null,
      sellerOrders: subOrders.rows.map((so) => {
        const deliveredAt = so.delivered_at ? new Date(so.delivered_at as string) : null;
        // E-books can't be returned, so a parcel of e-books only has no return window.
        const physical = items.some((i) => i.sellerOrderId === so.id && !i.isDigital);
        return {
          id: so.id as string,
          number: so.number as string,
          status: so.status as OrderStatus,
          store: { name: so.store_name as string, slug: so.store_slug as string },
          itemsSubtotal: so.items_subtotal as string,
          discountTotal: so.discount_total as string,
          shippingFee: so.shipping_fee as string,
          total: sellerOrderTotal({ itemsSubtotal: so.items_subtotal as string, discountTotal: so.discount_total as string, shippingFee: so.shipping_fee as string }),
          shippedAt: so.shipped_at ? new Date(so.shipped_at as string).toISOString() : null,
          deliveredAt: deliveredAt?.toISOString() ?? null,
          cancelReason: so.cancel_reason as string | null,
          returnableUntil: deliveredAt && so.status === 'delivered' && physical ? new Date(deliveredAt.getTime() + returnWindowDays * 86_400_000).toISOString() : null,
          shipment: shipmentsBySo.get(so.id as string) ?? null,
          items: items
            .filter((i) => i.sellerOrderId === so.id)
            .map((i) => ({ id: i.id, productId: i.productId, bookId: i.bookId, title: i.title, variantName: i.variantName, condition: i.condition, isDigital: i.isDigital, imageUrl: this.storage.publicUrl(i.imageKey), quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, lineTotal: i.lineTotal, refundedQuantity: i.refundedQuantity, path: reviewPath.get(i.id) ?? null })),
        };
      }),
      refunds: refundRows.rows.map((r) => ({ id: r.id, sellerOrderId: r.seller_order_id, amount: r.amount, status: r.status, reason: r.reason, createdAt: new Date(r.created_at as string).toISOString(), processedAt: r.processed_at ? new Date(r.processed_at as string).toISOString() : null })),
      returns: returnRows.rows.map((r) => ({ id: r.id, sellerOrderId: r.seller_order_id, status: r.status, reason: r.reason, details: r.details, sellerNote: r.seller_note, items: r.items ?? [], createdAt: new Date(r.created_at as string).toISOString() })),
      history: history.map((h) => ({ status: h.toStatus, note: h.note, actorRole: h.actorRole, sellerOrderId: h.sellerOrderId, at: h.createdAt.toISOString() })),
    };
  }

  async byNumber(number: string): Promise<OrderRow> {
    const [order] = await this.db.select().from(orders).where(eq(orders.number, number));
    if (!order) throw AppException.notFound('Order');
    return order;
  }

  /** Staff order list with filters (status, payment, search by number, phone or name). */
  async adminList(filter: { status?: string; paymentStatus?: string; q?: string; page: number; pageSize: number }) {
    const conditions = [sql`true`];
    if (filter.status) conditions.push(sql`o.status::text = ${filter.status}`);
    if (filter.paymentStatus) conditions.push(sql`o.payment_status::text = ${filter.paymentStatus}`);
    if (filter.q) {
      const like = `%${filter.q.replace(/[%_\\]/g, '')}%`;
      conditions.push(sql`(o.number ilike ${like} or u.display_name ilike ${like} or u.phone ilike ${like} or o.shipping_address->>'phone' ilike ${like})`);
    }
    const where = sql.join(conditions, sql` and `);
    const [rows, total] = await Promise.all([
      this.db.execute<Record<string, unknown>>(sql`
        select o.id, o.number, o.status, o.payment_status, o.payment_method, o.grand_total, o.refunded_total, o.placed_at,
          u.display_name, u.username, o.shipping_address->>'district' as district,
          (select count(*)::int from seller_orders so where so.order_id = o.id) as seller_count
        from orders o join users u on u.id = o.user_id where ${where} order by o.placed_at desc limit ${filter.pageSize} offset ${(filter.page - 1) * filter.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from orders o join users u on u.id = o.user_id where ${where}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id,
        number: r.number,
        status: r.status,
        paymentStatus: r.payment_status,
        paymentMethod: r.payment_method,
        grandTotal: r.grand_total,
        refundedTotal: r.refunded_total,
        placedAt: new Date(r.placed_at as string).toISOString(),
        customer: { name: r.display_name, username: r.username },
        district: r.district,
        sellerCount: r.seller_count,
      })),
      meta: { page: filter.page, pageSize: filter.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  // ------------------------------------------------------------------ cancellation

  /** Buyer (or staff) cancels the whole order while nothing has been packed yet. */
  async cancel(order: OrderRow, actor: Actor, reason: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for('update');
      if (!locked || locked.status === 'cancelled') throw new AppException('CONFLICT', 'api.commerce.alreadyCancelled');
      const subs = await tx.select().from(sellerOrders).where(eq(sellerOrders.orderId, order.id)).for('update');
      if (actor.role === 'buyer' && subs.some((s) => !['pending', 'confirmed', 'cancelled'].includes(s.status))) throw new AppException('CONFLICT', 'api.commerce.cannotCancel');
      if (subs.some((s) => ['shipped', 'out_for_delivery', 'delivered', 'returned', 'refunded'].includes(s.status))) throw new AppException('CONFLICT', 'api.commerce.cannotCancelShipped');
      await this.cancelOrderTx(tx, locked, subs.filter((s) => s.status !== 'cancelled').map((s) => s.id), actor, reason);
    });
    await this.notifications.notify(order.userId, { type: 'order', titleKey: 'api.orders.cancelledTitle', bodyKey: 'api.orders.cancelledBody', params: { number: order.number }, link: `/account/orders/${order.number}` }).catch(() => undefined);
  }

  /**
   * Cancels some (or all remaining) sub-orders: releases their stock, refunds what was paid for them,
   * and cancels the order itself once nothing is left (also giving the coupon back).
   */
  async cancelOrderTx(tx: DbOrTx, order: OrderRow, sellerOrderIds: string[], actor: Actor, reason: string): Promise<void> {
    if (!sellerOrderIds.length) return;
    const now = new Date();
    const subs = await tx.select().from(sellerOrders).where(inArray(sellerOrders.id, sellerOrderIds));
    const items = await tx.select().from(orderItems).where(inArray(orderItems.sellerOrderId, sellerOrderIds));
    await tx.update(sellerOrders).set({ status: 'cancelled', cancelledAt: now, cancelReason: reason, updatedAt: now }).where(inArray(sellerOrders.id, sellerOrderIds));
    await tx.insert(orderStatusHistory).values(subs.map((s) => ({ orderId: order.id, sellerOrderId: s.id, fromStatus: s.status, toStatus: 'cancelled' as const, actorId: actor.id, actorRole: actor.role, note: reason })));
    await releaseStock(
      tx,
      items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, quantity: i.quantity })),
      { type: 'order', id: order.id, actorId: actor.id },
    );
    await revokeDigitalAccess(tx, items.filter((i) => i.isDigital).map((i) => i.id));

    const all = await tx.select({ id: sellerOrders.id, status: sellerOrders.status }).from(sellerOrders).where(eq(sellerOrders.orderId, order.id));
    const status = deriveOrderStatus(all.map((s) => s.status));
    const cancelledAmount = subs.reduce((sum, s) => sum + toMinor(sellerOrderTotal(s)), 0);
    if (status === 'cancelled') {
      await tx.update(orders).set({ status, cancelledAt: now, cancelReason: reason, paymentDueAt: null, updatedAt: now }).where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: order.status, toStatus: 'cancelled', actorId: actor.id, actorRole: actor.role, note: reason });
      if (order.couponId) {
        const removed = await tx.delete(couponUsages).where(and(eq(couponUsages.orderId, order.id), eq(couponUsages.couponId, order.couponId))).returning({ id: couponUsages.id });
        if (removed.length) await tx.update(coupons).set({ usedCount: sql`greatest(${coupons.usedCount} - 1, 0)` }).where(eq(coupons.id, order.couponId));
      }
      await tx.update(payments).set({ status: 'cancelled', failureReason: 'order_cancelled' }).where(and(eq(payments.orderId, order.id), eq(payments.status, 'pending')));
    } else {
      await tx.update(orders).set({ status, updatedAt: now }).where(eq(orders.id, order.id));
      // Cash on delivery: the courier collects less.
      await tx
        .update(payments)
        .set({ amount: sql`greatest(${payments.amount} - ${fromMinor(cancelledAmount)}::numeric, 0)` })
        .where(and(eq(payments.orderId, order.id), eq(payments.status, 'pending'), eq(payments.provider, 'cod')));
    }

    if (order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded') {
      const [paid] = await tx.select().from(payments).where(and(eq(payments.orderId, order.id), inArray(payments.status, ['paid', 'partially_refunded']))).orderBy(desc(payments.paidAt)).limit(1);
      if (paid) {
        // Each cancelled sub-order refunds its own total (items − discount + shipping), less any
        // refund already issued for it, and never more than is left on the payment.
        const open = await tx.execute<{ seller_order_id: string | null; amount: string }>(sql`
          select seller_order_id, amount from refunds where order_id = ${order.id} and status not in ('rejected', 'failed')`);
        let remaining = toMinor(paid.amount) - open.rows.reduce((n, r) => n + toMinor(r.amount), 0);
        for (const s of subs) {
          const already = open.rows.filter((r) => r.seller_order_id === s.id).reduce((n, r) => n + toMinor(r.amount), 0);
          const share = Math.min(toMinor(sellerOrderTotal(s)) - already, remaining);
          if (share <= 0) continue;
          await this.refunds.create(tx, { orderId: order.id, sellerOrderId: s.id, paymentId: paid.id, amount: fromMinor(share), reason, requestedBy: actor.id });
          remaining -= share;
        }
      }
    }
    const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is string => !!id))];
    await refreshProductStock(tx, productIds);
    await refreshBookOffers(tx, [...new Set(items.map((i) => i.bookId).filter((id): id is string => !!id))]);
  }

  // ------------------------------------------------------------------ expiry

  /** Online orders not paid in time are cancelled and their stock released (after asking the gateway). */
  @Cron('*/1 * * * *')
  async expireUnpaid(): Promise<void> {
    if (this.config.isTest) return;
    await withCronLock(this.redis, 'expire-orders', 55, async () => {
      await this.expireNow();
    });
  }

  async expireNow(limit = 50): Promise<number> {
    const due = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.status, 'pending'), eq(orders.paymentStatus, 'pending'), ne(orders.paymentMethod, 'cod'), lt(orders.paymentDueAt, new Date())))
      .orderBy(asc(orders.paymentDueAt))
      .limit(limit);
    let expired = 0;
    for (const order of due) {
      const pending = await this.db.select().from(payments).where(and(eq(payments.orderId, order.id), eq(payments.status, 'pending')));
      for (const p of pending) await this.payments.verify(p);
      const [fresh] = await this.db.select().from(orders).where(eq(orders.id, order.id));
      if (!fresh || fresh.paymentStatus !== 'pending' || fresh.status !== 'pending') continue;
      try {
        await this.db.transaction(async (tx) => {
          const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for('update');
          if (!locked || locked.status !== 'pending' || locked.paymentStatus !== 'pending') return;
          const subs = await tx.select({ id: sellerOrders.id }).from(sellerOrders).where(and(eq(sellerOrders.orderId, order.id), ne(sellerOrders.status, 'cancelled')));
          await this.cancelOrderTx(tx, locked, subs.map((s) => s.id), { id: null, role: 'system' }, 'Payment was not completed in time');
        });
        expired++;
        await this.notifications.notify(order.userId, { type: 'order', titleKey: 'api.orders.expiredTitle', bodyKey: 'api.orders.expiredBody', params: { number: order.number }, link: `/account/orders/${order.number}` }).catch(() => undefined);
      } catch (error) {
        this.logger.warn(`Could not expire order ${order.number}: ${(error as Error).message}`);
      }
    }
    return expired;
  }
}
