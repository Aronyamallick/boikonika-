'use client';

import { formatMoney, PAYOUT_STATUSES } from '@boikonika/shared';
import { Eye } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';

interface Eligible {
  sellerId: string;
  store: { name: string; slug: string };
  amount: string;
  orders: number;
  payoutMethod: string | null;
  meetsMinimum: boolean;
}
interface Payout {
  id: string;
  store: string;
  amount: string;
  status: string;
  reference: string | null;
  note: string | null;
  account: { method: string; name: string; last4: string; bankName: string | null } | null;
  createdAt: string;
  paidAt: string | null;
}
interface Account {
  method: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  branchName: string | null;
  routingNumber: string | null;
}

export default function AdminPayoutsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { can } = useAuth();
  const { fromApi } = useFormErrors();
  const [eligible, setEligible] = useState<Eligible[] | null>(null);
  const [rows, setRows] = useState<Payout[] | null>(null);
  const [status, setStatus] = useState('processing');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [closing, setClosing] = useState<{ payout: Payout; as: 'paid' | 'failed' } | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Eligible[]>('/admin/payouts/eligible').then(setEligible, () => setEligible([]));
    apiRequest<Payout[]>('/admin/payouts', { query: { status: status || undefined, page, pageSize: 25 } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [status, page]);
  useEffect(load, [load]);

  const run = async (task: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      const res = await task();
      toast.show(res.message, 'success');
      setClosing(null);
      setText('');
      load();
    } catch (e) {
      const message = fromApi(e).message;
      if (closing) setError(message);
      else toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequirePermission permission="payouts.view">
      <h1 className="mb-4 text-2xl font-bold">{t('adminPayouts.title')}</h1>
      <section aria-labelledby="eligible" className="mb-8">
        <h2 id="eligible" className="mb-3 text-lg font-bold">
          {t('adminPayouts.eligible')}
        </h2>
        {!eligible ? (
          <Skeleton className="h-24 w-full" />
        ) : eligible.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('adminPayouts.noneEligible')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {eligible.map((e) => (
              <li key={e.sellerId} className="flex flex-wrap items-center gap-4 p-4 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-fg">{e.store.name}</span>
                  <span className="block text-fg-muted">
                    {t('adminPayouts.orders', { count: e.orders })} · {e.payoutMethod ? t(`payouts.methods.${e.payoutMethod}`) : '—'}
                  </span>
                </span>
                <span className="font-bold text-fg">{formatMoney(e.amount, locale)}</span>
                {e.meetsMinimum ? (
                  can('payouts.manage') ? (
                    <Button size="sm" disabled={busy} onClick={() => run(() => apiRequest('/admin/payouts', { method: 'POST', body: { sellerId: e.sellerId } }))}>
                      {t('adminPayouts.create')}
                    </Button>
                  ) : null
                ) : (
                  <Badge tone="neutral">{t('adminPayouts.belowMinimum')}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history">
        <h2 id="history" className="mb-3 text-lg font-bold">
          {t('adminPayouts.history')}
        </h2>
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t('common.filter')}>
          {[...PAYOUT_STATUSES, ''].map((s) => (
            <button key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => (setStatus(s), setPage(1))} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', status === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
              {s ? t(`status.payout.${s}`) : t('common.all')}
            </button>
          ))}
        </div>
        {!rows ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {rows.map((p) => {
              const revealed = accounts[p.id];
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-4 p-4 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-fg">{p.store}</span> · <span className="font-bold">{formatMoney(p.amount, locale)}</span>
                    <span className="block text-fg-muted">
                      {p.account ? `${t(`payouts.methods.${p.account.method}`)} · ${p.account.name} · ${revealed ? revealed.accountNumber : `•••• ${p.account.last4}`}${p.account.bankName ? ` · ${p.account.bankName}` : ''}${revealed?.routingNumber ? ` · ${revealed.routingNumber}` : ''}` : '—'}
                    </span>
                    <span className="block text-xs text-fg-subtle">
                      {format.dateTime(new Date(p.createdAt), { dateStyle: 'medium' })}
                      {p.reference ? ` · ${p.reference}` : ''}
                      {p.note ? ` · ${p.note}` : ''}
                    </span>
                  </span>
                  <Badge tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>{t(`status.payout.${p.status}`)}</Badge>
                  {can('payouts.manage') && p.status === 'processing' ? (
                    <span className="flex flex-wrap gap-2">
                      {!revealed && p.account ? (
                        <Button size="sm" variant="ghost" onClick={() => api<Account>(`/admin/payouts/${p.id}/account`).then((a) => setAccounts((m) => ({ ...m, [p.id]: a })), (e) => toast.show(fromApi(e).message, 'danger'))}>
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          {t('adminPayouts.reveal')}
                        </Button>
                      ) : null}
                      <Button size="sm" onClick={() => (setClosing({ payout: p, as: 'paid' }), setError(null), setText(''))}>
                        {t('adminPayouts.markPaid')}
                      </Button>
                      <Button size="sm" variant="outline" className="text-danger" onClick={() => (setClosing({ payout: p, as: 'failed' }), setError(null), setText(''))}>
                        {t('adminPayouts.markFailed')}
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <AdminPager page={page} total={total} pageSize={25} onPage={setPage} />
      </section>

      <Dialog
        open={!!closing}
        onClose={() => setClosing(null)}
        title={closing?.as === 'paid' ? t('adminPayouts.markPaid') : t('adminPayouts.markFailed')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setClosing(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={closing?.as === 'failed' ? 'danger' : 'primary'}
              loading={busy}
              disabled={text.trim().length < 3}
              onClick={() => closing && run(() => apiRequest(`/admin/payouts/${closing.payout.id}/${closing.as}`, { method: 'POST', body: closing.as === 'paid' ? { reference: text.trim() } : { note: text.trim() } }))}
            >
              {closing?.as === 'paid' ? t('adminPayouts.markPaid') : t('adminPayouts.markFailed')}
            </Button>
          </>
        }
      >
        <Field label={closing?.as === 'paid' ? t('adminPayouts.reference') : t('adminPayouts.note')} required error={error}>
          {(p) => <Input {...p} value={text} onChange={(e) => setText(e.target.value)} maxLength={closing?.as === 'paid' ? 120 : 500} />}
        </Field>
      </Dialog>
    </RequirePermission>
  );
}
