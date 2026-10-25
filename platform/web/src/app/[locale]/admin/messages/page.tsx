'use client';

import { CONTACT_STATUSES, CONTACT_TOPICS, type ContactStatus } from '@boikonika/shared';
import { Inbox } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';

interface Message {
  id: string;
  reference: string;
  name: string;
  email: string | null;
  phone: string | null;
  topic: string;
  orderNumber: string | null;
  message: string;
  locale: string;
  status: ContactStatus;
  account: { id: string; name: string; username: string | null } | null;
  reply: string | null;
  repliedBy: string | null;
  repliedAt: string | null;
  createdAt: string;
}
const PAGE_SIZE = 20;
const TONE: Record<ContactStatus, 'warning' | 'success' | 'neutral'> = { open: 'warning', answered: 'success', closed: 'neutral' };

/** The contact-form inbox: oldest open message first; replies go by email and to the person's notifications. */
export default function AdminMessagesPage() {
  const t = useTranslations('adminMessages');
  const tct = useTranslations('contact');
  const tc = useTranslations('common');
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [status, setStatus] = useState<ContactStatus>('open');
  const [topic, setTopic] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Message[] | null>(null);
  const [total, setTotal] = useState(0);
  const [replying, setReplying] = useState<Message | null>(null);
  const [reply, setReply] = useState('');
  const [close, setClose] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    apiRequest<Message[]>('/admin/messages', { query: { status, topic: topic || undefined, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [status, topic, page]);
  useEffect(load, [load]);

  const send = async () => {
    if (!replying) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await apiRequest(`/admin/messages/${replying.id}/reply`, { method: 'POST', body: { reply, close } });
      toast.show(res.message, 'success');
      setReplying(null);
      load();
    } catch (e) {
      const parsed = fromApi(e);
      setError(parsed.fields.reply ?? parsed.message);
    } finally {
      setBusy(false);
    }
  };
  const setMessageStatus = async (m: Message, next: ContactStatus) => {
    try {
      const res = await apiRequest(`/admin/messages/${m.id}/status`, { method: 'PUT', body: { status: next } });
      toast.show(res.message, 'success');
      load();
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    }
  };
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <RequirePermission permission="support.manage">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('text')}</p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={tc('filter')}>
          {CONTACT_STATUSES.map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => (setStatus(s), setPage(1))} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold', status === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
              {t(`statuses.${s}`)}
            </button>
          ))}
        </div>
        <label htmlFor="msg-topic" className="sr-only">
          {t('topic')}
        </label>
        <Select id="msg-topic" value={topic} onChange={(e) => (setTopic(e.target.value), setPage(1))} className="h-10 w-48">
          <option value="">{t('anyTopic')}</option>
          {CONTACT_TOPICS.map((x) => (
            <option key={x} value={x}>
              {tct(`topics.${x}`)}
            </option>
          ))}
        </Select>
      </div>
      {!rows ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title={status === 'open' ? t('inboxZero') : t('empty')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-surface p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-fg">
                    {m.name}
                    {m.account ? (
                      <Link href={`/admin/users/${m.account.id}`} className="ml-2 text-xs font-normal text-primary hover:underline">
                        {m.account.username ? `@${m.account.username}` : m.account.name}
                      </Link>
                    ) : null}
                  </p>
                  <p className="text-xs text-fg-subtle">
                    {t('reference', { ref: m.reference })} · {tct(`topics.${m.topic}`)} · {when(m.createdAt)} · {m.locale === 'en' ? 'English' : 'বাংলা'}
                  </p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {[m.email, m.phone, m.orderNumber ? t('order', { number: m.orderNumber }) : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Badge tone={TONE[m.status]}>{t(`statuses.${m.status}`)}</Badge>
              </div>
              <p className="mt-3 whitespace-pre-line rounded-lg bg-subtle p-3 text-fg" lang={m.locale}>
                {m.message}
              </p>
              {m.reply ? (
                <div className="mt-3 rounded-lg border border-success/30 bg-success-soft p-3 text-success-soft-fg">
                  <p className="text-xs font-semibold">{t('repliedBy', { name: m.repliedBy ?? '—', date: m.repliedAt ? when(m.repliedAt) : '' })}</p>
                  <p className="mt-1 whitespace-pre-line">{m.reply}</p>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => (setReplying(m), setReply(''), setClose(false), setError(undefined))}>
                  {m.reply ? t('replyAgain') : t('reply')}
                </Button>
                {m.status !== 'closed' ? (
                  <Button size="sm" variant="ghost" onClick={() => setMessageStatus(m, 'closed')}>
                    {t('close')}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setMessageStatus(m, 'open')}>
                    {t('reopen')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <AdminPager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      <Dialog
        open={!!replying}
        onClose={() => setReplying(null)}
        title={t('replyTitle', { name: replying?.name ?? '' })}
        closeLabel={tc('close')}
        className="w-[min(94vw,680px)]"
        footer={
          <>
            <Button variant="outline" onClick={() => setReplying(null)}>
              {tc('cancel')}
            </Button>
            <Button loading={busy} onClick={send}>
              {t('send')}
            </Button>
          </>
        }
      >
        {replying ? (
          <div className="space-y-4">
            <p className="max-h-40 overflow-auto whitespace-pre-line rounded-lg bg-subtle p-3 text-sm text-fg-muted">{replying.message}</p>
            <p className="text-sm text-fg-muted">{replying.email ? (replying.account ? t('goesBoth', { email: replying.email }) : t('goesEmail', { email: replying.email })) : t('goesApp')}</p>
            <Field label={t('yourReply')} hint={replying.locale === 'en' ? t('writeInEnglish') : t('writeInBangla')} error={error} required>
              {(p) => <Textarea {...p} value={reply} onChange={(e) => setReply(e.target.value)} rows={8} maxLength={5000} lang={replying.locale} />}
            </Field>
            <Checkbox label={t('closeAfter')} checked={close} onChange={(e) => setClose(e.target.checked)} />
          </div>
        ) : null}
      </Dialog>
    </RequirePermission>
  );
}
