'use client';

import { formatMoney } from '@boikonika/shared';
import { Banknote, CreditCard, FlaskConical, Plus, ShieldCheck, Smartphone, Truck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useCart } from '@/components/cart/cart-provider';
import { AddressForm, AddressLines } from '@/components/commerce/address-form';
import { Alert } from '@/components/ui/alert';
import { BookCover } from '@/components/ui/book-cover';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Link, useRouter } from '@/i18n/navigation';
import { api, apiRequest, ApiError } from '@/lib/api/client';
import { idempotencyKey, type Address, type CheckoutResult, type Quote, type ShippingOption } from '@/lib/commerce';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';

const METHOD_ICON: Record<string, typeof Banknote> = { cod: Banknote, bkash: Smartphone, nagad: Smartphone, rocket: Smartphone, card: CreditCard, internet_banking: CreditCard, sandbox: FlaskConical };

export function CheckoutView() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { cart, loading: cartLoading, reload: reloadCart } = useCart();
  const { fromApi } = useFormErrors();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [shipping, setShipping] = useState<ShippingOption[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [placing, setPlacing] = useState<'idle' | 'placing' | 'redirecting'>('idle');
  const [error, setError] = useState<string | null>(null);
  const key = useRef(idempotencyKey());

  useEffect(() => {
    api<Address[]>('/me/addresses').then(
      (list) => {
        setAddresses(list);
        setAddressId((current) => current ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null);
      },
      () => setAddresses([]),
    );
    api<{ shippingMethods: ShippingOption[] }>('/checkout/options', { auth: false }).then((o) => setShipping(o.shippingMethods), () => undefined);
  }, []);

  useEffect(() => {
    if (cart?.couponCode && coupon === null) {
      setCoupon(cart.couponCode);
      setCouponInput(cart.couponCode);
    }
  }, [cart?.couponCode, coupon]);

  const requote = useCallback(async () => {
    setQuoting(true);
    try {
      const q = await api<Quote>('/checkout/quote', { method: 'POST', body: { addressId: addressId ?? undefined, shippingMethod, couponCode: coupon ?? undefined } });
      setQuote(q);
      setPaymentMethod((current) => (current && q.paymentMethods.some((m) => m.method === current && m.available) ? current : (q.paymentMethods.find((m) => m.available && m.method !== 'cod')?.method ?? q.paymentMethods.find((m) => m.available)?.method ?? null)));
    } catch (e) {
      setError(fromApi(e).message);
    } finally {
      setQuoting(false);
    }
  }, [addressId, shippingMethod, coupon, fromApi]);

  useEffect(() => {
    if (addresses === null) return;
    void requote();
  }, [addresses, requote, cart?.summary.itemCount]);

  const place = async (e: FormEvent) => {
    e.preventDefault();
    if (!quote || !addressId || !paymentMethod) return;
    setError(null);
    setPlacing('placing');
    try {
      const res = await apiRequest<CheckoutResult>('/checkout', {
        method: 'POST',
        body: { addressId, shippingMethod, paymentMethod, couponCode: coupon ?? undefined, note: note.trim() || undefined, idempotencyKey: key.current, expectedTotal: quote.totals.grandTotal },
      });
      void reloadCart();
      const { order, payment } = res.data;
      if (payment?.redirectUrl) {
        setPlacing('redirecting');
        window.location.assign(payment.redirectUrl);
        return;
      }
      router.push(`/account/orders/${order.number}?placed=1`);
    } catch (err) {
      setPlacing('idle');
      setError(fromApi(err).message);
      // Prices or stock moved: show the fresh numbers. A new key lets the buyer place the corrected order.
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        key.current = idempotencyKey();
        void reloadCart();
        void requote();
      }
    }
  };

  const applyCoupon = (e: FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    setCoupon(code || null);
  };

  const selectedAddress = useMemo(() => addresses?.find((a) => a.id === addressId) ?? null, [addresses, addressId]);
  const methods = quote?.paymentMethods ?? [];
  const items = quote?.groups.flatMap((g) => g.items) ?? [];

  if (!cartLoading && cart && cart.summary.itemCount === 0 && placing === 'idle') {
    return (
      <div className="container-page py-10">
        <EmptyState
          title={t('checkout.emptyCart')}
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
      <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('checkout.title')}</h1>
      <form onSubmit={place} className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="space-y-6">
          <section aria-labelledby="step-address" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="step-address" className="text-lg font-bold text-fg">
                1. {t('checkout.addressStep')}
              </h2>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('checkout.addAddress')}
              </Button>
            </div>
            {addresses === null ? (
              <Skeleton className="h-24 w-full" />
            ) : addresses.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('checkout.noAddress')}</p>
            ) : (
              <div role="radiogroup" aria-labelledby="step-address" className="grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <label key={a.id} className={cn('cursor-pointer rounded-lg border p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40', a.id === addressId ? 'border-primary bg-primary-soft/50' : 'border-line hover:border-line-strong')}>
                    <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-fg-subtle">
                      <input type="radio" name="address" value={a.id} checked={a.id === addressId} onChange={() => setAddressId(a.id)} className="h-4 w-4 accent-[var(--bk-primary)]" />
                      {t(`addresses.labels.${a.label}`)}
                      {a.isDefault ? <span className="normal-case tracking-normal">· {t('addresses.default')}</span> : null}
                    </span>
                    <AddressLines address={a} locale={locale} />
                  </label>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="step-shipping" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <h2 id="step-shipping" className="mb-4 text-lg font-bold text-fg">
              2. {t('checkout.shippingStep')}
            </h2>
            <div role="radiogroup" aria-labelledby="step-shipping" className="grid gap-3 sm:grid-cols-2">
              {shipping.map((m) => (
                <label key={m.code} className={cn('flex cursor-pointer gap-3 rounded-lg border p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40', m.code === shippingMethod ? 'border-primary bg-primary-soft/50' : 'border-line hover:border-line-strong')}>
                  <input type="radio" name="shipping" value={m.code} checked={m.code === shippingMethod} onChange={() => setShippingMethod(m.code)} className="mt-1 h-4 w-4 accent-[var(--bk-primary)]" />
                  <span className="text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-fg">
                      <Truck className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                      {locale === 'bn' ? m.name.bn : m.name.en}
                    </span>
                    <span className="mt-0.5 block text-fg-muted">{t('checkout.days', { min: m.minDays, max: m.maxDays })}</span>
                    <span className="block text-fg-muted">{t('checkout.insideDhaka', { inside: formatMoney(m.insideDhakaFee, locale, { hideZeroDecimals: true }).slice(1), outside: formatMoney(m.outsideDhakaFee, locale, { hideZeroDecimals: true }).slice(1) })}</span>
                    {m.freeShippingThreshold ? <span className="block text-success">{t('checkout.freeAbove', { amount: formatMoney(m.freeShippingThreshold, locale, { hideZeroDecimals: true }).slice(1) })}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section aria-labelledby="step-payment" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <h2 id="step-payment" className="mb-4 text-lg font-bold text-fg">
              3. {t('checkout.paymentStep')}
            </h2>
            <div role="radiogroup" aria-labelledby="step-payment" className="grid gap-3 sm:grid-cols-2">
              {methods.map((m) => {
                const Icon = METHOD_ICON[m.method] ?? CreditCard;
                return (
                  <label
                    key={m.method}
                    className={cn(
                      'flex gap-3 rounded-lg border p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40',
                      !m.available ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                      m.method === paymentMethod ? 'border-primary bg-primary-soft/50' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <input type="radio" name="payment" value={m.method} disabled={!m.available} checked={m.method === paymentMethod} onChange={() => setPaymentMethod(m.method)} className="mt-1 h-4 w-4 accent-[var(--bk-primary)]" />
                    <span className="text-sm">
                      <span className="flex items-center gap-1.5 font-semibold text-fg">
                        <Icon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                        {t(`payment.${m.method}`)}
                      </span>
                      <span className="mt-0.5 block text-fg-muted">{!m.available ? (m.reason ?? t('checkout.unavailable')) : m.method === 'cod' ? t('checkout.codHint') : m.method === 'sandbox' ? t('checkout.sandboxHint') : t('checkout.onlineHint')}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <label htmlFor="checkout-note" className="mt-5 block text-sm font-semibold text-fg">
              {t('checkout.note')}
            </label>
            <Textarea id="checkout-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder={t('checkout.notePlaceholder')} className="mt-1.5" />
          </section>
        </div>

        <aside aria-labelledby="checkout-summary" className="rounded-xl border border-line bg-surface p-5 shadow-sm lg:sticky lg:top-24" aria-busy={quoting}>
          <h2 id="checkout-summary" className="text-lg font-bold text-fg">
            {t('cart.summary')}
          </h2>
          <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
            {items.map((i) => (
              <li key={i.variantId} className="flex gap-3 text-sm">
                <BookCover src={i.imageUrl} title={i.title} className="w-10 shrink-0 rounded-md p-1 text-[8px]" sizes="2.5rem" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium text-fg">{i.title}</p>
                  <p className="text-xs text-fg-muted">× {i.quantity}</p>
                </div>
                <p className="shrink-0 font-medium text-fg">{formatMoney(i.lineTotal, locale, { hideZeroDecimals: true })}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex gap-2">
              <label htmlFor="coupon" className="sr-only">
                {t('checkout.coupon')}
              </label>
              <Input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder={t('checkout.coupon')} className="h-10 uppercase" maxLength={40} onKeyDown={(e) => e.key === 'Enter' && applyCoupon(e)} />
              {coupon ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCoupon('');
                    setCouponInput('');
                  }}
                >
                  {t('checkout.removeCoupon')}
                </Button>
              ) : (
                <Button variant="outline" onClick={applyCoupon}>
                  {t('checkout.apply')}
                </Button>
              )}
            </div>
            {quote?.coupon ? <p className={cn('mt-1.5 text-sm', quote.coupon.applied ? 'text-success' : 'text-danger')} role="status">{quote.coupon.applied ? t('checkout.couponApplied', { code: quote.coupon.code }) : quote.coupon.message}</p> : null}
          </div>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-muted">{t('checkout.items', { count: quote?.totals.itemCount ?? 0 })}</dt>
              <dd className="text-fg">{formatMoney(quote?.totals.itemsSubtotal ?? '0', locale)}</dd>
            </div>
            {quote && Number(quote.totals.discountTotal) > 0 ? (
              <div className="flex justify-between text-success">
                <dt>{t('checkout.discount')}</dt>
                <dd>−{formatMoney(quote.totals.discountTotal, locale)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-fg-muted">
                {t('checkout.shipping')}
                {quote && quote.groups.length > 1 ? <span className="block text-xs">{t('cart.parcels', { count: quote.groups.length })}</span> : null}
              </dt>
              <dd className="text-fg">{!quote || quote.totals.shippingPending ? t('checkout.pending') : Number(quote.totals.shippingTotal) === 0 ? t('checkout.free') : formatMoney(quote.totals.shippingTotal, locale)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
              <dt className="text-fg">{t('checkout.total')}</dt>
              <dd className="text-fg" aria-live="polite">
                {formatMoney(quote?.totals.grandTotal ?? '0', locale)}
              </dd>
            </div>
          </dl>
          {quote?.problems.length ? (
            <Alert tone="warning" className="mt-4">
              {t('cart.problems')}{' '}
              <Link href="/cart" className="font-semibold underline">
                {t('cart.viewCart')}
              </Link>
            </Alert>
          ) : null}
          {error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}
          <Button type="submit" size="lg" className="mt-5 w-full" loading={placing !== 'idle'} disabled={!quote || quoting || !selectedAddress || !paymentMethod || !!quote.problems.length || !quote.totals.itemCount}>
            {placing === 'redirecting' ? t('checkout.redirecting') : placing === 'placing' ? t('checkout.placing') : paymentMethod && paymentMethod !== 'cod' ? t('checkout.placeAndPay') : t('checkout.placeOrder')}
          </Button>
          <p className="mt-3 text-xs text-fg-subtle">{t('checkout.terms')}</p>
          {paymentMethod && paymentMethod !== 'cod' ? (
            <p className="mt-3 flex items-start gap-2 text-xs text-fg-muted">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              {t('checkout.onlineHint')}
            </p>
          ) : null}
        </aside>
      </form>

      <Dialog open={adding} onClose={() => setAdding(false)} title={t('checkout.addAddress')} closeLabel={t('common.close')} className="w-[min(94vw,640px)]">
        <AddressForm
          onCancel={() => setAdding(false)}
          onSaved={(saved) => {
            setAdding(false);
            setAddresses((list) => [...(list ?? []).map((a) => (saved.isDefault ? { ...a, isDefault: false } : a)), saved]);
            setAddressId(saved.id);
          }}
          submitLabel={t('checkout.deliverHere')}
        />
      </Dialog>
    </div>
  );
}
