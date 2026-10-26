export type { BookCardData, ProductCardData, AuthorCardData, StoreCardData, LocalizedText, HomeSection, CategoryNode, CategoryDetail, RatingSummary, BookOffer, BookDetail, ProductVariant, ProductDetail, AuthorDetail, PublisherDetail, StoreDetail, SearchResults, Suggestion } from '@boikonika/shared';
import type { LocalizedText } from '@boikonika/shared';

/** Picks the visitor's language from a `{ bn, en }` value, falling back to the other one. */
export function localized(value: LocalizedText | string | undefined, locale: string): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return (locale === 'en' ? value.en || value.bn : value.bn || value.en) ?? '';
}

type QueryValue = string | number | boolean | string[] | undefined | null;

/** Builds a query string, dropping empty values (so URLs stay short and cache-friendly). */
export function toQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','));
    } else search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** Search params from a Next.js page as plain strings (first value wins). */
export function flatParams(params: Record<string, string | string[] | undefined>): Record<string, string> {
  // Repeated keys (checkbox groups submitted without JavaScript) become the comma lists the API expects.
  return Object.fromEntries(
    Object.entries(params)
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v] as const)
      .filter((e): e is readonly [string, string] => typeof e[1] === 'string' && e[1] !== ''),
  );
}
