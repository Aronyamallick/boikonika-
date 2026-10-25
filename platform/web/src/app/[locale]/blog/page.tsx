import { BLOG_KINDS } from '@boikonika/shared';
import { Newspaper } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Pagination } from '@/components/catalog/pagination';
import { ArticleCard } from '@/components/content/article-card';
import { EmptyState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { serverPage } from '@/lib/api/server';
import { toQuery } from '@/lib/catalog';
import type { ArticleCard as Article } from '@/lib/content';
import { cn } from '@/lib/cn';
import { alternates } from '@/lib/seo';

const PAGE_SIZE = 12;
type Search = { kind?: string; page?: string };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  return { title: t('title'), description: t('intro'), alternates: alternates(locale, '/blog') };
}

/** The blog: news, learning articles, announcements and study resources. */
export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const kind = (BLOG_KINDS as readonly string[]).includes(sp.kind ?? '') ? sp.kind : undefined;
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const { items, meta } = await serverPage<Article>(`/articles${toQuery({ kind, page, pageSize: PAGE_SIZE })}`, { locale, revalidate: 60 }).catch(() => ({ items: [] as Article[], meta: { page: 1, pageSize: PAGE_SIZE, total: 0 } }));
  const tabs: Array<{ value?: string; label: string }> = [{ label: t('blog.all') }, ...BLOG_KINDS.map((k) => ({ value: k, label: t(`content.kinds.${k}`) }))];

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{t('blog.title')}</h1>
        <p className="mt-2 max-w-2xl text-fg-muted">{t('blog.intro')}</p>
      </header>
      <nav aria-label={t('blog.filter')} className="-mx-4 mb-6 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {tabs.map((tab) => (
            <li key={tab.value ?? 'all'}>
              <Link
                href={tab.value ? `/blog?kind=${tab.value}` : '/blog'}
                aria-current={kind === tab.value ? 'page' : undefined}
                className={cn('inline-block whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold', kind === tab.value ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {items.length === 0 ? (
        <EmptyState icon={<Newspaper className="h-6 w-6" />} title={t('blog.empty')} text={t('blog.emptyText')} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <li key={a.id}>
              <ArticleCard article={a} headingLevel={2} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8">
        <Pagination path="/blog" params={kind ? { kind } : {}} page={meta.page} pageSize={meta.pageSize} total={meta.total} />
      </div>
    </div>
  );
}
