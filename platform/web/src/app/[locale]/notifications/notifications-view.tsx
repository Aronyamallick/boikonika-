'use client';

import { Bell, CheckCheck, Settings, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button, buttonClasses } from '@/components/ui/button';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Link, useRouter } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { announceInboxChange, type NotificationItem } from '@/lib/notifications';

/** Everything the platform told me, newest first: open, mark read, or remove. */
export function NotificationsView() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (after?: string) => {
      const res = await apiRequest<NotificationItem[]>('/me/notifications', { query: { limit: 20, cursor: after, unread: filter === 'unread' ? 1 : undefined } });
      setItems((prev) => (after ? [...(prev ?? []), ...res.data] : res.data));
      setCursor((res.meta?.nextCursor as string | null | undefined) ?? null);
    },
    [filter],
  );
  useEffect(() => {
    setItems(null);
    load().catch(() => setItems([]));
  }, [load]);

  const markRead = async (n: NotificationItem) => {
    if (n.read) return;
    await api(`/me/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
    setItems((list) => (filter === 'unread' ? list?.filter((x) => x.id !== n.id) : list?.map((x) => (x.id === n.id ? { ...x, read: true } : x))) ?? list);
    announceInboxChange();
  };
  const open = async (n: NotificationItem) => {
    await markRead(n);
    if (n.link) router.push(n.link);
  };
  const remove = async (n: NotificationItem) => {
    await api(`/me/notifications/${n.id}`, { method: 'DELETE' }).catch(() => undefined);
    setItems((list) => list?.filter((x) => x.id !== n.id) ?? list);
    announceInboxChange();
  };
  const readAll = async () => {
    await api('/me/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    setItems((list) => (filter === 'unread' ? [] : (list?.map((x) => ({ ...x, read: true })) ?? list)));
    announceInboxChange();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-fg-muted">{t('intro')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={readAll}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            {t('markAllRead')}
          </Button>
          <Link href="/account/notifications" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
            <Settings className="h-4 w-4" aria-hidden="true" />
            {t('settings')}
          </Link>
        </div>
      </header>
      <div className="flex gap-1.5" role="group" aria-label={t('filter')}>
        {(['all', 'unread'] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', filter === f ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
            {t(f === 'all' ? 'all' : 'unreadOnly')}
          </button>
        ))}
      </div>
      {!items ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title={filter === 'unread' ? t('noUnread') : t('empty')} text={t('emptyText')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          {items.map((n) => (
            <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3.5', !n.read && 'bg-primary-soft/40')}>
              <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-line' : 'bg-primary')} aria-hidden="true" />
              <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                <span className="block font-semibold text-fg">{n.title}</span>
                <span className="mt-0.5 block text-sm text-fg-muted">{n.body}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                  <RelativeTime date={n.createdAt} />
                  <span>·</span>
                  <span>{t(`types.${n.type}`)}</span>
                  {!n.read ? <span className="sr-only">{t('unread')}</span> : null}
                </span>
              </button>
              <Button size="icon" variant="ghost" className="text-fg-subtle" aria-label={t('remove', { title: n.title })} onClick={() => remove(n)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {cursor ? (
        <Button
          variant="outline"
          loading={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            await load(cursor).catch(() => undefined);
            setLoadingMore(false);
          }}
        >
          {t('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
