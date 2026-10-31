import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { CatalogBrowser } from '@/components/catalog/catalog-browser';
import { CategoryIcon } from '@/components/catalog/category-icon';
import { Link } from '@/i18n/navigation';
import { serverApi } from '@/lib/api/server';
import { flatParams, localized, type CategoryDetail } from '@/lib/catalog';
import { sanitizeBookParams, sanitizeProductParams } from '@/lib/catalog-query';
import { alternates } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; path: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(locale: string, segments: string[]) {
  const path = segments.map((s) => decodeURIComponent(s)).join('/');
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+){0,5}$/.test(path)) return null;
  return serverApi<CategoryDetail>(`/categories/${path}`, { locale, revalidate: 300 });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, path } = await params;
  const category = await load(locale, path);
  if (!category) return { title: '404', robots: { index: false } };
  const filtered = Object.keys(flatParams(await searchParams)).length > 0;
  const name = localized(category.name, locale);
  return {
    title: name,
    description: localized(category.description, locale) || undefined,
    alternates: alternates(locale, `/categories/${category.path}`),
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, path } = await params;
  setRequestLocale(locale);
  const category = await load(locale, path);
  if (!category) notFound();
  const t = await getTranslations();
  const kind = category.appliesTo === 'general' ? 'products' : 'books';
  const raw = flatParams(await searchParams);
  const query = kind === 'books' ? sanitizeBookParams(raw) : sanitizeProductParams(raw);
  delete query.category;
  const name = localized(category.name, locale);
  // The root of each tree is the plain books / products list.
  const crumbs = category.breadcrumbs
    .filter((c) => c.path.includes('/'))
    .map((c) => ({ label: localized(c.name, locale), href: `/categories/${c.path}` }));
  const rootCrumb = kind === 'books' ? { label: t('catalog.booksTitle'), href: '/books' } : { label: t('catalog.productsTitle'), href: '/products' };

  return (
    <CatalogBrowser
      kind={kind}
      path={`/categories/${category.path}`}
      locale={locale}
      params={query}
      fixed={{ category: category.path }}
      header={
        <>
          <Breadcrumbs items={[rootCrumb, ...crumbs.slice(0, -1), { label: name }]} />
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
              <CategoryIcon name={category.icon} className="h-6 w-6" />
            </span>
            <h1 className="text-3xl font-bold text-fg">{name}</h1>
          </div>
          {category.description ? <p className="mt-2 max-w-3xl text-fg-muted">{localized(category.description, locale)}</p> : null}
          {category.children.length ? (
            <nav aria-label={t('catalog.subcategories')} className="mt-5">
              <ul className="flex flex-wrap gap-2">
                {category.children.map((c) => (
                  <li key={c.path}>
                    <Link href={`/categories/${c.path}`} className="inline-flex items-center rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-fg shadow-sm hover:border-primary hover:text-primary">
                      {localized(c.name, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </>
      }
    />
  );
}
