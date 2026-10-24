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

/** Looks up a dotted key; returns undefined when the key does not exist. */
export function lookupMessage(locale: Locale, key: string): string | undefined {
  let node: unknown = messages[locale];
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Minimal server-side formatter for API messages: replaces `{name}` placeholders. Keys that do not
 * exist are returned unchanged, so plain sentences can be passed through as well.
 */
export function translate(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const template = lookupMessage(locale, key) ?? lookupMessage(DEFAULT_LOCALE, key) ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Picks the best supported locale from an Accept-Language header ("bn-BD,bn;q=0.9,en;q=0.8"). */
export function negotiateLocale(header: string | undefined | null, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (!header) return fallback;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...rest] = part.trim().split(';');
      const q = rest.find((p) => p.trim().startsWith('q='));
      return { lang: (tag ?? '').toLowerCase().split('-')[0] ?? '', q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((x) => x.lang)
    .sort((a, b) => b.q - a.q);
  return (ranked.find((x) => isLocale(x.lang))?.lang as Locale | undefined) ?? fallback;
}
