import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'use-intl';
import { ApiError, apiRequest, type ApiResult, type RequestOptions } from './api';
import { prefs } from './storage';

interface State<T> {
  data: T | null;
  meta: ApiResult<T>['meta'];
  error: ApiError | null;
  /** True until the first answer (from the network or the offline copy). */
  loading: boolean;
  /** True while a pull-to-refresh is in flight. */
  refreshing: boolean;
  /** The data shown came from the offline copy because the network failed. */
  offline: boolean;
}

/**
 * Loads an API path for a screen. With `persist`, the last good answer is kept on the phone and shown
 * at once (and when offline) while a fresh copy loads — reading lists and the home page stay usable
 * without a connection. Pass `null` to wait (e.g. until signed in).
 */
export function useApi<T>(path: string | null, options: { persist?: boolean; query?: RequestOptions['query'] } = {}) {
  const locale = useLocale();
  const query = options.query ? JSON.stringify(options.query) : '';
  const cacheKey = path && options.persist ? `cache:${locale}:${path}?${query}` : null;
  const [state, setState] = useState<State<T>>({ data: null, meta: undefined, error: null, loading: !!path, refreshing: false, offline: false });
  const generation = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!path) return;
      const run = ++generation.current;
      if (mode === 'refresh') setState((s) => ({ ...s, refreshing: true }));
      try {
        const res = await apiRequest<T>(path, { query: query ? JSON.parse(query) : undefined });
        if (run !== generation.current) return;
        setState({ data: res.data, meta: res.meta, error: null, loading: false, refreshing: false, offline: false });
        if (cacheKey) prefs.set(cacheKey, { data: res.data, meta: res.meta });
      } catch (error) {
        if (run !== generation.current) return;
        const apiError = error instanceof ApiError ? error : new ApiError(0, 'INTERNAL', '');
        setState((s) => ({ ...s, error: apiError, loading: false, refreshing: false, offline: s.data !== null && apiError.code === 'NETWORK' }));
      }
    },
    [path, query, cacheKey],
  );

  useEffect(() => {
    if (!path) return;
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      if (cacheKey) {
        const saved = await prefs.get<{ data: T; meta: ApiResult<T>['meta'] }>(cacheKey);
        if (active && saved) setState((s) => (s.data === null ? { ...s, data: saved.data, meta: saved.meta, loading: false } : s));
      }
      if (active) await load('initial');
    })();
    return () => {
      active = false;
    };
  }, [path, cacheKey, load]);

  return { ...state, reload: () => load('refresh'), setData: (data: T) => setState((s) => ({ ...s, data })) };
}

/**
 * A list that loads more as the reader scrolls. Works with both kinds of API paging: a `nextCursor`
 * (feeds) or page numbers with a total (catalogue lists). The first page is cached like `useApi`.
 */
export function useInfinite<T>(path: string | null, options: { persist?: boolean; query?: RequestOptions['query'] } = {}) {
  const first = useApi<T[]>(path, options);
  const [extra, setExtra] = useState<{ items: T[]; meta: ApiResult<T[]>['meta'] }>({ items: [], meta: undefined });
  const [loadingMore, setLoadingMore] = useState(false);
  const query = options.query ? JSON.stringify(options.query) : '';

  // A fresh first page (refresh, new filters) starts the list over.
  useEffect(() => setExtra({ items: [], meta: undefined }), [first.data, path, query]);

  const meta = extra.meta ?? first.meta;
  const loaded = (first.data?.length ?? 0) + extra.items.length;
  const hasMore = !!meta?.nextCursor || (!!meta?.total && !!meta.page && loaded < meta.total && loaded > 0);

  const loadMore = useCallback(async () => {
    if (!path || !hasMore || loadingMore || first.offline) return;
    setLoadingMore(true);
    try {
      const base = query ? JSON.parse(query) : {};
      const next = meta?.nextCursor ? { ...base, cursor: meta.nextCursor } : { ...base, page: (meta?.page ?? 1) + 1 };
      const res = await apiRequest<T[]>(path, { query: next });
      setExtra((e) => ({ items: [...e.items, ...res.data], meta: res.meta }));
    } catch {
      // Scrolling again retries.
    } finally {
      setLoadingMore(false);
    }
  }, [path, query, hasMore, loadingMore, meta, first.offline]);

  return { ...first, items: first.data ? [...first.data, ...extra.items] : [], hasMore, loadingMore, loadMore };
}
