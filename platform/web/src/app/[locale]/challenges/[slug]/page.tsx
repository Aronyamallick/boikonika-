import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { serverApi } from '@/lib/api/server';
import { localized } from '@/lib/reading';
import { alternates } from '@/lib/seo';
import { ChallengeDetail, type ChallengeDetailData } from './challenge-detail';

type Params = Promise<{ locale: string; slug: string }>;
const load = (locale: string, slug: string) => serverApi<ChallengeDetailData>(`/challenges/${encodeURIComponent(slug)}`, { locale, revalidate: 120 });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const challenge = await load(locale, slug);
  if (!challenge) return {};
  return { title: localized(challenge.title, locale), description: localized(challenge.description, locale), alternates: alternates(locale, `/challenges/${slug}`) };
}

export default async function ChallengePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const challenge = await load(locale, slug);
  if (!challenge) notFound();
  return (
    <div className="container-page max-w-3xl py-6 lg:py-8">
      <ChallengeDetail initial={challenge} />
    </div>
  );
}
