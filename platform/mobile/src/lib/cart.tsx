import type { CartView } from '@boikonika/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiRequest } from './api';
import { useAuth } from './auth';
import { prefs } from './storage';

const TOKEN_KEY = 'bk.cartToken';

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
 * The same cart as the website: guests get a token on their first add (kept on the phone), and after
 * sign-in the guest cart is merged into the account's cart.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useRef<string | null>(null);
  const merging = useRef(false);

  const headers = useCallback((): Record<string, string> => (status !== 'authenticated' && token.current ? { 'X-Cart-Token': token.current } : {}), [status]);

  const accept = useCallback(
    (view: CartView) => {
      if (status !== 'authenticated' && view.guestToken && view.guestToken !== token.current) {
        token.current = view.guestToken;
        void prefs.set(TOKEN_KEY, view.guestToken);
      }
      setCart(view);
    },
    [status],
  );

  const reload = useCallback(async () => {
    try {
      accept((await apiRequest<CartView>('/cart', { headers: headers() })).data);
    } catch {
      // The badge keeps its last value; the cart screen shows its own error.
    } finally {
      setLoading(false);
    }
  }, [headers, accept]);

  useEffect(() => {
    if (status === 'loading') return;
    let active = true;
    (async () => {
      token.current ??= await prefs.get<string>(TOKEN_KEY);
      if (!active) return;
      if (status === 'authenticated' && token.current && !merging.current) {
        merging.current = true;
        const guestToken = token.current;
        token.current = null;
        await prefs.remove(TOKEN_KEY);
        try {
          const res = await apiRequest<CartView>('/cart/merge', { method: 'POST', body: { guestToken } });
          if (active) (setCart(res.data), setLoading(false));
        } catch {
          if (active) await reload();
        } finally {
          merging.current = false;
        }
        return;
      }
      await reload();
    })();
    return () => {
      active = false;
    };
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
        accept((await apiRequest<CartView>(`/cart/items/${variantId}`, { method: 'PATCH', body: patch, headers: headers() })).data);
      },
      async remove(variantId) {
        accept((await apiRequest<CartView>(`/cart/items/${variantId}`, { method: 'DELETE', headers: headers() })).data);
      },
      async applyCoupon(code) {
        accept((await apiRequest<CartView>('/cart/coupon', { method: 'PUT', body: { code } })).data);
      },
      async removeCoupon() {
        accept((await apiRequest<CartView>('/cart/coupon', { method: 'DELETE' })).data);
      },
    }),
    [cart, loading, reload, headers, accept],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart outside CartProvider');
  return ctx;
}
