import { localizeDigits } from '@boikonika/shared';
import { BadgeCheck, Building2, Globe } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookCard } from '@/components/catalog/book-card';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { JsonLd } from '@/components/catalog/json-ld';
import { CardGrid } from '@/components/catalog/shelf';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/states';
import { serverApi } from '@/lib/api/server';
import type { PublisherDetail } from '@/lib/catalog';
import { absoluteUrl, alternates } from '@/lib/seo';

type Params = Promise<{ locale: string; slug: string }>;

async function load(locale: string, slug: string) {
  if (slug.length > 220) return null;
  return serverApi<PublisherDetail>(`/publishers/${encodeURIComponent(decodeURIComponent(slug))}`, { locale, revalidate: 120 });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const publisher = await load(locale, slug);
  if (!publisher) return { title: '404', robots: { index: false } };
  const t = await getTranslations({ locale });
  return { title: publisher.name, description: publisher.description?.slice(0, 160) ?? t('catalog.booksFrom', { name: publisher.name }), alternates: alternates(locale, `/publishers/${publisher.slug}`) };
}

export default async function PublisherPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const publisher = await load(locale, slug);
  if (!publisher) notFound();
  const t = await getTranslations();
  return (
    <div className="container-page py-6">
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: publisher.name, url: absoluteUrl(locale, `/publishers/${publisher.slug}`), logo: publisher.logoUrl ?? undefined, foundingDate: publisher.foundedYear ? String(publisher.foundedYear) : undefined }} />
      <Breadcrumbs items={[{ label: t('nav.publishers') }, { label: publisher.name }]} />
      <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        {publisher.logoUrl ? (
          <Avatar name={publisher.name} src={publisher.logoUrl} size="xl" className="rounded-2xl" />
        ) : (
          <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-secondary-soft text-secondary-soft-fg" aria-hidden="true">
            <Building2 className="h-10 w-10" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold text-fg">
            {publisher.name}
            {publisher.verified ? <BadgeCheck className="h-6 w-6 text-primary" aria-label={t('common.verified')} /> : null}
          </h1>
          {publisher.nameAlt ? <p className="text-lg text-fg-muted">{publisher.nameAlt}</p> : null}
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-fg-muted">
            {publisher.foundedYear ? <span>{t('catalog.founded', { year: localizeDigits(publisher.foundedYear, locale) })}</span> : null}
            <span>{t('common.books', { count: publisher.books.length })}</span>
            {publisher.website ? (
              <a href={publisher.website} rel="nofollow noopener noreferrer" target="_blank" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                <Globe className="h-4 w-4" aria-hidden="true" />
                {t('catalog.website')}
              </a>
            ) : null}
          </p>
        </div>
      </header>
      {publisher.description ? <p className="mt-5 max-w-prose whitespace-pre-line leading-relaxed text-fg">{publisher.description}</p> : null}
      <section aria-labelledby="publisher-books" className="mt-10">
        <h2 id="publisher-books" className="mb-5 text-xl font-bold text-fg">
          {t('catalog.booksFrom', { name: publisher.name })}
        </h2>
        {publisher.books.length ? (
          <CardGrid>
            {publisher.books.map((b) => (
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
