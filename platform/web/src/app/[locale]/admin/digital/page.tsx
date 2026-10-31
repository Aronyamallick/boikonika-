'use client';

import { DIGITAL_ASSET_STATUSES } from '@boikonika/shared';
import { FileText, Search } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { formatBytes, type AdminDigitalFile, type AssetStatus } from '@/lib/digital';
import { useFormErrors } from '@/lib/forms/errors';

const FILTERS = ['', ...DIGITAL_ASSET_STATUSES.filter((s) => s !== 'replaced')] as const;
const TONE: Record<AssetStatus, 'success' | 'neutral' | 'danger'> = { active: 'success', withdrawn: 'neutral', replaced: 'neutral', removed: 'danger' };
const PAGE_SIZE = 20;

/** Uploaded e-book files with their rights declarations; staff take files down after an upheld complaint. */
export default function AdminDigitalPage() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminDigitalFile[] | null>(null);
  const [total, setTotal] = useState(0);
  const [taking, setTaking] = useState<AdminDigitalFile | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    apiRequest<AdminDigitalFile[]>('/admin/digital', { query: { status: status || undefined, q: query || undefined, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [status, query, page]);
  useEffect(load, [load]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(q.trim());
  };
  const takedown = async () => {
    if (!taking) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await apiRequest(`/admin/digital/${taking.id}/takedown`, { method: 'POST', body: { reason: reason.trim() } });
      toast.show(res.message, 'success');
      setTaking(null);
      setReason('');
      load();
    } catch (e) {
      const parsed = fromApi(e);
      setError(parsed.fields.reason ?? parsed.message);
    } finally {
      setBusy(false);
    }
  };
  const restore = async (file: AdminDigitalFile) => {
    try {
      const res = await apiRequest(`/admin/digital/${file.id}/restore`, { method: 'POST' });
      toast.show(res.message, 'success');
      load();
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    }
  };

  return (
    <RequirePermission permission="copyright.manage">
      <h1 className="text-2xl font-bold">{t('adminDigital.title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('adminDigital.text')}</p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('common.filter')}>
          {FILTERS.map((s) => (
            <button key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => (setStatus(s), setPage(1))} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', status === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
              {s ? t(`adminDigital.status.${s}`) : t('common.all')}
            </button>
          ))}
        </div>
        <form onSubmit={search} role="search" className="flex gap-2">
          <label htmlFor="digital-q" className="sr-only">
            {t('adminDigital.search')}
          </label>
          <Input id="digital-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('adminDigital.search')} className="h-10 w-56" />
          <Button type="submit" size="icon" variant="outline" aria-label={t('adminDigital.search')}>
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </div>
      {!rows ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title={t('adminDigital.empty')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((f) => (
            <li key={f.id} className="flex flex-wrap gap-4 rounded-xl border border-line bg-surface p-4 text-sm shadow-sm">
              <BookCover src={f.book.coverUrl} title={f.book.title} className="w-12 shrink-0 p-0.5 text-[6px]" sizes="3rem" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link href={`/books/${f.book.slug}`} target="_blank" className="font-bold text-fg hover:text-primary">
                    {f.book.title}
                  </Link>
                  <Badge tone={TONE[f.status]}>{t(`adminDigital.status.${f.status}`)}</Badge>
                </div>
                <p className="mt-0.5 text-fg-muted">
                  {[f.fileName, f.format.toUpperCase(), f.pageCount ? t('digital.pages', { count: f.pageCount }) : null, formatBytes(f.sizeBytes, locale), t('adminDigital.downloads', { count: f.downloads })].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {f.uploader ? t('adminDigital.uploadedBy', { name: f.uploader.name }) : null} · {format.dateTime(new Date(f.uploadedAt), { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                {f.declaration ? (
                  <p className="mt-2 rounded-lg bg-subtle p-2.5 text-xs text-fg">
                    <span className="font-semibold">{t(`studio.capacity.${f.declaration.capacity as 'author'}`)}:</span> {f.declaration.statement}
                  </p>
                ) : null}
                <p className="mt-1 break-all font-mono text-[11px] text-fg-subtle">SHA-256 {f.sha256}</p>
                {f.removedReason ? <p className="mt-1 text-xs text-danger">{t('adminDigital.removedFor', { reason: f.removedReason })}</p> : null}
                <div className="mt-3 flex gap-2">
                  {f.status === 'removed' ? (
                    <Button size="sm" variant="outline" onClick={() => restore(f)}>
                      {t('adminDigital.restore')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => (setTaking(f), setReason(''), setError(undefined))}>
                      {t('adminDigital.takedown')}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AdminPager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      <Dialog
        open={!!taking}
        onClose={() => setTaking(null)}
        title={t('adminDigital.takedownTitle', { title: taking?.book.title ?? '' })}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setTaking(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={busy} onClick={takedown}>
              {t('adminDigital.takedown')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-fg-muted">{t('adminDigital.takedownText')}</p>
        <Field label={t('adminDigital.reason')} required error={error}>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />}
        </Field>
      </Dialog>
    </RequirePermission>
  );
}
