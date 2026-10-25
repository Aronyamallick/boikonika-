'use client';

import { formatMoney, REFUND_STATUSES } from '@boikonika/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';

interface Row {
  id: string;
  amount: string;
  status: string;
  reason: string;
  method: string;
  reference: string | null;
  failureReason: string | null;
  orderNumber: string;
  provider: string | null;
  paymentMethod: string | null;
  customer: { name: string; phone: string | null };
  createdAt: string;
}

export default function AdminRefundsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [status, setStatus] = useState<string>('processing');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [completing, setCompleting] = useState<Row | null>(null);
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    apiRequest<Row[]>('/admin/refunds', { query: { status: status || undefined, page, pageSize: 25 } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [status, page]);
  useEffect(load, [load]);

  const act = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await apiRequest(path, { method: 'POST', body });
      toast.show(res.message, 'success');
      setCompleting(null);
      setReference('');
      load();
    } catch (e) {
      setError(fromApi(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequirePermission permission="orders.refund">
      <h1 className="text-2xl font-bold">{t('adminRefunds.title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('adminRefunds.text')}</p>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t('common.filter')}>
        {[...REFUND_STATUSES, ''].map((s) => (
          <button key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => (setStatus(s), setPage(1))} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', status === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
            {s ? t(`status.refund.${s}`) : t('common.all')}
          </button>
        ))}
      </div>
      {!rows ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title={t('adminRefunds.empty')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-4 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-fg">{formatMoney(r.amount, locale)}</p>
                <p className="text-fg-muted">
                  <Link href={`/admin/orders/${r.orderNumber}`} className="font-mono text-primary hover:underline">
                    {r.orderNumber}
                  </Link>{' '}
                  · {r.customer.name}
                  {r.customer.phone ? ` · ${r.customer.phone}` : ''} · {r.paymentMethod ? t(`payment.${r.paymentMethod}`) : '—'}
                </p>
                <p className="text-xs text-fg-subtle">
                  {r.reason} · {format.dateTime(new Date(r.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                  {r.reference ? ` · ${r.reference}` : ''}
                  {r.failureReason && r.status === 'failed' ? ` · ${r.failureReason}` : ''}
                </p>
              </div>
              <Badge tone={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>{t(`status.refund.${r.status}`)}</Badge>
              {r.status === 'processing' && (r.provider === 'cod' || !r.provider) ? (
                <Button size="sm" onClick={() => (setCompleting(r), setError(null))}>
                  {t('adminRefunds.complete')}
                </Button>
              ) : null}
              {r.status === 'failed' ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(`/admin/refunds/${r.id}/retry`, {})}>
                  {t('adminRefunds.retry')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <AdminPager page={page} total={total} pageSize={25} onPage={setPage} />
      <Dialog
        open={!!completing}
        onClose={() => setCompleting(null)}
        title={t('adminRefunds.complete')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCompleting(null)}>
              {t('common.cancel')}
            </Button>
            <Button loading={busy} disabled={reference.trim().length < 3} onClick={() => completing && act(`/admin/refunds/${completing.id}/complete`, { reference: reference.trim() })}>
              {t('adminRefunds.complete')}
            </Button>
          </>
        }
      >
        {completing ? <p className="mb-3 text-sm text-fg-muted">{formatMoney(completing.amount, locale)} · {completing.customer.name} · {completing.customer.phone}</p> : null}
        <Field label={t('adminRefunds.reference')} required error={error}>
          {(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className="font-mono" />}
        </Field>
      </Dialog>
    </RequirePermission>
  );
}
