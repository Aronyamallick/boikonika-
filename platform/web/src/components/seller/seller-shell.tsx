'use client';

import { BookPlus, ExternalLink, PackagePlus, Settings2, Store, Tags } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { RequireAuth } from '@/components/auth/require-auth';
import { buttonClasses } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Link, usePathname } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import type { SellerAccount } from '@/lib/seller';

const SellerContext = createContext<{ seller: SellerAccount; reload: () => void } | null>(null);

export function useSeller() {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error('useSeller must be used inside SellerShell');
  return ctx;
}

const NAV = [
  { href: '/seller/products', key: 'navListings', Icon: Tags, exact: true },
  { href: '/seller/products/new-book', key: 'navNewBook', Icon: BookPlus, books: true },
  { href: '/seller/products/new', key: 'navNewProduct', Icon: PackagePlus, general: true },
  { href: '/seller/store', key: 'navStore', Icon: Settings2 },
] as const;

function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const [state, setState] = useState<{ seller: SellerAccount } | { error: 'not_seller' | 'failed' } | null>(null);

  const load = useCallback(() => {
    api<SellerAccount>('/seller/me').then(
      (seller) => setState({ seller }),
      (e) => setState({ error: e instanceof ApiError && e.status === 403 ? 'not_seller' : 'failed' }),
    );
  }, []);
  useEffect(load, [load]);

  if (!state) {
    return (
      <div className="container-page space-y-4 py-10" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if ('error' in state) {
    return (
      <div className="container-page py-10">
        {state.error === 'not_seller' ? (
          <EmptyState
            icon={<Store className="h-6 w-6" />}
            title={t('seller.notSellerTitle')}
            text={t('seller.notSellerText')}
            action={
              <Link href="/account/verification?purpose=seller" className={buttonClasses()}>
                {t('seller.apply')}
              </Link>
            }
          />
        ) : (
          <ErrorState title={t('common.errorTitle')} text={t('common.errorText')} retryLabel={t('common.retry')} onRetry={load} />
        )}
      </div>
    );
  }

  const { seller } = state;
  // Book listings need a verified book seller, publisher or author; general products a general seller.
  const sellsBooks = hasRole('book_seller', 'publisher', 'author');
  const items = NAV.filter((n) => (!('books' in n) || sellsBooks) && (!('general' in n) || hasRole('general_seller')));
  return (
    <SellerContext.Provider value={{ seller, reload: load }}>
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[220px_1fr] lg:py-8">
        <nav aria-label={t('seller.title')} className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-fg-subtle">{t('seller.title')}</p>
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {items.map(({ href, key, Icon, ...rest }) => {
              const active = 'exact' in rest ? pathname === href || /^\/seller\/products\/[0-9a-f-]{36}$/.test(pathname) : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn('flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold', active ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-subtle hover:text-fg')}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(`seller.${key}`)}
                  </Link>
                </li>
              );
            })}
            {seller.store ? (
              <li>
                <Link href={`/stores/${seller.store.slug}`} className="flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-fg-muted hover:bg-subtle hover:text-fg">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {t('seller.viewStore')}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </SellerContext.Provider>
  );
}

export function SellerShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}
