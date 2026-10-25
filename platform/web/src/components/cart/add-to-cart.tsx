'use client';

import { Check, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, buttonClasses } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Link, useRouter } from '@/i18n/navigation';
import { useFormErrors } from '@/lib/forms/errors';
import { cn } from '@/lib/cn';
import { useCart } from './cart-provider';

/** "Add to cart" (and optionally "Buy now") for one variant; shows a link to the cart once added. */
export function AddToCart({ variantId, available, quantity = 1, size = 'md', buyNow = false, className }: { variantId: string; available: number; quantity?: number; size?: 'sm' | 'md' | 'lg'; buyNow?: boolean; className?: string }) {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const { add, cart } = useCart();
  const { fromApi } = useFormErrors();
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null);
  const inCart = cart?.groups.some((g) => g.items.some((i) => i.variantId === variantId)) ?? false;

  if (available <= 0) {
    return (
      <Button size={size} variant="outline" disabled className={className}>
        {t('cart.outOfStock')}
      </Button>
    );
  }

  const run = async (mode: 'add' | 'buy') => {
    setBusy(mode);
    try {
      const message = await add(variantId, quantity);
      if (mode === 'buy') router.push('/checkout');
      else toast.show(message || t('cart.added'), 'success');
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Button size={size} loading={busy === 'add'} disabled={!!busy} onClick={() => run('add')}>
        {inCart ? <Check className="h-4 w-4" aria-hidden="true" /> : <ShoppingCart className="h-4 w-4" aria-hidden="true" />}
        {busy === 'add' ? t('cart.adding') : t('cart.addToCart')}
      </Button>
      {buyNow ? (
        <Button size={size} variant="accent" loading={busy === 'buy'} disabled={!!busy} onClick={() => run('buy')}>
          {t('cart.buyNow')}
        </Button>
      ) : null}
      {inCart ? (
        <Link href="/cart" className={buttonClasses({ variant: 'ghost', size })}>
          {t('cart.viewCart')}
        </Link>
      ) : null}
    </div>
  );
}
