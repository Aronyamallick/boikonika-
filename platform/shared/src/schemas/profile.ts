import { z } from 'zod';
import { INTEREST_KEYS } from '../constants/interests';
import { KYC_DOCUMENT_TYPES, KYC_PURPOSES, VISIBILITIES } from '../constants/statuses';
import { ROLES } from '../constants/roles';
import { LOCALES } from '../i18n/locales';
import { displayNameSchema } from './common';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: 'validation.maxLength' })
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: optionalText(600),
  education: optionalText(200),
  institution: optionalText(200),
  location: optionalText(120),
  website: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || /^https?:\/\/[^\s]+\.[^\s]+$/.test(v), { error: 'validation.url' })
    .nullable()
    .optional(),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  profileVisibility: z.enum(VISIBILITIES).optional(),
  readingStatsVisibility: z.enum(VISIBILITIES).optional(),
  libraryVisibility: z.enum(VISIBILITIES).optional(),
  activityVisibility: z.enum(VISIBILITIES).optional(),
  locale: z.enum(LOCALES).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  personalizationEnabled: z.boolean().optional(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const ONBOARDING_MIN_INTERESTS = 3;

export const interestsSchema = z.object({
  interests: z
    .array(z.enum(INTEREST_KEYS))
    .min(ONBOARDING_MIN_INTERESTS, { error: 'validation.pickInterests' })
    .max(INTEREST_KEYS.length)
    .transform((list) => [...new Set(list)]),
});

export const deleteAccountSchema = z.object({
  /** Required when the account has a password. */
  password: z.string().max(128).optional(),
  confirm: z.literal('DELETE', { error: 'validation.confirmDelete' }),
});

export const kycDocumentMetaSchema = z.object({
  type: z.enum(KYC_DOCUMENT_TYPES),
  side: z.enum(['front', 'back', 'single']).default('single'),
  number: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v.replace(/[\s-]/g, '').toUpperCase())
    .optional(),
  expiresOn: z.iso.date().optional(),
});

/** Sent as the multipart field "data" (JSON) alongside the files "documents[]" in the same order. */
export const kycSubmitSchema = z.object({
  purpose: z.enum(KYC_PURPOSES),
  requestedRole: z.enum(ROLES),
  legalName: displayNameSchema,
  dateOfBirth: z.iso.date().optional(),
  businessName: optionalText(200),
  institutionName: optionalText(200),
  address: optionalText(500),
  documents: z.array(kycDocumentMetaSchema).min(1).max(6),
  declarations: z.object({
    accurate: z.literal(true, { error: 'validation.declaration' }),
    authorised: z.literal(true, { error: 'validation.declaration' }),
  }),
});
export type KycSubmitInput = z.input<typeof kycSubmitSchema>;

export const kycDecisionSchema = z.object({ note: z.string().trim().max(1000).optional() });
export const kycRejectSchema = z.object({ reason: z.string().trim().min(5, { error: 'validation.reasonRequired' }).max(1000) });
