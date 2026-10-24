export const LOCALES = ['bn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
/** Bangladesh-first: Bangla is the default; English is a full alternative. */
export const DEFAULT_LOCALE: Locale = 'bn';

export const isLocale = (value: string | undefined | null): value is Locale => !!value && (LOCALES as readonly string[]).includes(value);
