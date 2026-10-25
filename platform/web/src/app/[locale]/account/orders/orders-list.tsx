'use client';

import { formatMoney } from '@boikonika/shared';
import { Package } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Button, buttonClasses } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { ORDER_TONE, PAYMENT_TONE, type OrderSummary } from '@/lib/commerce';

const PAGE_SIZE = 10;

export function OrdersList() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    apiRequest<OrderSummary[]>('/orders', { query: { page, pageSize: PAGE_SIZE } }).then(
      (res) => {
        setOrders((current) => (page === 1 ? res.data : [...(current ?? []), ...res.data]));
        setTotal(res.meta?.total ?? 0);
      },
      () => setFailed(true),
    );
  }, [page]);

  return (
    <div className="container-page max-w-4xl py-8">
      <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('orders.title')}</h1>
      <div className="mt-6">
        {failed ? (
          <ErrorState title={t('common.errorTitle')} text={t('common.errorText')} retryLabel={t('common.retry')} onRetry={() => setPage((p) => p)} />
        ) : orders === null ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={t('orders.empty')}
            text={t('orders.emptyText')}
            action={
              <Link href="/books" className={buttonClasses()}>
                {t('cart.continueShopping')}
              </Link>
            }
          />
        ) : (
          <ul className="space-y-4">
            {orders.map((o) => (
              <li key={o.id} className="group relative rounded-xl border border-line bg-surface p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-fg">
                      <Link href={`/account/orders/${o.number}`} className="after:absolute after:inset-0 after:rounded-xl group-focus-within:underline">
                        {t('orders.number', { number: o.number })}
                      </Link>
                    </h2>
                    <p className="text-sm text-fg-muted">{t('orders.placedOn', { date: format.dateTime(new Date(o.placedAt), { dateStyle: 'medium' }) })}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={ORDER_TONE[o.status] ?? 'neutral'}>{t(`status.order.${o.status}`)}</Badge>
                    {o.paymentMethod !== 'cod' || o.paymentStatus !== 'pending' ? <Badge tone={PAYMENT_TONE[o.paymentStatus] ?? 'neutral'}>{t(`status.payment.${o.paymentStatus}`)}</Badge> : null}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex -space-x-3">
                    {o.preview.map((p, i) => (
                      <BookCover key={i} src={p.imageUrl} title={p.title} className="w-11 rounded-md p-1 text-[7px] ring-2 ring-surface" sizes="2.75rem" />
                    ))}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-fg-muted">{t('cart.itemCount', { count: o.itemCount })}</p>
                    <p className="font-bold text-fg">{formatMoney(o.grandTotal, locale)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {orders && orders.length < total ? (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
              {t('common.seeMore')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
