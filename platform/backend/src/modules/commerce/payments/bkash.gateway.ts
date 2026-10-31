import { Inject, Injectable, Logger } from '@nestjs/common';
import { compareMoney } from '@boikonika/shared';
import type Redis from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../../config/config.module';
import { REDIS } from '../../../infra/redis/redis.module';
import { GATEWAY_TIMEOUT_MS, sanitizePayload, type GatewayInitiation, type GatewayRefund, type GatewayResult, type PaymentContext, type PaymentGateway, type StoredPayment } from './gateway';

type BkashResponse = Record<string, unknown> & { statusCode?: string; statusMessage?: string; errorCode?: string; errorMessage?: string };

const TOKEN_KEY = 'bkash:id_token';

/**
 * bKash Tokenized Checkout (create → buyer approves in the bKash page → execute). The callback's
 * query string is only a hint: the payment counts as paid after `execute` (or `payment/status`)
 * confirms it server-to-server with the expected amount.
 */
@Injectable()
export class BkashGateway implements PaymentGateway {
  readonly provider = 'bkash' as const;
  readonly methods = ['bkash'] as const;
  private readonly logger = new Logger('bKash');

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  isEnabled(): boolean {
    const c = this.config;
    return !!(c.BKASH_APP_KEY && c.BKASH_APP_SECRET && c.BKASH_USERNAME && c.BKASH_PASSWORD);
  }

  private base(path: string): string {
    return `${this.config.BKASH_BASE_URL.replace(/\/$/, '')}/tokenized/checkout${path}`;
  }

  private async token(): Promise<string> {
    const cached = await this.redis.get(TOKEN_KEY).catch(() => null);
    if (cached) return cached;
    const res = await fetch(this.base('/token/grant'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', username: this.config.BKASH_USERNAME!, password: this.config.BKASH_PASSWORD! },
      body: JSON.stringify({ app_key: this.config.BKASH_APP_KEY, app_secret: this.config.BKASH_APP_SECRET }),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as BkashResponse & { id_token?: string; expires_in?: number };
    if (!res.ok || !body.id_token) throw new Error(`bKash token grant failed: ${body.statusMessage ?? body.errorMessage ?? res.status}`);
    const ttl = Math.max(60, Number(body.expires_in ?? 3600) - 120);
    await this.redis.set(TOKEN_KEY, body.id_token, 'EX', ttl).catch(() => undefined);
    return body.id_token;
  }

  private async call(path: string, payload: Record<string, unknown>): Promise<BkashResponse> {
    const send = async () =>
      fetch(this.base(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: await this.token(), 'X-APP-Key': this.config.BKASH_APP_KEY! },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });
    let res = await send();
    if (res.status === 401) {
      // The cached token was revoked or expired early: grant a new one once.
      await this.redis.del(TOKEN_KEY).catch(() => undefined);
      res = await send();
    }
    const body = (await res.json().catch(() => ({}))) as BkashResponse;
    if (!res.ok) this.logger.warn(`bKash ${path} responded ${res.status}: ${body.statusMessage ?? body.errorMessage ?? ''}`);
    return body;
  }

  async initiate(ctx: PaymentContext): Promise<GatewayInitiation> {
    const body = await this.call('/create', {
      mode: '0011',
      payerReference: ctx.customer.phone.replace(/^\+88/, ''),
      callbackURL: ctx.urls.callback,
      amount: ctx.amount,
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: ctx.orderNumber,
    });
    const paymentID = body.paymentID as string | undefined;
    const bkashURL = body.bkashURL as string | undefined;
    if (body.statusCode !== '0000' || !paymentID || !bkashURL) throw new Error(`bKash create failed: ${body.statusMessage ?? body.errorMessage ?? 'unknown'}`);
    return { redirectUrl: bkashURL, providerPaymentId: paymentID, raw: sanitizePayload(body) };
  }

  /** Called from the callback with status=success: finalises the payment with bKash. */
  async execute(payment: StoredPayment): Promise<GatewayResult> {
    const body = await this.call('/execute', { paymentID: payment.providerPaymentId });
    // An execute retried after a lost response reports "already completed": confirm via status.
    if (body.statusCode !== '0000') return this.query(payment);
    return this.toResult(payment, body);
  }

  async query(payment: StoredPayment): Promise<GatewayResult> {
    if (!payment.providerPaymentId) return { status: 'pending', raw: {} };
    const body = await this.call('/payment/status', { paymentID: payment.providerPaymentId });
    return this.toResult(payment, body);
  }

  private toResult(payment: StoredPayment, body: BkashResponse): GatewayResult {
    const raw = sanitizePayload(body);
    const state = String(body.transactionStatus ?? '');
    const amount = typeof body.amount === 'string' ? body.amount : undefined;
    if (state === 'Completed') {
      if (!amount || compareMoney(amount, payment.amount) !== 0) return { status: 'failed', failureReason: 'amount_mismatch', raw };
      return { status: 'paid', amount, providerPaymentId: payment.providerPaymentId ?? undefined, transactionId: String(body.trxID ?? ''), eventId: `execute:${body.trxID}`, raw };
    }
    if (state === 'Initiated' || state === 'Pending Authorized') return { status: 'pending', raw };
    return { status: 'failed', failureReason: String(body.statusMessage ?? body.errorMessage ?? state ?? 'failed'), raw };
  }

  async refund(payment: StoredPayment, amount: string, reason: string, refundId: string): Promise<GatewayRefund> {
    const body = await this.call('/payment/refund', {
      paymentID: payment.providerPaymentId,
      trxID: payment.providerTransactionId,
      amount,
      sku: refundId.slice(0, 32),
      reason: reason.slice(0, 120),
    });
    const raw = sanitizePayload(body);
    if (body.transactionStatus === 'Completed' && body.refundTrxID) return { status: 'completed', providerRefundId: String(body.refundTrxID), raw };
    return { status: 'failed', failureReason: String(body.statusMessage ?? body.errorMessage ?? 'refund_failed'), raw };
  }
}
