import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';

/** Accounts, checkout, dashboards and tools are private; staging sets SEARCH_INDEXING=off to stay out of search. */
const PRIVATE = ['/account', '/admin', '/seller', '/studio', '/author', '/publisher', '/library', '/notifications', '/cart', '/checkout', '/payments', '/onboarding', '/assistant', '/search', '/design-system', '/login', '/register', '/forgot-password'];

export default function robots(): MetadataRoute.Robots {
  if (process.env.SEARCH_INDEXING === 'off') return { rules: { userAgent: '*', disallow: '/' } };
  // Both the Bangla paths and their /en twins. Prefix rules match deeper pages too ("/author" also covers
  // "/author/…" but not "/authors").
  const disallow = PRIVATE.flatMap((p) => [p + '$', p + '/', `/en${p}$`, `/en${p}/`]);
  return { rules: { userAgent: '*', allow: '/', disallow }, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
