import { localizeDigits } from '@boikonika/shared';
import { BadgeCheck, Globe } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookCard } from '@/components/catalog/book-card';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { FollowAuthorButton } from '@/components/catalog/follow-author-button';
import { JsonLd } from '@/components/catalog/json-ld';
import { CardGrid } from '@/components/catalog/shelf';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { serverApi } from '@/lib/api/server';
import type { AuthorDetail } from '@/lib/catalog';
import { absoluteUrl, alternates } from '@/lib/seo';

type Params = Promise<{ locale: string; slug: string }>;

async function load(locale: string, slug: string) {
  if (slug.length > 200) return null;
  return serverApi<AuthorDetail>(`/authors/${encodeURIComponent(decodeURIComponent(slug))}`, { locale, revalidate: 120 });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = await load(locale, slug);
  if (!author) return { title: '404', robots: { index: false } };
  const t = await getTranslations({ locale });
  const description = author.bio?.replace(/\s+/g, ' ').slice(0, 160) ?? t('catalog.booksBy', { name: author.name });
  return { title: author.name, description, alternates: alternates(locale, `/authors/${author.slug}`), openGraph: { type: 'profile', title: author.name, description, images: author.photoUrl ? [{ url: author.photoUrl }] : undefined } };
}

export default async function AuthorPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const author = await load(locale, slug);
  if (!author) notFound();
  const t = await getTranslations();
  const years =
    author.birthYear && author.deathYear
      ? t('catalog.lifespan', { birth: localizeDigits(author.birthYear, locale), death: localizeDigits(author.deathYear, locale) })
      : author.birthYear
        ? t('catalog.born', { year: localizeDigits(author.birthYear, locale) })
        : null;

  return (
    <div className="container-page py-6">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: author.name,
          alternateName: author.nameAlt ?? undefined,
          url: absoluteUrl(locale, `/authors/${author.slug}`),
          image: author.photoUrl ?? undefined,
          description: author.bio?.slice(0, 500) ?? undefined,
          birthDate: author.birthYear ? String(author.birthYear) : undefined,
          deathDate: author.deathYear ? String(author.deathYear) : undefined,
        }}
      />
      <Breadcrumbs items={[{ label: t('catalog.authorsTitle'), href: '/authors' }, { label: author.name }]} />
      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar name={author.name} src={author.photoUrl} size="xl" className="h-28 w-28 text-4xl ring-4 ring-surface" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold text-fg">
            {author.name}
            {author.verified ? <BadgeCheck className="h-6 w-6 text-primary" aria-label={t('common.verified')} /> : null}
          </h1>
          {author.nameAlt ? <p className="mt-0.5 text-lg text-fg-muted">{author.nameAlt}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            {years ? <span>{years}</span> : null}
            <span>{t('common.books', { count: author.bookCount })}</span>
            {author.claimed ? <Badge tone="primary">{t('catalog.officialProfile')}</Badge> : null}
          </div>
          {author.bio ? <p className="mt-4 max-w-prose whitespace-pre-line leading-relaxed text-fg">{author.bio}</p> : null}
          {author.website ? (
            <a href={author.website} rel="nofollow noopener noreferrer" target="_blank" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              <Globe className="h-4 w-4" aria-hidden="true" />
              {t('catalog.website')}
            </a>
          ) : null}
          <div className="mt-5">
            <FollowAuthorButton slug={author.slug} initialCount={author.followerCount} />
          </div>
        </div>
      </header>
      <section aria-labelledby="author-books" className="mt-10">
        <h2 id="author-books" className="mb-5 text-xl font-bold text-fg">
          {t('catalog.booksBy', { name: author.name })}
        </h2>
        {author.books.length ? (
          <CardGrid>
            {author.books.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </CardGrid>
        ) : (
          <EmptyState title={t('catalog.noBooks')} />
        )}
      </section>
    </div>
  );
}
