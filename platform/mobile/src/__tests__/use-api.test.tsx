import { BRAND, messages } from '@boikonika/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { IntlProvider } from 'use-intl';
import { useApi } from '@/lib/use-api';

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="bn" messages={messages.bn} timeZone={BRAND.timezone}>
    {children}
  </IntlProvider>
);
const ok = (data: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, data }) } as Response);

describe('useApi', () => {
  beforeEach(() => AsyncStorage.clear());

  it('keeps the last good answer and shows it when the phone is offline', async () => {
    globalThis.fetch = jest.fn(() => ok([{ key: 'trending' }])) as unknown as typeof fetch;
    const online = await renderHook(() => useApi<Array<{ key: string }>>('/home', { persist: true }), { wrapper });
    await waitFor(() => expect(online.result.current.data).toEqual([{ key: 'trending' }]));
    await waitFor(async () => expect(await AsyncStorage.getItem('cache:bn:/home?')).not.toBeNull());
    await online.unmount();

    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch;
    const offline = await renderHook(() => useApi<Array<{ key: string }>>('/home', { persist: true }), { wrapper });
    await waitFor(() => expect(offline.result.current.offline).toBe(true));
    expect(offline.result.current.data).toEqual([{ key: 'trending' }]);
    expect(offline.result.current.error?.code).toBe('NETWORK');
  });

  it('waits while the path is null and loads when it is set', async () => {
    globalThis.fetch = jest.fn(() => ok({ items: [] })) as unknown as typeof fetch;
    const { result, rerender } = await renderHook(({ path }: { path: string | null }) => useApi(path), { wrapper, initialProps: { path: null as string | null } });
    expect(result.current.loading).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await rerender({ path: '/me/library' });
    await waitFor(() => expect(result.current.data).toEqual({ items: [] }));
  });
});
