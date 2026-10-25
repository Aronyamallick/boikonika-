import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { CatalogBrowser } from '@/components/catalog/catalog-browser';
import { flatParams } from '@/lib/catalog';
import { sanitizeProductParams } from '@/lib/catalog-query';
import { alternates } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const query = sanitizeProductParams(flatParams(await searchParams));
  const t = await getTranslations({ locale });
  return { title: t('catalog.productsTitle'), description: t('catalog.productsText'), alternates: alternates(locale, '/products'), robots: Object.keys(query).length ? { index: false, follow: true } : undefined };
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = sanitizeProductParams(flatParams(await searchParams));
  const t = await getTranslations();
  return (
    <CatalogBrowser
      kind="products"
      path="/products"
      locale={locale}
      params={query}
      header={
        <>
          <Breadcrumbs items={[{ label: t('catalog.productsTitle') }]} />
          <h1 className="mt-3 text-3xl font-bold text-fg">{t('catalog.productsTitle')}</h1>
          <p className="mt-1 text-fg-muted">{t('catalog.productsText')}</p>
        </>
      }
    />
  );
}
