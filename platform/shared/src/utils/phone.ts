import { toEnglishDigits } from './bangla';

/** Bangladeshi mobile numbers: 01[3-9] + 8 digits, optionally prefixed with +88 / 88. */
const BD_MOBILE = /^(?:\+?88)?(01[3-9]\d{8})$/;

/** Normalises to E.164 (+8801XXXXXXXXX) or returns null when not a valid BD mobile number. */
export function normalizeBdPhone(input: string): string | null {
  const cleaned = toEnglishDigits(input).replace(/[\s\-().]/g, '');
  const match = BD_MOBILE.exec(cleaned);
  return match ? `+88${match[1]}` : null;
}

export const isBdPhone = (input: string): boolean => normalizeBdPhone(input) !== null;

/** "+8801712345678" → "01712-345678" for display; masks the middle when `mask` is set. */
export function formatBdPhone(e164: string, mask = false): string {
  const local = e164.replace(/^\+88/, '');
  if (mask) return `${local.slice(0, 3)}****${local.slice(-4)}`;
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

/** Mobile operator by prefix — used for SMS routing and bKash/Nagad hints. */
export function bdOperator(e164: string): 'grameenphone' | 'banglalink' | 'robi' | 'airtel' | 'teletalk' | 'unknown' {
  const prefix = e164.replace(/^\+88/, '').slice(0, 3);
  switch (prefix) {
    case '017':
    case '013':
      return 'grameenphone';
    case '019':
    case '014':
      return 'banglalink';
    case '018':
      return 'robi';
    case '016':
      return 'airtel';
    case '015':
      return 'teletalk';
    default:
      return 'unknown';
  }
}
