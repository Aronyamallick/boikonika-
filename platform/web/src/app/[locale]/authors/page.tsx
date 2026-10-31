import { localizeDigits } from '@boikonika/shared';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { AuthorCard } from '@/components/catalog/people-cards';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { serverApi } from '@/lib/api/server';
import { flatParams, toQuery, type AuthorCardData } from '@/lib/catalog';
import { alternates } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const PAGE_SIZE = 36;

function readQuery(raw: Record<string, string>) {
  const q = (raw.q ?? '').trim().slice(0, 120);
  const page = Math.min(200, Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1));
  return { q, page };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { q, page } = readQuery(flatParams(await searchParams));
  const t = await getTranslations({ locale });
  return { title: t('catalog.authorsTitle'), description: t('catalog.authorsText'), alternates: alternates(locale, '/authors'), robots: q || page > 1 ? { index: false, follow: true } : undefined };
}

export default async function AuthorsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, page } = readQuery(flatParams(await searchParams));
  const t = await getTranslations();
  const authors = (await serverApi<AuthorCardData[]>(`/authors${toQuery({ q, page: page > 1 ? page : undefined, pageSize: PAGE_SIZE })}`, { locale, revalidate: 120 })) ?? [];
  const href = (p: number) => `/authors${toQuery({ q, page: p > 1 ? p : undefined })}`;

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t('catalog.authorsTitle') }]} />
      <h1 className="mt-3 text-3xl font-bold text-fg">{t('catalog.authorsTitle')}</h1>
      <p className="mt-1 text-fg-muted">{t('catalog.authorsText')}</p>
      <form action="/authors" method="get" role="search" className="relative mt-5 max-w-md">
        <label htmlFor="author-q" className="sr-only">
          {t('catalog.searchAuthors')}
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
        <input
          id="author-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t('catalog.searchAuthors')}
          className="h-11 w-full rounded-full border border-line-input bg-surface pl-11 pr-4 text-[15px] text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </form>
      {authors.length ? (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {authors.map((a) => (
            <li key={a.slug} className="flex">
              <AuthorCard author={a} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-8" title={t('catalog.noAuthors')} />
      )}
      {page > 1 || authors.length === PAGE_SIZE ? (
        <nav aria-label={t('catalog.pagination')} className="mt-10 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={buttonClasses({ variant: 'outline' })}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t('common.previous')}
            </Link>
          ) : null}
          <span className="text-sm text-fg-muted">{t('catalog.goToPage', { page: localizeDigits(page, locale) })}</span>
          {authors.length === PAGE_SIZE ? (
            <Link href={href(page + 1)} rel="next" className={buttonClasses({ variant: 'outline' })}>
              {t('common.next')}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
