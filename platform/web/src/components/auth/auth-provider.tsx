'use client';

import type { AuthResult, AuthUser } from '@boikonika/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshSession, tokenStore } from '@/lib/api/client';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  /** Store the session returned by register/login endpoints. */
  signedIn: (result: AuthResult) => void;
  signOut: () => Promise<void>;
  /** Re-read the user (after profile, role or contact changes). */
  reload: () => Promise<void>;
  can: (permission: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const CHANNEL = 'bk-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const apply = useCallback((next: AuthUser | null) => {
    setUser(next);
    setStatus(next ? 'authenticated' : 'anonymous');
  }, []);

  useEffect(() => {
    let active = true;
    refreshSession().then((result) => active && apply(result?.user ?? null));
    const unsubscribe = tokenStore.onSessionLost(() => apply(null));
    // Keep tabs in sync: signing in or out in one tab updates the others.
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
    if (channel) {
      channel.onmessage = (event: MessageEvent<'login' | 'logout'>) => {
        if (event.data === 'logout') {
          tokenStore.clear();
          apply(null);
        } else {
          refreshSession().then((result) => apply(result?.user ?? null));
        }
      };
    }
    return () => {
      active = false;
      unsubscribe();
      channel?.close();
    };
  }, [apply]);

  const broadcast = (message: 'login' | 'logout') => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(message);
    channel.close();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signedIn(result) {
        tokenStore.set(result.tokens.accessToken, result.tokens.expiresIn);
        apply(result.user);
        broadcast('login');
      },
      async signOut() {
        await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
        tokenStore.clear();
        apply(null);
        broadcast('logout');
      },
      async reload() {
        apply(await api<AuthUser>('/auth/me'));
      },
      can: (permission) => !!user?.permissions.includes(permission),
      hasRole: (...roles) => !!user && roles.some((r) => user.roles.includes(r)),
    }),
    [status, user, apply],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
