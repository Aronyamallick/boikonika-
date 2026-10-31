'use client';

import { localizeDigits } from '@boikonika/shared';
import { BadgeCheck, Bookmark, Flag, Heart, Lock, MessageCircle, MoreHorizontal, Pencil, Share2, Trash2, Users } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { RelativeTime } from '@/components/ui/relative-time';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import type { PostView } from '@/lib/community';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import { ReportDialog } from './report-dialog';

const CLAMP = 480;

/** Community post: author, content (quote, progress, book, images) and like / comment / save / share actions. */
export function PostCard({ post: initial, detail = false, onDeleted }: { post: PostView; detail?: boolean; onDeleted?: (id: string) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { status } = useAuth();
  const [post, setPost] = useState(initial);
  const [expanded, setExpanded] = useState(detail);
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'report' | null>(null);
  const long = post.body.length > CLAMP;
  const body = expanded || !long ? post.body : `${post.body.slice(0, CLAMP).replace(/\s+\S*$/, '')}…`;
  const titleId = `post-${post.id}-title`;
  const Heading = detail ? 'h1' : 'h2';

  const requireLogin = () => {
    if (status === 'authenticated') return false;
    toast.show(t('community.signInToInteract'), 'info');
    return true;
  };

  const toggle = async (kind: 'like' | 'bookmark') => {
    if (requireLogin()) return;
    const on = kind === 'like' ? !post.liked : !post.bookmarked;
    const before = post;
    setPost((p) => (kind === 'like' ? { ...p, liked: on, likeCount: p.likeCount + (on ? 1 : -1) } : { ...p, bookmarked: on, bookmarkCount: p.bookmarkCount + (on ? 1 : -1) }));
    try {
      const res = await api<{ likeCount?: number; bookmarkCount?: number }>(`/posts/${post.id}/${kind}`, { method: on ? 'PUT' : 'DELETE' });
      setPost((p) => ({ ...p, ...(res.likeCount !== undefined ? { likeCount: res.likeCount } : {}), ...(res.bookmarkCount !== undefined ? { bookmarkCount: res.bookmarkCount } : {}) }));
      if (kind === 'bookmark') toast.show(on ? t('community.saved') : t('community.unsaved'), 'success');
    } catch {
      setPost(before);
      toast.show(t('errors.generic'), 'danger');
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${locale === 'bn' ? '' : `/${locale}`}/posts/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: post.title ?? t('community.postBy', { name: post.author.name }), url });
      else {
        await navigator.clipboard.writeText(url);
        toast.show(t('community.linkCopied'), 'success');
      }
    } catch {
      // The person closed the share sheet.
    }
  };

  return (
    <article aria-labelledby={titleId} className={cn('rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5', post.status !== 'published' && 'border-dashed')}>
      <header className="flex items-start gap-3">
        <Link href={`/u/${post.author.username}`} aria-hidden="true" tabIndex={-1}>
          <Avatar name={post.author.name} src={post.author.avatarUrl} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
            <Link href={`/u/${post.author.username}`} className="font-semibold text-fg hover:text-primary">
              {post.author.name}
            </Link>
            {post.author.isAuthor ? <BadgeCheck className="h-4 w-4 text-primary" aria-label={t('community.verifiedAuthor')} /> : null}
            <span className="text-fg-subtle">·</span>
            <Link href={`/posts/${post.id}`} className="text-fg-subtle hover:underline">
              <RelativeTime date={post.createdAt} />
            </Link>
            {post.editedAt ? <span className="text-fg-subtle">· {t('community.edited')}</span> : null}
            {post.visibility !== 'public' ? (
              <span className="inline-flex items-center text-fg-subtle" title={t(`community.visibility.${post.visibility}`)}>
                {post.visibility === 'followers' ? <Users className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                <span className="sr-only">{t(`community.visibility.${post.visibility}`)}</span>
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{t(`community.types.${post.type}`)}</Badge>
            {post.studentZone && post.subject ? <Badge tone="secondary">{t(`subjects.${post.subject}`)}</Badge> : null}
            {post.status !== 'published' ? <Badge tone="warning">{t('community.pendingReview')}</Badge> : null}
          </p>
        </div>
        <PostMenu post={post} onAction={setDialog} />
      </header>

      <div className="mt-3">
        {post.title ? (
          <Heading id={titleId} className={cn('font-bold leading-snug text-fg', detail ? 'text-2xl' : 'text-lg')}>
            {detail ? post.title : <Link href={`/posts/${post.id}`} className="hover:text-primary">{post.title}</Link>}
          </Heading>
        ) : (
          <Heading id={titleId} className="sr-only">
            {t('community.postBy', { name: post.author.name })}
          </Heading>
        )}
        {post.type === 'quote' ? (
          <figure className="mt-2 border-l-4 border-accent pl-4">
            <blockquote className="whitespace-pre-line font-serif text-lg leading-relaxed text-fg">{body}</blockquote>
            {post.quoteSource || post.book ? <figcaption className="mt-1 text-sm text-fg-muted">— {post.quoteSource ?? post.book?.title}</figcaption> : null}
          </figure>
        ) : (
          <p className={cn('mt-1.5 whitespace-pre-line break-words leading-relaxed text-fg', (post.type === 'poem' || post.type === 'story') && 'font-serif text-[17px]')}>{body}</p>
        )}
        {long && !detail ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-semibold text-primary hover:underline" aria-expanded={expanded}>
            {expanded ? t('community.showLess') : t('community.readMore')}
          </button>
        ) : null}

        {post.type === 'reading_progress' && post.readingPercent !== null ? (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-fg-muted">
              <span>{t('community.readingProgress')}</span>
              <span className="font-semibold text-fg">{localizeDigits(post.readingPercent, locale)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-primary-soft" role="progressbar" aria-valuenow={post.readingPercent} aria-valuemin={0} aria-valuemax={100} aria-label={t('community.readingProgress')}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${post.readingPercent}%` }} />
            </div>
          </div>
        ) : null}

        {post.media.length ? (
          <div className={cn('mt-3 grid gap-1.5 overflow-hidden rounded-lg', post.media.length > 1 && 'grid-cols-2')}>
            {post.media.map((m, i) => (
              <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer" className="block bg-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image with known dimensions */}
                <img
                  src={m.url}
                  alt={m.alt ?? t('community.imageAlt', { n: i + 1, name: post.author.name })}
                  width={m.width ?? undefined}
                  height={m.height ?? undefined}
                  loading="lazy"
                  className={cn('w-full object-cover', post.media.length === 1 ? 'max-h-[28rem]' : 'aspect-square')}
                />
              </a>
            ))}
          </div>
        ) : null}

        {post.book ? (
          <Link href={`/books/${post.book.slug}`} className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-surface-sunken p-2.5 hover:border-primary">
            <BookCover src={post.book.coverUrl} title={post.book.title} className="w-10 shrink-0 rounded p-0.5 text-[5px]" sizes="2.5rem" />
            <span className="min-w-0">
              <span className="line-clamp-1 font-semibold text-fg">{post.book.title}</span>
              {post.book.authors.length ? <span className="line-clamp-1 text-xs text-fg-muted">{post.book.authors.join(', ')}</span> : null}
            </span>
          </Link>
        ) : null}
      </div>

      {post.status === 'published' ? (
        <footer className="-mx-2 mt-3 flex items-center gap-1 text-sm">
          <ActionButton pressed={post.liked} onClick={() => toggle('like')} label={t('community.like')} count={post.likeCount}>
            <Heart className={cn('h-[18px] w-[18px]', post.liked && 'fill-danger text-danger')} aria-hidden="true" />
          </ActionButton>
          <Link href={`/posts/${post.id}#comments`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-fg-muted hover:bg-subtle hover:text-fg">
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="sr-only">{t('community.comments')}</span>
            {format.number(post.commentCount)}
          </Link>
          <ActionButton pressed={post.bookmarked} onClick={() => toggle('bookmark')} label={t('community.save')}>
            <Bookmark className={cn('h-[18px] w-[18px]', post.bookmarked && 'fill-primary text-primary')} aria-hidden="true" />
          </ActionButton>
          <button type="button" onClick={share} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-fg-muted hover:bg-subtle hover:text-fg">
            <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t('community.share')}</span>
          </button>
        </footer>
      ) : null}

      {dialog === 'edit' ? <EditPostDialog post={post} onClose={() => setDialog(null)} onSaved={(p) => setPost(p)} /> : null}
      <DeletePostDialog open={dialog === 'delete'} postId={post.id} onClose={() => setDialog(null)} onDeleted={() => onDeleted?.(post.id)} />
      <ReportDialog open={dialog === 'report'} onClose={() => setDialog(null)} targetType="post" targetId={post.id} />
    </article>
  );
}

function ActionButton({ pressed, onClick, label, count, children }: { pressed: boolean; onClick: () => void; label: string; count?: number; children: React.ReactNode }) {
  const format = useFormatter();
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 hover:bg-subtle', pressed ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
      {children}
      <span className="sr-only">{label}</span>
      {count !== undefined ? format.number(count) : null}
    </button>
  );
}

function PostMenu({ post, onAction }: { post: PostView; onAction: (a: 'edit' | 'delete' | 'report') => void }) {
  const t = useTranslations();
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  if (status !== 'authenticated') return null;
  const items = post.mine
    ? [
        { key: 'edit' as const, label: t('common.edit'), Icon: Pencil },
        { key: 'delete' as const, label: t('common.remove'), Icon: Trash2 },
      ]
    : [{ key: 'report' as const, label: t('report.title'), Icon: Flag }];
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((v) => !v)} className="rounded-lg p-1.5 text-fg-subtle hover:bg-subtle hover:text-fg">
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">{t('community.moreActions')}</span>
      </button>
      {open ? (
        <ul id={menuId} role="menu" className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface-raised py-1 shadow-lg">
          {items.map(({ key, label, Icon }) => (
            <li key={key} role="none">
              <button
                type="button"
                role="menuitem"
                autoFocus={key === items[0]!.key}
                onClick={() => (setOpen(false), onAction(key))}
                className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none', key === 'delete' || key === 'report' ? 'text-danger' : 'text-fg')}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EditPostDialog({ post, onClose, onSaved }: { post: PostView; onClose: () => void; onSaved: (p: PostView) => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({ title: post.title ?? '', body: post.body, visibility: post.visibility });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest<PostView>(`/posts/${post.id}`, { method: 'PATCH', body: { title: form.title.trim() || null, body: form.body, visibility: form.visibility } });
      onSaved(res.data);
      toast.show(res.message, 'success');
      onClose();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      if (!Object.keys(fields).length) toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('community.editPost')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={busy} onClick={() => save()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4" noValidate>
        <Field label={t('community.titleLabel')} error={errors.title}>
          {(p) => <Input {...p} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={200} />}
        </Field>
        <Field label={t('community.bodyLabel')} required error={errors.body}>
          {(p) => <Textarea {...p} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={8} maxLength={post.type === 'quote' ? 600 : 10000} />}
        </Field>
        <Field label={t('community.whoCanSee')}>
          {(p) => (
            <Select {...p} value={form.visibility} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as PostView['visibility'] }))}>
              {(['public', 'followers', 'private'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`community.visibility.${v}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  );
}

function DeletePostDialog({ open, postId, onClose, onDeleted }: { open: boolean; postId: string; onClose: () => void; onDeleted: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('community.deleteTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await apiRequest(`/posts/${postId}`, { method: 'DELETE' });
                toast.show(res.message, 'success');
                onClose();
                onDeleted();
              } catch (err) {
                toast.show(fromApi(err).message, 'danger');
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('common.remove')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-muted">{t('community.deleteText')}</p>
    </Dialog>
  );
}
