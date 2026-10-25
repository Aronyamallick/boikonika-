import type { MetadataRoute } from 'next';
import { colors } from '@boikonika/shared';

/** Installable web app (PWA): Bangla-first, opens on the home page, works as a standalone app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'বইকণিকা — Boikonika',
    short_name: 'বইকণিকা',
    description: 'বই কিনুন, জ্ঞান আবিষ্কার করুন, পড়ুন, শিখুন, লিখুন, ভাগ করুন। Buy books, discover knowledge, read, learn, write and share.',
    lang: 'bn',
    dir: 'ltr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: colors.light.bg,
    theme_color: '#2563EB',
    categories: ['books', 'education', 'shopping', 'social'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'আমার লাইব্রেরি · My Library', url: '/library', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'বই খুঁজুন · Books', url: '/books', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'নোটিফিকেশন · Notifications', url: '/notifications', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
