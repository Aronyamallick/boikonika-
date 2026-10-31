'use client';

import { Flag, Heart, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RelativeTime } from '@/components/ui/relative-time';
import { Button, buttonClasses } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import type { CommentView } from '@/lib/community';
import { useFormErrors } from '@/lib/forms/errors';
import { ReportDialog } from './report-dialog';

/** Conversation under a post: comments oldest first, one level of replies. */
export function Comments({ postId, onCountChange }: { postId: string; onCountChange?: (delta: number) => void }) {
  const t = useTranslations();
  const { status } = useAuth();
  const pathname = usePathname();
  const [items, setItems] = useState<CommentView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      try {
        const res = await apiRequest<CommentView[]>(`/posts/${postId}/comments`, { query: { cursor: after ?? undefined } });
        setItems((prev) => (after ? [...(prev ?? []), ...res.data] : res.data));
        setCursor(res.meta?.nextCursor ?? null);
      } catch {
        setItems((prev) => prev ?? []);
      } finally {
        setLoading(false);
      }
    },
    [postId],
  );
  useEffect(() => {
    void load(null);
  }, [load, status]);

  // Deep links from notifications (#comment-…) scroll once the thread is on screen.
  useEffect(() => {
    if (!items || !window.location.hash.startsWith('#comment-')) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'center' });
  }, [items]);

  const reload = () => load(null);

  return (
    <section id="comments" aria-labelledby="comments-title" className="scroll-mt-24 space-y-4">
      <h2 id="comments-title" className="text-lg font-bold text-fg">
        {t('community.comments')}
      </h2>
      {status === 'authenticated' ? (
        <CommentForm postId={postId} onDone={() => (onCountChange?.(1), reload())} />
      ) : status === 'anonymous' ? (
        <p className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-fg-muted">
          {t('community.signInToComment')}
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses({ size: 'sm', variant: 'outline' })}>
            {t('auth.login')}
          </Link>
        </p>
      ) : null}
      {items === null ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('community.noComments')}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((c) => (
            <li key={c.id}>
              <CommentItem comment={c} postId={postId} onChanged={reload} onCountChange={onCountChange} />
              {c.replies?.length ? (
                <ul className="ml-6 mt-3 space-y-3 border-l-2 border-line pl-4 sm:ml-12">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentItem comment={r} postId={postId} onChanged={reload} onCountChange={onCountChange} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {cursor ? (
        <Button variant="outline" loading={loading} onClick={() => load(cursor)}>
          {t('community.moreComments')}
        </Button>
      ) : null}
    </section>
  );
}

function CommentForm({ postId, parentId, onDone, onCancel, autoFocus }: { postId: string; parentId?: string; onDone: () => void; onCancel?: () => void; autoFocus?: boolean }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError(t('validation.required'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await apiRequest<{ status: string }>(`/posts/${postId}/comments`, { method: 'POST', body: { body, parentId } });
      if (res.data.status !== 'published') toast.show(res.message, 'info');
      setBody('');
      onDone();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setError(fields.body ?? message);
    } finally {
      setBusy(false);
    }
  };
  const label = parentId ? t('community.replyLabel') : t('community.commentLabel');
  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <label className="sr-only" htmlFor={`comment-${parentId ?? 'new'}`}>
        {label}
      </label>
      <Textarea
        id={`comment-${parentId ?? 'new'}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={parentId ? 2 : 3}
        maxLength={2000}
        placeholder={label}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `comment-${parentId ?? 'new'}-error` : undefined}
      />
      {error ? (
        <p id={`comment-${parentId ?? 'new'}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button type="submit" size="sm" loading={busy}>
          {parentId ? t('community.reply') : t('community.comment')}
        </Button>
      </div>
    </form>
  );
}

function CommentItem({ comment, postId, onChanged, onCountChange }: { comment: CommentView; postId: string; onChanged: () => void; onCountChange?: (delta: number) => void }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { status } = useAuth();
  const { fromApi } = useFormErrors();
  const [state, setState] = useState({ liked: comment.liked, likeCount: comment.likeCount, body: comment.body });
  const [mode, setMode] = useState<'reply' | 'edit' | null>(null);
  const [draft, setDraft] = useState(comment.body ?? '');
  const [reporting, setReporting] = useState(false);

  if (comment.deleted) {
    return (
      <p id={`comment-${comment.id}`} className="rounded-lg bg-subtle px-3 py-2 text-sm italic text-fg-subtle">
        {t('community.commentDeleted')}
      </p>
    );
  }

  const like = async () => {
    if (status !== 'authenticated') {
      toast.show(t('community.signInToInteract'), 'info');
      return;
    }
    const on = !state.liked;
    setState((s) => ({ ...s, liked: on, likeCount: s.likeCount + (on ? 1 : -1) }));
    try {
      const res = await api<{ likeCount: number }>(`/comments/${comment.id}/like`, { method: on ? 'PUT' : 'DELETE' });
      setState((s) => ({ ...s, likeCount: res.likeCount }));
    } catch {
      setState((s) => ({ ...s, liked: !on, likeCount: s.likeCount + (on ? -1 : 1) }));
    }
  };
  const remove = async () => {
    if (!window.confirm(t('community.deleteCommentConfirm'))) return;
    try {
      const res = await apiRequest(`/comments/${comment.id}`, { method: 'DELETE' });
      toast.show(res.message, 'success');
      onCountChange?.(-1);
      onChanged();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };
  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(`/comments/${comment.id}`, { method: 'PATCH', body: { body: draft } });
      setState((s) => ({ ...s, body: draft.trim() }));
      setMode(null);
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };

  return (
    <div id={`comment-${comment.id}`} className="flex scroll-mt-24 gap-3">
      <Link href={`/u/${comment.author.username}`} tabIndex={-1} aria-hidden="true">
        <Avatar name={comment.author.name} src={comment.author.avatarUrl} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-xl bg-subtle px-3 py-2">
          <p className="flex flex-wrap items-center gap-x-2 text-sm">
            <Link href={`/u/${comment.author.username}`} className="font-semibold text-fg hover:text-primary">
              {comment.author.name}
            </Link>
            <RelativeTime date={comment.createdAt} className="text-xs text-fg-subtle" />
            {comment.editedAt ? <span className="text-xs text-fg-subtle">· {t('community.edited')}</span> : null}
            {comment.pending ? <Badge tone="warning">{t('community.pendingReview')}</Badge> : null}
          </p>
          {mode === 'edit' ? (
            <form onSubmit={saveEdit} className="mt-1 space-y-2">
              <label className="sr-only" htmlFor={`edit-${comment.id}`}>
                {t('common.edit')}
              </label>
              <Textarea id={`edit-${comment.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={2000} autoFocus />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" size="sm">
                  {t('common.save')}
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-0.5 whitespace-pre-line break-words text-[15px] text-fg">{state.body}</p>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          <button type="button" onClick={like} aria-pressed={state.liked} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold hover:bg-subtle', state.liked ? 'text-danger' : 'text-fg-muted')}>
            <Heart className={cn('h-3.5 w-3.5', state.liked && 'fill-danger')} aria-hidden="true" />
            <span className="sr-only">{t('community.like')}</span>
            {format.number(state.likeCount)}
          </button>
          {status === 'authenticated' && !comment.pending ? (
            <button type="button" onClick={() => setMode(mode === 'reply' ? null : 'reply')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-fg-muted hover:bg-subtle">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {t('community.reply')}
            </button>
          ) : null}
          {comment.mine ? (
            <button type="button" onClick={() => (setDraft(state.body ?? ''), setMode('edit'))} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-fg-muted hover:bg-subtle">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              {t('common.edit')}
            </button>
          ) : null}
          {comment.canDelete ? (
            <button type="button" onClick={remove} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-danger hover:bg-subtle">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('common.remove')}
            </button>
          ) : null}
          {status === 'authenticated' && !comment.mine ? (
            <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-fg-muted hover:bg-subtle">
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              {t('report.short')}
            </button>
          ) : null}
        </div>
        {mode === 'reply' ? (
          <div className="mt-2">
            <CommentForm postId={postId} parentId={comment.id} autoFocus onCancel={() => setMode(null)} onDone={() => (setMode(null), onCountChange?.(1), onChanged())} />
          </div>
        ) : null}
        <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="comment" targetId={comment.id} />
      </div>
    </div>
  );
}
