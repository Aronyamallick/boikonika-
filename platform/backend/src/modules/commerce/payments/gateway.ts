import type { PaymentMethod } from '@boikonika/shared';

export type GatewayProvider = 'bkash' | 'sslcommerz' | 'sandbox';

/** What a gateway needs to start a payment; amounts are decimal strings (never floats). */
export interface PaymentContext {
  paymentId: string;
  method: PaymentMethod;
  amount: string;
  orderNumber: string;
  itemCount: number;
  customer: { name: string; email: string | null; phone: string };
  shipping: { name: string; addressLine: string; area: string; district: string; postcode: string | null };
  /** Our endpoints the gateway (or the buyer's browser) returns to. */
  urls: { callback: string; success: string; fail: string; cancel: string; ipn: string };
}

export interface GatewayInitiation {
  redirectUrl: string;
  providerPaymentId?: string;
  raw: Record<string, unknown>;
}

/** A verified answer from the provider (never built from unverified browser parameters). */
export interface GatewayResult {
  status: 'paid' | 'failed' | 'cancelled' | 'pending';
  amount?: string;
  providerPaymentId?: string;
  transactionId?: string;
  /** Unique per provider event; duplicates (repeated callbacks, IPN after redirect) are ignored. */
  eventId?: string;
  failureReason?: string;
  raw: Record<string, unknown>;
}

export interface GatewayRefund {
  status: 'completed' | 'processing' | 'failed';
  providerRefundId?: string;
  failureReason?: string;
  raw: Record<string, unknown>;
}

export interface StoredPayment {
  id: string;
  amount: string;
  method: PaymentMethod;
  providerPaymentId: string | null;
  providerTransactionId: string | null;
}

export interface PaymentGateway {
  readonly provider: GatewayProvider;
  /** Methods this gateway can collect when configured. */
  readonly methods: readonly PaymentMethod[];
  isEnabled(): boolean;
  initiate(ctx: PaymentContext): Promise<GatewayInitiation>;
  /** Asks the provider for the current state (used before expiring an unpaid order). */
  query(payment: StoredPayment): Promise<GatewayResult>;
  refund(payment: StoredPayment, amount: string, reason: string, refundId: string): Promise<GatewayRefund>;
}

export const GATEWAY_TIMEOUT_MS = 20_000;

/** Removes values that must never be stored (credentials, tokens) from provider payloads. */
export function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const hidden = /pass|secret|token|store_passwd|authorization|app_key/i;
  return Object.fromEntries(Object.entries(payload).filter(([k]) => !hidden.test(k)));
}
