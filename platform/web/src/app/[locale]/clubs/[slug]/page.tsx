import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { serverApi } from '@/lib/api/server';
import type { ClubDetail } from '@/lib/clubs';
import { alternates } from '@/lib/seo';
import { ClubView } from './club-view';

type Params = Promise<{ locale: string; slug: string }>;
const load = (locale: string, slug: string) => serverApi<ClubDetail>(`/clubs/${encodeURIComponent(decodeURIComponent(slug))}`, { locale, revalidate: 60 });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const club = await load(locale, slug);
  if (!club) return {};
  return {
    title: club.name,
    description: club.description?.slice(0, 160) ?? undefined,
    alternates: alternates(locale, `/clubs/${club.slug}`),
    openGraph: { title: club.name, images: club.coverUrl ? [club.coverUrl] : undefined },
    // Private and institution clubs are not for search engines.
    robots: club.type === 'public' ? undefined : { index: false, follow: false },
  };
}

export default async function ClubPage({ params, searchParams }: { params: Params; searchParams: Promise<{ tab?: string }> }) {
  const { locale, slug } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);
  const club = await load(locale, slug);
  if (!club) notFound();
  return (
    <div className="container-page py-6 lg:py-8">
      <ClubView initial={club} initialTab={tab} />
    </div>
  );
}
