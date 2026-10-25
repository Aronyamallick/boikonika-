'use client';

import { formatMoney, ORDER_STATUSES, PAYMENT_STATUSES, placeName } from '@boikonika/shared';
import { Search } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { ORDER_TONE, PAYMENT_TONE } from '@/lib/commerce';

interface Row {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  grandTotal: string;
  refundedTotal: string;
  placedAt: string;
  customer: { name: string; username: string };
  district: string;
  sellerCount: number;
}

export default function AdminOrdersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const [filters, setFilters] = useState({ status: '', paymentStatus: '', q: '' });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setRows(null);
    apiRequest<Row[]>('/admin/orders', { query: { ...filters, page, pageSize: 25 } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [filters, page]);

  const update = (patch: Partial<typeof filters>) => (setPage(1), setFilters((f) => ({ ...f, ...patch })));

  return (
    <RequirePermission permission="orders.view">
      <h1 className="mb-4 text-2xl font-bold">{t('adminOrders.title')}</h1>
      <div className="mb-4 flex flex-wrap gap-3">
        <form
          role="search"
          className="relative min-w-60 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() });
          }}
        >
          <label htmlFor="order-q" className="sr-only">
            {t('adminOrders.search')}
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input id="order-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('adminOrders.search')} className="h-10 w-full rounded-lg border border-line-input bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25" />
        </form>
        <label className="sr-only" htmlFor="order-status">
          {t('common.status')}
        </label>
        <Select id="order-status" value={filters.status} onChange={(e) => update({ status: e.target.value })} className="h-10 w-auto">
          <option value="">{t('common.status')}: {t('adminOrders.any')}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.order.${s}`)}
            </option>
          ))}
        </Select>
        <label className="sr-only" htmlFor="payment-status">
          {t('orders.paymentInfo')}
        </label>
        <Select id="payment-status" value={filters.paymentStatus} onChange={(e) => update({ paymentStatus: e.target.value })} className="h-10 w-auto">
          <option value="">{t('orders.paymentInfo')}: {t('adminOrders.any')}</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.payment.${s}`)}
            </option>
          ))}
        </Select>
      </div>
      {!rows ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title={t('sellerOrders.empty')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-fg-subtle">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t('sellerOrders.colOrder')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('adminOrders.customer')}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('sellerOrders.colTotal')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-subtle/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${r.number}`} className="font-mono font-semibold text-primary hover:underline">
                      {r.number}
                    </Link>
                    <span className="block text-xs text-fg-subtle">
                      {format.dateTime(new Date(r.placedAt), { dateStyle: 'medium', timeStyle: 'short' })} · {t('adminOrders.sellers', { count: r.sellerCount })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-fg">{r.customer.name}</span>
                    <span className="block text-xs text-fg-subtle">
                      @{r.customer.username} · {placeName(r.district, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-fg">{formatMoney(r.grandTotal, locale)}</span>
                    {Number(r.refundedTotal) > 0 ? <span className="block text-xs text-fg-subtle">−{formatMoney(r.refundedTotal, locale)}</span> : null}
                  </td>
                  <td className="space-x-1.5 px-4 py-3">
                    <Badge tone={ORDER_TONE[r.status] ?? 'neutral'}>{t(`status.order.${r.status}`)}</Badge>
                    <Badge tone={PAYMENT_TONE[r.paymentStatus] ?? 'neutral'}>
                      {t(`payment.${r.paymentMethod}`)} · {t(`status.payment.${r.paymentStatus}`)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminPager page={page} total={total} pageSize={25} onPage={setPage} />
    </RequirePermission>
  );
}
