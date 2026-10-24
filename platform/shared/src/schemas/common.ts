import { z } from 'zod';
import { LOCALES } from '../i18n';
import { normalizeBdPhone } from '../utils/phone';
import { toEnglishDigits } from '../utils/bangla';
import { PASSWORD_POLICY, passwordProblems } from '../constants/security';

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

export type Identifier = { kind: 'email'; value: string } | { kind: 'phone'; value: string } | { kind: 'username'; value: string };

/** Email, BD mobile number or username — normalised and tagged with its kind. */
export function parseIdentifier(raw: string): Identifier | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes('@')) {
    const parsed = emailSchema.safeParse(value);
    return parsed.success ? { kind: 'email', value: parsed.data } : null;
  }
  const phone = normalizeBdPhone(value);
  if (phone) return { kind: 'phone', value: phone };
  // Usernames need a letter, so a mistyped phone number is reported as invalid instead of
  // silently becoming a username lookup.
  return /^[A-Za-z0-9._]{3,30}$/.test(value) && /[A-Za-z]/.test(value) ? { kind: 'username', value: value.toLowerCase() } : null;
}

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
    if (passwordProblems(value).length) ctx.addIssue({ code: 'custom', message: 'validation.passwordWeak' });
  });

export const usernameSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .regex(/^[A-Za-z0-9._]{3,30}$/, { error: 'validation.username' })
  .refine((v) => /[A-Za-z]/.test(v) && !/^[._]|[._]$|\.\./.test(v), { error: 'validation.username' });

export const displayNameSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .min(2, { error: 'validation.nameLength' })
  .max(120, { error: 'validation.nameLength' })
  .refine((v) => !/[<>]/.test(v), { error: 'validation.nameLength' });

/** Six digits; Bangla digits are accepted and normalised. */
export const otpCodeSchema = z
  .string({ error: 'validation.otp' })
  .trim()
  .transform((v) => toEnglishDigits(v).replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, { error: 'validation.otp' }));

export const localeSchema = z.enum(LOCALES);

export const uuidSchema = z.uuid({ error: 'validation.invalidId' });

export const pageQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
