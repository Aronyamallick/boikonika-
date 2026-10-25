'use client';

import { formatMoney } from '@boikonika/shared';
import { AlertTriangle, ShieldCheck, ShoppingBag, Store, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { useCart } from '@/components/cart/cart-provider';
import { Alert } from '@/components/ui/alert';
import { BookCover } from '@/components/ui/book-cover';
import { Button, buttonClasses } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import type { CartItem } from '@/lib/commerce';
import { useFormErrors } from '@/lib/forms/errors';

export function CartView() {
  const t = useTranslations();
  const locale = useLocale();
  const { status } = useAuth();
  const { cart, loading } = useCart();

  if (loading && !cart) {
    return (
      <div className="container-page grid gap-6 py-8 lg:grid-cols-[1fr_22rem]" aria-busy="true">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  const groups = cart?.groups ?? [];
  const saved = cart?.saved ?? [];
  if (!groups.length && !saved.length) {
    return (
      <div className="container-page py-10">
        <h1 className="sr-only">{t('cart.title')}</h1>
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title={t('cart.empty')}
          text={t('cart.emptyText')}
          action={
            <Link href="/books" className={buttonClasses()}>
              {t('cart.continueShopping')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('cart.title')}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-5">
          {cart?.summary.hasProblems ? <Alert tone="warning">{t('cart.problems')}</Alert> : null}
          {groups.map((group) => (
            <section key={group.seller.id} aria-labelledby={`seller-${group.seller.id}`} className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
              <h2 id={`seller-${group.seller.id}`} className="flex items-center gap-2 border-b border-line bg-subtle/60 px-4 py-2.5 text-sm font-semibold text-fg">
                <Store className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                {t.rich('cart.soldBy', {
                  store: group.seller.name,
                  link: (chunks) => (
                    <Link href={`/stores/${group.seller.slug}`} className="hover:text-primary hover:underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </h2>
              <ul className="divide-y divide-line">
                {group.items.map((item) => (
                  <Line key={item.variantId} item={item} />
                ))}
              </ul>
            </section>
          ))}
          {saved.length ? (
            <section aria-labelledby="saved" className="rounded-xl border border-line bg-surface shadow-sm">
              <h2 id="saved" className="border-b border-line px-4 py-2.5 text-sm font-semibold text-fg">
                {t('cart.savedForLater', { count: saved.length })}
              </h2>
              <ul className="divide-y divide-line">
                {saved.map((item) => (
                  <Line key={item.variantId} item={item} saved />
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside aria-labelledby="summary" className="rounded-xl border border-line bg-surface p-5 shadow-sm lg:sticky lg:top-24">
          <h2 id="summary" className="text-lg font-bold text-fg">
            {t('cart.summary')}
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-muted">{t('cart.subtotal')} ({t('cart.itemCount', { count: cart?.summary.itemCount ?? 0 })})</dt>
              <dd className="font-semibold text-fg">{formatMoney(cart?.summary.subtotal ?? '0', locale)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-fg-subtle">{t('cart.shippingAtCheckout')}</p>
          {groups.length > 1 ? <p className="mt-1 text-xs text-fg-subtle">{t('cart.parcels', { count: groups.length })}</p> : null}
          {status === 'authenticated' ? (
            <Link href="/checkout" aria-disabled={!cart?.summary.itemCount} className={buttonClasses({ size: 'lg', className: `mt-5 w-full ${cart?.summary.itemCount ? '' : 'pointer-events-none opacity-50'}` })}>
              {t('cart.checkout')}
            </Link>
          ) : (
            <Link href={`/login?next=${encodeURIComponent('/checkout')}`} className={buttonClasses({ size: 'lg', className: 'mt-5 w-full' })}>
              {t('checkout.signIn')}
            </Link>
          )}
          <p className="mt-4 flex items-start gap-2 text-xs text-fg-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            {t('cart.secure')}
          </p>
        </aside>
      </div>
    </div>
  );
}

function Line({ item, saved }: { item: CartItem; saved?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const { update, remove } = useCart();
  const [busy, setBusy] = useState(false);
  const href = item.bookSlug ? `/books/${item.bookSlug}` : `/products/${item.productSlug}`;

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex gap-4 p-4" aria-busy={busy}>
      <Link href={href} className="w-16 shrink-0 sm:w-20" tabIndex={-1} aria-hidden="true">
        {item.type === 'book' || !item.imageUrl ? (
          <BookCover src={item.imageUrl} title={item.title} sizes="5rem" />
        ) : (
          <span className="relative block aspect-square overflow-hidden rounded-lg border border-line bg-subtle">
            <Image src={item.imageUrl} alt="" fill sizes="5rem" className="object-cover" />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <Link href={href} className="line-clamp-2 font-semibold text-fg hover:text-primary hover:underline">
              {item.title}
            </Link>
            <p className="mt-0.5 text-xs text-fg-muted">{[item.condition ? t(`book.conditions.${item.condition}`) : null, item.type === 'general' && item.variantName !== 'Default' ? item.variantName : null].filter(Boolean).join(' · ')}</p>
          </div>
          <Price amount={item.unitPrice} compareAt={item.compareAtPrice} locale={locale} size="sm" className="shrink-0" />
        </div>
        {item.state !== 'ok' && !saved ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-danger">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {item.state === 'unavailable' ? t('cart.unavailable') : t('cart.onlyLeft', { count: item.available })}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {!saved && item.state !== 'unavailable' ? (
            <QuantityStepper value={item.quantity} max={Math.max(item.available, 1)} disabled={busy} label={t('cart.quantityOf', { title: item.title })} onChange={(quantity) => run(() => update(item.variantId, { quantity }))} />
          ) : null}
          {saved ? (
            <Button size="sm" variant="outline" disabled={busy || item.state === 'unavailable'} onClick={() => run(() => update(item.variantId, { savedForLater: false }))}>
              {t('cart.moveToCart')}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => update(item.variantId, { savedForLater: true }))}>
              {t('cart.saveForLater')}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-danger" disabled={busy} onClick={() => run(() => remove(item.variantId))}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t('cart.remove')}
          </Button>
        </div>
      </div>
    </li>
  );
}
