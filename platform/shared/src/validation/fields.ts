import { toEnglishDigits } from '../utils/bangla';
import { normalizeBdPhone } from '../utils/phone';
import { passwordProblems } from '../constants/security';

/**
 * Dependency-free field rules shared by the zod schemas (API) and the web/mobile forms, so both sides
 * validate identically without shipping a schema library to the browser. Each returns an i18n key
 * on failure.
 */
export type ValidationKey = `validation.${string}`;

export type Identifier = { kind: 'email' | 'phone' | 'username'; value: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME = /^[A-Za-z0-9._]{3,30}$/;

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export function isValidUsername(value: string): boolean {
  return USERNAME.test(value) && /[A-Za-z]/.test(value) && !/^[._]|[._]$|\.\./.test(value);
}

/** Email, BD mobile number or username — normalised and tagged with its kind. */
export function parseIdentifier(raw: string): Identifier | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes('@')) {
    const email = normalizeEmail(value);
    return email ? { kind: 'email', value: email } : null;
  }
  const phone = normalizeBdPhone(value);
  if (phone) return { kind: 'phone', value: phone };
  // Usernames need a letter, so a mistyped phone number is reported as invalid instead of
  // silently becoming a username lookup.
  return USERNAME.test(value) && /[A-Za-z]/.test(value) ? { kind: 'username', value: value.toLowerCase() } : null;
}

/** Email or BD mobile (where a code can be sent). */
export function parseContact(raw: string): { kind: 'email' | 'phone'; value: string } | null {
  const id = parseIdentifier(raw);
  return id && id.kind !== 'username' ? (id as { kind: 'email' | 'phone'; value: string }) : null;
}

/** "১২৩ ৪৫৬" → "123456"; null unless exactly six digits. */
export function normalizeOtp(raw: string): string | null {
  const digits = toEnglishDigits(raw.trim()).replace(/\s/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

export function displayNameError(value: string): ValidationKey | null {
  const name = value.trim();
  return name.length < 2 || name.length > 120 || /[<>]/.test(name) ? 'validation.nameLength' : null;
}

export function passwordError(value: string): ValidationKey | null {
  return passwordProblems(value).length ? 'validation.passwordWeak' : null;
}
