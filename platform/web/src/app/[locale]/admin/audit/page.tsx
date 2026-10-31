'use client';

import { ChevronDown, ScrollText, Search } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { apiRequest } from '@/lib/api/client';

interface Entry {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  actor: { name: string; username: string | null } | null;
  at: string;
}
const PAGE_SIZE = 50;

/** Every sensitive staff and system action, newest first, with what changed. */
export default function AdminAuditPage() {
  const t = useTranslations('adminAudit');
  const format = useFormatter();
  const [form, setForm] = useState({ action: '', entityType: '', actor: '' });
  const [filter, setFilter] = useState(form);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    setRows(null);
    apiRequest<Entry[]>('/admin/audit-logs', { query: { action: filter.action || undefined, entityType: filter.entityType || undefined, actor: filter.actor || undefined, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [filter, page]);
  useEffect(load, [load]);
  const search = (e: FormEvent) => (e.preventDefault(), setPage(1), setFilter({ action: form.action.trim(), entityType: form.entityType.trim(), actor: form.actor.trim() }));

  return (
    <RequirePermission permission="audit.view">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('text')}</p>
      <form onSubmit={search} role="search" className="mb-4 flex flex-wrap gap-2">
        {(['action', 'entityType', 'actor'] as const).map((k) => (
          <span key={k} className="min-w-40 flex-1">
            <label htmlFor={`audit-${k}`} className="sr-only">
              {t(`filter.${k}`)}
            </label>
            <Input id={`audit-${k}`} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} placeholder={t(`filter.${k}`)} className="h-10 w-full" />
          </span>
        ))}
        <Button type="submit" size="icon" variant="outline" aria-label={t('search')}>
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
      {!rows ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title={t('empty')} />
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm shadow-sm">
          {rows.map((e) => {
            const changed = e.before || e.after;
            return (
              <li key={e.id} className="px-4 py-3">
                <details className="group">
                  <summary className={changed ? 'flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1' : 'pointer-events-none flex list-none flex-wrap items-baseline gap-x-3 gap-y-1'}>
                    <code className="rounded bg-subtle px-1.5 py-0.5 text-xs font-semibold text-fg">{e.action}</code>
                    <span className="text-fg-muted">
                      {e.entityType}
                      {e.entityId ? <span className="font-mono text-xs"> {e.entityId.slice(0, 8)}</span> : null}
                    </span>
                    <span className="text-fg">{e.actor ? e.actor.name : t('system')}</span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-fg-subtle">
                      <time dateTime={e.at}>{format.dateTime(new Date(e.at), { dateStyle: 'medium', timeStyle: 'medium' })}</time>
                      {e.ip ? ` · ${e.ip}` : ''}
                      {changed ? <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" /> : null}
                    </span>
                  </summary>
                  {changed ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Snapshot label={t('before')} value={e.before} />
                      <Snapshot label={t('after')} value={e.after} />
                    </div>
                  ) : null}
                </details>
              </li>
            );
          })}
        </ol>
      )}
      <AdminPager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
    </RequirePermission>
  );
}

function Snapshot({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold text-fg-subtle">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-lg bg-subtle p-2.5 font-mono text-xs text-fg">{value ? JSON.stringify(value, null, 2) : '—'}</pre>
    </div>
  );
}
