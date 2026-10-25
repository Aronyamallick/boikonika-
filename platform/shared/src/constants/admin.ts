/** Admin and moderation constants (kept apart from zod so browser bundles stay small). */

/** What a temporary restriction stops the person from doing. */
export const RESTRICTION_SCOPES = ['post', 'comment', 'review', 'sell', 'message', 'all'] as const;
export type RestrictionScope = (typeof RESTRICTION_SCOPES)[number];

export const COPYRIGHT_TARGETS = ['digital_asset', 'product', 'post', 'preview'] as const;
export type CopyrightTarget = (typeof COPYRIGHT_TARGETS)[number];

/**
 * System settings staff can change without a deploy. Each entry: type, default, limits. Keys are what
 * the API reads with SettingsService.
 */
export const SETTINGS_CATALOG = {
  'commission.defaultPercent': { type: 'number', default: 10, min: 0, max: 50, step: 0.5, group: 'commerce' },
  'orders.paymentWindowMinutes': { type: 'number', default: 30, min: 5, max: 1440, step: 1, group: 'commerce' },
  'orders.codMaxAmount': { type: 'number', default: 20000, min: 0, max: 500000, step: 100, group: 'commerce' },
  'orders.returnWindowDays': { type: 'number', default: 7, min: 0, max: 60, step: 1, group: 'commerce' },
  'marketplace.requireListingReview': { type: 'boolean', default: false, group: 'commerce' },
  'preview.maxPercent': { type: 'number', default: 20, min: 1, max: 50, step: 1, group: 'digital' },
  'digital.downloadsPerDay': { type: 'number', default: 10, min: 1, max: 100, step: 1, group: 'digital' },
  'recommendations.minSupport': { type: 'number', default: 2, min: 2, max: 50, step: 1, group: 'privacy' },
  'kyc.approvedRetentionDays': { type: 'number', default: 1825, min: 365, max: 3650, step: 1, group: 'privacy' },
  'kyc.rejectedRetentionDays': { type: 'number', default: 90, min: 30, max: 730, step: 1, group: 'privacy' },
} as const satisfies Record<string, { type: 'number'; default: number; min: number; max: number; step: number; group: string } | { type: 'boolean'; default: boolean; group: string }>;
export type SettingKey = keyof typeof SETTINGS_CATALOG;
