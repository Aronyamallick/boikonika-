import { Inject, Injectable, Logger } from '@nestjs/common';
import { orderItems, orders, paymentTransactions, payments, users, type AddressSnapshot, type Database, type DbOrTx } from '@boikonika/database';
import { type PaymentMethod, type PaymentStatus } from '@boikonika/shared';
import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../../../config/config.module';
import { AppException } from '../../../common/errors/app-exception';
import { DB } from '../../../infra/database/database.module';
import { BkashGateway } from './bkash.gateway';
import { type GatewayProvider, type GatewayResult, type PaymentGateway, type StoredPayment } from './gateway';
import { SandboxGateway } from './sandbox.gateway';
import { SslcommerzGateway } from './sslcommerz.gateway';

export type PaymentRow = typeof payments.$inferSelect;
export type SettleListener = (payment: PaymentRow, result: GatewayResult, tx: DbOrTx) => Promise<void>;

export interface MethodOption {
  method: PaymentMethod;
  provider: 'cod' | GatewayProvider;
}

/** Order of methods on the checkout page (most used in Bangladesh first). */
const METHOD_ORDER: PaymentMethod[] = ['bkash', 'nagad', 'rocket', 'card', 'internet_banking', 'cod', 'sandbox'];

/**
 * Payment attempts and their lifecycle. Gateways are pluggable; results are applied once (provider
 * event ids are unique) inside a transaction that also runs the order-side listeners.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');
  private readonly listeners: SettleListener[] = [];

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    readonly bkash: BkashGateway,
    readonly sslcommerz: SslcommerzGateway,
    readonly sandbox: SandboxGateway,
  ) {}

  onSettled(listener: SettleListener): void {
    this.listeners.push(listener);
  }

  /** Methods buyers can choose right now (a method appears only when a gateway can really take it). */
  availableMethods(): MethodOption[] {
    const options: MethodOption[] = [{ method: 'cod', provider: 'cod' }];
    for (const method of METHOD_ORDER) {
      if (method === 'cod') continue;
      const provider = this.providerFor(method);
      if (provider) options.push({ method, provider });
    }
    return options.sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
  }

  providerFor(method: PaymentMethod): 'cod' | GatewayProvider | null {
    if (method === 'cod') return 'cod';
    if (method === 'sandbox') return this.sandbox.isEnabled() ? 'sandbox' : null;
    if (method === 'bkash' && this.bkash.isEnabled()) return 'bkash';
    if ((this.sslcommerz.methods as readonly string[]).includes(method) && this.sslcommerz.isEnabled()) return 'sslcommerz';
    return null;
  }

  gateway(provider: string): PaymentGateway {
    if (provider === 'bkash') return this.bkash;
    if (provider === 'sslcommerz') return this.sslcommerz;
    if (provider === 'sandbox') return this.sandbox;
    throw new Error(`No gateway for provider ${provider}`);
  }

  /** Creates a payment attempt row (inside the checkout or "pay again" transaction). */
  async create(tx: DbOrTx, input: { orderId: string; method: PaymentMethod; amount: string; idempotencyKey: string; expiresAt: Date | null }): Promise<PaymentRow> {
    const provider = this.providerFor(input.method);
    if (!provider) throw new AppException('BAD_REQUEST', 'api.commerce.methodUnavailable', [{ field: 'paymentMethod', code: 'unavailable', message: 'api.commerce.methodUnavailable' }]);
    const [row] = await tx
      .insert(payments)
      .values({ orderId: input.orderId, method: input.method, provider, amount: input.amount, idempotencyKey: input.idempotencyKey, expiresAt: input.expiresAt })
      .onConflictDoNothing({ target: payments.idempotencyKey })
      .returning();
    if (row) return row;
    const [existing] = await tx.select().from(payments).where(eq(payments.idempotencyKey, input.idempotencyKey));
    return existing!;
  }

  private urls(paymentId: string) {
    const api = `${this.config.API_URL}/api/v1/payments`;
    return {
      callback: `${api}/bkash/callback`,
      success: `${api}/sslcommerz/success`,
      fail: `${api}/sslcommerz/fail`,
      cancel: `${api}/sslcommerz/cancel`,
      ipn: `${api}/sslcommerz/ipn`,
      sandbox: `${api}/sandbox/${paymentId}`,
    };
  }

  /** Starts the gateway session and returns where to send the buyer. COD needs no redirect. */
  async initiate(paymentId: string): Promise<{ redirectUrl: string | null }> {
    const [row] = await this.db
      .select({ payment: payments, number: orders.number, address: orders.shippingAddress, userId: orders.userId, name: users.displayName, email: users.email, phone: users.phone })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(users, eq(users.id, orders.userId))
      .where(eq(payments.id, paymentId));
    if (!row) throw AppException.notFound('Payment');
    const { payment } = row;
    if (payment.provider === 'cod') return { redirectUrl: null };
    if (payment.status !== 'pending') throw new AppException('CONFLICT', 'api.commerce.paymentNotPending');
    if (payment.redirectUrl && payment.providerPaymentId) return { redirectUrl: payment.redirectUrl };
    const [count] = await this.db.select({ n: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` }).from(orderItems).where(eq(orderItems.orderId, payment.orderId));
    const address = row.address as AddressSnapshot;
    try {
      const started = await this.gateway(payment.provider).initiate({
        paymentId: payment.id,
        method: payment.method,
        amount: payment.amount,
        orderNumber: row.number,
        itemCount: count?.n ?? 1,
        customer: { name: row.name, email: row.email, phone: row.phone ?? address.phone },
        shipping: { name: address.recipientName, addressLine: address.addressLine, area: `${address.area}, ${address.upazila}`, district: address.district, postcode: address.postcode ?? null },
        urls: this.urls(payment.id),
      });
      await this.db.transaction(async (tx) => {
        await tx.update(payments).set({ providerPaymentId: started.providerPaymentId ?? null, redirectUrl: started.redirectUrl }).where(eq(payments.id, payment.id));
        await tx.insert(paymentTransactions).values({ paymentId: payment.id, provider: payment.provider, kind: 'initiate', status: 'created', amount: payment.amount, payload: started.raw, payloadSha256: digest(started.raw) });
      });
      return { redirectUrl: started.redirectUrl };
    } catch (error) {
      this.logger.warn(`Could not start ${payment.provider} payment ${payment.id}: ${(error as Error).message}`);
      await this.db.transaction(async (tx) => {
        await tx.update(payments).set({ status: 'failed', failureReason: 'initiate_failed' }).where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')));
        await tx.insert(paymentTransactions).values({ paymentId: payment.id, provider: payment.provider, kind: 'initiate', status: 'error', payload: { message: (error as Error).message.slice(0, 300) } });
      });
      throw new AppException('PAYMENT_FAILED', 'api.commerce.gatewayUnavailable');
    }
  }

  async find(paymentId: string): Promise<PaymentRow | null> {
    const [row] = await this.db.select().from(payments).where(eq(payments.id, paymentId));
    return row ?? null;
  }

  async findByProviderId(provider: string, providerPaymentId: string): Promise<PaymentRow | null> {
    const [row] = await this.db.select().from(payments).where(and(eq(payments.provider, provider), eq(payments.providerPaymentId, providerPaymentId)));
    return row ?? null;
  }

  /**
   * Applies a verified gateway result exactly once. A paid payment stays paid; a failed or cancelled
   * attempt can still turn into paid if the provider later confirms the money arrived.
   */
  async settle(paymentId: string, result: GatewayResult, kind: 'callback' | 'ipn' | 'verify' | 'sandbox'): Promise<PaymentRow> {
    return this.db.transaction(async (tx) => {
      const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
      if (!payment) throw AppException.notFound('Payment');
      if (result.eventId) {
        const inserted = await tx
          .insert(paymentTransactions)
          .values({ paymentId, provider: payment.provider, kind, providerEventId: result.eventId, status: result.status, amount: result.amount ?? null, payload: result.raw, payloadSha256: digest(result.raw) })
          .onConflictDoNothing()
          .returning({ id: paymentTransactions.id });
        if (!inserted.length) return payment;
      } else {
        await tx.insert(paymentTransactions).values({ paymentId, provider: payment.provider, kind, status: result.status, amount: result.amount ?? null, payload: result.raw, payloadSha256: digest(result.raw) });
      }
      if (result.status === 'pending') return payment;
      const final = new Set<PaymentStatus>(['paid', 'refunded', 'partially_refunded']);
      if (final.has(payment.status)) return payment;
      if (result.status !== 'paid' && payment.status !== 'pending') return payment;
      const now = new Date();
      const [updated] = await tx
        .update(payments)
        .set(
          result.status === 'paid'
            ? { status: 'paid', paidAt: now, providerTransactionId: result.transactionId ?? payment.providerTransactionId, failureReason: null }
            : { status: result.status === 'cancelled' ? 'cancelled' : 'failed', failureReason: result.failureReason?.slice(0, 300) ?? null },
        )
        .where(eq(payments.id, paymentId))
        .returning();
      for (const listener of this.listeners) await listener(updated!, result, tx);
      return updated!;
    });
  }

  /** Asks the provider about a pending payment and applies the answer. */
  async verify(payment: PaymentRow): Promise<PaymentRow> {
    if (payment.provider === 'cod' || payment.status !== 'pending') return payment;
    try {
      const result = await this.gateway(payment.provider).query(this.stored(payment));
      return result.status === 'pending' ? payment : await this.settle(payment.id, result, 'verify');
    } catch (error) {
      this.logger.warn(`Could not verify payment ${payment.id}: ${(error as Error).message}`);
      return payment;
    }
  }

  /**
   * SSLCOMMERZ success/fail/cancel/IPN posts. `tran_id` is our payment id; a `val_id` is confirmed with
   * the validation API, otherwise the transaction is looked up before an attempt is closed.
   */
  async handleSslcommerz(body: Record<string, unknown>): Promise<PaymentRow | null> {
    const tranId = typeof body.tran_id === 'string' ? body.tran_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(tranId)) return null;
    const payment = await this.find(tranId);
    if (!payment || payment.provider !== 'sslcommerz') return null;
    const valId = typeof body.val_id === 'string' && /^[A-Za-z0-9]{6,64}$/.test(body.val_id) ? body.val_id : null;
    const result = valId ? await this.sslcommerz.validate(this.stored(payment), valId) : await this.sslcommerz.query(this.stored(payment));
    if (result.status === 'pending') {
      const state = String(body.status ?? '').toUpperCase();
      if (state === 'CANCELLED' || state === 'FAILED') return this.settle(payment.id, { status: state === 'CANCELLED' ? 'cancelled' : 'failed', failureReason: `sslcommerz_${state.toLowerCase()}`, raw: { status: state } }, 'callback');
      return payment;
    }
    return this.settle(payment.id, result, valId ? 'ipn' : 'verify');
  }

  /** A sandbox payment of one of the user's own orders (the simulator page is only for its buyer). */
  async ownedSandboxPayment(userId: string, paymentId: string): Promise<PaymentRow & { orderNumber: string }> {
    if (!this.sandbox.isEnabled()) throw AppException.notFound('Payment');
    const [row] = await this.db
      .select({ payment: payments, number: orders.number })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(payments.id, paymentId), eq(orders.userId, userId), eq(payments.provider, 'sandbox')));
    if (!row) throw AppException.notFound('Payment');
    return { ...row.payment, orderNumber: row.number };
  }

  homeUrl(): string {
    return `${this.config.APP_URL}/account/orders`;
  }

  stored(payment: PaymentRow): StoredPayment {
    return { id: payment.id, amount: payment.amount, method: payment.method, providerPaymentId: payment.providerPaymentId, providerTransactionId: payment.providerTransactionId };
  }

  /** Where the buyer lands after the gateway: their order page, in their language. */
  async returnUrl(paymentId: string, outcome: 'success' | 'failed' | 'cancelled'): Promise<string> {
    const [row] = await this.db
      .select({ number: orders.number, locale: users.locale })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(users, eq(users.id, orders.userId))
      .where(eq(payments.id, paymentId));
    if (!row) return `${this.config.APP_URL}/account/orders`;
    return `${this.config.APP_URL}${row.locale === 'en' ? '/en' : ''}/account/orders/${row.number}?payment=${outcome}`;
  }
}

const digest = (payload: unknown) => createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
