'use client';

import type { KycStatus } from '@boikonika/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';

interface Row {
  id: string;
  purpose: string;
  requestedRole: string;
  status: KycStatus;
  legalName: string;
  businessName: string | null;
  submittedAt: string;
  user: { username: string; displayName: string };
}

export default function KycQueuePage() {
  const t = useTranslations();
  const format = useFormatter();
  const [status, setStatus] = useState<KycStatus | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(null);
    apiRequest<Row[]>('/admin/kyc', { query: { status: status === 'all' ? undefined : status, page, pageSize: 20 } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setError(t('errors.generic')),
    );
  }, [status, page, t]);

  return (
    <RequirePermission permission="kyc.view">
      <h1 className="mb-4 text-2xl font-bold">{t('adminKyc.title')}</h1>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t('common.filter')}>
        {(['pending', 'under_review', 'resubmission_required', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => (setStatus(s), setPage(1))}
            className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', status === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}
          >
            {s === 'all' ? t('adminKyc.all') : t(`status.kyc.${s}`)}
          </button>
        ))}
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!rows && !error ? <Skeleton className="h-64 w-full" /> : null}
      {rows && !rows.length ? <EmptyState title={t('adminKyc.empty')} /> : null}
      {rows?.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-fg-subtle">
              <tr>
                <th scope="col" className="px-4 py-3">{t('adminKyc.applicant')}</th>
                <th scope="col" className="px-4 py-3">{t('verification.purpose')}</th>
                <th scope="col" className="px-4 py-3">{t('common.status')}</th>
                <th scope="col" className="px-4 py-3">{t('adminKyc.submittedAt')}</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-fg">{r.legalName}</p>
                    <p className="text-xs text-fg-muted">@{r.user.username}{r.businessName ? ` · ${r.businessName}` : ''}</p>
                  </td>
                  <td className="px-4 py-3">{t(`roles.${r.requestedRole}`)}</td>
                  <td className="px-4 py-3"><Badge tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : r.status === 'pending' ? 'info' : 'warning'}>{t(`status.kyc.${r.status}`)}</Badge></td>
                  <td className="px-4 py-3 text-fg-muted">{format.dateTime(new Date(r.submittedAt), { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/kyc/${r.id}`} className="font-semibold text-primary hover:underline">{t('adminKyc.open')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {total > 20 ? (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{t('common.previous')}</Button>
          <span className="text-sm text-fg-muted">{format.number(page)} / {format.number(Math.ceil(total / 20))}</span>
          <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</Button>
        </div>
      ) : null}
    </RequirePermission>
  );
}
