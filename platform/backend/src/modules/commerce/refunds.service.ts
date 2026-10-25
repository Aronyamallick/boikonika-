import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { orderItems, orders, payments, refunds, returnRequests, sellerOrders, type Database, type DbOrTx } from '@boikonika/database';
import { fromMinor, toMinor } from '@boikonika/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { deriveOrderStatus } from './order-status';
import { PaymentsService } from './payments/payments.service';

type RefundRow = typeof refunds.$inferSelect;

/**
 * Refunds are created inside the order transaction (status `approved`) and sent to the gateway by a
 * short-interval job, so no network call happens while rows are locked. Cash-on-delivery money has no
 * gateway to return through: those refunds wait for staff to pay them (bKash/bank) and record it.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger('Refunds');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(
    tx: DbOrTx,
    input: { orderId: string; sellerOrderId?: string | null; paymentId?: string | null; returnRequestId?: string | null; amount: string; reason: string; requestedBy: string | null; approvedBy?: string | null },
  ): Promise<RefundRow> {
    let paymentId = input.paymentId ?? null;
    if (!paymentId) {
      const [paid] = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.orderId, input.orderId), inArray(payments.status, ['paid', 'partially_refunded']))).orderBy(desc(payments.paidAt)).limit(1);
      paymentId = paid?.id ?? null;
    }
    const [row] = await tx
      .insert(refunds)
      .values({ orderId: input.orderId, sellerOrderId: input.sellerOrderId ?? null, paymentId, returnRequestId: input.returnRequestId ?? null, amount: input.amount, reason: input.reason.slice(0, 500), status: 'approved', requestedBy: input.requestedBy, approvedBy: input.approvedBy ?? input.requestedBy })
      .returning();
    return row!;
  }

  /** Staff-initiated refund (goodwill, damaged parcel…), limited to what is still refundable. */
  async createManual(actorId: string, orderId: string, input: { amount: string; sellerOrderId?: string; reason: string }) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
      if (!order) throw AppException.notFound('Order');
      if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') throw new AppException('CONFLICT', 'api.commerce.nothingToRefund');
      if (input.sellerOrderId) {
        const [so] = await tx.select({ id: sellerOrders.id }).from(sellerOrders).where(and(eq(sellerOrders.id, input.sellerOrderId), eq(sellerOrders.orderId, orderId)));
        if (!so) throw AppException.notFound('Seller order');
      }
      const [{ committed } = { committed: '0' }] = await tx.execute<{ committed: string }>(sql`select coalesce(sum(amount), 0)::text as committed from refunds where order_id = ${orderId} and status not in ('rejected', 'failed')`).then((r) => r.rows);
      const refundable = toMinor(order.grandTotal) - toMinor(committed);
      if (toMinor(input.amount) > refundable) {
        throw new AppException('VALIDATION_FAILED', 'api.commerce.refundTooLarge', [{ field: 'amount', code: 'too_large', message: 'api.commerce.refundTooLarge' }]).withParams({ amount: fromMinor(Math.max(0, refundable)) });
      }
      const refund = await this.create(tx, { orderId, sellerOrderId: input.sellerOrderId ?? null, amount: input.amount, reason: input.reason, requestedBy: actorId, approvedBy: actorId });
      await this.audit.record({ action: 'refund.create', entityType: 'order', entityId: orderId, actorId, after: { refundId: refund.id, amount: input.amount } }, tx);
      return refund;
    });
  }

  @Cron('*/1 * * * *')
  async processQueue(): Promise<void> {
    if (this.config.isTest) return;
    const ok = await this.redis.set('lock:cron:refunds', '1', 'EX', 55, 'NX').catch(() => null);
    if (!ok) return;
    try {
      await this.processApproved();
    } finally {
      await this.redis.del('lock:cron:refunds').catch(() => undefined);
    }
  }

  /** Sends approved refunds to their gateway (or parks COD refunds for staff). */
  async processApproved(limit = 20): Promise<void> {
    const queue = await this.db.select().from(refunds).where(eq(refunds.status, 'approved')).orderBy(asc(refunds.createdAt)).limit(limit);
    for (const refund of queue) {
      const claimed = await this.db.update(refunds).set({ status: 'processing', updatedAt: new Date() }).where(and(eq(refunds.id, refund.id), eq(refunds.status, 'approved'))).returning();
      if (!claimed.length) continue;
      const [payment] = refund.paymentId ? await this.db.select().from(payments).where(eq(payments.id, refund.paymentId)) : [];
      if (!payment || payment.provider === 'cod') {
        // Waits in "processing" until staff record the bKash/bank transfer.
        await this.db.update(refunds).set({ method: 'bkash' }).where(eq(refunds.id, refund.id));
        continue;
      }
      try {
        const result = await this.payments.gateway(payment.provider).refund(this.payments.stored(payment), refund.amount, refund.reason, refund.id);
        if (result.status === 'failed') {
          await this.db.update(refunds).set({ status: 'failed', failureReason: result.failureReason?.slice(0, 300) ?? 'failed', updatedAt: new Date() }).where(eq(refunds.id, refund.id));
          this.logger.warn(`Refund ${refund.id} failed at ${payment.provider}: ${result.failureReason}`);
        } else {
          await this.complete(refund.id, result.providerRefundId ?? null, null, result.status === 'processing');
        }
      } catch (error) {
        // Network trouble: try again on the next run.
        await this.db.update(refunds).set({ status: 'approved', updatedAt: new Date() }).where(eq(refunds.id, refund.id));
        this.logger.warn(`Refund ${refund.id} will be retried: ${(error as Error).message}`);
      }
    }
  }

  /** Records a refund as done: payment, order and sub-order totals, seller earnings and returns follow. */
  async complete(refundId: string, providerRefundId: string | null, actorId: string | null, settlingAtBank = false): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for('update');
      if (!refund || refund.status === 'completed') return;
      if (refund.status !== 'processing') throw new AppException('CONFLICT', 'api.commerce.refundNotProcessing');
      const now = new Date();
      await tx.update(refunds).set({ status: 'completed', providerRefundId, processedAt: now, approvedBy: refund.approvedBy ?? actorId, failureReason: settlingAtBank ? 'settling_at_bank' : null, updatedAt: now }).where(eq(refunds.id, refund.id));

      if (refund.paymentId) {
        const [p] = await tx
          .update(payments)
          .set({ refundedAmount: sql`least(${payments.refundedAmount} + ${refund.amount}::numeric, ${payments.amount})` })
          .where(eq(payments.id, refund.paymentId))
          .returning();
        if (p) await tx.update(payments).set({ status: toMinor(p.refundedAmount) >= toMinor(p.amount) ? 'refunded' : 'partially_refunded' }).where(eq(payments.id, p.id));
      }
      const [order] = await tx
        .update(orders)
        .set({ refundedTotal: sql`least(${orders.refundedTotal} + ${refund.amount}::numeric, ${orders.grandTotal})`, updatedAt: now })
        .where(eq(orders.id, refund.orderId))
        .returning();
      if (order) {
        await tx.update(orders).set({ paymentStatus: toMinor(order.refundedTotal) >= toMinor(order.grandTotal) ? 'refunded' : 'partially_refunded' }).where(eq(orders.id, order.id));
      }
      if (refund.sellerOrderId) {
        // The seller gives up the refunded sale; the platform gives back its commission share.
        const [so] = await tx.select().from(sellerOrders).where(eq(sellerOrders.id, refund.sellerOrderId)).for('update');
        if (so) {
          const pct = Number(so.commissionPercent);
          const amount = toMinor(refund.amount);
          const commissionBack = Math.round((amount * Math.round(pct * 100)) / 10000);
          const nextRefunded = toMinor(so.refundedTotal) + amount;
          const total = toMinor(so.itemsSubtotal) - toMinor(so.discountTotal) + toMinor(so.shippingFee);
          const fullyRefunded = nextRefunded >= total && (so.status === 'cancelled' || so.status === 'returned' || so.status === 'delivered');
          await tx
            .update(sellerOrders)
            .set({
              refundedTotal: fromMinor(nextRefunded),
              commissionAmount: fromMinor(Math.max(0, toMinor(so.commissionAmount) - commissionBack)),
              sellerEarning: fromMinor(Math.max(0, toMinor(so.sellerEarning) - (amount - commissionBack))),
              status: fullyRefunded && so.status !== 'cancelled' ? 'refunded' : so.status,
              updatedAt: now,
            })
            .where(eq(sellerOrders.id, so.id));
          if (fullyRefunded && so.status !== 'cancelled') {
            const all = await tx.select({ status: sellerOrders.status }).from(sellerOrders).where(eq(sellerOrders.orderId, refund.orderId));
            await tx.update(orders).set({ status: deriveOrderStatus(all.map((s) => s.status)) }).where(eq(orders.id, refund.orderId));
          }
        }
      }
      if (refund.returnRequestId) await tx.update(returnRequests).set({ status: 'refunded', updatedAt: now }).where(eq(returnRequests.id, refund.returnRequestId));
      if (actorId) await this.audit.record({ action: 'refund.complete', entityType: 'refund', entityId: refund.id, actorId, after: { reference: providerRefundId } }, tx);
      if (order) {
        await this.notifications.notify(order.userId, { type: 'order', titleKey: 'api.orders.refundedTitle', bodyKey: 'api.orders.refundedBody', params: { number: order.number, amount: refund.amount }, link: `/account/orders/${order.number}` }, tx).catch(() => undefined);
      }
    });
  }

  /** Staff: retry a refund the gateway rejected (e.g. after fixing the merchant balance). */
  async retry(refundId: string): Promise<void> {
    const updated = await this.db.update(refunds).set({ status: 'approved', failureReason: null, updatedAt: new Date() }).where(and(eq(refunds.id, refundId), eq(refunds.status, 'failed'))).returning({ id: refunds.id });
    if (!updated.length) throw new AppException('CONFLICT', 'api.commerce.refundNotFailed');
  }

  async list(filter: { status?: string; page: number; pageSize: number }) {
    const where = filter.status ? sql`r.status::text = ${filter.status}` : sql`true`;
    const [rows, total] = await Promise.all([
      this.db.execute<Record<string, unknown>>(sql`
        select r.id, r.amount, r.status, r.reason, r.method, r.provider_refund_id, r.failure_reason, r.created_at, r.processed_at,
          o.number as order_number, p.provider, p.method as payment_method, u.display_name as customer, u.phone as customer_phone
        from refunds r join orders o on o.id = r.order_id join users u on u.id = o.user_id left join payments p on p.id = r.payment_id
        where ${where} order by r.created_at desc limit ${filter.pageSize} offset ${(filter.page - 1) * filter.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from refunds r where ${where}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        reason: r.reason,
        method: r.method,
        reference: r.provider_refund_id,
        failureReason: r.failure_reason,
        orderNumber: r.order_number,
        provider: r.provider,
        paymentMethod: r.payment_method,
        customer: { name: r.customer, phone: r.customer_phone },
        createdAt: new Date(r.created_at as string).toISOString(),
        processedAt: r.processed_at ? new Date(r.processed_at as string).toISOString() : null,
      })),
      meta: { page: filter.page, pageSize: filter.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  /** Quantity bookkeeping for returned items (called when a return is refunded). */
  async markItemsRefunded(tx: DbOrTx, items: Array<{ orderItemId: string; quantity: number }>): Promise<void> {
    for (const i of items) {
      await tx.update(orderItems).set({ refundedQuantity: sql`least(${orderItems.refundedQuantity} + ${i.quantity}, ${orderItems.quantity})` }).where(eq(orderItems.id, i.orderItemId));
    }
  }
}
