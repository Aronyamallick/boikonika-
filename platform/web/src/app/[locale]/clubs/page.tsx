import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { serverPage } from '@/lib/api/server';
import type { ClubCard } from '@/lib/clubs';
import { alternates } from '@/lib/seo';
import { ClubDirectory } from './club-directory';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'clubs' });
  return { title: t('title'), description: t('intro'), alternates: alternates(locale, '/clubs') };
}

export default async function ClubsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('clubs');
  const initial = await serverPage<ClubCard>('/clubs?pageSize=18', { locale, revalidate: 120 });
  return (
    <div className="container-page space-y-6 py-6 lg:py-8">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-fg-muted">{t('intro')}</p>
      </header>
      <ClubDirectory initial={initial.items} initialTotal={initial.meta.total} />
    </div>
  );
}
