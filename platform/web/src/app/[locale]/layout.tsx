import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-bengali';
import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { colors } from '@boikonika/shared';
import { AuthProvider } from '@/components/auth/auth-provider';
import { CartProvider } from '@/components/cart/cart-provider';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { ServiceWorker } from '@/components/layout/service-worker';
import { SiteFooter } from '@/components/layout/site-footer';
import { NavigationProgress } from '@/components/layout/navigation-progress';
import { SiteHeader } from '@/components/layout/site-header';
import { themeInitScript } from '@/components/layout/theme-toggle';
import { ToastProvider } from '@/components/ui/toast';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/env';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  const tl = await getTranslations({ locale, namespace: 'landing' });
  const title = `${t('appName')} — ${t('tagline')}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${t('appName')}` },
    description: tl('heroSubtitle'),
    applicationName: t('appName'),
    alternates: { canonical: locale === routing.defaultLocale ? '/' : `/${locale}`, languages: { bn: '/', en: '/en', 'x-default': '/' } },
    openGraph: { type: 'website', siteName: t('appName'), title, description: tl('heroSubtitle'), locale: locale === 'bn' ? 'bn_BD' : 'en_US' },
    twitter: { card: 'summary_large_image', title, description: tl('heroSubtitle') },
    manifest: '/manifest.webmanifest',
    icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }], apple: '/icons/apple-touch-icon.png' },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: colors.light.bg },
    { media: '(prefers-color-scheme: dark)', color: colors.dark.bg },
  ],
};

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('common');
  // The "api" namespace is only used by the server; keep it out of the client bundle.
  const { api: _serverOnly, ...clientMessages } = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint to avoid a light/dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-[80] rounded-lg bg-primary px-4 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {t('skipToContent')}
        </a>
        <NavigationProgress />
        <NextIntlClientProvider messages={clientMessages}>
          <AuthProvider>
            <CartProvider>
              <ToastProvider closeLabel={t('close')}>
                <SiteHeader />
                <main id="main" tabIndex={-1} className="flex-1 outline-none">
                  {children}
                </main>
                <SiteFooter />
                <MobileTabBar />
                <ServiceWorker />
              </ToastProvider>
            </CartProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
