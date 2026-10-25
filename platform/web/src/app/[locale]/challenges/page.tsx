import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { serverApi } from '@/lib/api/server';
import type { Challenge } from '@/lib/reading';
import { alternates } from '@/lib/seo';
import { ChallengeList } from './challenge-list';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'challenges' });
  return { title: t('title'), description: t('intro'), alternates: alternates(locale, '/challenges') };
}

export default async function ChallengesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('challenges');
  const initial = (await serverApi<Challenge[]>('/challenges', { locale, revalidate: 300 })) ?? [];
  return (
    <div className="container-page space-y-6 py-6 lg:py-8">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-fg-muted">{t('intro')}</p>
      </header>
      <ChallengeList initial={initial} />
    </div>
  );
}
