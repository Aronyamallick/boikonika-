'use client';

import { formatMoney, PAYOUT_METHODS } from '@boikonika/shared';
import { Landmark, Plus, Smartphone, Trash2, Wallet } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface Summary {
  available: string;
  pending: string;
  inTransfer: string;
  paid: string;
  minimum: string;
  holdDays: number;
  payouts: Array<{ id: string; amount: string; status: string; reference: string | null; note: string | null; periodStart: string; periodEnd: string; paidAt: string | null; createdAt: string }>;
  accounts: Array<{ id: string; method: string; accountName: string; last4: string; bankName: string | null; branchName: string | null; isDefault: boolean }>;
}

export function PayoutsView() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ method: 'bkash', accountName: '', accountNumber: '', bankName: '', branchName: '', routingNumber: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api<Summary>('/seller/payouts').then(setData, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <ErrorState title={t('common.errorTitle')} retryLabel={t('common.retry')} onRetry={load} />;
  if (!data) return <Skeleton className="h-80 w-full" />;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await apiRequest('/seller/payout-accounts', { method: 'POST', body: { ...form, bankName: form.bankName || undefined, branchName: form.branchName || undefined, routingNumber: form.routingNumber || undefined } });
      toast.show(res.message, 'success');
      setAdding(false);
      setForm({ method: 'bkash', accountName: '', accountNumber: '', bankName: '', branchName: '', routingNumber: '' });
      load();
    } catch (err) {
      setErrors(fromApi(err).fields);
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    { label: t('payouts.available'), value: data.available, tone: 'text-success-text' },
    { label: t('payouts.pending'), value: data.pending, tone: 'text-fg' },
    { label: t('payouts.inTransfer'), value: data.inTransfer, tone: 'text-fg' },
    { label: t('payouts.paid'), value: data.paid, tone: 'text-fg' },
  ];
  const bank = form.method === 'bank';

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-fg">{t('payouts.title')}</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <p className="text-sm text-fg-muted">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{formatMoney(c.value, locale)}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-fg-muted">{t('payouts.holdNote', { days: format.number(data.holdDays), minimum: formatMoney(data.minimum, locale, { hideZeroDecimals: true }).slice(1) })}</p>

      <section aria-labelledby="accounts" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="accounts" className="text-lg font-bold text-fg">
            {t('payouts.accounts')}
          </h2>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('payouts.addAccount')}
          </Button>
        </div>
        {data.accounts.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('payouts.noAccounts')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3 text-sm">
                  {a.method === 'bank' ? <Landmark className="h-5 w-5 text-fg-subtle" aria-hidden="true" /> : <Smartphone className="h-5 w-5 text-fg-subtle" aria-hidden="true" />}
                  <span>
                    <span className="font-semibold text-fg">{t(`payouts.methods.${a.method}`)}</span> · {a.accountName} · •••• {a.last4}
                    {a.bankName ? <span className="block text-xs text-fg-muted">{[a.bankName, a.branchName].filter(Boolean).join(', ')}</span> : null}
                  </span>
                  {a.isDefault ? <Badge tone="primary">{t('payouts.default')}</Badge> : null}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  aria-label={`${t('common.remove')} ${t(`payouts.methods.${a.method}`)} ${a.last4}`}
                  onClick={async () => {
                    try {
                      await api(`/seller/payout-accounts/${a.id}`, { method: 'DELETE' });
                      load();
                    } catch (e) {
                      toast.show(fromApi(e).message, 'danger');
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="history" className="mb-4 text-lg font-bold text-fg">
          {t('payouts.history')}
        </h2>
        {data.payouts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Wallet className="h-4 w-4" aria-hidden="true" />
            {t('payouts.noPayouts')}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {data.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-bold text-fg">{formatMoney(p.amount, locale)}</span>
                  <span className="block text-xs text-fg-muted">
                    {t('payouts.period', { from: format.dateTime(new Date(p.periodStart), { dateStyle: 'medium' }), to: format.dateTime(new Date(p.periodEnd), { dateStyle: 'medium' }) })}
                    {p.reference ? ` · ${t('payouts.reference', { reference: p.reference })}` : ''}
                  </span>
                </span>
                <Badge tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>{t(`status.payout.${p.status}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t('payouts.addAccount')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="payout-account" loading={busy}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="payout-account" onSubmit={save} noValidate className="space-y-4">
          <Field label={t('payouts.method')}>
            {(p) => (
              <Select {...p} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
                {PAYOUT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`payouts.methods.${m}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('payouts.accountName')} required error={errors.accountName}>
            {(p) => <Input {...p} value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} maxLength={160} autoComplete="name" />}
          </Field>
          <Field label={t('payouts.accountNumber')} required error={errors.accountNumber}>
            {(p) => <Input {...p} value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} inputMode="numeric" maxLength={34} autoComplete="off" placeholder={bank ? '' : '01XXXXXXXXX'} />}
          </Field>
          {bank ? (
            <>
              <Field label={t('payouts.bankName')} required error={errors.bankName}>
                {(p) => <Input {...p} value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} maxLength={120} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('payouts.branchName')} error={errors.branchName}>
                  {(p) => <Input {...p} value={form.branchName} onChange={(e) => setForm((f) => ({ ...f, branchName: e.target.value }))} maxLength={120} />}
                </Field>
                <Field label={t('payouts.routingNumber')} error={errors.routingNumber}>
                  {(p) => <Input {...p} value={form.routingNumber} onChange={(e) => setForm((f) => ({ ...f, routingNumber: e.target.value }))} inputMode="numeric" maxLength={9} />}
                </Field>
              </div>
            </>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
