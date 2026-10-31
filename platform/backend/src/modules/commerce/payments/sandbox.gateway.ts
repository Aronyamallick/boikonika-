import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../config/config.module';
import type { GatewayInitiation, GatewayRefund, GatewayResult, PaymentContext, PaymentGateway, StoredPayment } from './gateway';

/**
 * Development/test payment simulator. It is switched off in production (the API refuses to boot with
 * it enabled) and appears to buyers as its own "Test payment" method, never as a real wallet or card.
 */
@Injectable()
export class SandboxGateway implements PaymentGateway {
  readonly provider = 'sandbox' as const;
  readonly methods = ['sandbox'] as const;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  isEnabled(): boolean {
    return this.config.paymentSandboxEnabled && !this.config.isProduction;
  }

  async initiate(ctx: PaymentContext): Promise<GatewayInitiation> {
    return { redirectUrl: `${this.config.APP_URL}/payments/sandbox/${ctx.paymentId}`, providerPaymentId: `sbx_${ctx.paymentId}`, raw: { simulated: true } };
  }

  /** The buyer's choice on the simulator page. */
  outcome(payment: StoredPayment, outcome: 'success' | 'failure' | 'cancel'): GatewayResult {
    if (outcome === 'success') return { status: 'paid', amount: payment.amount, transactionId: `SBX${payment.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`, eventId: `sandbox:${payment.id}`, raw: { simulated: true } };
    return { status: outcome === 'cancel' ? 'cancelled' : 'failed', failureReason: outcome === 'cancel' ? 'cancelled_by_buyer' : 'declined', raw: { simulated: true } };
  }

  async query(): Promise<GatewayResult> {
    return { status: 'pending', raw: {} };
  }

  async refund(_payment: StoredPayment, _amount: string, _reason: string, refundId: string): Promise<GatewayRefund> {
    return { status: 'completed', providerRefundId: `SBXR-${refundId.slice(0, 8)}`, raw: { simulated: true } };
  }
}
