'use client';

import { CalendarDays, Check, ImagePlus, Lock, MapPin, Megaphone, MessageCircle, Pin, Plus, Trash2, UserPlus, Users, Video, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { ClubForm } from '@/components/clubs/club-form';
import { BookPicker } from '@/components/community/book-picker';
import { ReportDialog } from '@/components/community/report-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Button, buttonClasses } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import type { ClubDetail, ClubMember, ClubPoll, ClubPost } from '@/lib/clubs';
import type { BookTag } from '@/lib/community';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

/** Runs an API call, shows its message, then reloads; returns whether it worked. */
function useAction(onDone: () => void) {
  const toast = useToast();
  const { fromApi } = useFormErrors();
  return useCallback(
    async (call: () => Promise<{ message?: string }>, success?: string) => {
      try {
        const res = await call();
        toast.show(success ?? res.message ?? '', 'success');
        onDone();
        return true;
      } catch (err) {
        toast.show(fromApi(err).message, 'danger');
        return false;
      }
    },
    [toast, fromApi, onDone],
  );
}

export function ClubView({ initial, initialTab }: { initial: ClubDetail; initialTab?: string }) {
  const t = useTranslations();
  const { status } = useAuth();
  const [club, setClub] = useState(initial);
  const reload = useCallback(() => api<ClubDetail>(`/clubs/${initial.slug}`).then(setClub, () => undefined), [initial.slug]);
  useEffect(() => {
    if (status === 'authenticated') void reload();
  }, [status, reload]);

  const tabs = [
    { key: 'discussions', label: t('clubs.tabDiscussions'), content: club.readable ? <Discussions club={club} /> : <PrivateNotice /> },
    { key: 'reading', label: t('clubs.tabReading'), content: club.readable ? <Reading club={club} onChanged={reload} /> : <PrivateNotice /> },
    { key: 'events', label: t('clubs.tabEvents'), content: club.readable ? <Events club={club} onChanged={reload} /> : <PrivateNotice /> },
    { key: 'members', label: club.pendingCount ? t('clubs.tabMembersPending', { count: club.pendingCount }) : t('clubs.tabMembers'), content: club.readable ? <Members club={club} onChanged={reload} /> : <PrivateNotice /> },
    ...(club.canModerate ? [{ key: 'settings', label: t('clubs.tabSettings'), content: <Settings club={club} onSaved={(c) => setClub(c)} /> }] : []),
  ];
  const index = Math.max(0, tabs.findIndex((x) => x.key === initialTab));

  return (
    <div className="space-y-6">
      <ClubHeader club={club} onChanged={reload} />
      <Tabs key={club.canModerate ? 'mod' : 'member'} defaultIndex={index} tabs={tabs.map(({ label, content }) => ({ label, content }))} />
    </div>
  );
}

function PrivateNotice() {
  const t = useTranslations('clubs');
  return <EmptyState icon={<Lock className="h-6 w-6" />} title={t('privateTitle')} text={t('privateText')} />;
}

function ClubHeader({ club, onChanged }: { club: ClubDetail; onChanged: () => void }) {
  const t = useTranslations();
  const format = useFormatter();
  const { status } = useAuth();
  const pathname = usePathname();
  const act = useAction(onChanged);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const m = club.membership;
  const run = async (fn: () => Promise<{ message?: string }>) => {
    setBusy(true);
    await act(fn);
    setBusy(false);
  };
  return (
    <header className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div
        className="h-32 bg-gradient-to-r from-secondary-soft via-primary-soft to-accent-soft sm:h-44"
        style={club.coverUrl ? { backgroundImage: `url(${club.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{club.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <Badge tone="neutral">
              {club.type === 'private' ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {t(`clubs.types.${club.type}`)}
            </Badge>
            {club.purpose === 'study' ? <Badge tone="secondary">{club.subject ? t(`subjects.${club.subject}`) : t('clubs.studyGroup')}</Badge> : null}
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" aria-hidden="true" />
              {t('clubs.members', { count: club.memberCount })}
            </span>
            {club.institutionName ? <span>· {club.institutionName}</span> : null}
            {club.owner ? (
              <span>
                ·{' '}
                {t.rich('clubs.startedBy', {
                  name: club.owner.name,
                  link: (chunks) => (
                    <Link href={`/u/${club.owner!.username}`} className="font-semibold text-fg hover:text-primary">
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            ) : null}
            <span>· {format.dateTime(new Date(club.createdAt), { year: 'numeric', month: 'short' })}</span>
          </p>
          {club.description ? <p className="mt-3 max-w-2xl whitespace-pre-line text-fg">{club.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'anonymous' ? (
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses()}>
              {t('clubs.loginToJoin')}
            </Link>
          ) : m?.status === 'active' ? (
            m.role === 'owner' ? (
              <Badge tone="primary">{t('clubs.roles.owner')}</Badge>
            ) : (
              <Button variant="outline" loading={busy} onClick={() => run(() => apiRequest(`/clubs/${club.slug}/membership`, { method: 'DELETE' }))}>
                {t('clubs.leave')}
              </Button>
            )
          ) : m?.status === 'pending' ? (
            <Button variant="outline" loading={busy} onClick={() => run(() => apiRequest(`/clubs/${club.slug}/membership`, { method: 'DELETE' }))}>
              {t('clubs.cancelRequest')}
            </Button>
          ) : m?.status === 'banned' ? null : club.joinPolicy === 'invite' && m?.status !== 'invited' ? (
            <Badge tone="neutral">{t('clubs.policies.invite')}</Badge>
          ) : status === 'authenticated' ? (
            <Button loading={busy} onClick={() => run(() => apiRequest(`/clubs/${club.slug}/join`, { method: 'POST' }))}>
              {m?.status === 'invited' ? t('clubs.acceptInvite') : club.joinPolicy === 'request' ? t('clubs.requestToJoin') : t('clubs.join')}
            </Button>
          ) : null}
          {status === 'authenticated' && !club.isOwner ? (
            <Button variant="ghost" onClick={() => setReporting(true)}>
              {t('report.short')}
            </Button>
          ) : null}
        </div>
      </div>
      {club.rules ? (
        <details className="border-t border-line px-5 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-fg">{t('clubs.rules')}</summary>
          <p className="mt-2 whitespace-pre-line text-fg-muted">{club.rules}</p>
        </details>
      ) : null}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="club" targetId={club.id} />
    </header>
  );
}

// ------------------------------------------------------------------ discussions

function Discussions({ club }: { club: ClubDetail }) {
  const t = useTranslations();
  const [items, setItems] = useState<ClubPost[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const load = useCallback(
    (p = 1) =>
      apiRequest<ClubPost[]>(`/clubs/${club.slug}/posts`, { query: { page: p, pageSize: 20 } }).then(
        (res) => (setItems((prev) => (p === 1 ? res.data : [...(prev ?? []), ...res.data])), setTotal(res.meta?.total ?? 0), setPage(p)),
        () => setItems([]),
      ),
    [club.slug],
  );
  useEffect(() => {
    void load(1);
  }, [load]);
  const member = club.membership?.status === 'active';
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        {member ? <ClubComposer club={club} onPosted={() => load(1)} /> : <p className="rounded-xl border border-line bg-surface p-4 text-sm text-fg-muted">{t('clubs.joinToPost')}</p>}
        {items === null ? (
          <Skeleton className="h-40 w-full" />
        ) : items.length === 0 ? (
          <EmptyState icon={<MessageCircle className="h-6 w-6" />} title={t('clubs.noPosts')} />
        ) : (
          <ul className="space-y-4">
            {items.map((p) => (
              <li key={p.id}>
                <Thread post={p} club={club} onChanged={() => load(1)} />
              </li>
            ))}
          </ul>
        )}
        {items && items.length < total ? (
          <Button variant="outline" onClick={() => load(page + 1)}>
            {t('community.loadMore')}
          </Button>
        ) : null}
      </div>
      <aside className="space-y-4">
        <CurrentBookCard club={club} />
        {club.polls.filter((p) => p.open).slice(0, 1).map((p) => (
          <PollCard key={p.id} poll={p} club={club} />
        ))}
      </aside>
    </div>
  );
}

function ClubComposer({ club, onPosted, parentId, onCancel }: { club: ClubDetail; onPosted: () => void; parentId?: string; onCancel?: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({ title: '', body: '', announcement: false });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.body.trim()) return setError(t('validation.required'));
    setBusy(true);
    setError(undefined);
    try {
      const res = await apiRequest<{ status: string }>(`/clubs/${club.slug}/posts`, {
        method: 'POST',
        body: { body: form.body, parentId, title: parentId ? undefined : form.title.trim() || undefined, kind: form.announcement ? 'announcement' : 'discussion' },
      });
      if (res.data.status !== 'published') toast.show(res.message, 'info');
      setForm({ title: '', body: '', announcement: false });
      onPosted();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setError(fields.body ?? message);
    } finally {
      setBusy(false);
    }
  };
  const id = parentId ? `club-reply-${parentId}` : 'club-new-post';
  return (
    <form onSubmit={submit} noValidate className={cn('space-y-3', !parentId && 'rounded-xl border border-line bg-surface p-4 shadow-sm')}>
      {parentId ? null : (
        <Field label={t('community.titleLabel')}>
          {(p) => <Input {...p} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={200} />}
        </Field>
      )}
      <label htmlFor={id} className={parentId ? 'sr-only' : 'mb-1.5 block text-sm font-semibold text-fg'}>
        {parentId ? t('community.replyLabel') : t('clubs.startTopic')}
      </label>
      <Textarea id={id} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={parentId ? 2 : 4} maxLength={5000} placeholder={parentId ? t('community.replyLabel') : t('clubs.topicPlaceholder')} aria-invalid={error ? true : undefined} autoFocus={!!parentId} />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {club.canModerate && !parentId ? <Checkbox label={t('clubs.asAnnouncement')} checked={form.announcement} onChange={(e) => setForm((f) => ({ ...f, announcement: e.target.checked }))} /> : <span />}
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          ) : null}
          <Button type="submit" size="sm" loading={busy}>
            {parentId ? t('community.reply') : t('community.post')}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Thread({ post, club, onChanged }: { post: ClubPost; club: ClubDetail; onChanged: () => void }) {
  const t = useTranslations();
  const act = useAction(onChanged);
  const [replying, setReplying] = useState(false);
  const member = club.membership?.status === 'active';
  return (
    <article id={`post-${post.id}`} className={cn('scroll-mt-24 rounded-xl border bg-surface p-4 shadow-sm', post.kind === 'announcement' ? 'border-accent' : 'border-line')}>
      <PostLine post={post} club={club} onChanged={onChanged} />
      {post.replies?.length ? (
        <ul className="ml-4 mt-3 space-y-3 border-l-2 border-line pl-4 sm:ml-10">
          {post.replies.map((r) => (
            <li key={r.id}>
              <PostLine post={r} club={club} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {member ? (
          <Button size="sm" variant="ghost" onClick={() => setReplying((v) => !v)}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {t('community.reply')}
          </Button>
        ) : null}
        {club.canModerate ? (
          <Button size="sm" variant="ghost" onClick={() => act(() => api(`/clubs/${club.slug}/posts/${post.id}/pin`, { method: 'PUT', body: { pinned: !post.pinned } }), post.pinned ? t('clubs.unpinned') : t('clubs.pinned'))}>
            <Pin className="h-4 w-4" aria-hidden="true" />
            {post.pinned ? t('clubs.unpin') : t('clubs.pin')}
          </Button>
        ) : null}
      </div>
      {replying ? (
        <div className="mt-2">
          <ClubComposer club={club} parentId={post.id} onCancel={() => setReplying(false)} onPosted={() => (setReplying(false), onChanged())} />
        </div>
      ) : null}
    </article>
  );
}

function PostLine({ post, club, onChanged }: { post: ClubPost; club: ClubDetail; onChanged: () => void }) {
  const t = useTranslations();
  const act = useAction(onChanged);
  return (
    <div className="flex gap-3">
      <Avatar name={post.author.name} src={post.author.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Link href={`/u/${post.author.username}`} className="font-semibold text-fg hover:text-primary">
            {post.author.name}
          </Link>
          <RelativeTime date={post.createdAt} className="text-xs text-fg-subtle" />
          {post.kind === 'announcement' ? (
            <Badge tone="accent">
              <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
              {t('clubs.announcement')}
            </Badge>
          ) : null}
          {post.pinned ? (
            <Badge tone="neutral">
              <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              {t('clubs.pinnedBadge')}
            </Badge>
          ) : null}
          {post.pending ? <Badge tone="warning">{t('community.pendingReview')}</Badge> : null}
        </p>
        {post.title ? <h3 className="mt-1 font-bold text-fg">{post.title}</h3> : null}
        <p className="mt-0.5 whitespace-pre-line break-words text-[15px] text-fg">{post.body}</p>
        {post.canDelete ? (
          <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline" onClick={() => window.confirm(t('clubs.deleteConfirm')) && act(() => apiRequest(`/clubs/${club.slug}/posts/${post.id}`, { method: 'DELETE' }))}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('common.remove')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ reading

function CurrentBookCard({ club }: { club: ClubDetail }) {
  const t = useTranslations();
  const format = useFormatter();
  const current = club.books.find((b) => b.status === 'current');
  if (!current) return null;
  const next = current.schedule.find((s) => new Date(s.dueOn) >= new Date(new Date().toDateString()));
  return (
    <section aria-labelledby="current-book" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <h2 id="current-book" className="mb-3 text-sm font-bold uppercase tracking-wide text-fg-subtle">
        {t('clubs.bookOfMonth')}
      </h2>
      <Link href={`/books/${current.book.slug}`} className="flex gap-3 hover:text-primary">
        <BookCover src={current.book.coverUrl} title={current.book.title} className="w-14 shrink-0 p-1 text-[6px]" sizes="3.5rem" />
        <span className="min-w-0">
          <span className="line-clamp-2 font-bold text-fg">{current.book.title}</span>
          <span className="line-clamp-1 text-sm text-fg-muted">{current.book.authors.join(', ')}</span>
        </span>
      </Link>
      {next ? <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-sm text-fg">{t('clubs.nextUp', { title: next.title, date: format.dateTime(new Date(`${next.dueOn}T00:00:00`), { day: 'numeric', month: 'long' }) })}</p> : null}
    </section>
  );
}

function Reading({ club, onChanged }: { club: ClubDetail; onChanged: () => void }) {
  const t = useTranslations();
  const format = useFormatter();
  const act = useAction(onChanged);
  const [book, setBook] = useState<BookTag | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bookStatus, setBookStatus] = useState<'current' | 'upcoming'>('current');
  const monthLabel = (m: string) => format.dateTime(new Date(`${m}-01T00:00:00`), { month: 'long', year: 'numeric' });
  return (
    <div className="space-y-6">
      {club.books.length === 0 ? <EmptyState icon={<CalendarDays className="h-6 w-6" />} title={t('clubs.noBooks')} /> : null}
      <ul className="space-y-4">
        {club.books.map((b) => (
          <li key={b.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-start gap-4">
              <BookCover src={b.book.coverUrl} title={b.book.title} className="w-16 shrink-0 p-1 text-[7px]" sizes="4rem" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{monthLabel(b.month)}</p>
                <Link href={`/books/${b.book.slug}`} className="font-bold text-fg hover:text-primary">
                  {b.book.title}
                </Link>
                <p className="text-sm text-fg-muted">{b.book.authors.join(', ')}</p>
                <Badge tone={b.status === 'current' ? 'primary' : b.status === 'upcoming' ? 'secondary' : 'neutral'} className="mt-1">
                  {t(`clubs.bookStatus.${b.status}`)}
                </Badge>
              </div>
              {club.canModerate ? (
                <Button size="icon" variant="ghost" className="text-danger" aria-label={t('clubs.removeBook', { title: b.book.title })} onClick={() => act(() => apiRequest(`/clubs/${club.slug}/books/${b.id}`, { method: 'DELETE' }))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            {b.schedule.length ? (
              <ol className="mt-4 space-y-2">
                {b.schedule.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-sm">
                    <span>
                      <span className="font-semibold text-fg">{s.title}</span>
                      {s.fromPage && s.toPage ? <span className="text-fg-muted"> · {t('clubs.pages', { from: s.fromPage, to: s.toPage })}</span> : null}
                    </span>
                    <span className="flex items-center gap-2 text-fg-muted">
                      {format.dateTime(new Date(`${s.dueOn}T00:00:00`), { day: 'numeric', month: 'short' })}
                      {club.canModerate ? (
                        <button type="button" className="rounded p-1 hover:bg-surface" aria-label={t('clubs.removeScheduleItem', { title: s.title })} onClick={() => act(() => apiRequest(`/clubs/${club.slug}/schedule/${s.id}`, { method: 'DELETE' }))}>
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
            {club.canModerate && b.status !== 'finished' ? <ScheduleForm club={club} clubBookId={b.id} onAdded={onChanged} /> : null}
          </li>
        ))}
      </ul>

      {club.canModerate ? (
        <section aria-labelledby="set-book" className="rounded-xl border border-dashed border-line-strong p-4">
          <h2 id="set-book" className="mb-3 font-bold text-fg">
            {t('clubs.setBook')}
          </h2>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <BookPicker value={book} onChange={setBook} label={t('clubs.book')} />
            <Field label={t('clubs.month')}>{(p) => <Input {...p} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
            <Field label={t('clubs.bookStatusLabel')}>
              {(p) => (
                <Select {...p} value={bookStatus} onChange={(e) => setBookStatus(e.target.value as 'current' | 'upcoming')}>
                  <option value="current">{t('clubs.bookStatus.current')}</option>
                  <option value="upcoming">{t('clubs.bookStatus.upcoming')}</option>
                </Select>
              )}
            </Field>
          </div>
          <Button className="mt-3" disabled={!book} onClick={async () => (await act(() => apiRequest(`/clubs/${club.slug}/books`, { method: 'PUT', body: { bookId: book!.id, month, status: bookStatus } }))) && setBook(null)}>
            {t('common.save')}
          </Button>
        </section>
      ) : null}

      <section aria-labelledby="polls" className="space-y-3">
        <h2 id="polls" className="text-lg font-bold text-fg">
          {t('clubs.polls')}
        </h2>
        {club.polls.length === 0 ? <p className="text-sm text-fg-muted">{t('clubs.noPolls')}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {club.polls.map((p) => (
            <PollCard key={p.id} poll={p} club={club} />
          ))}
        </div>
        {club.canModerate ? <PollForm club={club} onCreated={onChanged} /> : null}
      </section>
    </div>
  );
}

function ScheduleForm({ club, clubBookId, onAdded }: { club: ClubDetail; clubBookId: string; onAdded: () => void }) {
  const t = useTranslations();
  const act = useAction(onAdded);
  const [form, setForm] = useState({ title: '', fromPage: '', toPage: '', dueOn: '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.dueOn) return;
        const ok = await act(() =>
          apiRequest(`/clubs/${club.slug}/books/${clubBookId}/schedule`, { method: 'POST', body: { title: form.title, fromPage: form.fromPage || undefined, toPage: form.toPage || undefined, dueOn: form.dueOn } }),
        );
        if (ok) setForm({ title: '', fromPage: '', toPage: '', dueOn: '' });
      }}
    >
      <Field label={t('clubs.scheduleTitle')}>{(p) => <Input {...p} value={form.title} onChange={set('title')} maxLength={200} />}</Field>
      <Field label={t('clubs.fromPage')}>{(p) => <Input {...p} value={form.fromPage} onChange={set('fromPage')} inputMode="numeric" />}</Field>
      <Field label={t('clubs.toPage')}>{(p) => <Input {...p} value={form.toPage} onChange={set('toPage')} inputMode="numeric" />}</Field>
      <Field label={t('clubs.dueOn')}>{(p) => <Input {...p} type="date" value={form.dueOn} onChange={set('dueOn')} />}</Field>
      <Button type="submit" variant="outline">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t('clubs.addToSchedule')}
      </Button>
    </form>
  );
}

function PollCard({ poll: initial, club }: { poll: ClubPoll; club: ClubDetail }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [poll, setPoll] = useState(initial);
  const [choice, setChoice] = useState<string[]>(initial.options.filter((o) => o.mine).map((o) => o.id));
  const member = club.membership?.status === 'active';
  const voted = poll.options.some((o) => o.mine);
  const vote = async () => {
    try {
      setPoll(await api<ClubPoll>(`/clubs/${club.slug}/polls/${poll.id}/vote`, { method: 'POST', body: { optionIds: choice } }));
      toast.show(t('clubs.voted'), 'success');
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };
  const showResults = voted || !poll.open || !member;
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-sm" aria-label={poll.question}>
      <p className="font-bold text-fg">{poll.question}</p>
      <p className="mt-0.5 text-xs text-fg-muted">
        {t('clubs.votes', { count: poll.totalVotes })}
        {poll.closesAt ? ` · ${poll.open ? t('clubs.closes', { date: format.dateTime(new Date(poll.closesAt), { dateStyle: 'medium' }) }) : t('clubs.closed')}` : ''}
      </p>
      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">{poll.question}</legend>
        {poll.options.map((o) => {
          const share = poll.totalVotes ? o.votes / poll.totalVotes : 0;
          return (
            <label key={o.id} className={cn('relative block overflow-hidden rounded-lg border px-3 py-2 text-sm', member && poll.open ? 'cursor-pointer hover:border-primary' : '', o.mine ? 'border-primary' : 'border-line')}>
              {showResults ? <span className="absolute inset-y-0 left-0 bg-primary-soft" style={{ width: `${share * 100}%` }} aria-hidden="true" /> : null}
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {member && poll.open ? (
                    <input
                      type={poll.allowMultiple ? 'checkbox' : 'radio'}
                      name={`poll-${poll.id}`}
                      checked={choice.includes(o.id)}
                      onChange={(e) => setChoice((c) => (poll.allowMultiple ? (e.target.checked ? [...c, o.id] : c.filter((x) => x !== o.id)) : [o.id]))}
                      className="accent-[var(--bk-primary)]"
                    />
                  ) : null}
                  <span className="text-fg">{o.label}</span>
                  {o.mine ? <Check className="h-4 w-4 text-primary" aria-label={t('clubs.yourVote')} /> : null}
                </span>
                {showResults ? <span className="font-semibold tabular-nums text-fg">{format.number(share, { style: 'percent' })}</span> : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      {member && poll.open ? (
        <Button size="sm" className="mt-3" disabled={!choice.length} onClick={vote}>
          {voted ? t('clubs.changeVote') : t('clubs.vote')}
        </Button>
      ) : null}
    </section>
  );
}

function PollForm({ club, onCreated }: { club: ClubDetail; onCreated: () => void }) {
  const t = useTranslations();
  const act = useAction(onCreated);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [closesAt, setClosesAt] = useState('');
  return (
    <form
      className="space-y-3 rounded-xl border border-dashed border-line-strong p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const labels = options.map((o) => o.trim()).filter(Boolean);
        if (question.trim().length < 3 || labels.length < 2) return;
        const ok = await act(() =>
          apiRequest(`/clubs/${club.slug}/polls`, { method: 'POST', body: { question, options: labels.map((label) => ({ label })), allowMultiple: multiple, closesAt: closesAt ? new Date(closesAt).toISOString() : undefined } }),
        );
        if (ok) (setQuestion(''), setOptions(['', '']), setMultiple(false), setClosesAt(''));
      }}
    >
      <h3 className="font-bold text-fg">{t('clubs.newPoll')}</h3>
      <Field label={t('clubs.question')}>{(p) => <Input {...p} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} />}</Field>
      {options.map((o, i) => (
        <Field key={i} label={t('clubs.option', { n: i + 1 })}>
          {(p) => <Input {...p} value={o} onChange={(e) => setOptions((list) => list.map((x, j) => (j === i ? e.target.value : x)))} maxLength={200} />}
        </Field>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="ghost" disabled={options.length >= 8} onClick={() => setOptions((l) => [...l, ''])}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('clubs.addOption')}
        </Button>
        <Checkbox label={t('clubs.allowMultiple')} checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
      </div>
      <Field label={t('clubs.closesAt')}>{(p) => <Input {...p} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />}</Field>
      <Button type="submit">{t('clubs.createPoll')}</Button>
    </form>
  );
}

// ------------------------------------------------------------------ events

function Events({ club, onChanged }: { club: ClubDetail; onChanged: () => void }) {
  const t = useTranslations();
  const format = useFormatter();
  const act = useAction(onChanged);
  const member = club.membership?.status === 'active';
  return (
    <div className="space-y-4">
      {club.events.length === 0 ? <EmptyState icon={<CalendarDays className="h-6 w-6" />} title={t('clubs.noEvents')} /> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {club.events.map((e) => (
          <li key={e.id} className="flex gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
            <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary-soft py-2 text-primary-soft-fg">
              <span className="text-xs font-semibold uppercase">{format.dateTime(new Date(e.startsAt), { month: 'short' })}</span>
              <span className="text-xl font-bold">{format.dateTime(new Date(e.startsAt), { day: 'numeric' })}</span>
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold text-fg">{e.title}</p>
              <p className="text-fg-muted">{format.dateTimeRange(new Date(e.startsAt), new Date(e.endsAt ?? e.startsAt), { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>
              {e.location ? (
                <p className="mt-1 flex items-center gap-1 text-fg-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {e.location}
                </p>
              ) : null}
              {e.onlineUrl ? (
                <a href={e.onlineUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('clubs.joinOnline')}
                </a>
              ) : null}
              {e.description ? <p className="mt-1 whitespace-pre-line text-fg">{e.description}</p> : null}
            </div>
            {club.canModerate ? (
              <Button size="icon" variant="ghost" className="text-danger" aria-label={t('clubs.deleteEvent', { title: e.title })} onClick={() => act(() => apiRequest(`/clubs/${club.slug}/events/${e.id}`, { method: 'DELETE' }))}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {!member && club.events.length ? <p className="text-xs text-fg-muted">{t('clubs.linksForMembers')}</p> : null}
      {club.canModerate ? <EventForm club={club} onCreated={onChanged} /> : null}
    </div>
  );
}

function EventForm({ club, onCreated }: { club: ClubDetail; onCreated: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({ title: '', startsAt: '', endsAt: '', location: '', onlineUrl: '', description: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="space-y-3 rounded-xl border border-dashed border-line-strong p-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const res = await apiRequest(`/clubs/${club.slug}/events`, {
            method: 'POST',
            body: {
              title: form.title,
              startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
              endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
              location: form.location || undefined,
              onlineUrl: form.onlineUrl || undefined,
              description: form.description || undefined,
            },
          });
          toast.show(res.message, 'success');
          setForm({ title: '', startsAt: '', endsAt: '', location: '', onlineUrl: '', description: '' });
          setErrors({});
          onCreated();
        } catch (err) {
          const { fields, message } = fromApi(err);
          setErrors(fields);
          if (!Object.keys(fields).length) toast.show(message, 'danger');
        }
      }}
    >
      <h3 className="font-bold text-fg">{t('clubs.newEvent')}</h3>
      <Field label={t('clubs.eventTitle')} required error={errors.title}>
        {(p) => <Input {...p} value={form.title} onChange={set('title')} maxLength={200} />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('clubs.startsAt')} required error={errors.startsAt}>
          {(p) => <Input {...p} type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />}
        </Field>
        <Field label={t('clubs.endsAt')} error={errors.endsAt}>
          {(p) => <Input {...p} type="datetime-local" value={form.endsAt} onChange={set('endsAt')} />}
        </Field>
        <Field label={t('clubs.location')} error={errors.location}>
          {(p) => <Input {...p} value={form.location} onChange={set('location')} maxLength={200} />}
        </Field>
        <Field label={t('clubs.onlineUrl')} error={errors.onlineUrl}>
          {(p) => <Input {...p} type="url" value={form.onlineUrl} onChange={set('onlineUrl')} placeholder="https://" maxLength={500} />}
        </Field>
      </div>
      <Field label={t('clubs.eventDescription')}>{(p) => <Textarea {...p} value={form.description} onChange={set('description')} rows={2} maxLength={2000} />}</Field>
      <Button type="submit">{t('clubs.addEvent')}</Button>
    </form>
  );
}

// ------------------------------------------------------------------ members & settings

function Members({ club, onChanged }: { club: ClubDetail; onChanged: () => void }) {
  const t = useTranslations();
  const [active, setActive] = useState<ClubMember[] | null>(null);
  const [pending, setPending] = useState<ClubMember[]>([]);
  const [username, setUsername] = useState('');
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => (setVersion((v) => v + 1), onChanged()), [onChanged]);
  const act = useAction(refresh);
  useEffect(() => {
    api<ClubMember[]>(`/clubs/${club.slug}/members`).then(setActive, () => setActive([]));
    if (club.canModerate) api<ClubMember[]>(`/clubs/${club.slug}/members`, { query: { status: 'pending' } }).then(setPending, () => setPending([]));
  }, [club.slug, club.canModerate, version]);
  const memberAction = (id: string, action: string) => act(() => apiRequest(`/clubs/${club.slug}/members/${id}`, { method: 'POST', body: { action } }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section aria-labelledby="member-list">
        <h2 id="member-list" className="sr-only">
          {t('clubs.tabMembers')}
        </h2>
        {active === null ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {active.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                <Link href={`/u/${m.username}`} className="min-w-0 flex-1 font-semibold text-fg hover:text-primary">
                  {m.name}
                </Link>
                {m.role !== 'member' ? <Badge tone={m.role === 'owner' ? 'primary' : 'secondary'}>{t(`clubs.roles.${m.role}`)}</Badge> : null}
                {club.canModerate && m.role !== 'owner' ? (
                  <MemberMenu member={m} isOwner={club.isOwner} onAction={(a) => memberAction(m.id, a)} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {club.canModerate ? (
        <aside className="space-y-4">
          <section aria-labelledby="requests" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <h2 id="requests" className="mb-2 font-bold text-fg">
              {t('clubs.requests')}
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('clubs.noRequests')}</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-fg">{m.name}</span>
                    <Button size="sm" onClick={() => memberAction(m.id, 'approve')}>
                      {t('clubs.approve')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => memberAction(m.id, 'reject')}>
                      {t('clubs.decline')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <form
            className="rounded-xl border border-line bg-surface p-4 shadow-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              if (username.trim().length < 3) return;
              if (await act(() => apiRequest(`/clubs/${club.slug}/invites`, { method: 'POST', body: { username: username.replace(/^@/, '') } }))) setUsername('');
            }}
          >
            <Field label={t('clubs.inviteByUsername')}>{(p) => <Input {...p} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" maxLength={31} />}</Field>
            <Button type="submit" variant="outline" className="mt-3">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {t('clubs.invite')}
            </Button>
          </form>
        </aside>
      ) : null}
    </div>
  );
}

function MemberMenu({ member, isOwner, onAction }: { member: ClubMember; isOwner: boolean; onAction: (action: string) => void }) {
  const t = useTranslations('clubs');
  const ref = useRef<HTMLSelectElement>(null);
  const options = [
    ...(isOwner ? [member.role === 'moderator' ? 'demote' : 'promote'] : []),
    ...(member.role === 'moderator' && !isOwner ? [] : ['remove', 'ban']),
  ];
  if (!options.length) return null;
  return (
    <>
      <label htmlFor={`member-${member.id}`} className="sr-only">
        {t('manageMember', { name: member.name })}
      </label>
      <Select
        ref={ref}
        id={`member-${member.id}`}
        value=""
        onChange={(e) => {
          const action = e.target.value;
          if (!action) return;
          if ((action === 'remove' || action === 'ban') && !window.confirm(t(`confirm.${action}`, { name: member.name }))) {
            e.target.value = '';
            return;
          }
          onAction(action);
        }}
        className="h-9 w-auto py-0 text-sm"
      >
        <option value="">{t('manage')}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {t(`actions.${o}`)}
          </option>
        ))}
      </Select>
    </>
  );
}

function Settings({ club, onSaved }: { club: ClubDetail; onSaved: (c: ClubDetail) => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.show(t('errors.tooLarge'), 'danger');
    const body = new FormData();
    body.append('file', file);
    setBusy(true);
    try {
      const res = await api<{ url: string }>(`/clubs/${club.slug}/cover`, { method: 'PUT', body });
      onSaved({ ...club, coverUrl: res.url });
      toast.show(t('common.saved'), 'success');
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => upload(e.target.files?.[0])} />
        <Button variant="outline" loading={busy} onClick={() => input.current?.click()}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {t('clubs.changeCover')}
        </Button>
      </div>
      <ClubForm club={club} onSaved={onSaved} />
    </div>
  );
}
