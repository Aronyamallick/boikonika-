'use client';

import { BookCheck, BookOpen, Download, Heart, History, PlayCircle } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { BookCard } from '@/components/catalog/book-card';
import { ProductCard } from '@/components/catalog/product-card';
import { DownloadButton } from '@/components/digital/download-button';
import { BookCover } from '@/components/ui/book-cover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { formatBytes, type DownloadEntry, type HistoryEntry, type WishlistData } from '@/lib/digital';
import { useFormErrors } from '@/lib/forms/errors';

const PAGE = 20;

/** Saved books and products, with a quick way to drop the ones I no longer want. */
export function WishlistPanel() {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [data, setData] = useState<WishlistData | null>(null);
  const load = useCallback(() => {
    apiRequest<WishlistData>('/me/wishlist').then((r) => setData(r.data), () => setData({ books: [], products: [] }));
  }, []);
  useEffect(load, [load]);

  const remove = async (kind: 'books' | 'products', id: string) => {
    try {
      const res = await apiRequest(`/me/wishlist/${kind}/${id}`, { method: 'DELETE' });
      toast.show(res.message, 'success');
      load();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };

  if (!data) return <Skeleton className="h-64 w-full" />;
  if (!data.books.length && !data.products.length) {
    return (
      <EmptyState
        icon={<Heart className="h-6 w-6" />}
        title={t('wishlist.empty')}
        text={t('wishlist.emptyText')}
        action={
          <Link href="/books" className="font-semibold text-primary hover:underline">
            {t('library.browse')}
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-8">
      {data.books.length ? (
        <section aria-labelledby="wl-books">
          <h3 id="wl-books" className="mb-3 font-bold text-fg">
            {t('wishlist.books', { count: data.books.length })}
          </h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data.books.map((b) => (
              <li key={b.id} className="flex flex-col">
                <BookCard book={b} />
                <Button size="sm" variant="ghost" className="mt-1 self-start text-fg-muted" onClick={() => remove('books', b.id)} aria-label={t('wishlist.removeTitle', { title: b.title })}>
                  <Heart className="h-4 w-4 fill-danger text-danger" aria-hidden="true" />
                  {t('wishlist.remove')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.products.length ? (
        <section aria-labelledby="wl-products">
          <h3 id="wl-products" className="mb-3 font-bold text-fg">
            {t('wishlist.products', { count: data.products.length })}
          </h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data.products.map((p) => (
              <li key={p.id} className="flex flex-col">
                <ProductCard product={p} />
                {!p.available ? <p className="mt-1 text-xs font-semibold text-fg-subtle">{t('wishlist.unavailable')}</p> : null}
                <Button size="sm" variant="ghost" className="mt-1 self-start text-fg-muted" onClick={() => remove('products', p.id)} aria-label={t('wishlist.removeTitle', { title: p.title })}>
                  <Heart className="h-4 w-4 fill-danger text-danger" aria-hidden="true" />
                  {t('wishlist.remove')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function usePaged<T>(path: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const load = useCallback(
    (p: number) => {
      apiRequest<T[]>(path, { query: { page: p, pageSize: PAGE } }).then(
        (r) => {
          setItems((prev) => (p === 1 ? r.data : [...(prev ?? []), ...r.data]));
          setTotal(r.meta?.total ?? 0);
          setPage(p);
        },
        () => setItems((prev) => prev ?? []),
      );
    },
    [path],
  );
  useEffect(() => load(1), [load]);
  return { items, total, more: () => load(page + 1), reload: () => load(1) };
}

/** Every e-book download, newest first, with a fresh link for files still available. */
export function DownloadsPanel({ version }: { version: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const { items, total, more, reload } = usePaged<DownloadEntry>('/me/downloads');
  useEffect(() => {
    if (version) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the library changes
  }, [version]);

  if (!items) return <Skeleton className="h-48 w-full" />;
  if (!items.length) return <EmptyState icon={<Download className="h-6 w-6" />} title={t('digital.noDownloads')} text={t('digital.noDownloadsText')} />;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-sm">
        {items.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Link href={`/books/${d.book.slug}`} className="w-10 shrink-0" tabIndex={-1} aria-hidden="true">
              <BookCover src={d.book.coverUrl} title={d.book.title} className="w-10 p-0.5 text-[5px]" sizes="2.5rem" />
            </Link>
            <div className="min-w-0 flex-1 text-sm">
              <Link href={`/books/${d.book.slug}`} className="line-clamp-1 font-semibold text-fg hover:text-primary">
                {d.book.title}
              </Link>
              <p className="text-xs text-fg-muted">
                {[d.format.toUpperCase(), formatBytes(d.sizeBytes, locale), format.dateTime(new Date(d.at), { dateStyle: 'medium', timeStyle: 'short' })].join(' · ')}
              </p>
            </div>
            {d.available ? <DownloadButton bookId={d.book.id} title={d.book.title} size="sm" variant="outline" onDone={reload} /> : <span className="text-xs text-fg-subtle">{t('digital.fileGone')}</span>}
          </li>
        ))}
      </ul>
      {items.length < total ? (
        <Button variant="outline" onClick={more}>
          {t('common.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}

const EVENT_ICON: Record<string, typeof BookOpen> = { started: PlayCircle, finished: BookCheck, downloaded: Download };

/** What happened in my reading: books started and finished, e-books downloaded. */
export function HistoryPanel({ version }: { version: number }) {
  const t = useTranslations();
  const format = useFormatter();
  const { items, total, more, reload } = usePaged<HistoryEntry>('/me/reading/history');
  useEffect(() => {
    if (version) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the library changes
  }, [version]);

  if (!items) return <Skeleton className="h-48 w-full" />;
  if (!items.length) return <EmptyState icon={<History className="h-6 w-6" />} title={t('library.noHistory')} text={t('library.noHistoryText')} />;
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {items.map((h) => {
          const Icon = EVENT_ICON[h.event] ?? BookOpen;
          return (
            <li key={h.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm shadow-sm">
              <Icon className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-fg">
                {t.rich(`library.history.${['started', 'finished', 'downloaded'].includes(h.event) ? h.event : 'other'}`, {
                  book: () => (
                    <Link href={`/books/${h.book.slug}`} className="font-semibold hover:text-primary hover:underline">
                      {h.book.title}
                    </Link>
                  ),
                })}
              </p>
              <time dateTime={h.at} className="shrink-0 text-xs text-fg-muted">
                {format.dateTime(new Date(h.at), { dateStyle: 'medium' })}
              </time>
            </li>
          );
        })}
      </ol>
      {items.length < total ? (
        <Button variant="outline" onClick={more}>
          {t('common.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
