'use client';

import { formatMoney, RETURN_REASONS } from '@boikonika/shared';
import { CheckCircle2, CircleDot, ExternalLink, PackageCheck, RotateCcw, Star, Truck, XCircle } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AddressLines } from '@/components/commerce/address-form';
import { DownloadButton } from '@/components/digital/download-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest, ApiError } from '@/lib/api/client';
import { idempotencyKey, ORDER_TONE, PAYMENT_TONE, type OrderDetail } from '@/lib/commerce';
import { useFormErrors } from '@/lib/forms/errors';

export function OrderView({ number, paymentOutcome, placed }: { number: string; paymentOutcome: 'success' | 'failed' | 'cancelled' | null; placed: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [failed, setFailed] = useState<'missing' | 'error' | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [returnFor, setReturnFor] = useState<OrderDetail['sellerOrders'][number] | null>(null);
  const payKey = useRef(idempotencyKey());

  const load = useCallback(() => {
    api<OrderDetail>(`/orders/${number}`).then(setOrder, (e) => setFailed(e instanceof ApiError && e.status === 404 ? 'missing' : 'error'));
  }, [number]);
  useEffect(load, [load]);

  if (failed) {
    return (
      <div className="container-page py-10">
        {failed === 'missing' ? <ErrorState title={t('common.notFoundTitle')} text={t('common.notFoundText')} /> : <ErrorState title={t('common.errorTitle')} retryLabel={t('common.retry')} onRetry={load} />}
      </div>
    );
  }
  if (!order) {
    return (
      <div className="container-page max-w-4xl space-y-4 py-8" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const payNow = async () => {
    if (!order.payment && order.paymentMethod === 'cod') return;
    setBusy(true);
    try {
      const res = await api<{ redirectUrl: string | null }>(`/orders/${number}/pay`, { method: 'POST', body: { paymentMethod: order.paymentMethod, idempotencyKey: payKey.current } });
      if (res.redirectUrl) window.location.assign(res.redirectUrl);
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
      payKey.current = idempotencyKey();
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (reason.trim().length < 3) {
      setReasonError(t('validation.required'));
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<OrderDetail>(`/orders/${number}/cancel`, { method: 'POST', body: { reason: reason.trim() } });
      setOrder(res.data);
      setCancelling(false);
      toast.show(res.message, 'success');
    } catch (e) {
      setReasonError(fromApi(e).message);
    } finally {
      setBusy(false);
    }
  };

  const outcomeAlert = paymentOutcome === 'success' || order.paymentStatus === 'paid' ? null : paymentOutcome;

  return (
    <div className="container-page max-w-4xl py-8">
      <Link href="/account/orders" className="text-sm font-semibold text-primary hover:underline">
        ← {t('orders.title')}
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('orders.number', { number: order.number })}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('orders.placedOn', { date: format.dateTime(new Date(order.placedAt), { dateStyle: 'long', timeStyle: 'short' }) })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={ORDER_TONE[order.status] ?? 'neutral'}>{t(`status.order.${order.status}`)}</Badge>
          <Badge tone={PAYMENT_TONE[order.paymentStatus] ?? 'neutral'}>
            {t(`payment.${order.paymentMethod}`)} · {t(`status.payment.${order.paymentStatus}`)}
          </Badge>
        </div>
      </header>

      <div className="mt-5 space-y-3">
        {placed && order.paymentMethod === 'cod' && order.status !== 'cancelled' ? <Alert tone="success">{t('orders.placedCod')}</Alert> : null}
        {paymentOutcome === 'success' && order.paymentStatus === 'paid' ? <Alert tone="success">{t('orders.paymentSuccess')}</Alert> : null}
        {outcomeAlert === 'failed' ? <Alert tone="danger">{t('orders.paymentFailed')}</Alert> : null}
        {outcomeAlert === 'cancelled' ? <Alert tone="warning">{t('orders.paymentCancelled')}</Alert> : null}
        {order.canPay ? (
          <Alert tone="warning">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{order.paymentDueAt ? t('orders.payBy', { time: format.dateTime(new Date(order.paymentDueAt), { timeStyle: 'short', dateStyle: 'medium' }) }) : null}</span>
              <Button size="sm" loading={busy} onClick={payNow}>
                {t('orders.payNow')}
              </Button>
            </div>
          </Alert>
        ) : null}
        {order.status === 'cancelled' && order.cancelReason ? <Alert tone="info">{t('orders.cancelledReason', { reason: order.cancelReason })}</Alert> : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-5">
          {order.sellerOrders.map((so, index) => (
            <section key={so.id} aria-labelledby={`parcel-${so.id}`} className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-subtle/60 px-4 py-3">
                <h2 id={`parcel-${so.id}`} className="text-sm font-semibold text-fg">
                  {t('orders.parcel', { n: index + 1, total: order.sellerOrders.length })} ·{' '}
                  <Link href={`/stores/${so.store.slug}`} className="hover:text-primary hover:underline">
                    {t('orders.from', { store: so.store.name })}
                  </Link>
                </h2>
                <Badge tone={ORDER_TONE[so.status] ?? 'neutral'}>{t(`status.order.${so.status}`)}</Badge>
              </div>
              <ul className="divide-y divide-line">
                {so.items.map((item) => (
                  <li key={item.id} className="flex gap-3 px-4 py-3">
                    <BookCover src={item.imageUrl} title={item.title} className="w-12 shrink-0 rounded-md p-1 text-[8px]" sizes="3rem" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="line-clamp-2 font-medium text-fg">{item.title}</p>
                      <p className="text-xs text-fg-muted">
                        {item.isDigital ? (
                          <Badge tone="secondary" className="mr-1.5">
                            {t('digital.ebook')}
                          </Badge>
                        ) : null}
                        {[!item.isDigital && item.condition ? t(`book.conditions.${item.condition}`) : null, `× ${format.number(item.quantity)}`].filter(Boolean).join(' · ')}
                        {item.refundedQuantity ? ` · ${t('orders.refunded')} ${format.number(item.refundedQuantity)}` : ''}
                      </p>
                      {item.isDigital && item.bookId && order.status !== 'cancelled' && ['paid', 'partially_refunded'].includes(order.paymentStatus) ? (
                        <div className="my-2">
                          <DownloadButton bookId={item.bookId} title={item.title} size="sm" variant="outline" />
                        </div>
                      ) : null}
                      {so.status === 'delivered' && item.path ? (
                        <Link href={`${item.path}?review=1#ratings`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                          <Star className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('reviews.writeForItem')}
                        </Link>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-fg">{formatMoney(item.lineTotal, locale, { hideZeroDecimals: true })}</p>
                  </li>
                ))}
              </ul>
              {so.shipment ? (
                <div className="border-t border-line px-4 py-3">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Truck className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                    <span className="font-semibold text-fg">{t(`couriers.${so.shipment.courier}`)}</span>
                    {so.shipment.trackingNumber ? (
                      <span className="text-fg-muted">
                        {t('orders.trackingNumber')}: <span className="font-mono">{so.shipment.trackingNumber}</span>
                      </span>
                    ) : null}
                    {so.shipment.trackingUrl ? (
                      <a href={so.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                        {t('orders.trackParcel')}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </p>
                  <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
                    {so.shipment.events.map((e, i) => (
                      <li key={i} className="relative text-sm">
                        <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface" aria-hidden="true" />
                        <span className="font-medium text-fg">{t(`status.shipment.${e.status}`)}</span>
                        <span className="ml-2 text-xs text-fg-subtle">{format.dateTime(new Date(e.at), { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        {e.note ? <p className="text-xs text-fg-muted">{e.note}</p> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {so.cancelReason && so.status === 'cancelled' ? <p className="border-t border-line px-4 py-3 text-sm text-fg-muted">{t('orders.cancelledReason', { reason: so.cancelReason })}</p> : null}
              {so.returnableUntil && !order.returns.some((r) => r.sellerOrderId === so.id && ['requested', 'approved', 'received'].includes(r.status)) ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
                  <span className="text-fg-muted">{t('orders.returnableUntil', { date: format.dateTime(new Date(so.returnableUntil), { dateStyle: 'medium' }) })}</span>
                  <Button size="sm" variant="outline" onClick={() => setReturnFor(so)}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {t('orders.requestReturn')}
                  </Button>
                </div>
              ) : null}
            </section>
          ))}

          {order.returns.length ? (
            <section aria-labelledby="returns" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
              <h2 id="returns" className="font-bold text-fg">
                {t('orders.returns')}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {order.returns.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-fg">
                      {t(`orders.reasons.${r.reason}`)}
                      {r.sellerNote ? <span className="block text-xs text-fg-muted">{r.sellerNote}</span> : null}
                    </span>
                    <Badge tone={r.status === 'rejected' ? 'danger' : r.status === 'refunded' ? 'success' : 'warning'}>{t(`status.return.${r.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section aria-labelledby="summary" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <h2 id="summary" className="font-bold text-fg">
              {t('orders.summary')}
            </h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label={t('orders.subtotal')} value={formatMoney(order.totals.itemsSubtotal, locale)} />
              {Number(order.totals.discountTotal) > 0 ? <Row label={order.couponCode ? t('orders.couponUsed', { code: order.couponCode }) : t('orders.discount')} value={`−${formatMoney(order.totals.discountTotal, locale)}`} /> : null}
              <Row label={t('orders.shipping')} value={Number(order.totals.shippingTotal) ? formatMoney(order.totals.shippingTotal, locale) : t('checkout.free')} />
              <div className="flex justify-between border-t border-line pt-2 font-bold">
                <dt>{t('orders.grandTotal')}</dt>
                <dd>{formatMoney(order.totals.grandTotal, locale)}</dd>
              </div>
              {Number(order.totals.refundedTotal) > 0 ? <Row label={t('orders.refunded')} value={formatMoney(order.totals.refundedTotal, locale)} /> : null}
            </dl>
          </section>
          <section aria-labelledby="address" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <h2 id="address" className="mb-2 font-bold text-fg">
              {order.sellerOrders.every((so) => so.items.every((i) => i.isDigital)) ? t('digital.billingAddressTitle') : t('orders.deliveryAddress')}
            </h2>
            <AddressLines address={order.shippingAddress} locale={locale} />
            {order.note ? <p className="mt-3 text-sm text-fg-muted">{t('orders.note')}: {order.note}</p> : null}
          </section>
          {order.refunds.length ? (
            <section aria-labelledby="refunds" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
              <h2 id="refunds" className="mb-2 font-bold text-fg">
                {t('orders.refunds')}
              </h2>
              <ul className="space-y-2 text-sm">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-fg">{formatMoney(r.amount, locale)}</span>
                    <Badge tone={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>{t(`status.refund.${r.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-labelledby="timeline" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <h2 id="timeline" className="mb-3 font-bold text-fg">
              {t('orders.timeline')}
            </h2>
            <ol className="space-y-2.5 text-sm">
              {order.history.map((h, i) => {
                const event = h.note?.split(':')[0] ?? '';
                const Icon = h.status === 'cancelled' ? XCircle : h.status === 'delivered' ? PackageCheck : h.status === 'pending' && !h.note ? CircleDot : CheckCircle2;
                const label = i === 0 && h.status === 'pending' && !h.note ? t('orders.events.placed') : t.has(`orders.events.${event}`) ? t(`orders.events.${event}`) : t(`status.order.${h.status}`);
                return (
                  <li key={i} className="flex gap-2.5">
                    <Icon className={h.status === 'cancelled' ? 'mt-0.5 h-4 w-4 shrink-0 text-danger' : 'mt-0.5 h-4 w-4 shrink-0 text-success'} aria-hidden="true" />
                    <span>
                      <span className="font-medium text-fg">{label}</span>
                      <span className="block text-xs text-fg-subtle">{format.dateTime(new Date(h.at), { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
          {order.canCancel ? (
            <Button variant="outline" className="w-full text-danger" onClick={() => setCancelling(true)}>
              {t('orders.cancel')}
            </Button>
          ) : null}
          <Link href="/books" className={buttonClasses({ variant: 'ghost', className: 'w-full' })}>
            {t('cart.continueShopping')}
          </Link>
        </aside>
      </div>

      <Dialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={t('orders.cancelTitle')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelling(false)}>
              {t('orders.keep')}
            </Button>
            <Button variant="danger" loading={busy} onClick={cancel}>
              {t('orders.cancel')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-fg-muted">{t('orders.cancelHint')}</p>
        <Field label={t('orders.cancelReason')} required error={reasonError}>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />}
        </Field>
      </Dialog>

      {returnFor ? <ReturnDialog number={order.number} parcel={returnFor} onClose={() => setReturnFor(null)} onDone={(message) => (setReturnFor(null), toast.show(message, 'success'), load())} /> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
}

function ReturnDialog({ number, parcel, onClose, onDone }: { number: string; parcel: OrderDetail['sellerOrders'][number]; onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations();
  const { fromApi } = useFormErrors();
  const [reason, setReason] = useState<string>('damaged');
  const [details, setDetails] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(parcel.items.map((i) => [i.id, 0])));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (!items.length) {
      setError(t('validation.required'));
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest(`/orders/${number}/returns`, { method: 'POST', body: { sellerOrderId: parcel.id, reason, details: details.trim() || undefined, items } });
      onDone(res.message);
    } catch (e) {
      setError(fromApi(e).message);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('orders.returnTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={busy} onClick={submit}>
            {t('orders.submitReturn')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ul className="space-y-2">
          {parcel.items.filter((i) => !i.isDigital).map((i) => {
            const max = i.quantity - i.refundedQuantity;
            return (
              <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-fg">{i.title}</span>
                <label className="sr-only" htmlFor={`rq-${i.id}`}>
                  {t('orders.returnQuantity')}
                </label>
                <Select id={`rq-${i.id}`} value={String(quantities[i.id] ?? 0)} onChange={(e) => setQuantities((q) => ({ ...q, [i.id]: Number(e.target.value) }))} className="h-9 w-20" disabled={max <= 0}>
                  {Array.from({ length: max + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </li>
            );
          })}
        </ul>
        <Field label={t('orders.returnReason')}>
          {(p) => (
            <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`orders.reasons.${r}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('orders.returnDetails')}>{(p) => <Textarea {...p} value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} />}</Field>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Dialog>
  );
}
