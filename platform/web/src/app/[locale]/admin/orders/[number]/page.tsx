'use client';

import { formatMoney } from '@boikonika/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { AddressLines } from '@/components/commerce/address-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { ORDER_TONE, PAYMENT_TONE, type OrderDetail } from '@/lib/commerce';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

export default function AdminOrderPage() {
  const { number } = useParams<{ number: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { can } = useAuth();
  const { fromApi } = useFormErrors();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState<'refund' | 'cancel' | null>(null);
  const [form, setForm] = useState({ amount: '', sellerOrderId: '', reason: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<OrderDetail>(`/admin/orders/${number}`).then(setOrder, () => setFailed(true));
  }, [number]);
  useEffect(load, [load]);

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const res =
        dialog === 'refund'
          ? await apiRequest(`/admin/orders/${number}/refunds`, { method: 'POST', body: { amount: form.amount, sellerOrderId: form.sellerOrderId || undefined, reason: form.reason } })
          : await apiRequest(`/admin/orders/${number}/cancel`, { method: 'POST', body: { reason: form.reason } });
      toast.show(res.message, 'success');
      setDialog(null);
      setForm({ amount: '', sellerOrderId: '', reason: '' });
      load();
    } catch (e) {
      const { fields, message } = fromApi(e);
      setErrors(Object.keys(fields).length ? fields : { reason: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequirePermission permission="orders.view">
      {failed ? (
        <ErrorState title={t('common.notFoundTitle')} />
      ) : !order ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="space-y-5">
          <Link href="/admin/orders" className="text-sm font-semibold text-primary hover:underline">
            ← {t('adminOrders.title')}
          </Link>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-mono text-2xl font-bold">{order.number}</h1>
              <p className="text-sm text-fg-muted">{format.dateTime(new Date(order.placedAt), { dateStyle: 'long', timeStyle: 'short' })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={ORDER_TONE[order.status] ?? 'neutral'}>{t(`status.order.${order.status}`)}</Badge>
              <Badge tone={PAYMENT_TONE[order.paymentStatus] ?? 'neutral'}>
                {t(`payment.${order.paymentMethod}`)} · {t(`status.payment.${order.paymentStatus}`)}
              </Badge>
            </div>
          </header>
          <div className="flex flex-wrap gap-2">
            {can('orders.refund') && (order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded') ? (
              <Button variant="outline" onClick={() => setDialog('refund')}>
                {t('adminOrders.refund')}
              </Button>
            ) : null}
            {can('orders.manage') && order.status !== 'cancelled' && order.sellerOrders.every((s) => ['pending', 'confirmed', 'processing', 'cancelled'].includes(s.status)) ? (
              <Button variant="ghost" className="text-danger" onClick={() => setDialog('cancel')}>
                {t('adminOrders.cancel')}
              </Button>
            ) : null}
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-4">
              {order.sellerOrders.map((so) => (
                <section key={so.id} className="rounded-xl border border-line bg-surface">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-sm">
                    <span className="font-semibold">
                      <span className="font-mono">{so.number}</span> · {so.store.name}
                    </span>
                    <Badge tone={ORDER_TONE[so.status] ?? 'neutral'}>{t(`status.order.${so.status}`)}</Badge>
                  </div>
                  <ul className="divide-y divide-line text-sm">
                    {so.items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-3 px-4 py-2">
                        <span className="min-w-0 truncate">
                          {i.title} × {format.number(i.quantity)}
                        </span>
                        <span className="shrink-0">{formatMoney(i.lineTotal, locale)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-line px-4 py-2 text-right text-sm font-semibold">{formatMoney(so.total, locale)}</p>
                </section>
              ))}
            </div>
            <aside className="space-y-4">
              <section className="rounded-xl border border-line bg-surface p-4">
                <AddressLines address={order.shippingAddress} locale={locale} />
              </section>
              <section className="rounded-xl border border-line bg-surface p-4 text-sm">
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">{t('orders.grandTotal')}</dt>
                    <dd className="font-bold">{formatMoney(order.totals.grandTotal, locale)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">{t('orders.refunded')}</dt>
                    <dd>{formatMoney(order.totals.refundedTotal, locale)}</dd>
                  </div>
                </dl>
                {order.refunds.length ? (
                  <ul className="mt-3 space-y-1 border-t border-line pt-3">
                    {order.refunds.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span>{formatMoney(r.amount, locale)}</span>
                        <span className="text-fg-muted">{t(`status.refund.${r.status}`)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            </aside>
          </div>
          <Dialog
            open={!!dialog}
            onClose={() => setDialog(null)}
            title={dialog === 'refund' ? t('adminOrders.refundTitle') : t('adminOrders.cancel')}
            closeLabel={t('common.close')}
            footer={
              <>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="danger" loading={busy} onClick={submit}>
                  {dialog === 'refund' ? t('adminOrders.refund') : t('adminOrders.cancel')}
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              {dialog === 'refund' ? (
                <>
                  <Field label={t('adminOrders.amount')} required error={errors.amount}>
                    {(p) => <Input {...p} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} inputMode="decimal" />}
                  </Field>
                  <Field label={t('adminOrders.parcel')}>
                    {(p) => (
                      <Select {...p} value={form.sellerOrderId} onChange={(e) => setForm((f) => ({ ...f, sellerOrderId: e.target.value }))}>
                        <option value="">{t('adminOrders.wholeOrder')}</option>
                        {order.sellerOrders.map((so) => (
                          <option key={so.id} value={so.id}>
                            {so.number} · {so.store.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </>
              ) : null}
              <Field label={t('adminOrders.reason')} required error={errors.reason}>
                {(p) => <Textarea {...p} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} maxLength={500} />}
              </Field>
            </div>
          </Dialog>
        </div>
      )}
    </RequirePermission>
  );
}
