import type { ApiErrorDetail, AuthResult, ErrorCode, PageMeta } from '@boikonika/shared';

/** Same-origin path (proxied to the API by Next.js rewrites / the reverse proxy), so cookies stay first-party. */
export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    readonly details: ApiErrorDetail[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field → translated message (the API already localised them). */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.filter((d) => d.field).map((d) => [d.field!, d.message]));
  }
}

let accessToken: string | null = null;
let accessExpiresAt = 0;
const listeners = new Set<(signedIn: boolean) => void>();

export const tokenStore = {
  get: () => accessToken,
  set(token: string, expiresInSeconds: number) {
    accessToken = token;
    accessExpiresAt = Date.now() + expiresInSeconds * 1000;
  },
  clear() {
    accessToken = null;
    accessExpiresAt = 0;
    listeners.forEach((l) => l(false));
  },
  /** Called when the session can no longer be refreshed (expired or revoked elsewhere). */
  onSessionLost(listener: (signedIn: boolean) => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const locale = () => (typeof document !== 'undefined' ? document.documentElement.lang || 'bn' : 'bn');
export const hasSessionHint = () => typeof document !== 'undefined' && /(?:^|;\s*)bk_session=1/.test(document.cookie);

let refreshing: Promise<AuthResult | null> | null = null;

/**
 * Exchanges the HTTP-only refresh cookie for a new access token. Concurrent callers share one request,
 * and tabs take turns through the Web Locks API so they never present the same refresh token twice.
 */
export function refreshSession(): Promise<AuthResult | null> {
  if (!hasSessionHint()) return Promise.resolve(null);
  refreshing ??= (async () => {
    const run = async (): Promise<AuthResult | null> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Language': locale(), 'X-Requested-With': 'boikonika' },
          body: '{}',
        }).catch(() => null);
        if (!res) return null;
        if (res.status === 409) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }
        if (!res.ok) {
          tokenStore.clear();
          return null;
        }
        const body = (await res.json()) as { data: AuthResult };
        tokenStore.set(body.data.tokens.accessToken, body.data.tokens.expiresIn);
        return body.data;
      }
      return null;
    };
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('bk-auth-refresh', run) : run();
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Send the access token (default true; harmless on public endpoints). */
  auth?: boolean;
}

export interface ApiResult<T> {
  data: T;
  message: string;
  meta?: PageMeta;
}

/** Calls the API and unwraps the `{ success, data, message, errors }` envelope. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, query, signal, auth = true } = options;
  const url = new URL(`${API_BASE}${path}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));

  // Before the first call after a page load (or close to expiry) get a fresh access token.
  if (auth && hasSessionHint() && (!accessToken || accessExpiresAt - Date.now() < 30_000)) await refreshSession();

  const send = () => {
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': locale(), 'X-Requested-With': 'boikonika' };
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url.pathname + url.search, {
      method,
      headers,
      credentials: 'include',
      signal,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  };

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && auth && hasSessionHint()) {
      const refreshed = await refreshSession();
      if (refreshed) res = await send();
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError('', 0, 'NETWORK');
  }

  const payload = (await res.json().catch(() => null)) as
    | { success: true; data: T; message: string; meta?: PageMeta }
    | { success: false; message: string; errors: ApiErrorDetail[]; code: ErrorCode; requestId?: string }
    | null;
  if (!payload) throw new ApiError('', res.status, res.status >= 500 ? 'INTERNAL' : 'BAD_REQUEST');
  if (!payload.success) throw new ApiError(payload.message, res.status, payload.code, payload.errors, payload.requestId);
  return { data: payload.data, message: payload.message, meta: payload.meta };
}

export async function api<T>(path: string, options?: RequestOptions): Promise<T> {
  return (await apiRequest<T>(path, options)).data;
}

/** Authenticated download of a non-JSON response (e.g. the data export); returns the file and its name. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  if (hasSessionHint() && (!accessToken || accessExpiresAt - Date.now() < 30_000)) await refreshSession();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Accept-Language': locale(), 'X-Requested-With': 'boikonika', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });
  if (!res.ok) throw new ApiError('', res.status, res.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL');
  const filename = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'download';
  return { blob: await res.blob(), filename };
}
