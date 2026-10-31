import type { PageMeta } from '@boikonika/shared';
import { connection } from 'next/server';
import { API_INTERNAL_URL } from '@/lib/env';

interface ServerOptions {
  locale: string;
  revalidate?: number | false;
}

async function fetchEnvelope<T>(path: string, options: ServerOptions): Promise<{ data: T; meta?: PageMeta } | null> {
  let res: Response;
  try {
    res = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
      headers: { Accept: 'application/json', 'Accept-Language': options.locale },
      next: options.revalidate === false ? undefined : { revalidate: options.revalidate ?? 60 },
      cache: options.revalidate === false ? 'no-store' : undefined,
    });
  } catch (error) {
    // No API to reach while the site is being built (container builds): render this page per request
    // instead of failing the build or caching an empty page. At request time this is a no-op.
    await connection();
    throw error;
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return (await res.json()) as { data: T; meta?: PageMeta };
}

/**
 * Server-side fetch of public API data for server components (SEO pages). Anonymous: the visitor's
 * own state (following, ownership) is loaded in the browser. Returns null for 404.
 */
export async function serverApi<T>(path: string, options: ServerOptions = { locale: 'bn' }): Promise<T | null> {
  return (await fetchEnvelope<T>(path, options))?.data ?? null;
}

/** Paginated list endpoints: items plus page metadata. */
export async function serverPage<T>(path: string, options: ServerOptions): Promise<{ items: T[]; meta: Required<Pick<PageMeta, 'page' | 'pageSize' | 'total'>> }> {
  const res = await fetchEnvelope<T[]>(path, options);
  return {
    items: res?.data ?? [],
    meta: { page: res?.meta?.page ?? 1, pageSize: res?.meta?.pageSize ?? 24, total: res?.meta?.total ?? 0 },
  };
}
