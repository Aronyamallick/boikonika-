import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { PublisherDashboard } from './publisher-dashboard';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('publisherDashboard.title'), robots: { index: false, follow: false } };
}

export default async function PublisherDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <div className="container-page py-6 lg:py-8">
        <PublisherDashboard />
      </div>
    </RequireAuth>
  );
}
