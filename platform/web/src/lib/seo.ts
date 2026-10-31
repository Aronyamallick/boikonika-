import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/env';

/** Path with the locale prefix (Bangla is served without one). */
export function localePath(locale: string, path: string): string {
  const clean = path === '/' ? '' : path;
  return locale === 'bn' ? clean || '/' : `/${locale}${clean}`;
}

export const absoluteUrl = (locale: string, path: string) => `${SITE_URL}${localePath(locale, path)}`;

/** Canonical URL plus hreflang alternates for a page that exists in every language. */
export function alternates(locale: string, path: string): Metadata['alternates'] {
  return {
    canonical: localePath(locale, path),
    languages: { bn: localePath('bn', path), en: localePath('en', path), 'x-default': localePath('bn', path) },
  };
}

/** Serialises structured data safely inside a script tag (no `</script>` break-out). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
