'use client';

import { formatMoney } from '@boikonika/shared';
import { FlaskConical } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/forms/errors';

type Outcome = 'success' | 'failure' | 'cancel';

export function SandboxPayment({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { fromApi } = useFormErrors();
  const [payment, setPayment] = useState<{ amount: string; status: string; orderNumber: string } | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ amount: string; status: string; orderNumber: string }>(`/payments/sandbox/${id}`).then(setPayment, () => setMissing(true));
  }, [id]);

  const finish = async (outcome: Outcome) => {
    setBusy(outcome);
    try {
      const res = await api<{ status: string; orderNumber: string }>(`/payments/sandbox/${id}/complete`, { method: 'POST', body: { outcome } });
      const result = res.status === 'paid' ? 'success' : outcome === 'cancel' ? 'cancelled' : 'failed';
      router.replace(`/account/orders/${res.orderNumber}?payment=${result}`);
    } catch (e) {
      setError(fromApi(e).message);
      setBusy(null);
    }
  };

  if (missing) return <div className="container-page py-10"><ErrorState title={t('common.notFoundTitle')} text={t('common.notFoundText')} /></div>;
  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-md">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-fg" aria-hidden="true">
            <FlaskConical className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-bold text-fg">{t('sandboxPay.title')}</h1>
        </div>
        <Alert tone="warning" className="mt-4">
          {t('sandboxPay.text')}
        </Alert>
        {!payment ? (
          <Skeleton className="mt-5 h-20 w-full" />
        ) : (
          <>
            <dl className="mt-5 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">{t('sandboxPay.order', { number: payment.orderNumber })}</dt>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <dt>{t('sandboxPay.amount')}</dt>
                <dd>{formatMoney(payment.amount, locale)}</dd>
              </div>
            </dl>
            {error ? (
              <Alert tone="danger" className="mt-4">
                {error}
              </Alert>
            ) : null}
            <div className="mt-6 grid gap-2">
              <Button size="lg" loading={busy === 'success'} disabled={!!busy || payment.status !== 'pending'} onClick={() => finish('success')}>
                {t('sandboxPay.pay')}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" loading={busy === 'failure'} disabled={!!busy || payment.status !== 'pending'} onClick={() => finish('failure')}>
                  {t('sandboxPay.decline')}
                </Button>
                <Button variant="ghost" loading={busy === 'cancel'} disabled={!!busy || payment.status !== 'pending'} onClick={() => finish('cancel')}>
                  {t('sandboxPay.cancel')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
