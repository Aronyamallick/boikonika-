import { z } from 'zod';
import { COPYRIGHT_TARGETS, RESTRICTION_SCOPES, SETTINGS_CATALOG } from '../constants/admin';
import { ROLES } from '../constants/roles';
import { MODERATION_ACTIONS, REPORT_STATUSES, USER_STATUSES } from '../constants/statuses';
import { nfcText } from './catalog';

const page = { page: z.coerce.number().int().min(1).max(10_000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };

export const reportQueueQuerySchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  priority: z.enum(['normal', 'high']).optional(),
  targetType: z.string().max(20).optional(),
  ...page,
});

/** A moderator's decision on a report; duration applies to restrictions and suspensions. */
export const reportDecisionSchema = z
  .object({
    action: z.enum(MODERATION_ACTIONS),
    reason: nfcText(5, 1000),
    durationDays: z.coerce.number().int().min(1).max(365).optional(),
    scope: z.enum(RESTRICTION_SCOPES).default('all'),
  })
  .refine((v) => !['temporary_restriction', 'suspension'].includes(v.action) || v.durationDays !== undefined, { error: 'validation.durationRequired', path: ['durationDays'] });
export type ReportDecisionInput = z.input<typeof reportDecisionSchema>;

export const adminUserQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  ...page,
});

export const userStatusSchema = z
  .object({ status: z.enum(['active', 'suspended', 'banned']), reason: nfcText(5, 1000), days: z.coerce.number().int().min(1).max(365).optional() })
  .refine((v) => v.status !== 'suspended' || v.days !== undefined, { error: 'validation.durationRequired', path: ['days'] });

export const auditQuerySchema = z.object({
  action: z.string().trim().max(60).optional(),
  entityType: z.string().trim().max(40).optional(),
  actor: z.string().trim().max(120).optional(),
  ...page,
});

/** Partial update of the settings catalog; each value is checked against its entry. */
export const settingsUpdateSchema = z.object({ values: z.record(z.string(), z.union([z.number(), z.boolean()])) }).superRefine((v, ctx) => {
  for (const [key, value] of Object.entries(v.values)) {
    const entry = SETTINGS_CATALOG[key as keyof typeof SETTINGS_CATALOG];
    if (!entry) ctx.addIssue({ code: 'custom', path: ['values', key], message: 'validation.invalidChoice' });
    else if (entry.type === 'boolean' && typeof value !== 'boolean') ctx.addIssue({ code: 'custom', path: ['values', key], message: 'validation.invalidChoice' });
    else if (entry.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || value < entry.min || value > entry.max)) {
      ctx.addIssue({ code: 'custom', path: ['values', key], message: 'validation.outOfRange' });
    }
  }
});

const optionalUrl = z.url({ protocol: /^https?$/, error: 'validation.url' }).max(500);

/** A copyright complaint (takedown request), from anyone — the rights holder or their agent. */
export const copyrightClaimSchema = z.object({
  claimantName: nfcText(3, 160),
  claimantEmail: z.email({ error: 'validation.email' }).max(254),
  claimantPhone: z.string().trim().max(20).optional(),
  rightsHolder: nfcText(2, 200),
  workDescription: nfcText(20, 3000),
  contentUrl: z.url({ protocol: /^https?$/, error: 'validation.url' }).max(500),
  evidenceUrls: z.array(optionalUrl).max(5).default([]),
  goodFaithStatement: z.literal(true, { error: 'validation.declaration' }),
  accuracyStatement: z.literal(true, { error: 'validation.declaration' }),
  signature: nfcText(3, 160),
});
export type CopyrightClaimInput = z.input<typeof copyrightClaimSchema>;

export const copyrightQuerySchema = z.object({ status: z.string().max(30).optional(), ...page });

export const copyrightDecisionSchema = z.object({
  decision: z.enum(['review', 'uphold', 'reject', 'restore', 'keep_removed']),
  note: nfcText(5, 2000),
});

/** The uploader's answer to a takedown: why the content is theirs (or licensed) to publish. */
export const counterNoticeSchema = z.object({
  statement: nfcText(50, 3000),
  signature: nfcText(3, 160),
  consent: z.literal(true, { error: 'validation.declaration' }),
});

export const copyrightTargetSchema = z.enum(COPYRIGHT_TARGETS);
