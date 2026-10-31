import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@boikonika/shared';

/** Bangla is served at "/" and English at "/en" — clean URLs for the primary audience, hreflang for SEO. */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeCookie: { name: 'bk-locale', maxAge: 60 * 60 * 24 * 365 },
});
