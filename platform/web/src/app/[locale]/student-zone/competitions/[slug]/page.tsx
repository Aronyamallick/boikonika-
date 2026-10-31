import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { serverApi } from '@/lib/api/server';
import { alternates } from '@/lib/seo';
import { CompetitionView, type CompetitionDetail } from './competition-view';

type Params = Promise<{ locale: string; slug: string }>;
const load = (locale: string, slug: string) => serverApi<CompetitionDetail>(`/competitions/${encodeURIComponent(decodeURIComponent(slug))}`, { locale, revalidate: 120 });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const c = await load(locale, slug);
  if (!c) return {};
  return { title: c.title, description: c.rules.slice(0, 160), alternates: alternates(locale, `/student-zone/competitions/${c.slug}`) };
}

export default async function CompetitionPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const c = await load(locale, slug);
  if (!c) notFound();
  return (
    <div className="container-page max-w-3xl py-6 lg:py-8">
      <CompetitionView initial={c} />
    </div>
  );
}
