import { Inject, Injectable } from '@nestjs/common';
import { payoutItems, payouts, sellerPayoutAccounts, sellers, type Database } from '@boikonika/database';
import { compareMoney, fromMinor, toMinor, type payoutAccountSchema } from '@boikonika/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SellersService } from '../marketplace/sellers.service';
import { SettingsService } from '../settings/settings.service';

/**
 * Seller earnings become payable after delivery plus a hold period (covers the return window) and
 * when no return is open. A payout claims those sub-orders (each at most once) for one transfer.
 */
@Injectable()
export class PayoutsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sellers: SellersService,
    private readonly settings: SettingsService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async holdDays(): Promise<number> {
    const [hold, window] = await Promise.all([this.settings.number('payouts.holdDays', 7), this.settings.number('orders.returnWindowDays', 7)]);
    return Math.max(hold, window);
  }

  private eligible(holdDays: number) {
    return sql`so.status = 'delivered' and so.delivered_at <= now() - make_interval(days => ${holdDays})
      and not exists (select 1 from payout_items pi where pi.seller_order_id = so.id)
      and not exists (select 1 from return_requests r where r.seller_order_id = so.id and r.status in ('requested', 'approved', 'received'))
      and so.seller_earning > 0`;
  }

  async summary(userId: string) {
    const seller = await this.sellers.requireSeller(userId);
    const hold = await this.holdDays();
    const [row] = await this.db
      .execute<{ available: string; pending: string; paid: string; in_transfer: string }>(sql`
        select
          coalesce((select sum(so.seller_earning) from seller_orders so where so.seller_id = ${seller.id} and ${this.eligible(hold)}), 0)::text as available,
          coalesce((select sum(so.seller_earning) from seller_orders so join orders o on o.id = so.order_id
            where so.seller_id = ${seller.id} and so.status in ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered')
              and not exists (select 1 from payout_items pi where pi.seller_order_id = so.id)
              and (o.payment_method = 'cod' or o.payment_status = 'paid')), 0)::text as pending,
          coalesce((select sum(p.amount) from payouts p where p.seller_id = ${seller.id} and p.status = 'paid'), 0)::text as paid,
          coalesce((select sum(p.amount) from payouts p where p.seller_id = ${seller.id} and p.status in ('pending', 'processing')), 0)::text as in_transfer`)
      .then((r) => r.rows);
    const minimum = String(await this.settings.get<string | number>('payouts.minimumAmount', '500.00'));
    const available = fromMinor(toMinor(row?.available ?? '0'));
    return {
      available,
      // Earnings not yet payable (in delivery, or within the hold period).
      pending: fromMinor(Math.max(0, toMinor(row?.pending ?? '0') - toMinor(row?.available ?? '0'))),
      inTransfer: fromMinor(toMinor(row?.in_transfer ?? '0')),
      paid: fromMinor(toMinor(row?.paid ?? '0')),
      minimum,
      holdDays: hold,
      payouts: await this.db
        .select({ id: payouts.id, amount: payouts.amount, status: payouts.status, reference: payouts.reference, note: payouts.note, periodStart: payouts.periodStart, periodEnd: payouts.periodEnd, paidAt: payouts.paidAt, createdAt: payouts.createdAt })
        .from(payouts)
        .where(eq(payouts.sellerId, seller.id))
        .orderBy(desc(payouts.createdAt))
        .limit(50),
      accounts: await this.accounts(seller.id),
    };
  }

  private async accounts(sellerId: string) {
    const rows = await this.db.select().from(sellerPayoutAccounts).where(eq(sellerPayoutAccounts.sellerId, sellerId)).orderBy(desc(sellerPayoutAccounts.isDefault), desc(sellerPayoutAccounts.createdAt));
    // Only the last four digits ever leave the server.
    return rows.map((a) => ({ id: a.id, method: a.method, accountName: a.accountName, last4: a.accountNumberLast4, bankName: a.bankName, branchName: a.branchName, isDefault: a.isDefault }));
  }

  async addAccount(userId: string, input: z.output<typeof payoutAccountSchema>) {
    const seller = await this.sellers.requireSeller(userId);
    await this.db.transaction(async (tx) => {
      const existing = await tx.select({ id: sellerPayoutAccounts.id }).from(sellerPayoutAccounts).where(eq(sellerPayoutAccounts.sellerId, seller.id));
      if (existing.length >= 5) throw new AppException('BAD_REQUEST', 'api.commerce.payoutAccountLimit');
      await tx.update(sellerPayoutAccounts).set({ isDefault: false }).where(eq(sellerPayoutAccounts.sellerId, seller.id));
      await tx.insert(sellerPayoutAccounts).values({
        sellerId: seller.id,
        method: input.method,
        accountName: input.accountName,
        accountNumberEnc: this.crypto.encrypt(input.accountNumber),
        accountNumberLast4: input.accountNumber.slice(-4),
        bankName: input.bankName ?? null,
        branchName: input.branchName ?? null,
        routingNumber: input.routingNumber ?? null,
        isDefault: true,
      });
      await this.audit.record({ action: 'payout_account.add', entityType: 'seller', entityId: seller.id, after: { method: input.method, last4: input.accountNumber.slice(-4) } }, tx);
    });
    return this.accounts(seller.id);
  }

  async removeAccount(userId: string, accountId: string) {
    const seller = await this.sellers.requireSeller(userId);
    await this.db.transaction(async (tx) => {
      const [removed] = await tx.delete(sellerPayoutAccounts).where(and(eq(sellerPayoutAccounts.id, accountId), eq(sellerPayoutAccounts.sellerId, seller.id))).returning({ isDefault: sellerPayoutAccounts.isDefault });
      if (!removed) throw AppException.notFound('Account');
      if (removed.isDefault) {
        const [next] = await tx.select({ id: sellerPayoutAccounts.id }).from(sellerPayoutAccounts).where(eq(sellerPayoutAccounts.sellerId, seller.id)).orderBy(desc(sellerPayoutAccounts.createdAt)).limit(1);
        if (next) await tx.update(sellerPayoutAccounts).set({ isDefault: true }).where(eq(sellerPayoutAccounts.id, next.id));
      }
      await this.audit.record({ action: 'payout_account.remove', entityType: 'seller', entityId: seller.id, after: { accountId } }, tx);
    });
    return this.accounts(seller.id);
  }

  // ------------------------------------------------------------------ staff

  async eligibleSellers() {
    const hold = await this.holdDays();
    const minimum = String(await this.settings.get<string | number>('payouts.minimumAmount', '500.00'));
    const rows = await this.db.execute<Record<string, unknown>>(sql`
      select se.id as seller_id, st.name as store_name, st.slug as store_slug, sum(so.seller_earning)::text as amount, count(*)::int as orders,
        (select a.method from seller_payout_accounts a where a.seller_id = se.id and a.is_default limit 1) as method
      from seller_orders so join sellers se on se.id = so.seller_id left join seller_stores st on st.seller_id = se.id
      where ${this.eligible(hold)} group by se.id, st.name, st.slug order by sum(so.seller_earning) desc`);
    return rows.rows.map((r) => ({ sellerId: r.seller_id, store: { name: r.store_name, slug: r.store_slug }, amount: fromMinor(toMinor(r.amount as string)), orders: r.orders, payoutMethod: r.method, meetsMinimum: compareMoney(r.amount as string, minimum) >= 0 }));
  }

  async list(filter: { status?: string; page: number; pageSize: number }) {
    const where = filter.status ? sql`p.status::text = ${filter.status}` : sql`true`;
    const [rows, total] = await Promise.all([
      this.db.execute<Record<string, unknown>>(sql`
        select p.*, st.name as store_name, a.method as account_method, a.account_name, a.account_number_last4, a.bank_name
        from payouts p left join seller_stores st on st.seller_id = p.seller_id left join seller_payout_accounts a on a.id = p.payout_account_id
        where ${where} order by p.created_at desc limit ${filter.pageSize} offset ${(filter.page - 1) * filter.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from payouts p where ${where}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id,
        sellerId: r.seller_id,
        store: r.store_name,
        amount: r.amount,
        status: r.status,
        reference: r.reference,
        note: r.note,
        account: r.account_method ? { method: r.account_method, name: r.account_name, last4: r.account_number_last4, bankName: r.bank_name } : null,
        createdAt: new Date(r.created_at as string).toISOString(),
        paidAt: r.paid_at ? new Date(r.paid_at as string).toISOString() : null,
      })),
      meta: { page: filter.page, pageSize: filter.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  /** Bundles every payable sub-order of a seller into one transfer to their default account. */
  async create(actorId: string, sellerId: string) {
    const hold = await this.holdDays();
    const minimum = String(await this.settings.get<string | number>('payouts.minimumAmount', '500.00'));
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`payout:${sellerId}`}))`);
      const [account] = await tx.select().from(sellerPayoutAccounts).where(and(eq(sellerPayoutAccounts.sellerId, sellerId), eq(sellerPayoutAccounts.isDefault, true)));
      if (!account) throw new AppException('CONFLICT', 'api.commerce.noPayoutAccount');
      const due = await tx.execute<{ id: string; seller_earning: string; delivered_at: string }>(sql`
        select so.id, so.seller_earning, so.delivered_at from seller_orders so where so.seller_id = ${sellerId} and ${this.eligible(hold)} for update of so`);
      const total = due.rows.reduce((s, r) => s + toMinor(r.seller_earning), 0);
      if (!due.rows.length || total < toMinor(minimum)) throw new AppException('CONFLICT', 'api.commerce.payoutBelowMinimum').withParams({ amount: minimum });
      const times = due.rows.map((r) => new Date(r.delivered_at).getTime());
      const [payout] = await tx
        .insert(payouts)
        .values({ sellerId, payoutAccountId: account.id, amount: fromMinor(total), status: 'processing', periodStart: new Date(Math.min(...times)), periodEnd: new Date(Math.max(...times)), processedBy: actorId })
        .returning();
      await tx.insert(payoutItems).values(due.rows.map((r) => ({ payoutId: payout!.id, sellerOrderId: r.id, amount: r.seller_earning })));
      await this.audit.record({ action: 'payout.create', entityType: 'payout', entityId: payout!.id, actorId, after: { sellerId, amount: payout!.amount, orders: due.rows.length } }, tx);
      return payout!;
    });
  }

  /** Full account details for the staff member making the transfer (every view is audited). */
  async revealAccount(actorId: string, payoutId: string) {
    const [row] = await this.db
      .select({ account: sellerPayoutAccounts })
      .from(payouts)
      .innerJoin(sellerPayoutAccounts, eq(sellerPayoutAccounts.id, payouts.payoutAccountId))
      .where(eq(payouts.id, payoutId));
    if (!row) throw AppException.notFound('Payout account');
    await this.audit.record({ action: 'payout_account.view', entityType: 'payout', entityId: payoutId, actorId });
    const a = row.account;
    return { method: a.method, accountName: a.accountName, accountNumber: this.crypto.decrypt(a.accountNumberEnc), bankName: a.bankName, branchName: a.branchName, routingNumber: a.routingNumber };
  }

  async markPaid(actorId: string, payoutId: string, reference: string, note?: string) {
    const [payout] = await this.db
      .update(payouts)
      .set({ status: 'paid', reference, note: note ?? null, paidAt: new Date(), processedBy: actorId, updatedAt: new Date() })
      .where(and(eq(payouts.id, payoutId), sql`${payouts.status} in ('pending', 'processing')`))
      .returning();
    if (!payout) throw new AppException('CONFLICT', 'api.commerce.payoutNotOpen');
    await this.audit.record({ action: 'payout.paid', entityType: 'payout', entityId: payoutId, actorId, after: { reference } });
    const [seller] = await this.db.select({ userId: sellers.userId }).from(sellers).where(eq(sellers.id, payout.sellerId));
    if (seller) await this.notifications.notify(seller.userId, { type: 'payout', titleKey: 'api.orders.payoutPaidTitle', bodyKey: 'api.orders.payoutPaidBody', params: { amount: payout.amount, reference }, link: '/seller/payouts' }).catch(() => undefined);
    return payout;
  }

  /** The transfer bounced: the sub-orders become payable again. */
  async markFailed(actorId: string, payoutId: string, note: string) {
    return this.db.transaction(async (tx) => {
      const [payout] = await tx.update(payouts).set({ status: 'failed', note, processedBy: actorId, updatedAt: new Date() }).where(and(eq(payouts.id, payoutId), sql`${payouts.status} in ('pending', 'processing')`)).returning();
      if (!payout) throw new AppException('CONFLICT', 'api.commerce.payoutNotOpen');
      await tx.delete(payoutItems).where(eq(payoutItems.payoutId, payoutId));
      await this.audit.record({ action: 'payout.failed', entityType: 'payout', entityId: payoutId, actorId, after: { note } }, tx);
      const [seller] = await tx.select({ userId: sellers.userId }).from(sellers).where(eq(sellers.id, payout.sellerId));
      if (seller) await this.notifications.notify(seller.userId, { type: 'payout', titleKey: 'api.orders.payoutFailedTitle', bodyKey: 'api.orders.payoutFailedBody', params: { amount: payout.amount }, link: '/seller/payouts' }, tx).catch(() => undefined);
      return payout;
    });
  }

}
