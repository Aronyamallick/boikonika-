import { Inject, Injectable } from '@nestjs/common';
import { orderItems, orderStatusHistory, orders, payments, sellerOrders, shipments, shipmentTracking, type Database, type DbOrTx } from '@boikonika/database';
import { ORDER_STATUS_TRANSITIONS, type OrderStatus, type sellerOrderUpdateSchema, type ShipmentStatus } from '@boikonika/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SellersService } from '../marketplace/sellers.service';
import { recordDelivery } from './delivery';
import { fulfilStock } from './inventory';
import { deriveOrderStatus, sellerOrderTotal } from './order-status';
import { OrdersService } from './orders.service';

type UpdateInput = z.output<typeof sellerOrderUpdateSchema>;

/** Shipment state that matches each sub-order status (for the tracking timeline). */
const SHIPMENT_FOR: Partial<Record<OrderStatus, ShipmentStatus>> = { processing: 'packed', shipped: 'handed_to_courier', out_for_delivery: 'out_for_delivery', delivered: 'delivered' };

/** Sellers see and move only their own sub-orders; unpaid online orders stay hidden until paid. */
@Injectable()
export class SellerOrdersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sellers: SellersService,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  /** COD orders are actionable at once; online orders once the payment has arrived. */
  private readonly visible = sql`(o.payment_method = 'cod' or o.payment_status in ('paid', 'partially_refunded', 'refunded'))`;

  async list(userId: string, filter: { status?: string; returns?: 'requested'; q?: string; page: number; pageSize: number }) {
    const seller = await this.sellers.requireSeller(userId);
    const where = sql.join(
      [
        sql`so.seller_id = ${seller.id}`,
        this.visible,
        ...(filter.status ? [sql`so.status::text = ${filter.status}`] : []),
        ...(filter.returns ? [sql`exists(select 1 from return_requests r where r.seller_order_id = so.id and r.status = 'requested')`] : []),
        ...(filter.q ? [sql`(so.number ilike ${`%${filter.q.replace(/[%_\\]/g, '')}%`} or o.shipping_address->>'recipientName' ilike ${`%${filter.q.replace(/[%_\\]/g, '')}%`})`] : []),
      ],
      sql` and `,
    );
    const [rows, total] = await Promise.all([
      this.db.execute<Record<string, unknown>>(sql`
        select so.id, so.number, so.status, so.items_subtotal, so.discount_total, so.shipping_fee, so.seller_earning, so.created_at,
          o.payment_method, o.payment_status, o.shipping_address->>'recipientName' as recipient, o.shipping_address->>'district' as district,
          (select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.seller_order_id = so.id) as item_count
        from seller_orders so join orders o on o.id = so.order_id
        where ${where} order by so.created_at desc limit ${filter.pageSize} offset ${(filter.page - 1) * filter.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from seller_orders so join orders o on o.id = so.order_id where ${where}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id,
        number: r.number,
        status: r.status,
        total: sellerOrderTotal({ itemsSubtotal: r.items_subtotal as string, discountTotal: r.discount_total as string, shippingFee: r.shipping_fee as string }),
        earning: r.seller_earning,
        itemCount: r.item_count,
        paymentMethod: r.payment_method,
        paymentStatus: r.payment_status,
        recipient: r.recipient,
        district: r.district,
        createdAt: new Date(r.created_at as string).toISOString(),
      })),
      meta: { page: filter.page, pageSize: filter.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  async counts(userId: string): Promise<Record<string, number>> {
    const seller = await this.sellers.requireSeller(userId);
    const rows = await this.db.execute<{ status: string; n: number }>(sql`
      select so.status::text as status, count(*)::int as n from seller_orders so join orders o on o.id = so.order_id
      where so.seller_id = ${seller.id} and ${this.visible} group by so.status
      union all
      select 'returns', count(distinct r.seller_order_id)::int from return_requests r join seller_orders so on so.id = r.seller_order_id
      where so.seller_id = ${seller.id} and r.status = 'requested'`);
    return Object.fromEntries(rows.rows.filter((c) => c.n > 0).map((c) => [c.status, c.n]));
  }

  private async own(userId: string, sellerOrderId: string, tx: DbOrTx = this.db, lock = false) {
    const seller = await this.sellers.requireSeller(userId);
    const query = tx.select({ so: sellerOrders, order: orders }).from(sellerOrders).innerJoin(orders, eq(orders.id, sellerOrders.orderId)).where(and(eq(sellerOrders.id, sellerOrderId), eq(sellerOrders.sellerId, seller.id)));
    const [row] = lock ? await query.for('update') : await query;
    if (!row) throw AppException.notFound('Order');
    if (row.order.paymentMethod !== 'cod' && !['paid', 'partially_refunded', 'refunded'].includes(row.order.paymentStatus)) throw AppException.notFound('Order');
    return { seller, ...row };
  }

  async detail(userId: string, sellerOrderId: string) {
    const { so, order } = await this.own(userId, sellerOrderId);
    const [items, shipment, history, returns] = await Promise.all([
      this.db.select().from(orderItems).where(eq(orderItems.sellerOrderId, so.id)).orderBy(asc(orderItems.createdAt)),
      this.db.select().from(shipments).where(eq(shipments.sellerOrderId, so.id)).limit(1),
      this.db.select().from(orderStatusHistory).where(eq(orderStatusHistory.sellerOrderId, so.id)).orderBy(asc(orderStatusHistory.createdAt)),
      this.db.execute<Record<string, unknown>>(sql`
        select r.id, r.status, r.reason, r.details, r.seller_note, r.created_at,
          (select json_agg(json_build_object('orderItemId', ri.order_item_id, 'quantity', ri.quantity)) from return_items ri where ri.return_request_id = r.id) as items
        from return_requests r where r.seller_order_id = ${so.id} order by r.created_at desc`),
    ]);
    return {
      id: so.id,
      number: so.number,
      orderNumber: order.number,
      status: so.status,
      allowed: (ORDER_STATUS_TRANSITIONS[so.status] ?? []).filter((s) => s !== 'returned' && s !== 'refunded'),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      collectOnDelivery: order.paymentMethod === 'cod' ? sellerOrderTotal(so) : '0.00',
      totals: { itemsSubtotal: so.itemsSubtotal, discountTotal: so.discountTotal, shippingFee: so.shippingFee, total: sellerOrderTotal(so), commissionPercent: so.commissionPercent, commission: so.commissionAmount, earning: so.sellerEarning, refunded: so.refundedTotal },
      shippingAddress: order.shippingAddress,
      note: order.customerNote,
      placedAt: order.placedAt.toISOString(),
      confirmedAt: so.confirmedAt?.toISOString() ?? null,
      shippedAt: so.shippedAt?.toISOString() ?? null,
      deliveredAt: so.deliveredAt?.toISOString() ?? null,
      cancelReason: so.cancelReason,
      shipment: shipment[0] ? { courier: shipment[0].courier, trackingNumber: shipment[0].trackingNumber, trackingUrl: shipment[0].trackingUrl, status: shipment[0].status } : null,
      items: items.map((i) => ({ id: i.id, title: i.title, variantName: i.variantName, sku: i.sku, condition: i.condition, imageUrl: this.storage.publicUrl(i.imageKey), quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, lineTotal: i.lineTotal, refundedQuantity: i.refundedQuantity })),
      history: history.map((h) => ({ from: h.fromStatus, to: h.toStatus, note: h.note, actorRole: h.actorRole, at: h.createdAt.toISOString() })),
      returns: returns.rows.map((r) => ({ id: r.id, status: r.status, reason: r.reason, details: r.details, sellerNote: r.seller_note, items: r.items ?? [], createdAt: new Date(r.created_at as string).toISOString() })),
    };
  }

  /** Moves a sub-order along its lifecycle; shipping fulfils stock, delivery settles cash on delivery. */
  async update(userId: string, sellerOrderId: string, input: UpdateInput) {
    const result = await this.db.transaction(async (tx) => {
      const { so, order } = await this.own(userId, sellerOrderId, tx, true);
      if (!(ORDER_STATUS_TRANSITIONS[so.status] ?? []).includes(input.status)) {
        throw new AppException('CONFLICT', 'api.commerce.invalidTransition').withParams({ from: so.status, to: input.status });
      }
      const now = new Date();
      if (input.status === 'cancelled') {
        await this.orders.cancelOrderTx(tx, order, [so.id], { id: userId, role: 'seller' }, input.note!);
        return { order, so, status: 'cancelled' as const };
      }
      const items = await tx.select().from(orderItems).where(eq(orderItems.sellerOrderId, so.id));
      const patch: Partial<typeof sellerOrders.$inferInsert> = { status: input.status, updatedAt: now };
      if (input.status === 'confirmed') patch.confirmedAt = now;
      if (input.status === 'shipped') {
        patch.shippedAt = now;
        await fulfilStock(tx, items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, quantity: i.quantity })), { type: 'seller_order', id: so.id, actorId: userId });
      }
      if (input.status === 'delivered') patch.deliveredAt = now;
      await tx.update(sellerOrders).set(patch).where(eq(sellerOrders.id, so.id));
      await tx.insert(orderStatusHistory).values({ orderId: order.id, sellerOrderId: so.id, fromStatus: so.status, toStatus: input.status, actorId: userId, actorRole: 'seller', note: input.note ?? null });

      // Shipment record and tracking timeline.
      const shipmentStatus = SHIPMENT_FOR[input.status];
      if (shipmentStatus) {
        let [shipment] = await tx.select().from(shipments).where(eq(shipments.sellerOrderId, so.id)).limit(1);
        if (!shipment) {
          [shipment] = await tx
            .insert(shipments)
            .values({ sellerOrderId: so.id, shippingMethodId: so.shippingMethodId, courier: input.courier ?? 'manual', trackingNumber: input.trackingNumber ?? null, trackingUrl: input.trackingUrl ?? null, status: shipmentStatus, codAmount: order.paymentMethod === 'cod' ? sellerOrderTotal(so) : '0' })
            .returning();
        } else {
          await tx
            .update(shipments)
            .set({ status: shipmentStatus, courier: input.courier ?? shipment.courier, trackingNumber: input.trackingNumber ?? shipment.trackingNumber, trackingUrl: input.trackingUrl ?? shipment.trackingUrl, updatedAt: now })
            .where(eq(shipments.id, shipment.id));
        }
        if (input.status === 'shipped') await tx.update(shipments).set({ shippedAt: now }).where(eq(shipments.id, shipment!.id));
        if (input.status === 'delivered') await tx.update(shipments).set({ deliveredAt: now }).where(eq(shipments.id, shipment!.id));
        await tx.insert(shipmentTracking).values({ shipmentId: shipment!.id, status: shipmentStatus, note: input.note ?? null, actorId: userId, source: 'manual' });
      }

      if (input.status === 'delivered') await recordDelivery(tx, order.userId, items);

      const all = await tx.select({ id: sellerOrders.id, status: sellerOrders.status }).from(sellerOrders).where(eq(sellerOrders.orderId, order.id));
      const orderStatus = deriveOrderStatus(all.map((s) => s.status));
      await tx.update(orders).set({ status: orderStatus, updatedAt: now }).where(eq(orders.id, order.id));
      // Cash on delivery is collected when every remaining parcel has arrived.
      if (order.paymentMethod === 'cod' && orderStatus === 'delivered' && order.paymentStatus === 'pending') {
        await tx.update(payments).set({ status: 'paid', paidAt: now }).where(and(eq(payments.orderId, order.id), eq(payments.provider, 'cod'), eq(payments.status, 'pending')));
        await tx.update(orders).set({ paymentStatus: 'paid', paidAt: now }).where(eq(orders.id, order.id));
      }
      return { order, so, status: input.status };
    });

    const key = { confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', out_for_delivery: 'OutForDelivery', delivered: 'Delivered', cancelled: 'SellerCancelled' }[result.status];
    await this.notifications
      .notify(result.order.userId, { type: result.status === 'shipped' || result.status === 'out_for_delivery' || result.status === 'delivered' ? 'delivery' : 'order', titleKey: `api.orders.status${key}Title`, bodyKey: `api.orders.status${key}Body`, params: { number: result.order.number, store: '' }, link: `/account/orders/${result.order.number}` })
      .catch(() => undefined);
    return this.detail(userId, sellerOrderId);
  }
}
