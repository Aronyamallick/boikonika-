'use client';

import { Copyright, ExternalLink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Badge, type Tone } from '@/components/ui/badge';
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

type Status = 'submitted' | 'under_review' | 'content_removed' | 'counter_noticed' | 'restored' | 'rejected';
type Decision = 'review' | 'uphold' | 'reject' | 'restore' | 'keep_removed';
interface Claim {
  id: string;
  reference: string;
  status: Status;
  claimant: { name: string; email: string; phone: string | null; rightsHolder: string };
  workDescription: string;
  evidenceUrls: string[];
  signature: string;
  target: { type: string; id: string; title: string; url: string | null };
  respondent: { id: string; name: string; username: string | null } | null;
  counter: { statement: string; signature: string; at: string } | null;
  adminNote: string | null;
  handler: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** '' lists everything still open: new, under review and counter-noticed. */
const FILTERS = ['', 'submitted', 'under_review', 'counter_noticed', 'content_removed', 'restored', 'rejected'] as const;
const TONE: Record<Status, Tone> = { submitted: 'info', under_review: 'warning', content_removed: 'danger', counter_noticed: 'accent', restored: 'success', rejected: 'neutral' };
/** What staff can do next from each state (the API enforces the same transitions). */
const NEXT: Partial<Record<Status, Decision[]>> = { submitted: ['review', 'uphold', 'reject'], under_review: ['uphold', 'reject'], counter_noticed: ['restore', 'keep_removed'] };
const PAGE_SIZE = 20;

/** Copyright complaints: check the claim, take the content down or reject it, then weigh any counter-notice. */
export default function AdminCopyrightPage() {
  const t = useTranslations('adminCopyright');
  const tc = useTranslations('common');
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Claim[] | null>(null);
  const [total, setTotal] = useState(0);
  const [deciding, setDeciding] = useState<{ claim: Claim; decision: Decision } | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    apiRequest<Claim[]>('/admin/copyright', { query: { status: status || undefined, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [status, page]);
  useEffect(load, [load]);

  const decide = async () => {
    if (!deciding) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await apiRequest(`/admin/copyright/${deciding.claim.id}/decision`, { method: 'POST', body: { decision: deciding.decision, note: note.trim() } });
      toast.show(res.message, 'success');
      setDeciding(null);
      load();
    } catch (e) {
      const parsed = fromApi(e);
      setError(parsed.fields.note ?? parsed.message);
    } finally {
      setBusy(false);
    }
  };
  const when = (d: string) => format.dateTime(new Date(d), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <RequirePermission permission="copyright.manage">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('text')}</p>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={tc('filter')}>
        {FILTERS.map((s) => (
          <button key={s || 'open'} type="button" aria-pressed={status === s} onClick={() => (setStatus(s), setPage(1))} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', status === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
            {s ? t(`statuses.${s}`) : t('open')}
          </button>
        ))}
      </div>
      {!rows ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Copyright className="h-6 w-6" />} title={t('empty')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-surface p-4 text-sm shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    {t('reference', { ref: c.reference })} · {t(`targets.${c.target.type}`)}
                  </p>
                  <h2 className="mt-0.5 font-bold text-fg">
                    {c.target.url ? (
                      <a href={c.target.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                        {c.target.title || c.target.url}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : (
                      c.target.title
                    )}
                  </h2>
                </div>
                <Badge tone={TONE[c.status]}>{t(`statuses.${c.status}`)}</Badge>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-fg-subtle">{t('claimant')}</dt>
                  <dd className="text-fg">
                    {c.claimant.name} · <a href={`mailto:${c.claimant.email}`} className="text-primary hover:underline">{c.claimant.email}</a>
                    {c.claimant.phone ? ` · ${c.claimant.phone}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">{t('rightsHolder')}</dt>
                  <dd className="text-fg">{c.claimant.rightsHolder}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">{t('respondent')}</dt>
                  <dd className="text-fg">
                    {c.respondent ? (
                      <Link href={`/admin/users/${c.respondent.id}`} className="text-primary hover:underline">
                        {c.respondent.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">{t('received')}</dt>
                  <dd className="text-fg">{when(c.createdAt)}</dd>
                </div>
              </dl>
              <div className="mt-3 rounded-lg bg-subtle p-3">
                <p className="text-xs font-semibold text-fg-subtle">{t('work')}</p>
                <p className="mt-1 whitespace-pre-line text-fg">{c.workDescription}</p>
                {c.evidenceUrls.length ? (
                  <ul className="mt-2 space-y-0.5">
                    {c.evidenceUrls.map((u) => (
                      <li key={u}>
                        <a href={u} target="_blank" rel="noreferrer nofollow" className="break-all text-xs text-primary hover:underline">
                          {u}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-2 text-xs text-fg-subtle">{t('signedBy', { name: c.signature })}</p>
              </div>
              {c.counter ? (
                <div className="mt-3 rounded-lg border border-accent/40 bg-accent-soft p-3 text-accent-soft-fg">
                  <p className="text-xs font-semibold">{t('counterNotice', { date: when(c.counter.at) })}</p>
                  <p className="mt-1 whitespace-pre-line">{c.counter.statement}</p>
                  <p className="mt-2 text-xs">{t('signedBy', { name: c.counter.signature })}</p>
                </div>
              ) : null}
              {c.adminNote ? (
                <p className="mt-3 text-xs text-fg-muted">
                  {t('lastNote', { name: c.handler ?? '—' })}: {c.adminNote}
                </p>
              ) : null}
              {NEXT[c.status]?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {NEXT[c.status]!.map((d) => (
                    <Button key={d} size="sm" variant={d === 'uphold' ? 'danger' : d === 'restore' || d === 'review' ? 'outline' : 'ghost'} onClick={() => (setDeciding({ claim: c, decision: d }), setNote(''), setError(undefined))}>
                      {t(`decisions.${d}`)}
                    </Button>
                  ))}
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
        title={deciding ? t(`decisions.${deciding.decision}`) : ''}
        closeLabel={tc('close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeciding(null)}>
              {tc('cancel')}
            </Button>
            <Button variant={deciding?.decision === 'uphold' ? 'danger' : 'primary'} loading={busy} onClick={decide}>
              {t('confirm')}
            </Button>
          </>
        }
      >
        {deciding ? <p className="mb-3 text-sm text-fg-muted">{t(`decisionHints.${deciding.decision}`)}</p> : null}
        <Field label={t('note')} hint={t('noteHint')} required error={error}>
          {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={2000} />}
        </Field>
      </Dialog>
    </RequirePermission>
  );
}
