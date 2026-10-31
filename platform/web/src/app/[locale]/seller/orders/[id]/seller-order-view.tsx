'use client';

import { COURIERS, formatMoney } from '@boikonika/shared';
import { Printer } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AddressLines } from '@/components/commerce/address-form';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest, ApiError } from '@/lib/api/client';
import { ORDER_TONE, type OrderItem } from '@/lib/commerce';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface SellerOrder {
  id: string;
  number: string;
  orderNumber: string;
  status: string;
  allowed: string[];
  paymentMethod: string;
  paymentStatus: string;
  collectOnDelivery: string;
  totals: { itemsSubtotal: string; discountTotal: string; shippingFee: string; total: string; commissionPercent: string; commission: string; earning: string; refunded: string };
  shippingAddress: { recipientName: string; phone: string; addressLine: string; area: string; upazila: string; union?: string | null; district: string; division: string; postcode?: string | null };
  note: string | null;
  placedAt: string;
  shipment: { courier: string; trackingNumber: string | null; trackingUrl: string | null; status: string } | null;
  items: Array<OrderItem & { sku: string }>;
  history: Array<{ from: string | null; to: string; note: string | null; actorRole: string | null; at: string }>;
  returns: Array<{ id: string; status: string; reason: string; details: string | null; sellerNote: string | null; items: Array<{ orderItemId: string; quantity: number }>; createdAt: string }>;
}

export function SellerOrderView({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [order, setOrder] = useState<SellerOrder | null>(null);
  const [failed, setFailed] = useState<'missing' | 'error' | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [form, setForm] = useState({ courier: 'manual', trackingNumber: '', trackingUrl: '', note: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [decline, setDecline] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState('');
  const [restock, setRestock] = useState(true);

  const load = useCallback(() => {
    api<SellerOrder>(`/seller/orders/${id}`).then(setOrder, (e) => setFailed(e instanceof ApiError && e.status === 404 ? 'missing' : 'error'));
  }, [id]);
  useEffect(load, [load]);

  if (failed) return failed === 'missing' ? <ErrorState title={t('common.notFoundTitle')} text={t('common.notFoundText')} /> : <ErrorState title={t('common.errorTitle')} retryLabel={t('common.retry')} onRetry={load} />;
  if (!order) return <Skeleton className="h-96 w-full" />;

  const needsForm = (status: string) => status === 'shipped' || status === 'cancelled';
  const submit = async (status: string) => {
    setBusy(true);
    setErrors({});
    try {
      const body =
        status === 'shipped'
          ? { status, courier: form.courier, trackingNumber: form.trackingNumber.trim() || undefined, trackingUrl: form.trackingUrl.trim() || undefined, note: form.note.trim() || undefined }
          : { status, note: form.note.trim() || undefined };
      const res = await apiRequest<SellerOrder>(`/seller/orders/${id}/status`, { method: 'POST', body });
      setOrder(res.data);
      setAction(null);
      setForm({ courier: 'manual', trackingNumber: '', trackingUrl: '', note: '' });
      toast.show(res.message, 'success');
    } catch (e) {
      const { fields, message } = fromApi(e);
      setErrors(fields);
      if (!Object.keys(fields).length) toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const returnAction = async (returnId: string, path: 'decision' | 'received', body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await apiRequest(`/seller/returns/${returnId}/${path}`, { method: 'POST', body });
      toast.show(res.message, 'success');
      setDecline(null);
      load();
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const itemTitle = (orderItemId: string) => order.items.find((i) => i.id === orderItemId)?.title ?? '';

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/seller/orders" className="text-sm font-semibold text-primary hover:underline print:hidden">
        ← {t('sellerOrders.title')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-fg">{order.number}</h1>
          <p className="text-sm text-fg-muted">{format.dateTime(new Date(order.placedAt), { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ORDER_TONE[order.status] ?? 'neutral'}>{t(`status.order.${order.status}`)}</Badge>
          <Badge tone={order.paymentMethod === 'cod' ? 'warning' : 'success'}>{order.paymentMethod === 'cod' ? t('sellerOrders.collect', { amount: formatMoney(order.collectOnDelivery, locale) }) : t('sellerOrders.prepaid')}</Badge>
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            {t('sellerOrders.packingSlip')}
          </Button>
        </div>
      </header>

      {order.allowed.length ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-surface p-4 print:hidden">
          {order.allowed.map((status) => (
            <Button key={status} variant={status === 'cancelled' ? 'ghost' : 'primary'} className={status === 'cancelled' ? 'text-danger' : undefined} loading={busy && action === status} onClick={() => (needsForm(status) ? setAction(status) : (setAction(status), submit(status)))}>
              {t(`sellerOrders.actions.${status}`)}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
        <section aria-labelledby="items" className="self-start overflow-hidden rounded-xl border border-line bg-surface">
          <h2 id="items" className="border-b border-line px-4 py-3 font-bold text-fg">
            {t('sellerOrders.items')}
          </h2>
          <ul className="divide-y divide-line">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-3 px-4 py-3">
                <BookCover src={i.imageUrl} title={i.title} className="w-12 shrink-0 rounded-md p-1 text-[8px] print:hidden" sizes="3rem" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-fg">{i.title}</p>
                  <p className="text-xs text-fg-muted">
                    <span className="font-mono">{i.sku}</span>
                    {i.condition ? ` · ${t(`book.conditions.${i.condition}`)}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm">
                  <span className="font-bold text-fg">× {format.number(i.quantity)}</span>
                  <span className="block text-right text-xs text-fg-muted">{formatMoney(i.lineTotal, locale, { hideZeroDecimals: true })}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-5">
          <section aria-labelledby="customer" className="rounded-xl border border-line bg-surface p-4">
            <h2 id="customer" className="mb-2 font-bold text-fg">
              {t('sellerOrders.customer')}
            </h2>
            <AddressLines address={order.shippingAddress} locale={locale} />
            {order.note ? (
              <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-sm text-fg">
                <span className="font-semibold">{t('sellerOrders.customerNote')}:</span> {order.note}
              </p>
            ) : null}
          </section>
          <section aria-labelledby="earnings" className="rounded-xl border border-line bg-surface p-4 print:hidden">
            <h2 id="earnings" className="mb-2 font-bold text-fg">
              {t('sellerOrders.earnings')}
            </h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">{t('sellerOrders.total')}</dt>
                <dd>{formatMoney(order.totals.total, locale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">{t('sellerOrders.commission', { percent: format.number(Number(order.totals.commissionPercent)) })}</dt>
                <dd>−{formatMoney(order.totals.commission, locale)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-bold text-success-text">
                <dt>{t('sellerOrders.earning')}</dt>
                <dd>{formatMoney(order.totals.earning, locale)}</dd>
              </div>
            </dl>
          </section>
          {order.shipment ? (
            <section className="rounded-xl border border-line bg-surface p-4 text-sm">
              <p className="font-bold text-fg">{t(`couriers.${order.shipment.courier}`)}</p>
              {order.shipment.trackingNumber ? <p className="font-mono text-fg-muted">{order.shipment.trackingNumber}</p> : null}
              <p className="mt-1 text-fg-muted">{t(`status.shipment.${order.shipment.status}`)}</p>
            </section>
          ) : null}
        </div>
      </div>

      {order.returns.length ? (
        <section aria-labelledby="returns" className="rounded-xl border border-line bg-surface p-4 print:hidden">
          <h2 id="returns" className="mb-3 font-bold text-fg">
            {t('sellerOrders.returns')}
          </h2>
          <ul className="space-y-4">
            {order.returns.map((r) => (
              <li key={r.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-fg">{t(`orders.reasons.${r.reason}`)}</span>
                  <Badge tone={r.status === 'rejected' ? 'danger' : r.status === 'refunded' ? 'success' : 'warning'}>{t(`status.return.${r.status}`)}</Badge>
                </div>
                {r.details ? <p className="mt-1 text-fg-muted">{r.details}</p> : null}
                <ul className="mt-2 list-inside list-disc text-fg-muted">
                  {r.items.map((i) => (
                    <li key={i.orderItemId}>
                      {itemTitle(i.orderItemId)} × {format.number(i.quantity)}
                    </li>
                  ))}
                </ul>
                {r.status === 'requested' ? (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => returnAction(r.id, 'decision', { approve: true })}>
                      {t('sellerOrders.approve')}
                    </Button>
                    <Button size="sm" variant="outline" className="text-danger" disabled={busy} onClick={() => (setDecline(r.id), setDeclineNote(''))}>
                      {t('sellerOrders.reject')}
                    </Button>
                  </div>
                ) : r.status === 'approved' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Checkbox checked={restock} onChange={(e) => setRestock(e.target.checked)} label={t('sellerOrders.restock')} />
                    <Button size="sm" disabled={busy} onClick={() => returnAction(r.id, 'received', { restock })}>
                      {t('sellerOrders.markReceived')}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="history" className="rounded-xl border border-line bg-surface p-4 print:hidden">
        <h2 id="history" className="mb-3 font-bold text-fg">
          {t('sellerOrders.history')}
        </h2>
        <ol className="space-y-2 text-sm">
          {order.history.map((h, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2">
              <span className="text-fg">
                {t(`status.order.${h.to}`)}
                {h.note ? <span className="text-fg-muted"> — {h.note}</span> : null}
              </span>
              <span className="text-xs text-fg-subtle">{format.dateTime(new Date(h.at), { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </li>
          ))}
        </ol>
      </section>

      <Dialog
        open={action === 'shipped' || action === 'cancelled'}
        onClose={() => setAction(null)}
        title={action === 'shipped' ? t('sellerOrders.shipTitle') : t('sellerOrders.cancelTitle')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant={action === 'cancelled' ? 'danger' : 'primary'} loading={busy} onClick={() => action && submit(action)}>
              {action ? t(`sellerOrders.actions.${action}`) : ''}
            </Button>
          </>
        }
      >
        {action === 'shipped' ? (
          <div className="space-y-4">
            <Field label={t('orders.courier')} error={errors.courier}>
              {(p) => (
                <Select {...p} value={form.courier} onChange={(e) => setForm((f) => ({ ...f, courier: e.target.value }))}>
                  {COURIERS.map((c) => (
                    <option key={c} value={c}>
                      {t(`couriers.${c}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('orders.trackingNumber')} error={errors.trackingNumber}>
              {(p) => <Input {...p} value={form.trackingNumber} onChange={(e) => setForm((f) => ({ ...f, trackingNumber: e.target.value }))} className="font-mono" maxLength={80} />}
            </Field>
            <Field label={t('sellerOrders.trackingUrl')} error={errors.trackingUrl}>
              {(p) => <Input {...p} value={form.trackingUrl} onChange={(e) => setForm((f) => ({ ...f, trackingUrl: e.target.value }))} type="url" placeholder="https://" maxLength={500} />}
            </Field>
            <Field label={t('sellerOrders.note')}>{(p) => <Input {...p} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} maxLength={500} />}</Field>
          </div>
        ) : (
          <Field label={t('sellerOrders.cancelReason')} required error={errors.note}>
            {(p) => <Textarea {...p} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} maxLength={500} />}
          </Field>
        )}
      </Dialog>

      <Dialog
        open={!!decline}
        onClose={() => setDecline(null)}
        title={t('sellerOrders.reject')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDecline(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={busy} disabled={declineNote.trim().length < 5} onClick={() => decline && returnAction(decline, 'decision', { approve: false, note: declineNote.trim() })}>
              {t('sellerOrders.reject')}
            </Button>
          </>
        }
      >
        <Field label={t('sellerOrders.rejectReason')} required hint={t('validation.reasonRequired')}>
          {(p) => <Textarea {...p} value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} rows={3} maxLength={500} />}
        </Field>
      </Dialog>
    </div>
  );
}
