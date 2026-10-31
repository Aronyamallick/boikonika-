import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
/** Where the Next.js server forwards /api/v1 (in production the reverse proxy usually routes it directly). */
const apiInternalUrl = (process.env.API_INTERNAL_URL ?? apiUrl).replace(/\/$/, '');
const google = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? ' https://accounts.google.com' : '';
const assetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL || apiUrl;
/** Uploaded media can also be served through this site's own /api/v1 rewrite. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const isDev = process.env.NODE_ENV !== 'production';
/** HTTPS-only directives; a production build served over plain http (local QA) must not send them. */
const httpsOnly = !isDev && siteUrl.startsWith('https://');

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${google}`,
  `style-src 'self' 'unsafe-inline'${google}`,
  `img-src 'self' data: blob: ${assetsUrl} ${apiUrl} https:`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl}${isDev ? ' ws://localhost:3000' : ''}${google}`,
  `frame-src 'self'${google}`,
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: httpsOnly ? csp : csp.replace('; upgrade-insecure-requests', '') },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  ...(httpsOnly ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [new URL(`${assetsUrl}/**`), new URL(`${apiUrl}/**`), new URL(`${siteUrl}/**`)].map((u) => ({
      protocol: u.protocol.replace(':', '') as 'http' | 'https',
      hostname: u.hostname,
      port: u.port,
    })),
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // The service worker must always be re-checked so updates reach every reader.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }] },
    ];
  },
  async rewrites() {
    // Same-origin API calls keep the refresh cookie first-party and avoid CORS preflights.
    return [{ source: '/api/v1/:path*', destination: `${apiInternalUrl}/api/v1/:path*` }];
  },
};

export default withNextIntl(nextConfig);
