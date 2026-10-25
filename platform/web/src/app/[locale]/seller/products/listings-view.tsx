'use client';

import { formatMoney, PRODUCT_STATUSES } from '@boikonika/shared';
import { BookPlus, Package, PackagePlus, Search } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { STATUS_TONE, type ListingRow } from '@/lib/seller';

const PAGE_SIZE = 20;

export function ListingsView() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const { hasRole } = useAuth();
  const [filters, setFilters] = useState({ status: '', type: '', q: '' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ items: ListingRow[]; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    apiRequest<ListingRow[]>('/seller/products', { query: { ...filters, page, pageSize: PAGE_SIZE } }).then(
      (res) => !cancelled && setResult({ items: res.data, total: res.meta?.total ?? res.data.length }),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [filters, page, attempt]);

  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE));
  const update = (patch: Partial<typeof filters>) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const actions = (
    <div className="flex flex-wrap gap-2">
      {hasRole('book_seller', 'publisher', 'author') ? (
        <Link href="/seller/products/new-book" className={buttonClasses()}>
          <BookPlus className="h-4 w-4" aria-hidden="true" />
          {t('seller.navNewBook')}
        </Link>
      ) : null}
      {hasRole('general_seller') ? (
        <Link href="/seller/products/new" className={buttonClasses({ variant: 'outline' })}>
          <PackagePlus className="h-4 w-4" aria-hidden="true" />
          {t('seller.navNewProduct')}
        </Link>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-fg">{t('seller.listingsTitle')}</h1>
        {actions}
      </header>

      <form
        role="search"
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: query.trim() });
        }}
      >
        <div className="relative min-w-56 flex-1">
          <label htmlFor="listing-q" className="sr-only">
            {t('seller.searchListings')}
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input
            id="listing-q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('seller.searchListings')}
            className="h-11 w-full rounded-lg border border-line-input bg-surface pl-9 pr-3 text-[15px] text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
        <label className="sr-only" htmlFor="listing-status">
          {t('seller.colStatus')}
        </label>
        <Select id="listing-status" value={filters.status} onChange={(e) => update({ status: e.target.value })} className="w-auto">
          <option value="">{t('seller.allStatuses')}</option>
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.product.${s}`)}
            </option>
          ))}
        </Select>
        <label className="sr-only" htmlFor="listing-type">
          {t('seller.allTypes')}
        </label>
        <Select id="listing-type" value={filters.type} onChange={(e) => update({ type: e.target.value })} className="w-auto">
          <option value="">{t('seller.allTypes')}</option>
          <option value="book">{t('seller.typeBook')}</option>
          <option value="general">{t('seller.typeGeneral')}</option>
        </Select>
        <Button type="submit" variant="outline">
          {t('common.search')}
        </Button>
      </form>

      {failed ? (
        <ErrorState title={t('common.errorTitle')} text={t('common.errorText')} retryLabel={t('common.retry')} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !result ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : result.items.length === 0 ? (
        <EmptyState icon={<Package className="h-6 w-6" />} title={t('seller.listingsEmpty')} text={t('seller.listingsEmptyText')} action={filters.q || filters.status || filters.type ? undefined : actions} />
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {result.items.map((item) => (
              <li key={item.id} className="relative flex items-center gap-4 p-4 hover:bg-subtle">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-subtle">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt="" fill sizes="3rem" className="object-cover" />
                  ) : (
                    <Package className="m-auto h-full w-5 text-fg-subtle" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-fg">
                    <Link href={`/seller/products/${item.id}`} className="after:absolute after:inset-0 hover:underline">
                      {item.title}
                    </Link>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
                    <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{t(`status.product.${item.status}`)}</Badge>
                    {item.condition ? <span>{t(`book.conditions.${item.condition}`)}</span> : null}
                    <span>
                      {t('seller.colUpdated')}: {format.relativeTime(new Date(item.updatedAt), new Date())}
                    </span>
                  </p>
                  {item.status === 'rejected' && item.rejectionReason ? <p className="mt-1 text-sm text-danger">{t('seller.rejectedReason', { reason: item.rejectionReason })}</p> : null}
                </div>
                <dl className="hidden shrink-0 grid-cols-3 gap-6 text-right text-sm sm:grid">
                  <div>
                    <dt className="text-xs text-fg-subtle">{t('seller.colPrice')}</dt>
                    <dd className="font-semibold text-fg">{formatMoney(item.price, locale, { hideZeroDecimals: true })}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-subtle">{t('seller.colStock')}</dt>
                    <dd className={item.totalStock > 0 ? 'font-semibold text-fg' : 'font-semibold text-danger'}>{format.number(item.totalStock)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-subtle">{t('seller.colSales')}</dt>
                    <dd className="font-semibold text-fg">{format.number(item.salesCount)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav aria-label={t('catalog.pagination')} className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('common.previous')}
              </Button>
              <span className="text-sm text-fg-muted">{t('catalog.pageOf', { page: format.number(page), pages: format.number(pages) })}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                {t('common.next')}
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
