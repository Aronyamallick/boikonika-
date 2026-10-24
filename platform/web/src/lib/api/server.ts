import { API_INTERNAL_URL } from '@/lib/env';

/**
 * Server-side fetch of public API data for server components (SEO pages). Anonymous: the visitor's
 * own state (following, ownership) is loaded in the browser. Returns null for 404.
 */
export async function serverApi<T>(path: string, options: { locale: string; revalidate?: number | false } = { locale: 'bn' }): Promise<T | null> {
  const res = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
    headers: { Accept: 'application/json', 'Accept-Language': options.locale },
    next: options.revalidate === false ? undefined : { revalidate: options.revalidate ?? 60 },
    cache: options.revalidate === false ? 'no-store' : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return ((await res.json()) as { data: T }).data;
}
