'use client';

import { formatMoney } from '@boikonika/shared';
import { AlertTriangle, BadgeCheck, Copyright, Flag, ListChecks, MessageSquareWarning, RotateCcw } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ColumnChart, type ColumnDatum } from '@/components/dashboard/column-chart';
import { RangePresets, StatTile } from '@/components/dashboard/stat-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { localized } from '@/lib/catalog';

const RANGES = [7, 30, 90] as const;
interface Change {
  value: number;
  change: number | null;
}
interface Overview {
  days: number;
  kpis: {
    users: number;
    newUsers: Change;
    dau: number;
    wau: number;
    mau: number;
    stickiness: number | null;
    authors: number;
    sellers: number;
    publishers: number;
    books: number;
    products: number;
    orders: Change;
    revenue: { value: string; change: number | null };
    commission: string;
    conversion: number | null;
  };
  queues: { pendingKyc: number; openRefunds: number; pendingListings: number; openReports: number; urgentReports: number; heldContent: number; copyrightClaims: number };
  series: Array<{ day: string; signups: number; active: number; orders: number; revenue: number }>;
  popular: {
    books: Array<{ slug: string; title: string; coverUrl: string | null; sales: number; views: number }>;
    authors: Array<{ slug: string; name: string; sales: number; followers: number }>;
    searches: Array<{ query: string; count: number; results: number }>;
    categories: Array<{ slug: string; path: string; name: { bn: string; en: string }; sales: number; views: number }>;
  };
}
const utcDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};

/** Staff overview: health of the platform, what needs doing, and what readers are buying and looking for. */
export function AdminOverview() {
  const t = useTranslations('adminOverview');
  const td = useTranslations('dashboard');
  const locale = useLocale();
  const format = useFormatter();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Overview>('/admin/overview', { query: { days } }).then(
      (d) => (setData(d), setFailed(false), setLoading(false)),
      () => (setFailed(true), setLoading(false)),
    );
  }, [days]);

  if (failed && !data) return <ErrorState title={t('error')} />;
  if (!data) return <Skeleton className="h-[40rem] w-full" />;
  const money = (v: string | number) => formatMoney(String(v), locale, { hideZeroDecimals: true });
  const comparison = td('vsPrevious', { count: data.days });
  const dayLabel = (day: string) => format.dateTime(utcDay(day), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const series = (pick: (s: Overview['series'][number]) => number, show: (v: number) => string): ColumnDatum[] => data.series.map((s) => ({ key: s.day, label: dayLabel(s.day), value: pick(s), display: show(pick(s)) }));
  const queues = [
    { key: 'urgentReports', count: data.queues.urgentReports, href: '/admin/moderation', Icon: AlertTriangle },
    { key: 'openReports', count: data.queues.openReports, href: '/admin/moderation', Icon: Flag },
    { key: 'heldContent', count: data.queues.heldContent, href: '/admin/moderation?tab=held', Icon: MessageSquareWarning },
    { key: 'copyrightClaims', count: data.queues.copyrightClaims, href: '/admin/copyright', Icon: Copyright },
    { key: 'pendingKyc', count: data.queues.pendingKyc, href: '/admin/kyc', Icon: BadgeCheck },
    { key: 'pendingListings', count: data.queues.pendingListings, href: '/admin/products', Icon: ListChecks },
    { key: 'openRefunds', count: data.queues.openRefunds, href: '/admin/refunds', Icon: RotateCcw },
  ] as const;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-fg-muted">{t('text')}</p>
        </div>
        <RangePresets value={days} options={RANGES} onChange={setDays} label={td('period')} />
      </header>

      <section aria-labelledby="queues">
        <h2 id="queues" className="mb-3 text-lg font-bold">
          {t('queuesTitle')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {queues.map(({ key, count, href, Icon }) => (
            <li key={key}>
              <Link href={href} className="flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-primary hover:bg-primary-soft/40">
                <span className={count ? (key === 'urgentReports' ? 'rounded-lg bg-danger-soft p-2 text-danger-soft-fg' : 'rounded-lg bg-warning-soft p-2 text-warning-soft-fg') : 'rounded-lg bg-subtle p-2 text-fg-subtle'}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xl font-bold text-fg">{format.number(count)}</span>
                  <span className="block text-sm text-fg-muted">{t(`queues.${key}`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="kpis" className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={loading}>
        <h2 id="kpis" className="mb-3 text-lg font-bold">
          {t('kpisTitle')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label={t('revenue')} value={money(data.kpis.revenue.value)} change={data.kpis.revenue.change} comparison={comparison} hint={t('commission', { amount: money(data.kpis.commission) })} />
          <StatTile label={t('orders')} value={format.number(data.kpis.orders.value)} change={data.kpis.orders.change} comparison={comparison} hint={data.kpis.conversion !== null ? t('conversion', { value: data.kpis.conversion }) : undefined} />
          <StatTile label={t('newUsers')} value={format.number(data.kpis.newUsers.value)} change={data.kpis.newUsers.change} comparison={comparison} hint={t('totalUsers', { count: data.kpis.users })} />
          <StatTile label={t('activeUsers')} value={format.number(data.kpis.mau)} hint={t('activeHint', { dau: data.kpis.dau, wau: data.kpis.wau })} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
          {(['books', 'products', 'sellers', 'authors', 'publishers'] as const).map((k) => (
            <div key={k} className="rounded-lg border border-line bg-surface px-3 py-2.5">
              <dt className="text-fg-muted">{t(`counts.${k}`)}</dt>
              <dd className="text-lg font-bold text-fg">{format.number(data.kpis[k])}</dd>
            </div>
          ))}
          <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
            <dt className="text-fg-muted">{t('stickiness')}</dt>
            <dd className="text-lg font-bold text-fg">{data.kpis.stickiness !== null ? format.number(data.kpis.stickiness / 100, { style: 'percent', maximumFractionDigits: 1 }) : '—'}</dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ColumnChart title={t('revenuePerDay')} subtitle={td('lastDays', { count: data.days })} data={series((s) => s.revenue, (v) => money(v))} categoryLabel={td('day')} emptyText={t('noData')} stale={loading} />
          <ColumnChart title={t('ordersPerDay')} subtitle={td('lastDays', { count: data.days })} data={series((s) => s.orders, (v) => t('ordersCount', { count: v }))} integer categoryLabel={td('day')} emptyText={t('noData')} stale={loading} />
          <ColumnChart title={t('activePerDay')} subtitle={td('lastDays', { count: data.days })} data={series((s) => s.active, (v) => t('peopleCount', { count: v }))} integer categoryLabel={td('day')} emptyText={t('noData')} stale={loading} />
          <ColumnChart title={t('signupsPerDay')} subtitle={td('lastDays', { count: data.days })} data={series((s) => s.signups, (v) => t('peopleCount', { count: v }))} integer categoryLabel={td('day')} emptyText={t('noData')} stale={loading} />
        </div>
      </section>

      <section aria-labelledby="popular" className="grid gap-4 lg:grid-cols-2">
        <h2 id="popular" className="sr-only">
          {t('popularTitle')}
        </h2>
        <RankList title={t('popularBooks')} empty={t('noData')} head={[t('book'), t('sales'), t('views')]} rows={data.popular.books.map((b) => ({ key: b.slug, href: `/books/${b.slug}`, label: b.title, cells: [format.number(b.sales), format.number(b.views)] }))} />
        <RankList title={t('popularAuthors')} empty={t('noData')} head={[t('author'), t('sales'), t('followers')]} rows={data.popular.authors.map((a) => ({ key: a.slug, href: `/authors/${a.slug}`, label: a.name, cells: [format.number(a.sales), format.number(a.followers)] }))} />
        <RankList title={t('popularCategories')} empty={t('noData')} head={[t('category'), t('sales'), t('views')]} rows={data.popular.categories.map((c) => ({ key: c.slug, href: `/categories/${c.path}`, label: localized(c.name, locale), cells: [format.number(c.sales), format.number(c.views)] }))} />
        <RankList title={t('popularSearches')} empty={t('noData')} head={[t('search'), t('searches'), t('results')]} rows={data.popular.searches.map((s) => ({ key: s.query, href: `/search?q=${encodeURIComponent(s.query)}`, label: s.query, cells: [format.number(s.count), format.number(s.results)] }))} />
      </section>
    </div>
  );
}

function RankList({ title, head, rows, empty }: { title: string; head: [string, string, string]; rows: Array<{ key: string; href: string; label: string; cells: [string, string] }>; empty: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <h3 className="mb-3 font-bold text-fg">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-fg-subtle">
            <tr>
              <th scope="col" className="pb-2 font-bold">
                {head[0]}
              </th>
              <th scope="col" className="pb-2 text-right font-bold">
                {head[1]}
              </th>
              <th scope="col" className="pb-2 text-right font-bold">
                {head[2]}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="max-w-0 truncate py-2 pr-3 text-left font-medium">
                  <Link href={r.href} className="text-fg hover:text-primary hover:underline">
                    {r.label}
                  </Link>
                </th>
                <td className="py-2 text-right tabular-nums text-fg">{r.cells[0]}</td>
                <td className="py-2 pl-3 text-right tabular-nums text-fg-muted">{r.cells[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
