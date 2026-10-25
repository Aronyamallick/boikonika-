import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { ClubForm } from '@/components/clubs/club-form';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'clubs' });
  return { title: t('newClub'), robots: { index: false, follow: false } };
}

export default async function NewClubPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ purpose?: string }> }) {
  const { locale } = await params;
  const { purpose } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('clubs');
  return (
    <RequireAuth>
      <div className="container-page space-y-6 py-6 lg:py-8">
        <header>
          <h1 className="text-2xl font-bold text-fg">{purpose === 'study' ? t('newStudyGroup') : t('newClub')}</h1>
          <p className="mt-1 text-fg-muted">{t('newIntro')}</p>
        </header>
        <ClubForm defaultPurpose={purpose === 'study' ? 'study' : 'reading'} />
      </div>
    </RequireAuth>
  );
}
