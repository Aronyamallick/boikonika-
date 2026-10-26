import type { AuthResult, AuthUser, TwoFactorChallenge } from '@boikonika/shared';
import { getRandomBytes } from 'expo-crypto';
import * as Device from 'expo-device';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { acceptSession, api, clearSession, clientKind, hasStoredSession, onSessionChange, refreshSession } from './api';
import { disablePush } from './push';
import { secure } from './storage';

type Status = 'loading' | 'authenticated' | 'anonymous';
type SignIn = AuthResult | TwoFactorChallenge;

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  /** Fields every sign-in sends: which device this is, so "Active devices" and new-device alerts work. */
  device: () => Promise<{ client: 'android' | 'ios'; deviceId: string; deviceName?: string }>;
  /** Finishes any sign-in, registration or two-step result. Returns the challenge when a code is still needed. */
  complete: (result: SignIn) => Promise<TwoFactorChallenge | null>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  can: (permission: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEVICE_KEY = 'bk.deviceId';
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A random id this installation keeps, so the account can recognise the device. */
async function deviceId(): Promise<string> {
  const existing = await secure.get(DEVICE_KEY);
  if (existing) return existing;
  const bytes = getRandomBytes(32);
  const id = Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join('');
  await secure.set(DEVICE_KEY, id);
  return id;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = (await hasStoredSession()) ? await refreshSession() : null;
      if (!active) return;
      setUser(result?.user ?? null);
      setStatus(result ? 'authenticated' : 'anonymous');
    })();
    const off = onSessionChange((signedIn) => {
      if (!signedIn) (setUser(null), setStatus('anonymous'));
    });
    return () => {
      active = false;
      off();
    };
  }, []);

  const complete = useCallback(async (result: SignIn) => {
    if ('twoFactorRequired' in result) return result;
    await acceptSession(result);
    setUser(result.user);
    setStatus('authenticated');
    return null;
  }, []);

  const signOut = useCallback(async () => {
    // Stop this phone's notices first, while the session can still say which account they belong to.
    await disablePush().catch(() => undefined);
    const refreshToken = await secure.get('bk.refreshToken');
    await api('/auth/logout', { method: 'POST', body: { refreshToken: refreshToken ?? undefined } }).catch(() => undefined);
    await clearSession();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await api<AuthUser>('/auth/me'));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      device: async () => ({ client: clientKind(), deviceId: await deviceId(), deviceName: Device.modelName ?? undefined }),
      complete,
      signOut,
      refreshUser,
      can: (permission) => !!user?.permissions.includes(permission),
      hasRole: (...roles) => !!user && roles.some((r) => user.roles.includes(r)),
    }),
    [status, user, complete, signOut, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
