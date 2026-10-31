import { KYC_PURPOSES } from '@boikonika/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { VerificationView } from './verification-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'verification' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function VerificationPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ purpose?: string }> }) {
  const { locale } = await params;
  const { purpose } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('verification');
  return (
    <RequireAuth>
      <div className="container-page max-w-3xl space-y-6 py-8 sm:py-10">
        <header>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-fg-muted">{t('subtitle')}</p>
        </header>
        <VerificationView initialPurpose={KYC_PURPOSES.find((p) => p === purpose)} />
      </div>
    </RequireAuth>
  );
}
