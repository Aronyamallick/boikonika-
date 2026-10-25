import { SearchX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/states';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { serverApi, serverPage } from '@/lib/api/server';
import { toQuery, type BookCardData, type CategoryNode, type ProductCardData } from '@/lib/catalog';
import { BookCard } from './book-card';
import { BookFilters, SortSelect } from './catalog-filters';
import { categoryOptions } from './category-options';
import { Pagination } from './pagination';
import { ProductCard } from './product-card';
import { CardGrid } from './shelf';

const SORTS = [
  ['relevance', 'search.sortRelevance'],
  ['popular', 'search.sortBestSelling'],
  ['newest', 'search.sortNewest'],
  ['price_asc', 'search.sortPriceLow'],
  ['price_desc', 'search.sortPriceHigh'],
  ['rating', 'search.sortRating'],
] as const;

/**
 * Filterable, sortable, paginated grid of books or general products. `fixed` params (such as the
 * category of a category page) are always applied and hidden from the filter panel.
 */
export async function CatalogBrowser({
  kind,
  path,
  locale,
  params,
  fixed = {},
  header,
}: {
  kind: 'books' | 'products';
  path: string;
  locale: string;
  params: Record<string, string>;
  fixed?: Record<string, string>;
  header: ReactNode;
}) {
  const t = await getTranslations();
  const query = { ...params, ...fixed, pageSize: '24' };
  const [page, tree] = await Promise.all([
    kind === 'books' ? serverPage<BookCardData>(`/books${toQuery(query)}`, { locale }) : serverPage<ProductCardData>(`/products${toQuery(query)}`, { locale }),
    fixed.category ? Promise.resolve(null) : serverApi<CategoryNode[]>(`/categories?for=${kind === 'books' ? 'book' : 'general'}`, { locale, revalidate: 300 }),
  ]);
  const { items, meta } = page;
  const sortOptions = SORTS.filter(([value]) => kind === 'books' || value !== 'relevance' || params.q).map(([value, label]) => ({ value, label: t(label) }));

  return (
    <div className="container-page py-6">
      {header}
      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside>
          <BookFilters path={path} values={params} categories={tree ? categoryOptions(tree, locale) : undefined} kind={kind} />
        </aside>
        <section aria-labelledby="results-heading" aria-live="polite">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-heading" className="text-sm font-semibold text-fg-muted">
              {kind === 'books' ? t('catalog.bookCount', { count: meta.total }) : t('catalog.productCount', { count: meta.total })}
            </h2>
            <SortSelect path={path} values={params} options={sortOptions} />
          </div>
          {items.length ? (
            <CardGrid className="lg:grid-cols-4 xl:grid-cols-5">
              {kind === 'books'
                ? (items as BookCardData[]).map((b, i) => <BookCard key={b.id} book={b} priority={i < 4} />)
                : (items as ProductCardData[]).map((p) => <ProductCard key={p.id} product={p} />)}
            </CardGrid>
          ) : (
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title={kind === 'books' ? t('catalog.noBooks') : t('catalog.noProducts')}
              text={t('catalog.noBooksText')}
              action={
                Object.keys(params).length ? (
                  <Link href={path} className={buttonClasses({ variant: 'outline' })}>
                    {t('common.clearFilters')}
                  </Link>
                ) : undefined
              }
            />
          )}
          <Pagination path={path} params={params} page={meta.page} pageSize={meta.pageSize} total={meta.total} />
        </section>
      </div>
    </div>
  );
}

