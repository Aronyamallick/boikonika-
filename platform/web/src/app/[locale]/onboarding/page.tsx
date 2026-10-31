import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { OnboardingView } from './onboarding-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'onboarding' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <Suspense>
        <OnboardingView />
      </Suspense>
    </RequireAuth>
  );
}
