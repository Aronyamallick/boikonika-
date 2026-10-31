'use client';

import { BookOpen, History, Package, PenLine, Search, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import type { Suggestion } from '@/lib/catalog';
import { toQuery } from '@/lib/catalog';
import { cn } from '@/lib/cn';

const KIND_ICON = { book: BookOpen, author: PenLine, product: Package, query: TrendingUp, recent: History } as const;
/** Recent searches shown above the popular ones when the field is empty. */
const RECENT_SHOWN = 5;
type Item = Suggestion | { kind: 'recent'; slug: string; label: string; detail?: null; imageUrl?: null };

function suggestionHref(s: Item): string {
  if (s.kind === 'book') return `/books/${s.slug}`;
  if (s.kind === 'author') return `/authors/${s.slug}`;
  if (s.kind === 'product') return `/products/${s.slug}`;
  return `/search${toQuery({ q: s.label })}`;
}

/**
 * Search field with autocomplete (WAI-ARIA combobox). It is a plain GET form underneath, so
 * search still works before JavaScript loads.
 */
export function SearchBox({ action, defaultValue, className, size = 'md' }: { action: string; defaultValue?: string; className?: string; size?: 'md' | 'lg' }) {
  const t = useTranslations();
  const router = useRouter();
  const { status } = useAuth();
  const id = useId();
  const listId = `${id}-list`;
  const [value, setValue] = useState(defaultValue ?? '');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const cache = useRef(new Map<string, Suggestion[]>());
  const wrapper = useRef<HTMLFormElement>(null);

  useEffect(() => setValue(defaultValue ?? ''), [defaultValue]);

  useEffect(() => {
    if (!open) return;
    const q = value.trim();
    const key = q.length >= 2 ? q.toLowerCase() : '';
    const hit = cache.current.get(key);
    if (hit) {
      setItems(hit);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ items: Suggestion[] }>('/search/suggest', { query: { q: key }, signal: controller.signal, auth: false }).then(
        (res) => {
          cache.current.set(key, res.items);
          setItems(res.items);
          setActive(-1);
        },
        () => undefined,
      );
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, open]);

  // My recent searches (kept only with personalisation on), refreshed each time the list opens.
  useEffect(() => {
    if (!open || status !== 'authenticated') return;
    api<string[]>('/me/search-history').then((r) => setRecent(r.slice(0, RECENT_SHOWN)), () => setRecent([]));
  }, [open, status]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const remember = (q: string) => {
    if (status === 'authenticated') void api('/me/search-history', { method: 'POST', body: { q } }).catch(() => undefined);
  };
  const go = (s: Item) => {
    setOpen(false);
    if (s.kind === 'query' || s.kind === 'recent') remember(s.label);
    router.push(suggestionHref(s));
  };
  const clearRecent = () => {
    setRecent([]);
    void api('/me/search-history', { method: 'DELETE' }).catch(() => undefined);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      if (!shown.length) return;
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % shown.length : i <= 0 ? shown.length - 1 : i - 1));
    } else if (e.key === 'Enter' && open && active >= 0 && shown[active]) {
      e.preventDefault();
      go(shown[active]!);
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  const popular = value.trim().length < 2;
  const recentItems: Item[] = popular ? recent.map((q) => ({ kind: 'recent', slug: `recent-${q}`, label: q })) : [];
  const shown: Item[] = [...recentItems, ...items.filter((s) => !(popular && s.kind === 'query' && recent.includes(s.label)))];
  const showList = open && shown.length > 0;

  return (
    <form
      ref={wrapper}
      action={action}
      method="get"
      role="search"
      className={cn('relative w-full', className)}
      onSubmit={(e) => {
        const q = value.trim();
        e.preventDefault();
        setOpen(false);
        if (!q) return;
        remember(q);
        router.push(`${action}${toQuery({ q })}`);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t('search.placeholder')}
      </label>
      <Search className={cn('pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle', size === 'lg' ? 'h-5 w-5' : 'h-4.5 w-4.5')} aria-hidden="true" />
      <input
        id={id}
        name="q"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t('search.placeholder')}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={200}
        className={cn(
          'w-full rounded-full border border-line-input bg-surface pl-11 pr-4 text-fg placeholder:text-fg-subtle shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
          size === 'lg' ? 'h-14 text-base' : 'h-11 text-[15px]',
        )}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={popular ? t('searchPage.popular') : t('searchPage.suggestions')}
        className={cn('absolute inset-x-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-line bg-surface-raised py-2 shadow-lg', showList ? 'block' : 'hidden')}
      >
        {shown.map((s, i) => {
          const Icon = KIND_ICON[s.kind];
          const heading =
            popular && i === 0 && s.kind === 'recent' ? (
              <li key="h-recent" role="presentation" className="flex items-center justify-between px-4 pb-1 pt-0.5 text-xs font-bold uppercase tracking-wide text-fg-subtle">
                {t('searchPage.recent')}
                <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={clearRecent} className="normal-case tracking-normal text-primary hover:underline">
                  {t('searchPage.clearRecent')}
                </button>
              </li>
            ) : popular && s.kind !== 'recent' && (i === 0 || shown[i - 1]!.kind === 'recent') ? (
              <li key="h-popular" role="presentation" className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-fg-subtle">
                {t('searchPage.popular')}
              </li>
            ) : null;
          return [
            heading,
            <li
              key={`${s.kind}-${s.slug}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => go(s)}
              onPointerEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center gap-3 px-4 py-2', i === active ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg')}
            >
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnails from the catalogue
                <img src={s.imageUrl} alt="" className="h-9 w-7 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <span className="inline-flex h-9 w-7 shrink-0 items-center justify-center text-fg-subtle" aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.label}</span>
                {s.detail ? <span className="block truncate text-xs text-fg-muted">{s.detail}</span> : null}
              </span>
              {s.kind !== 'query' && s.kind !== 'recent' ? <span className="shrink-0 text-xs text-fg-subtle">{t(`searchPage.kind${s.kind[0]!.toUpperCase()}${s.kind.slice(1)}`)}</span> : null}
            </li>,
          ];
        })}
      </ul>
    </form>
  );
}
