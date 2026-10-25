'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { apiRequest } from '@/lib/api/client';
import type { CartView } from '@/lib/commerce';

const TOKEN_KEY = 'bk-cart';

const readToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const writeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the guest cart lives for this tab only.
  }
};

interface CartContextValue {
  cart: CartView | null;
  count: number;
  loading: boolean;
  reload: () => Promise<void>;
  /** Adds units and returns the API's confirmation message. */
  add: (variantId: string, quantity?: number) => Promise<string>;
  update: (variantId: string, patch: { quantity?: number; savedForLater?: boolean }) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Cart state for the whole app. Guests get a token from the API on their first add (kept in this
 * browser); after sign-in the guest cart is merged into the account's cart.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const merging = useRef(false);

  const headers = useCallback((): Record<string, string> => {
    if (status === 'authenticated') return {};
    const token = readToken();
    return token ? { 'X-Cart-Token': token } : {};
  }, [status]);

  const accept = useCallback(
    (view: CartView) => {
      if (status !== 'authenticated' && view.guestToken) writeToken(view.guestToken);
      setCart(view);
    },
    [status],
  );

  const reload = useCallback(async () => {
    try {
      const res = await apiRequest<CartView>('/cart', { headers: headers() });
      accept(res.data);
    } catch {
      // The header badge simply stays as it was.
    } finally {
      setLoading(false);
    }
  }, [headers, accept]);

  useEffect(() => {
    if (status === 'loading') return;
    const token = readToken();
    if (status === 'authenticated' && token && !merging.current) {
      merging.current = true;
      apiRequest<CartView>('/cart/merge', { method: 'POST', body: { guestToken: token } })
        .then((res) => {
          writeToken(null);
          setCart(res.data);
          setLoading(false);
        })
        .catch(() => {
          writeToken(null);
          void reload();
        })
        .finally(() => {
          merging.current = false;
        });
      return;
    }
    void reload();
  }, [status, reload]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      count: cart?.summary.itemCount ?? 0,
      reload,
      async add(variantId, quantity = 1) {
        const res = await apiRequest<CartView>('/cart/items', { method: 'POST', body: { variantId, quantity }, headers: headers() });
        accept(res.data);
        return res.message;
      },
      async update(variantId, patch) {
        const res = await apiRequest<CartView>(`/cart/items/${variantId}`, { method: 'PATCH', body: patch, headers: headers() });
        accept(res.data);
      },
      async remove(variantId) {
        const res = await apiRequest<CartView>(`/cart/items/${variantId}`, { method: 'DELETE', headers: headers() });
        accept(res.data);
      },
      async applyCoupon(code) {
        const res = await apiRequest<CartView>('/cart/coupon', { method: 'PUT', body: { code } });
        accept(res.data);
      },
      async removeCoupon() {
        const res = await apiRequest<CartView>('/cart/coupon', { method: 'DELETE' });
        accept(res.data);
      },
    }),
    [cart, loading, reload, headers, accept],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
