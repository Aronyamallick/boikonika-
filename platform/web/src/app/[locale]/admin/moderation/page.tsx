'use client';

import { MODERATION_ACTIONS, RESTRICTION_SCOPES, type ModerationAction, type RestrictionScope } from '@boikonika/shared';
import { AlertTriangle, ExternalLink, Flag, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface Target {
  type: string;
  id: string;
  title: string;
  excerpt: string | null;
  status: string | null;
  link: string | null;
  owner: { id: string; name: string; username: string | null; status: string } | null;
}
interface QueueItem {
  target: Target;
  reports: number;
  reporters: number;
  reasons: string[];
  urgent: boolean;
  status: string;
  assignee: string | null;
  notes: Array<{ reason: string; details: string; at: string }>;
  firstAt: string;
  lastAt: string;
}
const PAGE_SIZE = 20;
const TIMED: ModerationAction[] = ['temporary_restriction', 'suspension'];

/** The moderation desk: reported content grouped by target, and content held for review. */
export default function AdminModerationPage() {
  return (
    <Suspense>
      <ModerationDesk />
    </Suspense>
  );
}

function ModerationDesk() {
  const t = useTranslations('adminModeration');
  const { can } = useAuth();
  const params = useSearchParams();
  return (
    <RequirePermission permission="reports.view">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mb-4 mt-1 max-w-3xl text-fg-muted">{t('text')}</p>
      <Tabs
        defaultIndex={params.get('tab') === 'held' ? 1 : 0}
        tabs={[
          { label: t('tabReports'), content: <Queue canDecide={can('reports.resolve')} /> },
          ...(can('community.moderate') ? [{ label: t('tabHeld'), content: <Held /> }] : []),
        ]}
      />
    </RequirePermission>
  );
}

function TargetCard({ target, children }: { target: Target; children?: React.ReactNode }) {
  const t = useTranslations('adminModeration');
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{t(`types.${target.type}`)}</Badge>
        {target.status ? <Badge tone={target.status === 'published' || target.status === 'active' ? 'success' : target.status === 'pending_review' ? 'warning' : 'danger'}>{t(`statuses.${target.status}`)}</Badge> : null}
      </div>
      <p className="mt-1.5 font-bold text-fg">
        {target.link ? (
          <Link href={target.link} target="_blank" className="inline-flex items-center gap-1 hover:text-primary hover:underline">
            {target.title}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          target.title
        )}
      </p>
      {target.excerpt ? <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-fg-muted">{target.excerpt}</p> : null}
      {target.owner ? (
        <p className="mt-1 text-xs text-fg-subtle">
          {t('by')}{' '}
          <Link href={`/admin/users/${target.owner.id}`} className="font-semibold text-primary hover:underline">
            {target.owner.name}
          </Link>
          {target.owner.status !== 'active' ? <span className="ml-1 text-danger">({t(`statuses.${target.owner.status}`)})</span> : null}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function Queue({ canDecide }: { canDecide: boolean }) {
  const t = useTranslations('adminModeration');
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [filter, setFilter] = useState<'open' | 'action_taken' | 'dismissed'>('open');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<QueueItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [deciding, setDeciding] = useState<QueueItem | null>(null);

  const load = useCallback(() => {
    setRows(null);
    apiRequest<QueueItem[]>('/admin/moderation/queue', { query: { status: filter === 'open' ? undefined : filter, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [filter, page]);
  useEffect(load, [load]);

  const review = async (item: QueueItem) => {
    try {
      await apiRequest(`/admin/moderation/targets/${item.target.type}/${item.target.id}/review`, { method: 'POST' });
      load();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('filter')}>
        {(['open', 'action_taken', 'dismissed'] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => (setFilter(f), setPage(1))} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', filter === f ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
            {t(`filters.${f}`)}
          </button>
        ))}
      </div>
      {!rows ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={filter === 'open' ? t('clear') : t('none')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((item) => (
            <li key={`${item.target.type}:${item.target.id}`} className={cn('flex flex-wrap gap-4 rounded-xl border bg-surface p-4 shadow-sm', item.urgent && filter === 'open' ? 'border-danger/40' : 'border-line')}>
              <TargetCard target={item.target}>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  {item.urgent ? (
                    <Badge tone="danger">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {t('urgent')}
                    </Badge>
                  ) : null}
                  {item.reasons.map((r) => (
                    <Badge key={r} tone="warning">
                      {t(`reasons.${r}`)}
                    </Badge>
                  ))}
                  <span className="text-fg-muted">
                    <Flag className="mr-1 inline h-3 w-3" aria-hidden="true" />
                    {t('reportCount', { count: item.reports, people: item.reporters })} · <RelativeTime date={item.lastAt} />
                  </span>
                  {item.assignee ? <span className="text-fg-muted">· {t('reviewing', { name: item.assignee })}</span> : null}
                </div>
                {item.notes.length ? (
                  <ul className="mt-2 space-y-1 rounded-lg bg-subtle p-2.5 text-xs text-fg">
                    {item.notes.map((n, i) => (
                      <li key={i}>
                        <span className="font-semibold">{t(`reasons.${n.reason}`)}:</span> {n.details}
                        <span className="ml-1 text-fg-subtle">· {format.dateTime(new Date(n.at), { dateStyle: 'medium' })}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </TargetCard>
              {canDecide && filter === 'open' ? (
                <div className="flex shrink-0 flex-col gap-2">
                  <Button size="sm" onClick={() => setDeciding(item)}>
                    {t('decide')}
                  </Button>
                  {item.status === 'reported' ? (
                    <Button size="sm" variant="outline" onClick={() => review(item)}>
                      {t('startReview')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <AdminPager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      <DecisionDialog item={deciding} onClose={() => setDeciding(null)} onDone={() => (setDeciding(null), load())} />
    </div>
  );
}

function DecisionDialog({ item, onClose, onDone }: { item: QueueItem | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('adminModeration');
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [action, setAction] = useState<ModerationAction>('warning');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  const [scope, setScope] = useState<RestrictionScope>('all');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (item) (setAction('warning'), setReason(''), setDays('7'), setScope('all'), setErrors({}));
  }, [item]);
  const options = MODERATION_ACTIONS.filter((a) => !(item?.target.type === 'user' && a === 'content_removal') && !(!item?.target.owner && ['temporary_restriction', 'suspension', 'ban'].includes(a)));

  const submit = async () => {
    if (!item) return;
    setBusy(true);
    setErrors({});
    try {
      const res = await apiRequest(`/admin/moderation/targets/${item.target.type}/${item.target.id}/decision`, { method: 'POST', body: { action, reason, durationDays: TIMED.includes(action) ? Number(days) : undefined, scope } });
      toast.show(res.message, 'success');
      onDone();
    } catch (err) {
      const parsed = fromApi(err);
      setErrors(parsed.fields);
      if (!Object.keys(parsed.fields).length) toast.show(parsed.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!item}
      onClose={onClose}
      title={t('decideTitle', { title: item?.target.title.slice(0, 60) ?? '' })}
      closeLabel={t('close')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant={['suspension', 'ban'].includes(action) ? 'danger' : 'primary'} loading={busy} onClick={submit}>
            {t(`actions.${action}`)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('action')}>
          {(p) => (
            <Select {...p} value={action} onChange={(e) => setAction(e.target.value as ModerationAction)}>
              {options.map((a) => (
                <option key={a} value={a}>
                  {t(`actions.${a}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="text-sm text-fg-muted">{t(`actionHints.${action}`)}</p>
        {TIMED.includes(action) ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('days')} error={errors.durationDays} required>
              {(p) => <Input {...p} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />}
            </Field>
            {action === 'temporary_restriction' ? (
              <Field label={t('scope')}>
                {(p) => (
                  <Select {...p} value={scope} onChange={(e) => setScope(e.target.value as RestrictionScope)}>
                    {RESTRICTION_SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {t(`scopes.${s}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
          </div>
        ) : null}
        <Field label={t('reason')} hint={action === 'no_action' ? t('reasonHintInternal') : t('reasonHint')} error={errors.reason} required>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />}
        </Field>
      </div>
    </Dialog>
  );
}

function Held() {
  const t = useTranslations('adminModeration');
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [type, setType] = useState<'post' | 'comment' | 'club_post'>('post');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Target[] | null>(null);
  const [total, setTotal] = useState(0);
  const [removing, setRemoving] = useState<Target | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    setRows(null);
    apiRequest<Target[]>('/admin/moderation/held', { query: { type, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [type, page]);
  useEffect(load, [load]);

  const approve = async (target: Target) => {
    try {
      const res = await apiRequest(`/admin/moderation/held/${target.type}/${target.id}/approve`, { method: 'POST' });
      toast.show(res.message, 'success');
      load();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      const res = await apiRequest(`/admin/moderation/held/${removing.type}/${removing.id}/remove`, { method: 'POST', body: { reason } });
      toast.show(res.message, 'success');
      setRemoving(null);
      load();
    } catch (err) {
      const parsed = fromApi(err);
      setError(parsed.fields.reason ?? parsed.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('filter')}>
        {(['post', 'comment', 'club_post'] as const).map((f) => (
          <button key={f} type="button" aria-pressed={type === f} onClick={() => (setType(f), setPage(1))} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', type === f ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
            {t(`types.${f}`)}
          </button>
        ))}
      </div>
      {!rows ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={t('noHeld')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((target) => (
            <li key={target.id} className="flex flex-wrap gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
              <TargetCard target={target} />
              <div className="flex shrink-0 flex-col gap-2">
                <Button size="sm" onClick={() => approve(target)}>
                  {t('approve')}
                </Button>
                <Button size="sm" variant="outline" className="text-danger" onClick={() => (setRemoving(target), setReason(''), setError(undefined))}>
                  {t('remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AdminPager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('removeTitle')}
        closeLabel={t('close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              {t('cancel')}
            </Button>
            <Button variant="danger" onClick={remove}>
              {t('remove')}
            </Button>
          </>
        }
      >
        <Field label={t('reason')} hint={t('reasonHint')} error={error} required>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />}
        </Field>
      </Dialog>
    </div>
  );
}
