'use client';

import { formatMoney, localizeDigits } from '@boikonika/shared';
import { BookOpen, ImagePlus } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type ReactNode } from 'react';
import { ColumnChart } from '@/components/dashboard/column-chart';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/forms/errors';

/** Book row shared by the author and publisher dashboards (mirrors the API). */
export interface CreatorBook {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  rating: number;
  ratingCount: number;
  sales: number;
  views: number;
  sales30: number;
  views30: number;
  offers: number;
  minPrice: string | null;
}

export interface DailyPoint {
  day: string;
  views: number;
  sales: number;
}

const utcDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};

/** Page views and copies sold per day — two charts, never one chart with two scales. */
export function ViewsSalesCharts({ series }: { series: DailyPoint[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const label = (day: string) => format.dateTime(utcDay(day), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const subtitle = t('dashboard.lastDays', { count: series.length });
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ColumnChart
        title={t('creatorDashboard.viewsPerDay')}
        subtitle={subtitle}
        integer
        categoryLabel={t('dashboard.day')}
        emptyText={t('creatorDashboard.noViews')}
        data={series.map((s) => ({ key: s.day, label: label(s.day), value: s.views, display: t('creatorDashboard.viewsCount', { count: s.views }) }))}
      />
      <ColumnChart
        title={t('creatorDashboard.salesPerDay')}
        subtitle={subtitle}
        integer
        categoryLabel={t('dashboard.day')}
        emptyText={t('creatorDashboard.noSales')}
        data={series.map((s) => ({ key: s.day, label: label(s.day), value: s.sales, display: t('creatorDashboard.copiesCount', { count: s.sales }) }))}
      />
    </div>
  );
}

export function CreatorBooksTable({ books, empty }: { books: CreatorBook[]; empty: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  if (!books.length) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-line bg-surface p-5 text-sm text-fg-muted shadow-sm">
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">{t('creatorDashboard.books')}</caption>
        <thead className="border-b border-line text-xs uppercase tracking-wide text-fg-subtle">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">{t('creatorDashboard.colBook')}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('creatorDashboard.colRating')}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('creatorDashboard.colSales')}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('creatorDashboard.colViews')}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('creatorDashboard.colOffers')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {books.map((b) => (
            <tr key={b.id} className="hover:bg-subtle/60">
              <td className="px-4 py-3">
                <span className="flex items-center gap-3">
                  <span className="h-12 w-9 shrink-0 overflow-hidden rounded bg-subtle">
                    {/* eslint-disable-next-line @next/next/no-img-element -- catalogue cover thumbnail */}
                    {b.coverUrl ? <img src={b.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <Link href={`/books/${b.slug}`} className="line-clamp-2 font-semibold text-fg hover:text-primary">
                    {b.title}
                  </Link>
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {b.ratingCount ? (
                  <>
                    <span className="font-semibold text-fg">{localizeDigits(b.rating.toFixed(1), locale)}</span>
                    <span className="block text-xs text-fg-subtle">{t('book.ratingsCount', { count: b.ratingCount })}</span>
                  </>
                ) : (
                  <span className="text-fg-subtle">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className="font-semibold text-fg">{format.number(b.sales30)}</span>
                <span className="block text-xs text-fg-subtle">{t('creatorDashboard.total', { count: b.sales })}</span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className="font-semibold text-fg">{format.number(b.views30)}</span>
                <span className="block text-xs text-fg-subtle">{t('creatorDashboard.total', { count: b.views })}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="tabular-nums text-fg">{format.number(b.offers)}</span>
                {b.minPrice ? <span className="block text-xs text-fg-subtle">{t('creatorDashboard.from', { price: formatMoney(b.minPrice, locale, { hideZeroDecimals: true }) })}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Square photo / logo with an upload button (JPEG, PNG or WebP up to 5 MB). */
export function ImageUploader({ src, endpoint, label, fallback, onUploaded }: { src: string | null; endpoint: string; label: string; fallback: ReactNode; onUploaded: (url: string) => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.show(t('errors.tooLarge'), 'danger');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    setBusy(true);
    try {
      const res = await api<{ url: string }>(endpoint, { method: 'PUT', body });
      onUploaded(res.url);
      toast.show(t('common.saved'), 'success');
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-subtle text-fg-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image */}
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : fallback}
      </span>
      <div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => upload(e.target.files?.[0])} />
        <Button variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
        <p className="mt-1.5 text-xs text-fg-muted">{t('creatorDashboard.imageHint')}</p>
      </div>
    </div>
  );
}
