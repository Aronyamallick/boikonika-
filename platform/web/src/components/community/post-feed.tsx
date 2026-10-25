'use client';

import { MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { apiRequest } from '@/lib/api/client';
import type { PostView } from '@/lib/community';
import { PostCard } from './post-card';

type Query = Record<string, string | number | boolean | undefined>;

/**
 * Cursor-paged list of posts from any feed endpoint. Loads more when the end comes into view (and by
 * button, for keyboard and screen-reader users). New posts from the composer are prepended.
 */
export function PostFeed({ endpoint, query = {}, empty, prepend, label }: { endpoint: string; query?: Query; empty?: ReactNode; prepend?: PostView[]; label: string }) {
  const t = useTranslations();
  const [items, setItems] = useState<PostView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([endpoint, query]);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await apiRequest<PostView[]>(endpoint, { query: { ...query, cursor: after ?? undefined } });
        setItems((prev) => (after ? [...(prev ?? []), ...res.data.filter((p) => !prev?.some((q) => q.id === p.id))] : res.data));
        setCursor(res.meta?.nextCursor ?? null);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures endpoint and query
    [key],
  );

  useEffect(() => {
    setItems(null);
    setCursor(null);
    void load(null);
  }, [load]);

  useEffect(() => {
    if (!prepend?.length) return;
    setItems((prev) => [...prepend.filter((p) => !prev?.some((q) => q.id === p.id)), ...(prev ?? [])]);
  }, [prepend]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && !loading && load(cursor), { rootMargin: '600px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loading, load]);

  if (failed && !items) return <ErrorState title={t('common.errorTitle')} text={t('common.errorText')} retryLabel={t('common.retry')} onRetry={() => load(null)} />;
  if (!items) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!items.length) return <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title={empty ?? t('community.empty')} />;

  return (
    <section aria-label={label} className="space-y-4">
      {items.map((post) => (
        <PostCard key={post.id} post={post} onDeleted={(id) => setItems((list) => list?.filter((p) => p.id !== id) ?? null)} />
      ))}
      <div ref={sentinel} />
      {cursor ? (
        <div className="text-center">
          <Button variant="outline" loading={loading} onClick={() => load(cursor)}>
            {t('community.loadMore')}
          </Button>
        </div>
      ) : (
        <p className="py-2 text-center text-sm text-fg-subtle">{t('community.end')}</p>
      )}
    </section>
  );
}
