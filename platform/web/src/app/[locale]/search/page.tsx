import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookCard } from '@/components/catalog/book-card';
import { AuthorCard } from '@/components/catalog/people-cards';
import { ProductCard } from '@/components/catalog/product-card';
import { CardGrid } from '@/components/catalog/shelf';
import { SearchBox } from '@/components/layout/search-box';
import { buttonClasses } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { serverApi } from '@/lib/api/server';
import { flatParams, toQuery, type SearchResults, type Suggestion } from '@/lib/catalog';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const readQuery = (raw: Record<string, string>) => (raw.q ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const q = readQuery(flatParams(await searchParams));
  const t = await getTranslations({ locale });
  // Result pages are for people, not for search engine indexes.
  return { title: q ? `${q} — ${t('searchPage.title')}` : t('searchPage.title'), robots: { index: false, follow: true } };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const q = readQuery(flatParams(await searchParams));
  const t = await getTranslations();
  const [results, popular] = await Promise.all([
    q.length >= 2 ? serverApi<SearchResults>(`/search${toQuery({ q })}`, { locale, revalidate: 30 }) : Promise.resolve(null),
    q.length >= 2 ? Promise.resolve(null) : serverApi<{ items: Suggestion[] }>('/search/suggest', { locale, revalidate: 300 }),
  ]);
  const total = results ? (results.bookTotal ?? results.books.length) + results.authors.length + results.products.length : 0;

  return (
    <div className="container-page py-6">
      <h1 className="sr-only">{t('searchPage.title')}</h1>
      <div className="max-w-2xl">
        <SearchBox action="/search" size="lg" defaultValue={q} />
      </div>

      {!results ? (
        <div className="mt-10 max-w-2xl">
          <p className="text-xl font-bold text-fg">{t('searchPage.prompt')}</p>
          <p className="mt-1 text-fg-muted">{t('searchPage.promptText')}</p>
          {popular?.items.length ? (
            <>
              <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-fg-muted">{t('searchPage.popular')}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {popular.items.map((s) => (
                  <li key={s.label}>
                    <Link href={`/search${toQuery({ q: s.label })}`} className="inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-fg hover:border-primary hover:text-primary">
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : total === 0 ? (
        <EmptyState className="mt-10" icon={<Search className="h-6 w-6" />} title={t('search.noResults', { query: q })} text={t('search.noResultsText')} />
      ) : (
        <div className="mt-6 space-y-10">
          <p className="text-sm text-fg-muted" role="status">
            {t('search.results', { count: total, query: q })}
          </p>
          {results.authors.length ? (
            <section aria-labelledby="r-authors">
              <SectionHeader id="r-authors" title={t('searchPage.authors')} />
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {results.authors.map((a) => (
                  <li key={a.slug} className="flex">
                    <AuthorCard author={a} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {results.books.length ? (
            <section aria-labelledby="r-books">
              <SectionHeader id="r-books" title={t('searchPage.books')} />
              <CardGrid>
                {results.books.map((b, i) => (
                  <BookCard key={b.id} book={b} priority={i < 4} />
                ))}
              </CardGrid>
              {(results.bookTotal ?? 0) > results.books.length ? (
                <div className="mt-6 text-center">
                  <Link href={`/books${toQuery({ q })}`} className={buttonClasses({ variant: 'outline' })}>
                    {t('searchPage.seeAllBooks', { count: results.bookTotal ?? 0 })}
                  </Link>
                </div>
              ) : null}
            </section>
          ) : null}
          {results.products.length ? (
            <section aria-labelledby="r-products">
              <SectionHeader id="r-products" title={t('searchPage.products')} href={`/products${toQuery({ q })}`} linkLabel={t('common.viewAll')} />
              <CardGrid>
                {results.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </CardGrid>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
