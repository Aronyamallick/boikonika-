import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { ProfileSettings } from './profile-settings';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'profileSettings' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ProfileSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('profileSettings');
  return (
    <RequireAuth>
      <div className="container-page max-w-3xl space-y-6 py-8 sm:py-10">
        <header>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-fg-muted">{t('subtitle')}</p>
        </header>
        <ProfileSettings />
      </div>
    </RequireAuth>
  );
}
