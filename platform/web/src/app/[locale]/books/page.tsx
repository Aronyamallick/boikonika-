import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { CatalogBrowser } from '@/components/catalog/catalog-browser';
import { flatParams } from '@/lib/catalog';
import { sanitizeBookParams } from '@/lib/catalog-query';
import { alternates } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const query = sanitizeBookParams(flatParams(await searchParams));
  const t = await getTranslations({ locale });
  // Filtered and paged variants are not indexed separately; the canonical list is.
  const filtered = Object.keys(query).length > 0;
  return { title: t('catalog.booksTitle'), description: t('catalog.booksText'), alternates: alternates(locale, '/books'), robots: filtered ? { index: false, follow: true } : undefined };
}

export default async function BooksPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = sanitizeBookParams(flatParams(await searchParams));
  const t = await getTranslations();
  return (
    <CatalogBrowser
      kind="books"
      path="/books"
      locale={locale}
      params={query}
      header={
        <>
          <Breadcrumbs items={[{ label: t('catalog.booksTitle') }]} />
          <h1 className="mt-3 text-3xl font-bold text-fg">{t('catalog.booksTitle')}</h1>
          <p className="mt-1 text-fg-muted">{t('catalog.booksText')}</p>
        </>
      }
    />
  );
}
