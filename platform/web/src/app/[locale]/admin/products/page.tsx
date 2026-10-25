'use client';

import { formatMoney, PRODUCT_STATUSES, type ProductStatus } from '@boikonika/shared';
import { Package, Search } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';
import { STATUS_TONE } from '@/lib/seller';

interface Row {
  id: string;
  slug: string;
  type: 'book' | 'general';
  title: string;
  status: ProductStatus;
  condition: string | null;
  price: string;
  totalStock: number;
  rejectionReason: string | null;
  createdAt: string;
  storeName: string;
  storeSlug: string;
  imageUrl: string | null;
}

type Decision = 'approve' | 'reject' | 'suspend' | 'restore';

/** Which decisions make sense for a listing in each state. */
const DECISIONS: Record<ProductStatus, Decision[]> = {
  pending_review: ['approve', 'reject', 'suspend'],
  active: ['suspend'],
  suspended: ['restore'],
  rejected: ['restore'],
  draft: [],
  archived: [],
};

export default function AdminProductsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { can } = useAuth();
  const { fromApi } = useFormErrors();
  const [status, setStatus] = useState<ProductStatus | 'all'>('pending_review');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ row: Row; decision: Decision } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    setError('');
    apiRequest<Row[]>('/admin/products', { query: { status: status === 'all' ? undefined : status, q: query || undefined, page, pageSize: 20 } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setError(t('errors.generic')),
    );
  }, [status, query, page, t]);
  useEffect(load, [load]);

  const decide = async (row: Row, decision: Decision, why?: string) => {
    setBusy(true);
    try {
      const res = await apiRequest<{ id: string; status: ProductStatus }>(`/admin/products/${row.id}/${decision}`, { method: 'POST', body: { reason: why || undefined } });
      toast.show(res.message, 'success');
      setPending(null);
      setReason('');
      load();
    } catch (e) {
      const { fields, message } = fromApi(e);
      if (pending) setReasonError(fields.reason ?? message);
      else toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const needsReason = (d: Decision) => d === 'reject' || d === 'suspend';
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <RequirePermission permission="products.view">
      <h1 className="text-2xl font-bold">{t('adminProducts.title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('adminProducts.text')}</p>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t('common.filter')}>
        {([...PRODUCT_STATUSES, 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => (setStatus(s), setPage(1))}
            className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', status === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}
          >
            {s === 'all' ? t('common.all') : t(`status.product.${s}`)}
          </button>
        ))}
      </div>
      <form
        role="search"
        className="relative mb-4 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
      >
        <label htmlFor="admin-product-q" className="sr-only">
          {t('adminProducts.search')}
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
        <input
          id="admin-product-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('adminProducts.search')}
          className="h-10 w-full rounded-lg border border-line-input bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </form>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!rows ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Package className="h-6 w-6" />} title={t('adminProducts.empty')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-subtle">
                {row.imageUrl ? <Image src={row.imageUrl} alt="" fill sizes="3rem" className="object-cover" /> : <Package className="m-auto h-full w-5 text-fg-subtle" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-fg">{row.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
                  <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{t(`status.product.${row.status}`)}</Badge>
                  <span>{row.type === 'book' ? t('seller.typeBook') : t('seller.typeGeneral')}</span>
                  {row.condition ? <span>{t(`book.conditions.${row.condition}`)}</span> : null}
                  <span>{formatMoney(row.price, locale, { hideZeroDecimals: true })}</span>
                  <span>
                    {t('adminProducts.store')}:{' '}
                    <Link href={`/stores/${row.storeSlug}`} className="text-primary hover:underline">
                      {row.storeName}
                    </Link>
                  </span>
                  <span>
                    {t('adminProducts.created')}: {format.dateTime(new Date(row.createdAt), { dateStyle: 'medium' })}
                  </span>
                </p>
                {row.rejectionReason && (row.status === 'rejected' || row.status === 'suspended') ? <p className="mt-1 text-sm text-danger">{t('seller.rejectedReason', { reason: row.rejectionReason })}</p> : null}
              </div>
              {can('products.moderate') ? (
                <div className="flex flex-wrap gap-2">
                  {DECISIONS[row.status].map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={d === 'approve' || d === 'restore' ? 'primary' : 'outline'}
                      className={d === 'reject' || d === 'suspend' ? 'text-danger' : undefined}
                      disabled={busy}
                      onClick={() => (needsReason(d) ? (setPending({ row, decision: d }), setReason(''), setReasonError(null)) : decide(row, d))}
                    >
                      {t(`adminProducts.${d}`)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {pages > 1 ? (
        <nav aria-label={t('catalog.pagination')} className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('common.previous')}
          </Button>
          <span className="text-sm text-fg-muted">{t('catalog.pageOf', { page: format.number(page), pages: format.number(pages) })}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {t('common.next')}
          </Button>
        </nav>
      ) : null}

      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? `${t(`adminProducts.${pending.decision}`)}: ${pending.row.title}` : ''}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                if (!pending) return;
                if (reason.trim().length < 5) {
                  setReasonError(t('validation.reasonRequired'));
                  return;
                }
                void decide(pending.row, pending.decision, reason.trim());
              }}
            >
              {pending ? t(`adminProducts.${pending.decision}`) : ''}
            </Button>
          </>
        }
      >
        <Field label={t('adminProducts.reason')} required error={reasonError}>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />}
        </Field>
      </Dialog>
    </RequirePermission>
  );
}
