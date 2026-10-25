import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { StudioView } from './studio-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'studio' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function DigitalStudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('studio');
  return (
    <RequireAuth>
      <div className="container-page py-6 lg:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('title')}</h1>
          <p className="mt-1 max-w-3xl text-fg-muted">{t('intro')}</p>
        </header>
        <StudioView />
      </div>
    </RequireAuth>
  );
}
