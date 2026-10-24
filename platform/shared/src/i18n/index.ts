import bn from './messages/bn.json';
import en from './messages/en.json';

export const LOCALES = ['bn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
/** Bangladesh-first: Bangla is the default; English is a full alternative. */
export const DEFAULT_LOCALE: Locale = 'bn';

export type Messages = typeof en;
export const messages: Record<Locale, Messages> = { bn, en };

export const isLocale = (value: string | undefined | null): value is Locale => !!value && (LOCALES as readonly string[]).includes(value);

/** Flattens nested messages into dotted keys — used by the key-parity test and admin tooling. */
export function flattenMessages(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') Object.assign(out, flattenMessages(value as Record<string, unknown>, path));
    else out[path] = String(value);
  }
  return out;
}
