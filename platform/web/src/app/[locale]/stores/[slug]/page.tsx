import { localizeDigits, placeName } from '@boikonika/shared';
import { MapPin, Star, Store } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { BookCard } from '@/components/catalog/book-card';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { JsonLd } from '@/components/catalog/json-ld';
import { ProductCard } from '@/components/catalog/product-card';
import { CardGrid } from '@/components/catalog/shelf';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { serverApi } from '@/lib/api/server';
import type { StoreDetail } from '@/lib/catalog';
import { absoluteUrl, alternates } from '@/lib/seo';

type Params = Promise<{ locale: string; slug: string }>;

async function load(locale: string, slug: string) {
  // Store slugs may be Bangla, so only the length is checked before asking the API.
  const decoded = decodeURIComponent(slug);
  if (!decoded || decoded.length > 160) return null;
  return serverApi<StoreDetail>(`/stores/${encodeURIComponent(decoded)}`, { locale, revalidate: 60 });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const store = await load(locale, slug);
  if (!store) return { title: '404', robots: { index: false } };
  return { title: store.name, description: store.tagline ?? store.description?.slice(0, 160) ?? undefined, alternates: alternates(locale, `/stores/${store.slug}`), openGraph: { title: store.name, images: store.logoUrl ? [{ url: store.logoUrl }] : undefined } };
}

export default async function StorePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const store = await load(locale, slug);
  if (!store) notFound();
  const t = await getTranslations();
  const format = await getFormatter();
  const books = store.books.length ? (
    <CardGrid>
      {store.books.map((b) => (
        <BookCard key={b.id} book={b} />
      ))}
    </CardGrid>
  ) : null;
  const products = store.products.length ? (
    <CardGrid>
      {store.products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </CardGrid>
  ) : null;
  const tabs = [
    ...(books ? [{ label: `${t('catalog.storeBooks')} (${localizeDigits(store.books.length, locale)})`, content: books }] : []),
    ...(products ? [{ label: `${t('catalog.storeProducts')} (${localizeDigits(store.products.length, locale)})`, content: products }] : []),
  ];

  return (
    <div className="pb-6">
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Store', name: store.name, url: absoluteUrl(locale, `/stores/${store.slug}`), image: store.logoUrl ?? undefined, address: store.district ? { '@type': 'PostalAddress', addressLocality: placeName(store.district, 'en'), addressRegion: store.division ? placeName(store.division, 'en') : undefined, addressCountry: 'BD' } : undefined, aggregateRating: store.ratingCount ? { '@type': 'AggregateRating', ratingValue: store.ratingAvg.toFixed(1), ratingCount: store.ratingCount } : undefined }} />
      <div className="h-32 bg-gradient-to-r from-secondary-soft via-primary-soft to-accent-soft sm:h-44" style={store.bannerUrl ? { backgroundImage: `url(${store.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
      <div className="container-page">
        <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
          {store.logoUrl ? (
            <Avatar name={store.name} src={store.logoUrl} size="xl" className="rounded-2xl ring-4 ring-canvas" />
          ) : (
            <span className="inline-flex h-24 w-24 items-center justify-center rounded-2xl bg-surface text-secondary shadow ring-4 ring-canvas" aria-hidden="true">
              <Store className="h-10 w-10" />
            </span>
          )}
          <div className="min-w-0 pb-1">
            <h1 className="text-3xl font-bold text-fg">{store.name}</h1>
            {store.tagline ? <p className="text-fg-muted">{store.tagline}</p> : null}
          </div>
        </div>
        <div className="mt-3">
          <Breadcrumbs items={[{ label: t('nav.sellers') }, { label: store.name }]} />
        </div>
        <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-muted">
          <li>
            <Badge tone="secondary">{t(`catalog.sellerTypes.${store.sellerType}`)}</Badge>
          </li>
          {store.ratingCount ? (
            <li className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-accent text-accent-hover" aria-hidden="true" />
              <span className="font-semibold text-fg">{localizeDigits(store.ratingAvg.toFixed(1), locale)}</span> ({t('book.ratingsCount', { count: store.ratingCount })})
            </li>
          ) : null}
          {store.district ? (
            <li className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {[placeName(store.district, locale), store.division && store.division !== store.district ? placeName(store.division, locale) : null].filter(Boolean).join(', ')}
            </li>
          ) : null}
          {store.since ? <li>{t('catalog.storeSince', { date: format.dateTime(new Date(store.since), { year: 'numeric', month: 'long' }) })}</li> : null}
        </ul>
        {store.description ? <p className="mt-4 max-w-prose whitespace-pre-line leading-relaxed text-fg">{store.description}</p> : null}

        <div className="mt-8">{tabs.length > 1 ? <Tabs tabs={tabs} /> : tabs.length ? tabs[0]!.content : <EmptyState title={t('catalog.storeEmpty')} />}</div>

        {store.returnPolicy || store.shippingPolicy ? (
          <section aria-labelledby="policies" className="mt-12 grid gap-4 md:grid-cols-2">
            <h2 id="policies" className="sr-only">
              {t('catalog.policies')}
            </h2>
            {store.shippingPolicy ? (
              <div className="rounded-xl border border-line bg-surface p-5">
                <h3 className="font-bold text-fg">{t('catalog.shippingPolicy')}</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-fg-muted">{store.shippingPolicy}</p>
              </div>
            ) : null}
            {store.returnPolicy ? (
              <div className="rounded-xl border border-line bg-surface p-5">
                <h3 className="font-bold text-fg">{t('catalog.returnPolicy')}</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-fg-muted">{store.returnPolicy}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
