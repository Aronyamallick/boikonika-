import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/api/server';
import { absoluteUrl } from '@/lib/seo';

// Built per request (the API caches the list), never at build time when the API may not be running.
export const dynamic = 'force-dynamic';

/** Listing pages that are always there. People's profiles are left out on purpose. */
const SECTIONS = ['/', '/books', '/products', '/authors', '/community', '/clubs', '/student-zone', '/challenges', '/blog', '/help', '/contact', '/copyright'];

/** Every public page once, in Bangla (the default), with its English twin as an hreflang alternate. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = (await serverApi<Array<{ path: string; updatedAt: string }>>('/sitemap', { locale: 'bn', revalidate: 900 }).catch(() => null)) ?? [];
  return [...SECTIONS.map((path) => ({ path, updatedAt: undefined })), ...pages].map(({ path: raw, updatedAt }) => {
    // Slugs can be Bangla; sitemap URLs must be percent-encoded.
    const path = encodeURI(raw);
    return {
      url: absoluteUrl('bn', path),
      lastModified: updatedAt,
      alternates: { languages: { bn: absoluteUrl('bn', path), en: absoluteUrl('en', path), 'x-default': absoluteUrl('bn', path) } },
    };
  });
}
