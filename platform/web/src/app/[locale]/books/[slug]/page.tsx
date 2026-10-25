import { formatMoney, localizeDigits, placeName, toMinor } from '@boikonika/shared';
import { BadgeCheck, MapPin, Star, Store } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AddToCart } from '@/components/cart/add-to-cart';
import { BookCard } from '@/components/catalog/book-card';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { JsonLd } from '@/components/catalog/json-ld';
import { ReviewsList } from '@/components/reviews/reviews-list';
import { Shelf } from '@/components/catalog/shelf';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Price } from '@/components/ui/price';
import { Rating } from '@/components/ui/rating';
import { Link } from '@/i18n/navigation';
import { serverApi } from '@/lib/api/server';
import { localized, type BookDetail, type BookOffer } from '@/lib/catalog';
import { absoluteUrl, alternates } from '@/lib/seo';

type Params = Promise<{ locale: string; slug: string }>;

async function load(locale: string, slug: string) {
  if (slug.length > 220) return null;
  return serverApi<BookDetail>(`/books/${encodeURIComponent(decodeURIComponent(slug))}`, { locale, revalidate: 60 });
}

const plain = (text: string | null, max = 160) => (text ? text.replace(/[#*_>`[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : undefined);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const book = await load(locale, slug);
  if (!book) return { title: '404', robots: { index: false } };
  const authors = book.contributors.filter((c) => c.role === 'author').map((c) => c.name).join(', ');
  const title = authors ? `${book.title} — ${authors}` : book.title;
  return {
    title,
    description: plain(book.description),
    alternates: alternates(locale, `/books/${book.slug}`),
    openGraph: { type: 'book', title, description: plain(book.description), images: book.coverUrl ? [{ url: book.coverUrl }] : undefined },
  };
}

export default async function BookPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const book = await load(locale, slug);
  if (!book) notFound();
  const t = await getTranslations();

  const byRole = (role: string) => book.contributors.filter((c) => c.role === role);
  const authors = byRole('author');
  const others = ['translator', 'editor', 'illustrator'].map((role) => ({ role, people: byRole(role) })).filter((g) => g.people.length);
  const primary = book.categories.find((c) => c.primary) ?? book.categories[0];
  const format = book.formats[0];
  const best = book.offers.find((o) => o.stock > 0);
  const inStockOffers = book.offers.filter((o) => o.stock > 0);
  const prices = inStockOffers.map((o) => toMinor(o.price));
  const pick = book.picks.editors ? 'catalog.editorsPick' : book.picks.students ? 'catalog.studentPick' : book.picks.teachers ? 'catalog.teacherPick' : null;

  const details: Array<[string, ReactNode]> = [
    [t('book.language'), t(`book.languages.${book.language}`)],
    ...(format?.pages ? [[t('book.pages'), localizeDigits(format.pages, locale)] as [string, ReactNode]] : []),
    ...(format?.publisher ? [[t('book.publisher'), <Link key="p" href={`/publishers/${format.publisher.slug}`} className="text-primary hover:underline">{format.publisher.name}</Link>] as [string, ReactNode]] : []),
    ...(format?.edition ? [[t('book.edition'), format.edition] as [string, ReactNode]] : []),
    ...(format?.isbn13 ? [[t('catalog.isbn13'), <span key="i" className="font-mono">{format.isbn13}</span>] as [string, ReactNode]] : []),
    ...(format ? [[t('book.format'), t(`book.formats.${format.format}`)] as [string, ReactNode]] : []),
    ...(book.firstPublishedYear ? [[t('catalog.firstPublished'), localizeDigits(book.firstPublishedYear, locale)] as [string, ReactNode]] : []),
    ...(book.seriesName ? [[t('catalog.series'), book.seriesNumber ? t('catalog.seriesNumber', { name: book.seriesName, number: localizeDigits(book.seriesNumber, locale) }) : book.seriesName] as [string, ReactNode]] : []),
    ...(book.ageGroup ? [[t('book.ageGroup'), t(`catalog.ages.${book.ageGroup}`)] as [string, ReactNode]] : []),
    ...(book.academicLevel ? [[t('book.academicLevel'), t(`catalog.levels.${book.academicLevel}`)] as [string, ReactNode]] : []),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    url: absoluteUrl(locale, `/books/${book.slug}`),
    inLanguage: book.language,
    image: book.coverUrl ?? undefined,
    description: plain(book.description, 500),
    author: authors.map((a) => ({ '@type': 'Person', name: a.name, url: absoluteUrl(locale, `/authors/${a.slug}`) })),
    translator: byRole('translator').map((a) => ({ '@type': 'Person', name: a.name })),
    isbn: format?.isbn13 ?? undefined,
    numberOfPages: format?.pages ?? undefined,
    publisher: format?.publisher ? { '@type': 'Organization', name: format.publisher.name } : undefined,
    datePublished: book.firstPublishedYear ? String(book.firstPublishedYear) : undefined,
    aggregateRating: book.rating.count ? { '@type': 'AggregateRating', ratingValue: book.rating.average.toFixed(1), ratingCount: book.rating.count } : undefined,
    offers: prices.length
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'BDT',
          lowPrice: (Math.min(...prices) / 100).toFixed(2),
          highPrice: (Math.max(...prices) / 100).toFixed(2),
          offerCount: inStockOffers.length,
          availability: 'https://schema.org/InStock',
        }
      : undefined,
  };

  return (
    <div className="container-page py-6">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        items={[
          { label: t('catalog.booksTitle'), href: '/books' },
          ...(primary ? [{ label: localized(primary.name, locale), href: `/categories/${primary.path}` }] : []),
          { label: book.title },
        ]}
      />

      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,18rem)_1fr] lg:grid-cols-[20rem_1fr_20rem]">
        <div className="mx-auto w-48 sm:w-56 md:sticky md:top-24 md:mx-0 md:w-full md:self-start">
          <BookCover src={book.coverUrl} title={book.title} author={authors.map((a) => a.name).join(', ')} priority sizes="(max-width: 768px) 14rem, 20rem" />
        </div>

        <div className="min-w-0">
          {pick ? (
            <Badge tone="accent" className="mb-3">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              {t(pick)}
            </Badge>
          ) : null}
          <h1 className="text-3xl font-bold leading-tight text-fg sm:text-4xl">{book.title}</h1>
          {book.subtitle ? <p className="mt-1 text-lg text-fg-muted">{book.subtitle}</p> : null}
          {authors.length ? (
            <p className="mt-3 text-fg-muted">
              {t.rich('catalog.byAuthors', {
                names: () => (
                  <>
                    {authors.map((a, i) => (
                      <span key={a.id}>
                        {i > 0 ? ', ' : null}
                        <Link href={`/authors/${a.slug}`} className="font-semibold text-primary hover:underline">
                          {a.name}
                        </Link>
                        {a.verified ? <BadgeCheck className="ml-0.5 inline h-4 w-4 text-primary" aria-label={t('common.verified')} /> : null}
                      </span>
                    ))}
                  </>
                ),
              })}
            </p>
          ) : null}
          {others.map((g) => (
            <p key={g.role} className="mt-1 text-sm text-fg-muted">
              {t(`catalog.roles.${g.role}`)}:{' '}
              {g.people.map((p, i) => (
                <span key={p.id}>
                  {i > 0 ? ', ' : null}
                  <Link href={`/authors/${p.slug}`} className="font-medium text-fg hover:text-primary hover:underline">
                    {p.name}
                  </Link>
                </span>
              ))}
            </p>
          ))}
          {book.originalTitle ? <p className="mt-1 text-sm text-fg-subtle">{book.originalTitle}</p> : null}
          {book.rating.count ? (
            <a href="#ratings" className="mt-3 inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg">
              <Rating value={book.rating.average} label={t('book.rating', { rating: localizeDigits(book.rating.average.toFixed(1), locale) })} />
              <span className="font-semibold text-fg">{localizeDigits(book.rating.average.toFixed(1), locale)}</span>
              <span>({t('book.ratingsCount', { count: book.rating.count })})</span>
            </a>
          ) : null}

          {best ? (
            <div className="mt-5">
              <Price amount={best.price} compareAt={best.compareAtPrice} locale={locale} size="lg" />
              {inStockOffers.length > 1 ? <p className="mt-1 text-sm text-fg-muted">{t('book.offersCount', { count: inStockOffers.length })}</p> : null}
              {best.variantId ? <AddToCart variantId={best.variantId} available={best.stock} size="lg" buyNow className="mt-4" /> : null}
            </div>
          ) : book.isFree ? (
            <p className="mt-5 text-2xl font-bold text-success">{t('common.free')}</p>
          ) : null}

          {book.genres.length ? (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label={t('book.genres')}>
              {book.genres.map((g) => (
                <li key={g.key}>
                  <Link href={`/books?genre=${g.key}`} className="inline-flex rounded-full bg-secondary-soft px-3 py-1 text-xs font-semibold text-secondary-soft-fg hover:underline">
                    {localized(g.name, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {book.description ? (
            <section aria-labelledby="about" className="mt-8">
              <h2 id="about" className="text-xl font-bold text-fg">
                {t('book.description')}
              </h2>
              <div className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-fg">{book.description}</div>
            </section>
          ) : null}

          <section aria-labelledby="details" className="mt-8">
            <h2 id="details" className="text-xl font-bold text-fg">
              {t('book.details')}
            </h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-line pb-2 sm:block">
                  <dt className="text-sm text-fg-muted">{label}</dt>
                  <dd className="text-sm font-medium text-fg sm:mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>
            {book.formats.length > 1 ? (
              <div className="mt-6">
                <h3 className="font-bold text-fg">{t('catalog.editions')}</h3>
                <ul className="mt-2 space-y-1 text-sm text-fg-muted">
                  {book.formats.map((f) => (
                    <li key={f.id}>
                      {[t(`book.formats.${f.format}`), f.edition, f.publisher?.name, f.publicationYear ? localizeDigits(f.publicationYear, locale) : null, f.isbn13].filter(Boolean).join(' · ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <aside aria-labelledby="offers" className="md:col-span-2 lg:col-span-1">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-sm lg:sticky lg:top-24">
            <h2 id="offers" className="text-lg font-bold text-fg">
              {t('catalog.offersTitle')}
            </h2>
            {book.offers.length ? (
              <ul className="mt-3 divide-y divide-line">
                {book.offers.map((o) => (
                  <OfferRow key={o.productId} offer={o} locale={locale} />
                ))}
              </ul>
            ) : (
              <div className="mt-3 text-sm">
                <p className="font-semibold text-fg">{t('catalog.noOffers')}</p>
                <p className="mt-1 text-fg-muted">{t('catalog.noOffersText')}</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <section aria-labelledby="ratings" className="mt-12 max-w-3xl">
        <h2 id="ratings" className="mb-4 scroll-mt-24 text-xl font-bold text-fg">
          {t('book.reviews')}
        </h2>
        <ReviewsList kind="book" slug={book.slug} targetId={book.id} rating={book.rating} />
      </section>

      {book.related.length ? (
        <Shelf id="related" title={t('catalog.related')} contained={false} className="mt-6">
          {book.related.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </Shelf>
      ) : null}
    </div>
  );
}

async function OfferRow({ offer, locale }: { offer: BookOffer; locale: string }) {
  const t = await getTranslations();
  const used = offer.condition !== 'new';
  return (
    <li className="py-3.5 first:pt-1 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone={used ? 'warning' : 'success'}>{t(`book.conditions.${offer.condition}`)}</Badge>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-fg">
            <Store className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
            <Link href={`/stores/${offer.store.slug}`} className="truncate hover:text-primary hover:underline">
              {offer.store.name}
            </Link>
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-fg-muted">
            {offer.store.ratingCount ? (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-accent text-accent-hover" aria-hidden="true" />
                {t('catalog.storeRating', { rating: localizeDigits(offer.store.ratingAvg.toFixed(1), locale) })}
              </span>
            ) : null}
            {offer.store.district ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {t('catalog.shipsFrom', { district: placeName(offer.store.district, locale) })}
              </span>
            ) : null}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold text-fg">{formatMoney(offer.price, locale, { hideZeroDecimals: true })}</p>
          {offer.compareAtPrice && toMinor(offer.compareAtPrice) > toMinor(offer.price) ? <p className="text-xs text-fg-subtle line-through">{formatMoney(offer.compareAtPrice, locale, { hideZeroDecimals: true })}</p> : null}
        </div>
      </div>
      {offer.conditionNote ? (
        <p className="mt-2 rounded-lg bg-subtle px-3 py-2 text-xs text-fg-muted">
          <span className="font-semibold text-fg">{t('catalog.conditionNote')}:</span> {offer.conditionNote}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className={offer.stock > 0 ? (offer.stock <= 3 ? 'text-xs font-semibold text-warning-soft-fg' : 'text-xs text-success') : 'text-xs text-fg-subtle'}>
          {offer.stock > 0 ? (offer.stock <= 3 ? t('catalog.lowStock', { count: offer.stock }) : t('common.inStock')) : t('common.outOfStock')}
        </p>
        {offer.variantId && offer.stock > 0 ? <AddToCart variantId={offer.variantId} available={offer.stock} size="sm" /> : null}
      </div>
    </li>
  );
}
