'use client';

import { formatMoney, placeName } from '@boikonika/shared';
import { Inbox } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { ORDER_TONE, SELLER_ORDER_TABS } from '@/lib/commerce';
import { cn } from '@/lib/cn';

interface Row {
  id: string;
  number: string;
  status: string;
  total: string;
  earning: string;
  itemCount: number;
  paymentMethod: string;
  paymentStatus: string;
  recipient: string;
  district: string;
  createdAt: string;
}

const TABS = SELLER_ORDER_TABS;
const PAGE_SIZE = 20;

export function SellerOrdersList({ initialStatus = 'pending' }: { initialStatus?: (typeof TABS)[number] }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const [status, setStatus] = useState<(typeof TABS)[number]>(initialStatus);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    api<Record<string, number>>('/seller/orders-summary').then(setCounts, () => undefined);
  }, [attempt]);

  useEffect(() => {
    setRows(null);
    setFailed(false);
    apiRequest<Row[]>('/seller/orders', { query: status === 'returns' ? { returns: 'requested', page, pageSize: PAGE_SIZE } : { status: status || undefined, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setFailed(true),
    );
  }, [status, page, attempt]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-fg">{t('sellerOrders.title')}</h1>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('common.filter')}>
        {TABS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            aria-pressed={status === s}
            onClick={() => (setStatus(s), setPage(1))}
            className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold', status === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}
          >
            {s === 'returns' ? t('sellerOrders.returnsTab') : s ? t(`status.order.${s}`) : t('sellerOrders.all')}
            {s && counts[s] ? <span className={cn('rounded-full px-1.5 text-xs', status === s ? 'bg-primary-fg/20' : 'bg-surface')}>{format.number(counts[s])}</span> : null}
          </button>
        ))}
      </div>
      {failed ? (
        <ErrorState title={t('common.errorTitle')} retryLabel={t('common.retry')} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !rows ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title={t('sellerOrders.empty')} text={t('sellerOrders.emptyText')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-fg-subtle">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t('sellerOrders.colOrder')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('sellerOrders.colCustomer')}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('sellerOrders.colItems')}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('sellerOrders.colTotal')}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('sellerOrders.colEarning')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-subtle/60">
                  <td className="px-4 py-3">
                    <Link href={`/seller/orders/${r.id}`} className="font-mono font-semibold text-primary hover:underline">
                      {r.number}
                    </Link>
                    <span className="block text-xs text-fg-subtle">{format.dateTime(new Date(r.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-fg">{r.recipient}</span>
                    <span className="block text-xs text-fg-subtle">{placeName(r.district, locale)}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{format.number(r.itemCount)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-fg">{formatMoney(r.total, locale, { hideZeroDecimals: true })}</span>
                    <span className="block text-xs text-fg-subtle">{t(`payment.${r.paymentMethod}`)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-success">{formatMoney(r.earning, locale, { hideZeroDecimals: true })}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ORDER_TONE[r.status] ?? 'neutral'}>{t(`status.order.${r.status}`)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    </div>
  );
}
