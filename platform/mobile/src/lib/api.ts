import type { AuthResult, PageMeta } from '@boikonika/shared';
import { Platform } from 'react-native';
import { API_URL } from './config';
import { secure } from './storage';

const REFRESH_KEY = 'bk.refreshToken';
const CLIENT = Platform.OS === 'ios' ? 'ios' : 'android';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** field → translated message, from the API's validation errors. */
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export interface ApiResult<T> {
  data: T;
  meta?: PageMeta;
  message: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

let accessToken: string | null = null;
let accessExpiresAt = 0;
let locale = 'bn';
let refreshing: Promise<AuthResult | null> | null = null;
const listeners = new Set<(signedIn: boolean) => void>();

export const setApiLocale = (value: string) => (locale = value);
/** Told when the session ends on its own (refresh rejected), so the app can show the signed-out state. */
export const onSessionChange = (fn: (signedIn: boolean) => void) => (listeners.add(fn), () => listeners.delete(fn));

/** Stores the tokens from sign-in, registration or refresh. */
export async function acceptSession(result: AuthResult): Promise<void> {
  accessToken = result.tokens.accessToken;
  accessExpiresAt = Date.now() + result.tokens.expiresIn * 1000;
  if (result.tokens.refreshToken) await secure.set(REFRESH_KEY, result.tokens.refreshToken);
}

export async function clearSession(): Promise<void> {
  accessToken = null;
  accessExpiresAt = 0;
  await secure.remove(REFRESH_KEY);
}

export const hasStoredSession = async () => !!(await secure.get(REFRESH_KEY));
export const clientKind = () => CLIENT;

/** Rotates the refresh token for a new access token; concurrent callers share one request. */
export function refreshSession(): Promise<AuthResult | null> {
  refreshing ??= (async () => {
    const refreshToken = await secure.get(REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const res = await send<AuthResult>('/auth/refresh', { method: 'POST', body: { refreshToken } }, false);
      await acceptSession(res.data);
      return res.data;
    } catch (error) {
      // Only a rejected token ends the session; a network blip keeps it for the next try.
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
        listeners.forEach((fn) => fn(false));
      }
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function send<T>(path: string, options: RequestOptions, auth: boolean): Promise<ApiResult<T>> {
  const url = new URL(`${API_URL}/api/v1${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': locale,
    'X-Requested-With': 'boikonika',
    'X-Client-Platform': CLIENT,
    ...options.headers,
  };
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', '');
  }
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; meta?: PageMeta; message?: string; code?: string; errors?: Array<{ field?: string; message: string }> } | null;
  if (!res.ok || !json?.success) {
    const fields = Object.fromEntries((json?.errors ?? []).filter((e) => e.field).map((e) => [e.field!, e.message]));
    throw new ApiError(res.status, json?.code ?? 'INTERNAL', json?.message ?? '', fields);
  }
  return { data: json.data as T, meta: json.meta, message: json.message ?? '' };
}

/**
 * Calls the API with the reader's language and session. An expired access token is refreshed once
 * and the request retried.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  if (!accessToken || accessExpiresAt - Date.now() < 30_000) {
    if (await secure.get(REFRESH_KEY)) await refreshSession();
  }
  try {
    return await send<T>(path, options, true);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && accessToken && (await refreshSession())) return send<T>(path, options, true);
    throw error;
  }
}

export const api = async <T>(path: string, options?: RequestOptions): Promise<T> => (await apiRequest<T>(path, options)).data;
