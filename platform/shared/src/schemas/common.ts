import { z } from 'zod';
import { LOCALES } from '../i18n/locales';
import { normalizeBdPhone } from '../utils/phone';
import { PASSWORD_POLICY } from '../constants/security';
import { displayNameError, isValidUsername, normalizeOtp, parseIdentifier, passwordError } from '../validation/fields';

/**
 * Field schemas shared by the API, the web forms and the mobile app. Error messages are i18n keys
 * (e.g. "validation.email"); clients and the API translate them with the shared message files.
 */
export const emailSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .toLowerCase()
  .max(254, { error: 'validation.email' })
  .pipe(z.email({ error: 'validation.email' }));

/** Bangladeshi mobile number in any common format (Bangla digits, +88, spaces) → E.164. */
export const bdPhoneSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .transform((value, ctx) => {
    const phone = normalizeBdPhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'validation.phone' });
      return z.NEVER;
    }
    return phone;
  });

/** Email or BD mobile (no usernames) — where a code will be sent. */
export const contactSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .min(1, { error: 'validation.required' })
  .transform((value, ctx) => {
    const id = parseIdentifier(value);
    if (!id || id.kind === 'username') {
      ctx.addIssue({ code: 'custom', message: 'validation.identifier' });
      return z.NEVER;
    }
    return id as { kind: 'email' | 'phone'; value: string };
  });

/** Email, BD mobile or username — for logging in. */
export const identifierSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .min(1, { error: 'validation.required' })
  .max(254, { error: 'validation.identifier' })
  .transform((value, ctx) => {
    const id = parseIdentifier(value);
    if (!id) {
      ctx.addIssue({ code: 'custom', message: 'validation.identifier' });
      return z.NEVER;
    }
    return id;
  });

export const passwordSchema = z
  .string({ error: 'validation.required' })
  .max(PASSWORD_POLICY.maxLength, { error: 'validation.passwordWeak' })
  .superRefine((value, ctx) => {
    if (passwordError(value)) ctx.addIssue({ code: 'custom', message: 'validation.passwordWeak' });
  });

export const usernameSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .refine(isValidUsername, { error: 'validation.username' });

export const displayNameSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .refine((v) => !displayNameError(v), { error: 'validation.nameLength' });

/** Six digits; Bangla digits are accepted and normalised. */
export const otpCodeSchema = z.string({ error: 'validation.otp' }).transform((v, ctx) => {
  const code = normalizeOtp(v);
  if (!code) {
    ctx.addIssue({ code: 'custom', message: 'validation.otp' });
    return z.NEVER;
  }
  return code;
});

export const localeSchema = z.enum(LOCALES);

export const uuidSchema = z.uuid({ error: 'validation.invalidId' });

export const pageQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
