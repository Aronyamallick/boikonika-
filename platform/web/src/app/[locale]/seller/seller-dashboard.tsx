'use client';

import { formatMoney, localizeDigits } from '@boikonika/shared';
import { AlertTriangle, CheckCircle2, ClipboardCheck, ExternalLink, MessageSquareReply, PackageCheck, PackageOpen, RotateCcw, Star, Truck } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ColumnChart, type ColumnDatum } from '@/components/dashboard/column-chart';
import { RangePresets, StatTile } from '@/components/dashboard/stat-tile';
import { useSeller } from '@/components/seller/seller-shell';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Rating } from '@/components/ui/rating';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { useFormErrors } from '@/lib/forms/errors';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

interface Kpi<T> {
  value: T;
  change: number | null;
}
interface Overview {
  days: number;
  store: { name: string; slug: string; rating: number; ratingCount: number; productCount: number } | null;
  kpis: { revenue: Kpi<string>; orders: Kpi<number>; units: Kpi<number>; earnings: Kpi<string>; averageOrder: Kpi<string> };
  series: Array<{ day: string; revenue: string; orders: number }>;
  actions: { pending: number; confirmed: number; processing: number; returns: number };
  lowStock: Array<{ productId: string; title: string; variant: string; available: number; threshold: number }>;
  topProducts: Array<{ productId: string | null; title: string; imageUrl: string | null; units: number; revenue: string }>;
  balance: { available: string; pending: string; paid: string };
  reviews: Array<{ id: string; rating: number; title: string | null; body: string | null; sellerReply: string | null; createdAt: string; target: string; user: string }>;
}

/** ISO calendar day → Date at UTC midnight (format with timeZone UTC so the day never shifts). */
const utcDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};

export function SellerDashboard() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const { seller } = useSeller();
  const [days, setDays] = useState<Range>(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    api<Overview>('/seller/dashboard', { query: { days } }).then(
      (d) => (setData(d), setLoading(false)),
      () => (setFailed(true), setLoading(false)),
    );
  }, [days]);
  useEffect(load, [load]);

  if (failed && !data) return <ErrorState title={t('common.errorTitle')} text={t('common.errorText')} retryLabel={t('common.retry')} onRetry={load} />;
  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const money = (v: string) => formatMoney(v, locale, { hideZeroDecimals: true });
  const dayLabel = (day: string) => format.dateTime(utcDay(day), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const revenueSeries: ColumnDatum[] = data.series.map((s) => ({ key: s.day, label: dayLabel(s.day), value: Number(s.revenue), display: money(s.revenue) }));
  const orderSeries: ColumnDatum[] = data.series.map((s) => ({ key: s.day, label: dayLabel(s.day), value: s.orders, display: t('sellerDashboard.ordersCount', { count: s.orders }) }));
  const comparison = t('dashboard.vsPrevious', { count: data.days });
  const actions = [
    { key: 'pending', count: data.actions.pending, href: '/seller/orders?status=pending', Icon: ClipboardCheck },
    { key: 'confirmed', count: data.actions.confirmed, href: '/seller/orders?status=confirmed', Icon: PackageOpen },
    { key: 'processing', count: data.actions.processing, href: '/seller/orders?status=processing', Icon: Truck },
    { key: 'returns', count: data.actions.returns, href: '/seller/orders?status=returns', Icon: RotateCcw },
  ] as const;
  const caughtUp = actions.every((a) => a.count === 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('sellerDashboard.title')}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
            <span className="font-semibold text-fg">{data.store?.name ?? t('seller.title')}</span>
            {data.store?.ratingCount ? (
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-accent text-accent-hover" aria-hidden="true" />
                {t('sellerDashboard.storeRating', { rating: localizeDigits(data.store.rating.toFixed(1), locale), count: data.store.ratingCount })}
              </span>
            ) : null}
            {data.store ? <span>{t('sellerDashboard.liveListings', { count: data.store.productCount })}</span> : null}
          </p>
        </div>
        {seller.store ? (
          <Link href={`/stores/${seller.store.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            {t('seller.viewStore')}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      <section aria-labelledby="todo">
        <h2 id="todo" className="mb-3 text-lg font-bold text-fg">
          {t('sellerDashboard.todo')}
        </h2>
        {caughtUp ? (
          <p className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg-muted shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-success-text" aria-hidden="true" />
            {t('sellerDashboard.caughtUp')}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actions.map(({ key, count, href, Icon }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-primary hover:bg-primary-soft/40"
                >
                  <span className={count ? 'rounded-lg bg-warning-soft p-2 text-warning-soft-fg' : 'rounded-lg bg-subtle p-2 text-fg-subtle'}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xl font-bold text-fg">{format.number(count)}</span>
                    <span className="block text-sm text-fg-muted">{t(`sellerDashboard.action.${key}`)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="performance" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="performance" className="text-lg font-bold text-fg">
            {t('sellerDashboard.performance')}
          </h2>
          <RangePresets value={days} options={RANGES} onChange={setDays} label={t('dashboard.period')} />
        </div>
        {failed ? <p className="text-sm text-danger">{t('common.errorText')}</p> : null}
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={loading}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label={t('sellerDashboard.revenue')} value={money(data.kpis.revenue.value)} change={data.kpis.revenue.change} comparison={comparison} />
            <StatTile
              label={t('sellerDashboard.orders')}
              value={format.number(data.kpis.orders.value)}
              change={data.kpis.orders.change}
              comparison={comparison}
              hint={data.kpis.orders.value ? t('sellerDashboard.averageOrder', { amount: money(data.kpis.averageOrder.value) }) : undefined}
            />
            <StatTile label={t('sellerDashboard.units')} value={format.number(data.kpis.units.value)} change={data.kpis.units.change} comparison={comparison} />
            <StatTile label={t('sellerDashboard.earnings')} value={money(data.kpis.earnings.value)} change={data.kpis.earnings.change} comparison={comparison} hint={t('sellerDashboard.earningsHint')} />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <ColumnChart title={t('sellerDashboard.revenuePerDay')} subtitle={t('dashboard.lastDays', { count: data.days })} data={revenueSeries} categoryLabel={t('dashboard.day')} emptyText={t('sellerDashboard.noSales')} stale={loading} />
            <ColumnChart title={t('sellerDashboard.ordersPerDay')} subtitle={t('dashboard.lastDays', { count: data.days })} data={orderSeries} integer categoryLabel={t('dashboard.day')} emptyText={t('sellerDashboard.noSales')} stale={loading} />
          </div>
          <div className="mt-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-fg">{t('sellerDashboard.topProducts')}</h3>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('sellerDashboard.noSales')}</p>
            ) : (
              <ol className="divide-y divide-line">
                {data.topProducts.map((p, i) => (
                  <li key={`${p.productId ?? p.title}-${i}`} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 shrink-0 text-center text-sm font-bold text-fg-subtle">{format.number(i + 1)}</span>
                    <span className="h-12 w-9 shrink-0 overflow-hidden rounded bg-subtle">
                      {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded thumbnail */}
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      {p.productId ? (
                        <Link href={`/seller/products/${p.productId}`} className="line-clamp-1 font-semibold text-fg hover:text-primary">
                          {p.title}
                        </Link>
                      ) : (
                        <span className="line-clamp-1 font-semibold text-fg">{p.title}</span>
                      )}
                      <span className="block text-xs text-fg-muted">{t('sellerDashboard.unitsSold', { count: p.units })}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">{money(p.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="stock" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 id="stock" className="mb-3 flex items-center gap-2 font-bold text-fg">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
            {t('sellerDashboard.lowStock')}
          </h2>
          {data.lowStock.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              {t('sellerDashboard.stockOk')}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.lowStock.map((s) => (
                <li key={`${s.productId}-${s.variant}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/seller/products/${s.productId}`} className="min-w-0 hover:text-primary">
                    <span className="line-clamp-1 font-semibold text-fg">{s.title}</span>
                    <span className="block text-xs text-fg-muted">{s.variant}</span>
                  </Link>
                  <span className={s.available === 0 ? 'shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-soft-fg' : 'shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-soft-fg'}>
                    {s.available === 0 ? t('sellerDashboard.outOfStock') : t('sellerDashboard.left', { count: s.available })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="balance" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="balance" className="font-bold text-fg">
              {t('sellerDashboard.balance')}
            </h2>
            <Link href="/seller/payouts" className="text-sm font-semibold text-primary hover:underline">
              {t('payouts.nav')}
            </Link>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-fg-muted">{t('payouts.available')}</dt>
              <dd className="mt-0.5 text-lg font-bold text-fg">{money(data.balance.available)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('payouts.pending')}</dt>
              <dd className="mt-0.5 text-lg font-bold text-fg">{money(data.balance.pending)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('payouts.paid')}</dt>
              <dd className="mt-0.5 text-lg font-bold text-fg">{money(data.balance.paid)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section aria-labelledby="reviews" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="reviews" className="mb-3 font-bold text-fg">
          {t('sellerDashboard.recentReviews')}
        </h2>
        {data.reviews.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('sellerDashboard.noReviews')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.reviews.map((r) => (
              <SellerReviewItem key={r.id} review={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SellerReviewItem({ review }: { review: Overview['reviews'][number] }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [reply, setReply] = useState(review.sellerReply);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.sellerReply ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim().length < 2) {
      setError(t('validation.required'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await apiRequest<{ sellerReply: string }>(`/reviews/${review.id}/reply`, { method: 'POST', body: { body: draft } });
      setReply(res.data.sellerReply);
      setEditing(false);
      toast.show(t('common.saved'), 'success');
    } catch (err) {
      const { fields, message } = fromApi(err);
      setError(fields.body ?? message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Rating value={review.rating} label={t('book.rating', { rating: localizeDigits(review.rating, locale) })} />
        <span className="font-semibold text-fg">{review.user}</span>
        <span className="text-fg-subtle">{format.dateTime(new Date(review.createdAt), { dateStyle: 'medium' })}</span>
      </div>
      <p className="mt-1 text-xs text-fg-muted">{review.target}</p>
      {review.title ? <p className="mt-2 font-semibold text-fg">{review.title}</p> : null}
      {review.body ? <p className="mt-1 whitespace-pre-line text-sm text-fg">{review.body}</p> : null}
      {reply && !editing ? (
        <div className="mt-3 rounded-lg border-l-4 border-secondary bg-secondary-soft/50 px-3 py-2 text-sm">
          <p className="text-xs font-semibold text-secondary-soft-fg">{t('reviews.yourReply')}</p>
          <p className="mt-0.5 whitespace-pre-line text-fg">{reply}</p>
          <button type="button" className="mt-1 text-xs font-semibold text-primary hover:underline" onClick={() => (setDraft(reply), setEditing(true))}>
            {t('common.edit')}
          </button>
        </div>
      ) : null}
      {editing ? (
        <form onSubmit={submit} noValidate className="mt-3 space-y-2">
          <Field label={t('reviews.replyLabel')} error={error}>
            {(p) => <Textarea {...p} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={2000} />}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy}>
              {t('reviews.postReply')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : !reply ? (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setEditing(true)}>
          <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
          {t('reviews.reply')}
        </Button>
      ) : null}
    </li>
  );
}
