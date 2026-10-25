'use client';

import { localizeDigits } from '@boikonika/shared';
import { Bell, CheckCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { RelativeTime } from '@/components/ui/relative-time';
import { Link, useRouter } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { INBOX_CHANGED, type NotificationItem } from '@/lib/notifications';

const POLL_MS = 60_000;

/** Header bell: unread count, and the latest notifications in a panel. Refreshes quietly, never nags. */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const router = useRouter();
  const { status } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    if (status !== 'authenticated' || document.visibilityState === 'hidden') return;
    api<{ unread: number }>('/me/notifications/unread-count').then((r) => setUnread(r.unread), () => undefined);
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(INBOX_CHANGED, refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(INBOX_CHANGED, refresh);
    };
  }, [status, refresh]);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    apiRequest<NotificationItem[]>('/me/notifications', { query: { limit: 6 } }).then((r) => setItems(r.data), () => setItems([]));
    const onPointer = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (status !== 'authenticated') return null;

  const openItem = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.read) api<{ unread: number }>(`/me/notifications/${n.id}/read`, { method: 'POST' }).then((r) => setUnread(r.unread), () => undefined);
    if (n.link) router.push(n.link);
  };
  const readAll = async () => {
    await api('/me/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    setUnread(0);
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? list);
  };

  const label = unread ? t('bellUnread', { count: unread }) : t('bell');
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-danger-fg ring-2 ring-surface" aria-hidden="true">
            {unread > 99 ? '99+' : localizeDigits(unread, locale)}
          </span>
        ) : null}
      </button>
      {open ? (
        <div ref={panelRef} id={panelId} role="region" aria-label={t('title')} className="fixed inset-x-4 top-16 z-50 overflow-hidden rounded-xl border border-line bg-surface-raised shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem]">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="font-bold text-fg">{t('title')}</h2>
            {unread ? (
              <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t('markAllRead')}
              </button>
            ) : null}
          </div>
          {!items ? (
            <div className="space-y-2 p-4" aria-hidden="true">
              <div className="h-10 animate-pulse rounded bg-skeleton" />
              <div className="h-10 animate-pulse rounded bg-skeleton" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg-muted">{t('empty')}</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none', !n.read && 'bg-primary-soft/40')}>
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-fg">{n.title}</span>
                      <span className="line-clamp-2 block text-sm text-fg-muted">{n.body}</span>
                      <RelativeTime date={n.createdAt} className="mt-0.5 block text-xs text-fg-subtle" />
                    </span>
                    {!n.read ? <span className="sr-only">{t('unread')}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm">
            <Link href="/notifications" onClick={() => setOpen(false)} className="font-semibold text-primary hover:underline">
              {t('seeAll')}
            </Link>
            <Link href="/account/notifications" onClick={() => setOpen(false)} className="text-fg-muted hover:text-fg hover:underline">
              {t('settings')}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
