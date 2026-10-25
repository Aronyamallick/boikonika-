import { Inject, Injectable } from '@nestjs/common';
import { compareMoney, type PaymentMethod } from '@boikonika/shared';
import { APP_CONFIG, type AppConfig } from '../../../config/config.module';
import { GATEWAY_TIMEOUT_MS, sanitizePayload, type GatewayInitiation, type GatewayRefund, type GatewayResult, type PaymentContext, type PaymentGateway, type StoredPayment } from './gateway';

/** Which part of the SSLCOMMERZ page opens first for each method. */
const CARD_GROUPS: Partial<Record<PaymentMethod, string>> = {
  card: 'visacard,mastercard,amexcard',
  internet_banking: 'internetbank',
  nagad: 'mobilebank',
  rocket: 'mobilebank',
  bkash: 'mobilebank',
};

/**
 * SSLCOMMERZ hosted checkout for cards, internet banking and mobile wallets. Card details are entered
 * on SSLCOMMERZ's page only. Every success/IPN is confirmed with the validation API (status, our
 * transaction id, amount and currency) before the order is treated as paid.
 */
@Injectable()
export class SslcommerzGateway implements PaymentGateway {
  readonly provider = 'sslcommerz' as const;
  readonly methods = ['card', 'internet_banking', 'nagad', 'rocket', 'bkash'] as const;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  isEnabled(): boolean {
    return !!(this.config.SSLCOMMERZ_STORE_ID && this.config.SSLCOMMERZ_STORE_PASSWORD);
  }

  private url(path: string, query?: Record<string, string>): string {
    const u = new URL(`${this.config.SSLCOMMERZ_BASE_URL.replace(/\/$/, '')}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) u.searchParams.set(k, v);
    return u.toString();
  }

  private credentials() {
    return { store_id: this.config.SSLCOMMERZ_STORE_ID!, store_passwd: this.config.SSLCOMMERZ_STORE_PASSWORD! };
  }

  async initiate(ctx: PaymentContext): Promise<GatewayInitiation> {
    const form = new URLSearchParams({
      ...this.credentials(),
      total_amount: ctx.amount,
      currency: 'BDT',
      tran_id: ctx.paymentId,
      success_url: ctx.urls.success,
      fail_url: ctx.urls.fail,
      cancel_url: ctx.urls.cancel,
      ipn_url: ctx.urls.ipn,
      cus_name: ctx.customer.name,
      cus_email: ctx.customer.email ?? 'no-reply@boikonika.com',
      cus_phone: ctx.customer.phone,
      cus_add1: ctx.shipping.addressLine,
      cus_city: ctx.shipping.district,
      cus_country: 'Bangladesh',
      shipping_method: 'Courier',
      ship_name: ctx.shipping.name,
      ship_add1: `${ctx.shipping.addressLine}, ${ctx.shipping.area}`,
      ship_city: ctx.shipping.district,
      ship_postcode: ctx.shipping.postcode ?? '0000',
      ship_country: 'Bangladesh',
      num_of_item: String(ctx.itemCount),
      product_name: `Order ${ctx.orderNumber}`,
      product_category: 'Books',
      product_profile: 'physical-goods',
      value_a: ctx.orderNumber,
    });
    const group = CARD_GROUPS[ctx.method];
    if (group) form.set('multi_card_name', group);
    const res = await fetch(this.url('/gwprocess/v4/api.php'), { method: 'POST', body: form, signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS) });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.status !== 'SUCCESS' || typeof body.GatewayPageURL !== 'string') throw new Error(`SSLCOMMERZ init failed: ${String(body.failedreason ?? res.status)}`);
    return { redirectUrl: body.GatewayPageURL, providerPaymentId: typeof body.sessionkey === 'string' ? body.sessionkey : undefined, raw: sanitizePayload(body) };
  }

  /** Confirms a `val_id` received on the success URL or IPN. */
  async validate(payment: StoredPayment, valId: string): Promise<GatewayResult> {
    const res = await fetch(this.url('/validator/api/validationserverAPI.php', { val_id: valId, ...this.credentials(), format: 'json' }), { signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS) });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return this.toResult(payment, body);
  }

  async query(payment: StoredPayment): Promise<GatewayResult> {
    const res = await fetch(this.url('/validator/api/merchantTransIDvalidationAPI.php', { tran_id: payment.id, ...this.credentials(), format: 'json' }), { signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS) });
    const body = (await res.json().catch(() => ({}))) as { element?: Array<Record<string, unknown>> };
    const elements = body.element ?? [];
    const valid = elements.find((e) => e.status === 'VALID' || e.status === 'VALIDATED');
    if (valid) return this.toResult(payment, valid);
    if (elements.some((e) => e.status === 'PENDING')) return { status: 'pending', raw: {} };
    return elements.length ? { status: 'failed', failureReason: String(elements[0]?.status ?? 'failed'), raw: sanitizePayload(elements[0] ?? {}) } : { status: 'pending', raw: {} };
  }

  private toResult(payment: StoredPayment, body: Record<string, unknown>): GatewayResult {
    const raw = sanitizePayload(body);
    const status = String(body.status ?? '');
    if (status !== 'VALID' && status !== 'VALIDATED') return { status: status === 'CANCELLED' ? 'cancelled' : 'failed', failureReason: status || 'invalid', raw };
    const amount = String(body.currency_amount ?? body.amount ?? '');
    const currency = String(body.currency_type ?? body.currency ?? 'BDT');
    if (body.tran_id !== payment.id || currency !== 'BDT' || !/^\d+(\.\d{1,2})?$/.test(amount) || compareMoney(amount, payment.amount) !== 0) {
      return { status: 'failed', failureReason: 'validation_mismatch', raw };
    }
    return { status: 'paid', amount, transactionId: String(body.bank_tran_id ?? ''), eventId: `valid:${String(body.val_id ?? body.bank_tran_id)}`, raw };
  }

  async refund(payment: StoredPayment, amount: string, reason: string, refundId: string): Promise<GatewayRefund> {
    const res = await fetch(
      this.url('/validator/api/merchantTransIDvalidationAPI.php', {
        bank_tran_id: payment.providerTransactionId ?? '',
        refund_amount: amount,
        refund_remarks: reason.slice(0, 200),
        refe_id: refundId,
        ...this.credentials(),
        format: 'json',
      }),
      { signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS) },
    );
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const raw = sanitizePayload(body);
    // SSLCOMMERZ accepts the request and settles it with the bank later.
    if (body.APIConnect === 'DONE' && body.status === 'success') return { status: 'processing', providerRefundId: String(body.refund_ref_id ?? ''), raw };
    return { status: 'failed', failureReason: String(body.errorReason ?? body.status ?? 'refund_failed'), raw };
  }
}
