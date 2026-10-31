'use client';

import { BadgeCheck, ExternalLink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
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

interface Claim {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  evidenceUrl: string | null;
  reason: string | null;
  createdAt: string;
  author: { id: string; name: string; slug: string; bookCount: number };
  claimant: { id: string; name: string; username: string; legalName: string | null; authorSlug: string | null };
}

const STATUSES = ['pending', 'approved', 'rejected'] as const;
const PAGE_SIZE = 20;

export default function AdminAuthorClaimsPage() {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('pending');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Claim[] | null>(null);
  const [total, setTotal] = useState(0);
  const [deciding, setDeciding] = useState<{ claim: Claim; approve: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    apiRequest<Claim[]>('/admin/author-claims', { query: { status, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [status, page]);
  useEffect(load, [load]);

  const decide = async () => {
    if (!deciding) return;
    if (!deciding.approve && reason.trim().length < 3) {
      setError(t('validation.required'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await apiRequest(`/admin/author-claims/${deciding.claim.id}/${deciding.approve ? 'approve' : 'reject'}`, { method: 'POST', body: { reason: reason.trim() || undefined } });
      toast.show(res.message, 'success');
      setDeciding(null);
      setReason('');
      load();
    } catch (e) {
      setError(fromApi(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequirePermission permission="authors.manage">
      <h1 className="text-2xl font-bold">{t('adminClaims.title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('adminClaims.text')}</p>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t('common.filter')}>
        {STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => (setStatus(s), setPage(1))} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', status === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
            {t(`authorDashboard.claimStatus.${s}`)}
          </button>
        ))}
      </div>
      {!rows ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<BadgeCheck className="h-6 w-6" />} title={t('adminClaims.empty')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-surface p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-fg">
                    <Link href={`/authors/${c.author.slug}`} target="_blank" className="hover:text-primary">
                      {c.author.name}
                    </Link>
                    <span className="ml-2 font-normal text-fg-muted">{t('catalog.bookCount', { count: c.author.bookCount })}</span>
                  </p>
                  <p className="mt-0.5 text-fg-muted">
                    {t('adminClaims.by', { name: c.claimant.name, username: c.claimant.username })}
                    {c.claimant.authorSlug ? (
                      <>
                        {' · '}
                        <Link href={`/authors/${c.claimant.authorSlug}`} target="_blank" className="text-primary hover:underline">
                          {t('adminClaims.ownPage')}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-fg-subtle">
                    {c.claimant.legalName ? t('adminClaims.legalName', { name: c.claimant.legalName }) : t('adminClaims.noKyc')} · {format.dateTime(new Date(c.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <Badge tone={c.status === 'approved' ? 'success' : c.status === 'rejected' ? 'danger' : 'warning'}>{t(`authorDashboard.claimStatus.${c.status}`)}</Badge>
              </div>
              <p className="mt-3 whitespace-pre-line rounded-lg bg-subtle p-3 text-fg">{c.message}</p>
              {c.evidenceUrl ? (
                <a href={c.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-2 inline-flex items-center gap-1 break-all text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {c.evidenceUrl}
                </a>
              ) : null}
              {c.reason ? <p className="mt-2 text-xs text-fg-muted">{t('adminClaims.reason', { reason: c.reason })}</p> : null}
              {c.status === 'pending' ? (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => (setDeciding({ claim: c, approve: true }), setReason(''), setError(undefined))}>
                    {t('adminClaims.approve')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => (setDeciding({ claim: c, approve: false }), setReason(''), setError(undefined))}>
                    {t('adminClaims.reject')}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <AdminPager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      <Dialog
        open={!!deciding}
        onClose={() => setDeciding(null)}
        title={deciding?.approve ? t('adminClaims.approveTitle', { name: deciding.claim.author.name }) : t('adminClaims.rejectTitle')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeciding(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant={deciding?.approve ? 'primary' : 'danger'} loading={busy} onClick={decide}>
              {deciding?.approve ? t('adminClaims.approve') : t('adminClaims.reject')}
            </Button>
          </>
        }
      >
        {deciding?.approve ? <p className="mb-3 text-sm text-fg-muted">{t('adminClaims.approveText')}</p> : null}
        <Field label={deciding?.approve ? t('adminClaims.noteOptional') : t('adminClaims.rejectReason')} required={!deciding?.approve} error={error}>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />}
        </Field>
      </Dialog>
    </RequirePermission>
  );
}
