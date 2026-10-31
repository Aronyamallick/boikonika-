import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { serverPage } from '@/lib/api/server';
import type { ClubCard } from '@/lib/clubs';
import { alternates } from '@/lib/seo';
import { ClubDirectory } from '../../clubs/club-directory';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'student' });
  return { title: t('studyGroups'), description: t('groupsIntro'), alternates: alternates(locale, '/student-zone/groups') };
}

export default async function StudyGroupsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('student');
  const initial = await serverPage<ClubCard>('/clubs?purpose=study&pageSize=18', { locale, revalidate: 120 });
  return (
    <div className="container-page space-y-6 py-6 lg:py-8">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('studyGroups')}</h1>
        <p className="mt-1 text-fg-muted">{t('groupsIntro')}</p>
      </header>
      <ClubDirectory initial={initial.items} initialTotal={initial.meta.total} purpose="study" />
    </div>
  );
}
