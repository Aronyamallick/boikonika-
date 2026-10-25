/** Catalogue response shapes (mirrors the API; the API is the source of truth). */
export interface BookCardData {
  id: string;
  slug: string;
  title: string;
  language: string;
  coverUrl: string | null;
  authors: Array<{ name: string; slug: string }>;
  minPrice: string | null;
  compareAtPrice: string | null;
  offerCount: number;
  inStock: boolean;
  hasUsed: boolean;
  isFree: boolean;
  ratingAvg: number;
  ratingCount: number;
}

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  price: string;
  compareAtPrice: string | null;
  inStock: boolean;
  ratingAvg: number;
  ratingCount: number;
  store: { name: string; slug: string } | null;
}

export interface AuthorCardData {
  slug: string;
  name: string;
  nameAlt: string | null;
  photoUrl: string | null;
  verified: boolean;
  bookCount: number;
  followerCount: number;
}

export interface StoreCardData {
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  district: string | null;
  ratingAvg: number;
  productCount: number;
}

export type LocalizedText = { bn: string; en: string } | null;

export interface HomeSection {
  key: string;
  type: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  config: { source?: string; content?: Record<string, unknown> };
  items: unknown[];
}

export interface CategoryNode {
  id: string;
  slug: string;
  path: string;
  name: LocalizedText;
  icon: string | null;
  appliesTo: string;
  depth: number;
  children: CategoryNode[];
}

export interface CategoryDetail {
  slug: string;
  path: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string | null;
  appliesTo: string;
  children: Array<{ slug: string; path: string; name: LocalizedText; icon: string | null }>;
  breadcrumbs: Array<{ path: string; name: LocalizedText }>;
}

export interface RatingSummary {
  average: number;
  count: number;
  breakdown: Record<string, number>;
}

export interface BookOffer {
  productId: string;
  productSlug: string;
  variantId: string | null;
  formatId: string | null;
  condition: string;
  conditionNote: string | null;
  price: string;
  compareAtPrice: string | null;
  stock: number;
  store: { name: string; slug: string; district: string | null; ratingAvg: number; ratingCount: number };
}

export interface BookDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  originalTitle: string | null;
  description: string | null;
  language: string;
  ageGroup: string | null;
  academicLevel: string | null;
  seriesName: string | null;
  seriesNumber: number | null;
  firstPublishedYear: number | null;
  isFree: boolean;
  coverUrl: string | null;
  images: Array<{ url: string; alt: string | null; kind: string }>;
  tableOfContents: unknown;
  contributors: Array<{ id: string; slug: string; name: string; nameAlt: string | null; role: string; verified: boolean; photoUrl: string | null }>;
  categories: Array<{ slug: string; path: string; name: LocalizedText; primary: boolean }>;
  genres: Array<{ key: string; name: LocalizedText }>;
  formats: Array<{ id: string; format: string; isbn13: string | null; isbn10: string | null; edition: string | null; publicationYear: number | null; pages: number | null; publisher: { name: string; slug: string } | null }>;
  offers: BookOffer[];
  previews: Array<{ id: string; kind: string; title: string | null }>;
  rating: RatingSummary;
  picks: { editors: boolean; students: boolean; teachers: boolean };
  related: BookCardData[];
}

export interface ProductVariant {
  id: string;
  name: string;
  options: Record<string, string>;
  price: string;
  compareAtPrice: string | null;
  sku: string | null;
  available: number;
}

export type ProductDetail =
  | { type: 'book'; bookSlug: string | null }
  | {
      type: 'general';
      id: string;
      slug: string;
      title: string;
      description: string | null;
      brand: string | null;
      attributes: Record<string, string>;
      price: string;
      compareAtPrice: string | null;
      images: Array<{ url: string; alt: string | null }>;
      variants: ProductVariant[];
      category: { path: string; name: LocalizedText } | null;
      store: { name: string; slug: string; district: string | null; ratingAvg: number } | null;
      rating: RatingSummary;
      related: ProductCardData[];
    };

export interface AuthorDetail extends AuthorCardData {
  id: string;
  bio: string | null;
  birthYear: number | null;
  deathYear: number | null;
  website: string | null;
  claimed: boolean;
  following: boolean;
  books: BookCardData[];
}

export interface PublisherDetail {
  slug: string;
  name: string;
  nameAlt: string | null;
  description: string | null;
  website: string | null;
  foundedYear: number | null;
  verified: boolean;
  logoUrl: string | null;
  followerCount: number;
  books: BookCardData[];
}

export interface StoreDetail {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  division: string | null;
  district: string | null;
  returnPolicy: string | null;
  shippingPolicy: string | null;
  ratingAvg: number;
  ratingCount: number;
  followerCount: number;
  productCount: number;
  sellerType: string;
  since: string | null;
  books: BookCardData[];
  products: ProductCardData[];
}

export interface SearchResults {
  query: string;
  books: BookCardData[];
  bookTotal?: number;
  authors: AuthorCardData[];
  products: ProductCardData[];
}

export interface Suggestion {
  kind: 'book' | 'author' | 'product' | 'query';
  slug: string;
  label: string;
  detail: string | null;
  imageUrl: string | null;
}

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
