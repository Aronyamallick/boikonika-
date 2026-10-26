import { acceptSession, ApiError, apiRequest, clearSession, onSessionChange, refreshSession } from '@/lib/api';
import * as SecureStore from 'expo-secure-store';

type Call = { url: string; init: RequestInit };
const calls: Call[] = [];
const reply = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);
const tokens = (n: number) => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresIn: 900 });
const user = { id: 'u1', displayName: 'Rahim' };

beforeEach(async () => {
  calls.length = 0;
  await clearSession();
});

function mockFetch(handler: (path: string, init: RequestInit) => Promise<Response>) {
  globalThis.fetch = jest.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(new URL(url).pathname.replace('/api/v1', ''), init);
  }) as unknown as typeof fetch;
}

describe('API client', () => {
  it('sends the language, platform and session, and keeps the refresh token in the secure store', async () => {
    await acceptSession({ user, tokens: tokens(1) } as never);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('bk.refreshToken', 'refresh-1');
    mockFetch(() => reply(200, { success: true, data: { ok: 1 }, message: '' }));
    const res = await apiRequest<{ ok: number }>('/cart', { query: { page: 2, empty: '' } });
    expect(res.data.ok).toBe(1);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-1');
    expect(headers['X-Client-Platform']).toMatch(/^(ios|android)$/);
    expect(headers['Accept-Language']).toBe('bn');
    expect(calls[0]!.url).toContain('page=2');
    expect(calls[0]!.url).not.toContain('empty');
  });

  it('refreshes once for concurrent callers and retries a request that got 401', async () => {
    await acceptSession({ user, tokens: tokens(1) } as never);
    let rejected = false;
    mockFetch((path, init) => {
      if (path === '/auth/refresh') return reply(200, { success: true, data: { user, tokens: tokens(2) } });
      const auth = (init.headers as Record<string, string>).Authorization;
      if (auth === 'Bearer access-1' && !rejected) {
        rejected = true;
        return reply(401, { success: false, code: 'UNAUTHORIZED', message: 'expired' });
      }
      return reply(200, { success: true, data: auth });
    });
    const res = await apiRequest<string>('/me/library');
    expect(res.data).toBe('Bearer access-2');
    await Promise.all([refreshSession(), refreshSession()]);
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(2);
  });

  it('ends the session only when the refresh token is rejected, not on a network failure', async () => {
    await acceptSession({ user, tokens: tokens(1) } as never);
    const signedOut = jest.fn();
    const off = onSessionChange(signedOut);
    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch;
    expect(await refreshSession()).toBeNull();
    expect(signedOut).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync('bk.refreshToken')).toBe('refresh-1');

    mockFetch(() => reply(401, { success: false, code: 'UNAUTHORIZED', message: 'revoked' }));
    expect(await refreshSession()).toBeNull();
    expect(signedOut).toHaveBeenCalledWith(false);
    expect(await SecureStore.getItemAsync('bk.refreshToken')).toBeNull();
    off();
  });

  it('turns failures into ApiError with the translated message and field errors', async () => {
    mockFetch(() => reply(422, { success: false, code: 'VALIDATION', message: 'ঠিক করুন', errors: [{ field: 'phone', message: 'সঠিক নম্বর দিন' }] }));
    const error = await apiRequest('/me/addresses', { method: 'POST', body: {} }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({ phone: 'সঠিক নম্বর দিন' });
    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch;
    expect((await apiRequest('/home').catch((e) => e)).code).toBe('NETWORK');
  });
});
