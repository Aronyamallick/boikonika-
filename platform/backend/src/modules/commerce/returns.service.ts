import { Inject, Injectable } from '@nestjs/common';
import { orderItems, orderStatusHistory, orders, returnItems, returnRequests, sellerOrders, sellers, type Database } from '@boikonika/database';
import { fromMinor, toMinor, type returnDecisionSchema, type returnRequestSchema } from '@boikonika/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { NotificationsService } from '../notifications/notifications.service';
import { SellersService } from '../marketplace/sellers.service';
import { SettingsService } from '../settings/settings.service';
import { restockReturned } from './inventory';
import { deriveOrderStatus } from './order-status';
import { RefundsService } from './refunds.service';

/**
 * Returns: the buyer asks within the return window → the seller approves or declines (with a reason)
 * → when the parcel comes back the seller marks it received (optionally restocking) → refund.
 */
@Injectable()
export class ReturnsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sellers: SellersService,
    private readonly refunds: RefundsService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async request(userId: string, orderNumber: string, input: z.output<typeof returnRequestSchema>) {
    const windowDays = await this.settings.number('orders.returnWindowDays', 7);
    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ so: sellerOrders, order: orders })
        .from(sellerOrders)
        .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
        .where(and(eq(sellerOrders.id, input.sellerOrderId), eq(orders.number, orderNumber), eq(orders.userId, userId)))
        .for('update');
      if (!row) throw AppException.notFound('Order');
      const { so, order } = row;
      if (so.status !== 'delivered' || !so.deliveredAt) throw new AppException('CONFLICT', 'api.commerce.returnNotDelivered');
      if (Date.now() > so.deliveredAt.getTime() + windowDays * 86_400_000) throw new AppException('CONFLICT', 'api.commerce.returnWindowClosed').withParams({ days: windowDays });
      const [open] = await tx.select({ id: returnRequests.id }).from(returnRequests).where(and(eq(returnRequests.sellerOrderId, so.id), inArray(returnRequests.status, ['requested', 'approved', 'received'])));
      if (open) throw new AppException('CONFLICT', 'api.commerce.returnOpen');

      const items = await tx.select().from(orderItems).where(eq(orderItems.sellerOrderId, so.id));
      const previous = await tx.execute<{ order_item_id: string; quantity: number }>(sql`
        select ri.order_item_id, sum(ri.quantity)::int as quantity from return_items ri join return_requests r on r.id = ri.return_request_id
        where r.seller_order_id = ${so.id} and r.status in ('received', 'refunded') group by ri.order_item_id`);
      for (const [index, wanted] of input.items.entries()) {
        const item = items.find((i) => i.id === wanted.orderItemId);
        if (!item) throw AppException.validation([{ field: `items.${index}.orderItemId`, code: 'invalid', message: 'validation.invalidId' }]);
        const returned = previous.rows.find((p) => p.order_item_id === item.id)?.quantity ?? 0;
        if (wanted.quantity > item.quantity - Math.max(returned, item.refundedQuantity)) {
          throw AppException.validation([{ field: `items.${index}.quantity`, code: 'too_many', message: 'api.commerce.returnTooMany' }]);
        }
      }
      const [request] = await tx.insert(returnRequests).values({ sellerOrderId: so.id, userId, reason: input.reason, details: input.details ?? null }).returning();
      await tx.insert(returnItems).values(input.items.map((i) => ({ returnRequestId: request!.id, orderItemId: i.orderItemId, quantity: i.quantity })));
      await tx.insert(orderStatusHistory).values({ orderId: order.id, sellerOrderId: so.id, toStatus: so.status, actorId: userId, actorRole: 'buyer', note: `return_requested:${input.reason}` });
      const [seller] = await tx.select({ userId: sellers.userId }).from(sellers).where(eq(sellers.id, so.sellerId));
      return { request: request!, sellerUserId: seller?.userId, soNumber: so.number, soId: so.id };
    });
    if (created.sellerUserId) {
      await this.notifications
        .notify(created.sellerUserId, { type: 'order', titleKey: 'api.orders.returnRequestedTitle', bodyKey: 'api.orders.returnRequestedBody', params: { number: created.soNumber }, link: `/seller/orders/${created.soId}` })
        .catch(() => undefined);
    }
    return { id: created.request.id, status: created.request.status };
  }

  private async ownReturn(userId: string, returnId: string) {
    const seller = await this.sellers.requireSeller(userId);
    const [row] = await this.db
      .select({ request: returnRequests, so: sellerOrders, order: orders })
      .from(returnRequests)
      .innerJoin(sellerOrders, eq(sellerOrders.id, returnRequests.sellerOrderId))
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .where(and(eq(returnRequests.id, returnId), eq(sellerOrders.sellerId, seller.id)));
    if (!row) throw AppException.notFound('Return');
    return row;
  }

  async decide(userId: string, returnId: string, input: z.output<typeof returnDecisionSchema>) {
    const { request, order } = await this.ownReturn(userId, returnId);
    const updated = await this.db
      .update(returnRequests)
      .set({ status: input.approve ? 'approved' : 'rejected', sellerNote: input.note ?? null, decidedBy: userId, decidedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(returnRequests.id, request.id), eq(returnRequests.status, 'requested')))
      .returning({ id: returnRequests.id });
    if (!updated.length) throw new AppException('CONFLICT', 'api.commerce.returnNotPending');
    await this.notifications
      .notify(order.userId, { type: 'order', titleKey: input.approve ? 'api.orders.returnApprovedTitle' : 'api.orders.returnRejectedTitle', bodyKey: input.approve ? 'api.orders.returnApprovedBody' : 'api.orders.returnRejectedBody', params: { number: order.number, note: input.note ?? '' }, link: `/account/orders/${order.number}` })
      .catch(() => undefined);
  }

  /** The parcel came back: restock (if sellable) and refund the returned lines. */
  async received(userId: string, returnId: string, restock: boolean) {
    const { request, so, order } = await this.ownReturn(userId, returnId);
    await this.db.transaction(async (tx) => {
      const claimed = await tx.update(returnRequests).set({ status: 'received', updatedAt: new Date() }).where(and(eq(returnRequests.id, request.id), eq(returnRequests.status, 'approved'))).returning({ id: returnRequests.id });
      if (!claimed.length) throw new AppException('CONFLICT', 'api.commerce.returnNotApproved');
      const lines = await tx.select({ ri: returnItems, item: orderItems }).from(returnItems).innerJoin(orderItems, eq(orderItems.id, returnItems.orderItemId)).where(eq(returnItems.returnRequestId, request.id));
      await tx.update(returnItems).set({ restock }).where(eq(returnItems.returnRequestId, request.id));
      if (restock) await restockReturned(tx, lines.filter((l) => l.item.variantId).map((l) => ({ variantId: l.item.variantId!, quantity: l.ri.quantity })), { type: 'return', id: request.id, actorId: userId });
      // Refund what was paid for those units: unit price less their share of the line discount.
      const amount = lines.reduce((sum, l) => sum + Math.round((toMinor(l.item.lineTotal) * l.ri.quantity) / l.item.quantity), 0);
      await this.refunds.markItemsRefunded(tx, lines.map((l) => ({ orderItemId: l.item.id, quantity: l.ri.quantity })));
      const all = await tx.select().from(orderItems).where(eq(orderItems.sellerOrderId, so.id));
      if (all.every((i) => i.refundedQuantity >= i.quantity)) {
        await tx.update(sellerOrders).set({ status: 'returned', updatedAt: new Date() }).where(eq(sellerOrders.id, so.id));
        const subs = await tx.select({ status: sellerOrders.status }).from(sellerOrders).where(eq(sellerOrders.orderId, order.id));
        await tx.update(orders).set({ status: deriveOrderStatus(subs.map((s) => s.status)) }).where(eq(orders.id, order.id));
      }
      await tx.insert(orderStatusHistory).values({ orderId: order.id, sellerOrderId: so.id, toStatus: all.every((i) => i.refundedQuantity >= i.quantity) ? 'returned' : so.status, actorId: userId, actorRole: 'seller', note: `return_received${restock ? ':restocked' : ''}` });
      if (amount > 0 && (order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded')) {
        await this.refunds.create(tx, { orderId: order.id, sellerOrderId: so.id, returnRequestId: request.id, amount: fromMinor(amount), reason: `Return: ${request.reason}`, requestedBy: userId });
      }
    });
  }
}
