import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const assetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL ?? apiUrl;
const isDev = process.env.NODE_ENV !== 'production';

const toWs = (url: string) => url.replace(/^http/, 'ws');
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${assetsUrl} ${apiUrl} https:`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl} ${toWs(apiUrl)}${isDev ? ' ws://localhost:3000' : ''}`,
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: isDev ? csp.replace('; upgrade-insecure-requests', '') : csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [new URL(`${assetsUrl}/**`), new URL(`${apiUrl}/**`)].map((u) => ({
      protocol: u.protocol.replace(':', '') as 'http' | 'https',
      hostname: u.hostname,
      port: u.port,
    })),
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
