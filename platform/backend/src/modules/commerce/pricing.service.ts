import { Inject, Injectable } from '@nestjs/common';
import { addresses, couponUsages, coupons, shippingMethods, type Database, type DbOrTx } from '@boikonika/database';
import { allocateMinor, fromMinor, INSIDE_DHAKA_DISTRICTS, toMinor, type PaymentMethod } from '@boikonika/shared';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { DB } from '../../infra/database/database.module';
import { SettingsService } from '../settings/settings.service';
import type { CartLine } from './cart.service';
import { PaymentsService } from './payments/payments.service';

type Address = typeof addresses.$inferSelect;
type Coupon = typeof coupons.$inferSelect;
type Method = typeof shippingMethods.$inferSelect;

export interface QuoteGroup {
  seller: CartLine['seller'];
  lines: Array<CartLine & { discount: string }>;
  itemsSubtotal: string;
  itemDiscount: string;
  shippingFee: string;
  shippingDiscount: string;
  total: string;
  weightGrams: number;
}

export interface Quote {
  groups: QuoteGroup[];
  problems: Array<{ variantId: string; title: string; state: CartLine['state']; available: number }>;
  address: Address | null;
  shippingMethod: { code: string; name: unknown; minDays: number; maxDays: number; supportsCod: boolean } | null;
  coupon: { code: string; applied: boolean; message?: string; params?: Record<string, string | number>; discount: string; couponId?: string; sellerId?: string | null } | null;
  totals: { itemCount: number; itemsSubtotal: string; discountTotal: string; shippingTotal: string; grandTotal: string; shippingPending: boolean };
  paymentMethods: Array<{ method: PaymentMethod; provider: string; available: boolean; reason?: string }>;
}

/**
 * Computes what an order would cost, from live data only: per-seller groups, shipping by zone
 * (inside/outside Dhaka) with free-shipping thresholds and weight, coupon discounts split exactly
 * across sellers and lines, and which payment methods apply.
 */
@Injectable()
export class PricingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly payments: PaymentsService,
  ) {}

  async shippingMethodsList() {
    return this.db
      .select({ code: shippingMethods.code, name: shippingMethods.name, insideDhakaFee: shippingMethods.insideDhakaFee, outsideDhakaFee: shippingMethods.outsideDhakaFee, freeShippingThreshold: shippingMethods.freeShippingThreshold, minDays: shippingMethods.minDays, maxDays: shippingMethods.maxDays, supportsCod: shippingMethods.supportsCod })
      .from(shippingMethods)
      .where(and(isNull(shippingMethods.sellerId), eq(shippingMethods.isActive, true)))
      .orderBy(asc(shippingMethods.position));
  }

  async quote(input: { userId: string; lines: CartLine[]; addressId?: string; shippingMethod: string; couponCode?: string | null }, tx: DbOrTx = this.db): Promise<Quote> {
    const active = input.lines.filter((l) => !l.savedForLater);
    const problems = active.filter((l) => l.state !== 'ok').map((l) => ({ variantId: l.variantId, title: l.title, state: l.state, available: l.available }));
    const buyable = active.filter((l) => l.state === 'ok');

    const [address] = input.addressId ? await tx.select().from(addresses).where(and(eq(addresses.id, input.addressId), eq(addresses.userId, input.userId))) : [];
    const [method] = await tx
      .select()
      .from(shippingMethods)
      .where(and(isNull(shippingMethods.sellerId), eq(shippingMethods.code, input.shippingMethod), eq(shippingMethods.isActive, true)));

    // Group by seller, preserving cart order.
    const bySeller = new Map<string, CartLine[]>();
    for (const line of buyable) bySeller.set(line.seller.id, [...(bySeller.get(line.seller.id) ?? []), line]);
    const groups = [...bySeller.values()].map((lines) => {
      const subtotal = lines.reduce((sum, l) => sum + toMinor(l.lineTotal), 0);
      const weight = lines.reduce((sum, l) => sum + (l.weightGrams ?? 0) * l.quantity, 0);
      return { seller: lines[0]!.seller, lines, subtotal, weight, shipping: address && method ? this.shippingFee(method, address, subtotal, weight) : 0 };
    });

    // Coupon
    let coupon: Quote['coupon'] = null;
    const itemDiscounts = new Map<string, number>();
    const shippingDiscounts = new Map<string, number>();
    if (input.couponCode && groups.length) {
      const evaluated = await this.evaluateCoupon(tx, input.couponCode, input.userId, groups);
      if ('error' in evaluated) coupon = { code: input.couponCode, applied: false, message: evaluated.error, params: evaluated.params, discount: '0.00' };
      else {
        for (const [sellerId, d] of evaluated.items) itemDiscounts.set(sellerId, d);
        for (const [sellerId, d] of evaluated.shipping) shippingDiscounts.set(sellerId, d);
        const total = [...evaluated.items.values(), ...evaluated.shipping.values()].reduce((a, b) => a + b, 0);
        coupon = { code: evaluated.coupon.code, applied: true, discount: fromMinor(total), couponId: evaluated.coupon.id, sellerId: evaluated.coupon.sellerId };
      }
    }

    const quoteGroups: QuoteGroup[] = groups.map((g) => {
      const itemDiscount = itemDiscounts.get(g.seller.id) ?? 0;
      const shippingDiscount = Math.min(shippingDiscounts.get(g.seller.id) ?? 0, g.shipping);
      const perLine = allocateMinor(itemDiscount, g.lines.map((l) => toMinor(l.lineTotal)));
      return {
        seller: g.seller,
        lines: g.lines.map((l, i) => ({ ...l, discount: fromMinor(perLine[i]!) })),
        itemsSubtotal: fromMinor(g.subtotal),
        itemDiscount: fromMinor(itemDiscount),
        shippingFee: fromMinor(g.shipping),
        shippingDiscount: fromMinor(shippingDiscount),
        total: fromMinor(g.subtotal - itemDiscount + g.shipping - shippingDiscount),
        weightGrams: g.weight,
      };
    });

    const itemsSubtotal = groups.reduce((s, g) => s + g.subtotal, 0);
    const shippingTotal = groups.reduce((s, g) => s + g.shipping, 0);
    const discountTotal = quoteGroups.reduce((s, g) => s + toMinor(g.itemDiscount) + toMinor(g.shippingDiscount), 0);
    const grandTotal = itemsSubtotal - discountTotal + shippingTotal;

    const codMax = toMinor(String(await this.settings.get<string | number>('orders.codMaxAmount', '20000.00')));
    const paymentMethods = this.payments.availableMethods().map((m) => {
      if (m.method !== 'cod') return { ...m, available: true };
      if (method && !method.supportsCod) return { ...m, available: false, reason: 'api.commerce.codNotForMethod' };
      if (grandTotal > codMax) return { ...m, available: false, reason: 'api.commerce.codLimit' };
      return { ...m, available: true };
    });

    return {
      groups: quoteGroups,
      problems,
      address: address ?? null,
      shippingMethod: method ? { code: method.code, name: method.name, minDays: method.minDays, maxDays: method.maxDays, supportsCod: method.supportsCod } : null,
      coupon,
      totals: {
        itemCount: buyable.reduce((n, l) => n + l.quantity, 0),
        itemsSubtotal: fromMinor(itemsSubtotal),
        discountTotal: fromMinor(discountTotal),
        shippingTotal: fromMinor(shippingTotal),
        grandTotal: fromMinor(grandTotal),
        shippingPending: !address || !method,
      },
      paymentMethods,
    };
  }

  /** Each seller ships separately: zone fee, free above the threshold, plus a per-kg fee above 1 kg. */
  private shippingFee(method: Method, address: Address, subtotalMinor: number, weightGrams: number): number {
    if (method.freeShippingThreshold && subtotalMinor >= toMinor(method.freeShippingThreshold)) return 0;
    const inside = (INSIDE_DHAKA_DISTRICTS as readonly string[]).includes(address.district);
    const base = toMinor(inside ? method.insideDhakaFee : method.outsideDhakaFee);
    const extraKg = Math.max(0, Math.ceil((weightGrams - 1000) / 1000));
    return base + extraKg * toMinor(method.perExtraKgFee);
  }

  private async evaluateCoupon(
    tx: DbOrTx,
    code: string,
    userId: string,
    groups: Array<{ seller: CartLine['seller']; subtotal: number; shipping: number }>,
  ): Promise<{ coupon: Coupon; items: Map<string, number>; shipping: Map<string, number> } | { error: string; params?: Record<string, string | number> }> {
    const [coupon] = await tx.select().from(coupons).where(eq(coupons.code, code));
    const now = new Date();
    if (!coupon || !coupon.isActive) return { error: 'api.commerce.couponInvalid' };
    if (coupon.startsAt && coupon.startsAt > now) return { error: 'api.commerce.couponNotStarted' };
    if (coupon.endsAt && coupon.endsAt <= now) return { error: 'api.commerce.couponExpired' };
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { error: 'api.commerce.couponUsedUp' };
    const [{ used } = { used: 0 }] = await tx.select({ used: count() }).from(couponUsages).where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, userId)));
    if (used >= coupon.perUserLimit) return { error: 'api.commerce.couponAlreadyUsed' };

    const eligible = coupon.sellerId ? groups.filter((g) => g.seller.id === coupon.sellerId) : groups;
    if (!eligible.length) return { error: 'api.commerce.couponNotApplicable' };
    const base = eligible.reduce((s, g) => s + g.subtotal, 0);
    if (base < toMinor(coupon.minOrderAmount)) return { error: 'api.commerce.couponMinimum', params: { amount: coupon.minOrderAmount } };

    const items = new Map<string, number>();
    const shipping = new Map<string, number>();
    if (coupon.type === 'free_shipping') {
      for (const g of eligible) shipping.set(g.seller.id, g.shipping);
    } else {
      let discount = coupon.type === 'percent' ? Math.round((base * Math.round(Number(coupon.value) * 100)) / 10000) : toMinor(coupon.value);
      if (coupon.maxDiscountAmount) discount = Math.min(discount, toMinor(coupon.maxDiscountAmount));
      discount = Math.min(discount, base);
      const parts = allocateMinor(discount, eligible.map((g) => g.subtotal));
      eligible.forEach((g, i) => items.set(g.seller.id, parts[i]!));
    }
    return { coupon, items, shipping };
  }

  /** Commission on what the seller actually sells: platform-funded coupons don't reduce it. */
  static commission(itemsSubtotal: string, sellerFundedDiscount: string, percent: number): { commission: string; earning: string } {
    const net = toMinor(itemsSubtotal) - toMinor(sellerFundedDiscount);
    const commission = Math.round((net * Math.round(percent * 100)) / 10000);
    return { commission: fromMinor(commission), earning: fromMinor(net - commission) };
  }
}

