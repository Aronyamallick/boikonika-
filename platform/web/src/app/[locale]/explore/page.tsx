import { BookOpen, Package, PenLine, Store } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CategoryIcon } from '@/components/catalog/category-icon';
import { SearchBox } from '@/components/layout/search-box';
import { Link } from '@/i18n/navigation';
import { serverApi } from '@/lib/api/server';
import { localized, type CategoryNode } from '@/lib/catalog';
import { alternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('nav.explore'), description: t('catalog.booksText'), alternates: alternates(locale, '/explore') };
}

/** Discovery hub: search, every category of both trees, and the main catalogue entry points. */
export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tree = (await serverApi<CategoryNode[]>('/categories', { locale, revalidate: 300 })) ?? [];
  const shortcuts = [
    { href: '/books', label: t('catalog.booksTitle'), Icon: BookOpen },
    { href: '/authors', label: t('catalog.authorsTitle'), Icon: PenLine },
    { href: '/products', label: t('catalog.productsTitle'), Icon: Package },
    { href: '/seller', label: t('nav.sell'), Icon: Store },
  ];
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold text-fg">{t('nav.explore')}</h1>
      <div className="mt-5 max-w-2xl">
        <SearchBox action="/search" size="lg" />
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shortcuts.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 font-semibold text-fg shadow-sm hover:border-primary hover:text-primary">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
      {tree.map((root) => (
        <section key={root.path} aria-labelledby={`cat-${root.slug}`} className="mt-10">
          <h2 id={`cat-${root.slug}`} className="text-xl font-bold text-fg">
            <Link href={root.appliesTo === 'general' ? '/products' : '/books'} className="hover:text-primary">
              {localized(root.name, locale)}
            </Link>
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {root.children.map((c) => (
              <li key={c.path} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
                <Link href={`/categories/${c.path}`} className="flex items-center gap-3 font-semibold text-fg hover:text-primary">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                    <CategoryIcon name={c.icon} className="h-5 w-5" />
                  </span>
                  {localized(c.name, locale)}
                </Link>
                {c.children.length ? (
                  <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 pl-[3.25rem] text-sm">
                    {c.children.map((g) => (
                      <li key={g.path}>
                        <Link href={`/categories/${g.path}`} className="text-fg-muted hover:text-primary hover:underline">
                          {localized(g.name, locale)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
