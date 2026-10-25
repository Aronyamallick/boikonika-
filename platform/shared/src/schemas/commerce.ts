import { z } from 'zod';
import { BD_DISTRICT_KEYS, findDivision, isDistrictInDivision } from '../constants/bangladesh';
import { ADDRESS_LABELS, COURIERS, MAX_CART_QUANTITY, PAYOUT_METHODS, RETURN_REASONS, SELLER_ORDER_ACTIONS } from '../constants/commerce';
import { PAYMENT_METHODS } from '../constants/statuses';
import { toEnglishDigits } from '../utils/bangla';
import { moneySchema, nfcText } from './catalog';
import { bdPhoneSchema } from './common';

const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((v) => v.normalize('NFC').replace(/\s+/g, ' ').trim())
    .pipe(z.string().max(max, { error: 'validation.maxLength' }))
    .optional()
    .transform((v) => v || undefined);

/** Bangladesh delivery address: division → district (official keys), then upazila/thana, area and street. */
export const addressSchema = z
  .object({
    label: z.enum(ADDRESS_LABELS).default('home'),
    recipientName: nfcText(2, 120),
    phone: bdPhoneSchema,
    division: z.string({ error: 'validation.required' }).trim().min(1, { error: 'validation.required' }),
    district: z.string({ error: 'validation.required' }).trim().min(1, { error: 'validation.required' }),
    upazila: nfcText(2, 80),
    union: optionalText(80),
    area: nfcText(2, 120),
    addressLine: nfcText(3, 300),
    postcode: z
      .string()
      .transform((v) => toEnglishDigits(v).trim())
      .refine((v) => v === '' || /^[0-9]{4}$/.test(v), { error: 'validation.postcode' })
      .optional()
      .transform((v) => v || undefined),
    isDefault: z.boolean().default(false),
  })
  .refine((v) => !!findDivision(v.division), { error: 'validation.invalidChoice', path: ['division'] })
  .refine((v) => BD_DISTRICT_KEYS.includes(v.district) && isDistrictInDivision(v.division, v.district), { error: 'validation.invalidChoice', path: ['district'] });
export type AddressInput = z.input<typeof addressSchema>;

const quantity = z.coerce.number().int().min(1, { error: 'validation.quantity' }).max(MAX_CART_QUANTITY, { error: 'validation.quantity' });

export const addCartItemSchema = z.object({ variantId: z.uuid({ error: 'validation.invalidId' }), quantity: quantity.default(1) });
export const updateCartItemSchema = z
  .object({ quantity: quantity.optional(), savedForLater: z.boolean().optional() })
  .refine((v) => v.quantity !== undefined || v.savedForLater !== undefined, { error: 'validation.required' });
export const mergeCartSchema = z.object({ guestToken: z.string().regex(/^[A-Za-z0-9_-]{32,64}$/) });
export const couponCodeSchema = z.object({
  code: z
    .string({ error: 'validation.required' })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,40}$/, { error: 'validation.couponCode' }),
});

const idempotencyKey = z.string().regex(/^[A-Za-z0-9_-]{16,80}$/, { error: 'validation.required' });

/** Price check before placing the order (also used for the live summary on the checkout page). */
export const checkoutQuoteSchema = z.object({
  addressId: z.uuid().optional(),
  shippingMethod: z.string().trim().max(40).default('standard'),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
});

export const checkoutSchema = z.object({
  addressId: z.uuid({ error: 'validation.addressRequired' }),
  shippingMethod: z.string().trim().max(40).default('standard'),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: 'validation.paymentMethod' }),
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
  note: optionalText(500),
  /** Generated once per checkout page: retries (double click, flaky network) return the same order. */
  idempotencyKey,
  /** What the buyer saw; if prices changed since, the order is not placed and a fresh quote is returned. */
  expectedTotal: moneySchema.optional(),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const payOrderSchema = z.object({ paymentMethod: z.enum(PAYMENT_METHODS, { error: 'validation.paymentMethod' }), idempotencyKey });

export const cancelOrderSchema = z.object({ reason: nfcText(3, 500) });

export const sellerOrderUpdateSchema = z
  .object({
    status: z.enum(SELLER_ORDER_ACTIONS),
    note: optionalText(500),
    courier: z.enum(COURIERS).optional(),
    trackingNumber: z
      .string()
      .trim()
      .max(80)
      .regex(/^[A-Za-z0-9-]*$/, { error: 'validation.trackingNumber' })
      .optional()
      .transform((v) => v || undefined),
    trackingUrl: z.url({ protocol: /^https$/, error: 'validation.httpsUrl' }).max(500).optional(),
  })
  .refine((v) => v.status !== 'cancelled' || (v.note && v.note.length >= 3), { error: 'validation.reasonRequired', path: ['note'] });

export const returnRequestSchema = z.object({
  sellerOrderId: z.uuid(),
  reason: z.enum(RETURN_REASONS),
  details: optionalText(1000),
  items: z
    .array(z.object({ orderItemId: z.uuid(), quantity: z.coerce.number().int().min(1).max(MAX_CART_QUANTITY) }))
    .min(1, { error: 'validation.required' })
    .max(50),
});

export const returnDecisionSchema = z.object({ approve: z.boolean(), note: optionalText(500) }).refine((v) => v.approve || (v.note && v.note.length >= 5), { error: 'validation.reasonRequired', path: ['note'] });
export const returnReceivedSchema = z.object({ restock: z.boolean().default(true) });

export const refundSchema = z.object({
  amount: moneySchema.refine((v) => Number(v) > 0, { error: 'validation.nonZero' }),
  sellerOrderId: z.uuid().optional(),
  reason: nfcText(5, 500),
});

export const payoutAccountSchema = z
  .object({
    method: z.enum(PAYOUT_METHODS),
    accountName: nfcText(2, 160),
    accountNumber: z
      .string({ error: 'validation.required' })
      .transform((v) => toEnglishDigits(v).replace(/[\s-]/g, ''))
      .pipe(z.string().regex(/^[0-9]{6,30}$/, { error: 'validation.accountNumber' })),
    bankName: optionalText(120),
    branchName: optionalText(120),
    routingNumber: z
      .string()
      .transform((v) => toEnglishDigits(v).trim())
      .refine((v) => v === '' || /^[0-9]{9}$/.test(v), { error: 'validation.routingNumber' })
      .optional()
      .transform((v) => v || undefined),
  })
  .refine((v) => v.method !== 'bank' || !!v.bankName, { error: 'validation.required', path: ['bankName'] })
  // Mobile wallets are phone numbers: 01XXXXXXXXX.
  .refine((v) => v.method === 'bank' || /^(?:880)?01[3-9][0-9]{8}$/.test(v.accountNumber), { error: 'validation.phone', path: ['accountNumber'] });

export const payoutPaidSchema = z.object({ reference: nfcText(3, 120), note: optionalText(500) });
export const payoutFailedSchema = z.object({ note: nfcText(3, 500) });

const optionalMoney = moneySchema.optional();
export const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,40}$/, { error: 'validation.couponCode' }),
    type: z.enum(['percent', 'fixed', 'free_shipping']),
    value: moneySchema,
    minOrderAmount: moneySchema.default('0.00'),
    maxDiscountAmount: optionalMoney,
    usageLimit: z.coerce.number().int().min(1).max(10_000_000).optional(),
    perUserLimit: z.coerce.number().int().min(1).max(100).default(1),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    isActive: z.boolean().default(true),
    description: optionalText(300),
  })
  .refine((v) => v.type !== 'percent' || (Number(v.value) > 0 && Number(v.value) <= 100), { error: 'validation.percent', path: ['value'] })
  .refine((v) => v.type === 'free_shipping' || Number(v.value) > 0, { error: 'validation.nonZero', path: ['value'] })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, { error: 'validation.dateRange', path: ['endsAt'] });
export type CouponInput = z.input<typeof couponSchema>;
