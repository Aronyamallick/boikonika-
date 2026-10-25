import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { LibraryView } from './library-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'library' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function LibraryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string; digital?: string }> }) {
  const { locale } = await params;
  const { tab, digital } = await searchParams;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <div className="container-page py-6 lg:py-8">
        <LibraryView initialTab={tab} initialFilter={digital === '1' ? 'ebooks' : ''} />
      </div>
    </RequireAuth>
  );
}
