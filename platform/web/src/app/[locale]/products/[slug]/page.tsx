import { localizeDigits, placeName, toMinor } from '@boikonika/shared';
import { MapPin, Star, Store } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { ImageGallery } from '@/components/catalog/image-gallery';
import { JsonLd } from '@/components/catalog/json-ld';
import { ProductCard } from '@/components/catalog/product-card';
import { RatingSummary } from '@/components/catalog/rating-summary';
import { Shelf } from '@/components/catalog/shelf';
import { VariantPicker } from '@/components/catalog/variant-picker';
import { Link, redirect } from '@/i18n/navigation';
import { serverApi } from '@/lib/api/server';
import { localized, type ProductDetail } from '@/lib/catalog';
import { absoluteUrl, alternates } from '@/lib/seo';

type Params = Promise<{ locale: string; slug: string }>;

async function load(locale: string, slug: string) {
  if (slug.length > 220) return null;
  return serverApi<ProductDetail>(`/products/${encodeURIComponent(decodeURIComponent(slug))}`, { locale, revalidate: 60 });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await load(locale, slug);
  if (!product || product.type !== 'general') return { title: '404', robots: { index: false } };
  const description = product.description?.replace(/\s+/g, ' ').slice(0, 160);
  return {
    title: product.title,
    description,
    alternates: alternates(locale, `/products/${product.slug}`),
    openGraph: { type: 'website', title: product.title, description, images: product.images[0] ? [{ url: product.images[0].url }] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await load(locale, slug);
  if (!product) notFound();
  // Book listings live on their book page, where every seller's offer is compared.
  if (product.type === 'book') {
    if (!product.bookSlug) notFound();
    redirect({ href: `/books/${product.bookSlug}`, locale });
    return null;
  }
  const t = await getTranslations();
  const attributes = Object.entries(product.attributes ?? {});
  const available = product.variants.some((v) => v.available > 0);
  const prices = product.variants.map((v) => toMinor(v.price));

  return (
    <div className="container-page py-6">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.title,
          url: absoluteUrl(locale, `/products/${product.slug}`),
          image: product.images.map((i) => i.url),
          description: product.description?.slice(0, 500) ?? undefined,
          brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
          sku: product.variants[0]?.sku ?? undefined,
          aggregateRating: product.rating.count ? { '@type': 'AggregateRating', ratingValue: product.rating.average.toFixed(1), ratingCount: product.rating.count } : undefined,
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'BDT',
            lowPrice: (Math.min(...prices) / 100).toFixed(2),
            highPrice: (Math.max(...prices) / 100).toFixed(2),
            offerCount: product.variants.length,
            availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
        }}
      />
      <Breadcrumbs
        items={[
          { label: t('catalog.productsTitle'), href: '/products' },
          ...(product.category ? [{ label: localized(product.category.name, locale), href: `/categories/${product.category.path}` }] : []),
          { label: product.title },
        ]}
      />
      <div className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-[28rem_1fr]">
        <ImageGallery images={product.images} title={product.title} />
        <div className="min-w-0">
          {product.brand ? <p className="text-sm font-semibold uppercase tracking-wide text-secondary">{product.brand}</p> : null}
          <h1 className="mt-1 text-3xl font-bold leading-tight text-fg">{product.title}</h1>
          <div className="mt-5">
            <VariantPicker variants={product.variants} />
          </div>
          {product.store ? (
            <div className="mt-6 rounded-xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('catalog.soldByStore')}</p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-fg">
                <Store className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                <Link href={`/stores/${product.store.slug}`} className="hover:text-primary hover:underline">
                  {product.store.name}
                </Link>
              </p>
              <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-fg-muted">
                {product.store.ratingAvg > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-accent text-accent-hover" aria-hidden="true" />
                    {localizeDigits(product.store.ratingAvg.toFixed(1), locale)}
                  </span>
                ) : null}
                {product.store.district ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('catalog.shipsFrom', { district: placeName(product.store.district, locale) })}
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
          {product.description ? (
            <section aria-labelledby="about" className="mt-8">
              <h2 id="about" className="text-xl font-bold text-fg">
                {t('catalog.details')}
              </h2>
              <div className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-fg">{product.description}</div>
            </section>
          ) : null}
          {attributes.length ? (
            <section aria-labelledby="specs" className="mt-8">
              <h2 id="specs" className="text-xl font-bold text-fg">
                {t('catalog.specs')}
              </h2>
              <dl className="mt-3 divide-y divide-line rounded-xl border border-line">
                {attributes.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[10rem_1fr] gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-fg-muted">{k}</dt>
                    <dd className="font-medium text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </div>
      <section aria-labelledby="ratings" className="mt-12 max-w-2xl">
        <h2 id="ratings" className="mb-4 text-xl font-bold text-fg">
          {t('book.reviews')}
        </h2>
        <RatingSummary rating={product.rating} />
      </section>
      {product.related.length ? (
        <Shelf id="related" title={t('catalog.related')} contained={false} className="mt-6">
          {product.related.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Shelf>
      ) : null}
    </div>
  );
}
