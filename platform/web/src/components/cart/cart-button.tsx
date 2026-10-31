'use client';

import { ShoppingCart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { localizeDigits } from '@boikonika/shared';
import { Link } from '@/i18n/navigation';
import { useCart } from './cart-provider';

/** Header cart link with the number of items (announced with the link name). */
export function CartButton() {
  const t = useTranslations();
  const locale = useLocale();
  const { count } = useCart();
  const label = count ? `${t('nav.cart')} — ${t('cart.itemCount', { count })}` : t('nav.cart');
  return (
    <Link href="/cart" className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg" aria-label={label}>
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      {count ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-fg ring-2 ring-surface" aria-hidden="true">
          {count > 99 ? '99+' : localizeDigits(count, locale)}
        </span>
      ) : null}
    </Link>
  );
}
