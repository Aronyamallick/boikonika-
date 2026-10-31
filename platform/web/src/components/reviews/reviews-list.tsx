'use client';

import { localizeDigits } from '@boikonika/shared';
import { BadgeCheck, MessageSquareText, PenLine, Star, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { RatingSummary } from '@/components/catalog/rating-summary';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Rating } from '@/components/ui/rating';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import type { RatingSummary as Summary } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified: boolean;
  helpfulCount: number;
  notHelpfulCount: number;
  sellerReply: { body: string; store: string | null; at: string } | null;
  createdAt: string;
  edited: boolean;
  pending: boolean;
  mine: boolean;
  myVote: boolean | null;
  user: { name: string; username: string; avatarUrl: string | null };
}

interface Eligibility {
  canReview: boolean;
  verified: boolean;
  reviewId: string | null;
}

const SORTS = ['helpful', 'newest', 'highest', 'lowest'] as const;
const PAGE_SIZE = 10;

/**
 * Published reviews of a book (shared by every seller's copy) or of a general product, with sorting,
 * star and verified-purchase filters, helpful votes, and the signed-in reader's own review form.
 */
export function ReviewsList({ kind, slug, targetId, rating: initialRating }: { kind: 'book' | 'product'; slug: string; targetId: string; rating: Summary }) {
  const t = useTranslations();
  const locale = useLocale();
  const { status } = useAuth();
  const pathname = usePathname();
  const [summary, setSummary] = useState(initialRating);
  const [sort, setSort] = useState<(typeof SORTS)[number]>('helpful');
  const [rating, setRating] = useState<number | null>(null);
  const [verified, setVerified] = useState(false);
  const [items, setItems] = useState<Review[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [composing, setComposing] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const autoOpened = useRef(false);
  const detailPath = `/${kind === 'book' ? 'books' : 'products'}/${encodeURIComponent(slug)}`;
  const base = `${detailPath}/reviews`;
  const targetKey = kind === 'book' ? 'bookId' : 'productId';

  const fetchPage = useCallback(
    (p: number) => apiRequest<Review[]>(base, { query: { sort, rating: rating ?? undefined, verified: verified ? 'true' : undefined, page: p, pageSize: PAGE_SIZE } }),
    [base, sort, rating, verified],
  );

  const reload = useCallback(() => {
    setItems(null);
    setPage(1);
    fetchPage(1).then(
      (res) => (setItems(res.data), setTotal(res.meta?.total ?? 0)),
      () => setItems([]),
    );
  }, [fetchPage]);
  // The viewer's own (possibly pending) review is included once signed in.
  useEffect(reload, [reload, status]);

  const loadEligibility = useCallback(() => {
    if (status !== 'authenticated') return setEligibility(null);
    api<Eligibility>('/reviews/eligibility', { query: { [targetKey]: targetId } }).then(setEligibility, () => setEligibility(null));
  }, [status, targetKey, targetId]);
  useEffect(loadEligibility, [loadEligibility]);

  // "Write a review" links from delivered orders open the form directly.
  useEffect(() => {
    if (autoOpened.current || !eligibility || new URLSearchParams(window.location.search).get('review') !== '1') return;
    autoOpened.current = true;
    if (eligibility.canReview || eligibility.reviewId) {
      setComposing(true);
      formRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [eligibility]);

  const more = async () => {
    setLoadingMore(true);
    try {
      const res = await fetchPage(page + 1);
      setItems((prev) => [...(prev ?? []), ...res.data]);
      setPage((p) => p + 1);
      setTotal(res.meta?.total ?? total);
    } finally {
      setLoadingMore(false);
    }
  };

  const afterChange = () => {
    setComposing(false);
    reload();
    loadEligibility();
    // The page itself is cached; refresh the average and star breakdown from the API.
    api<{ rating: Summary }>(detailPath).then((d) => setSummary(d.rating), () => undefined);
  };

  const filtered = rating !== null || verified;
  return (
    <div className="space-y-5">
      <RatingSummary rating={summary} />
      <div ref={formRef} className="pt-3">
        {status === 'anonymous' ? (
          <p className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-fg-muted">
            <MessageSquareText className="h-5 w-5 text-fg-subtle" aria-hidden="true" />
            {t('reviews.signInPrompt')}
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses({ size: 'sm', variant: 'outline' })}>
              {t('reviews.signIn')}
            </Link>
          </p>
        ) : eligibility && composing ? (
          <ReviewForm targetKey={targetKey} targetId={targetId} reviewId={eligibility.reviewId} verified={eligibility.verified} onDone={afterChange} onCancel={() => setComposing(false)} />
        ) : eligibility?.reviewId ? (
          <Button variant="outline" onClick={() => setComposing(true)}>
            <PenLine className="h-4 w-4" aria-hidden="true" />
            {t('reviews.editYours')}
          </Button>
        ) : eligibility?.canReview ? (
          <Button onClick={() => setComposing(true)}>
            <PenLine className="h-4 w-4" aria-hidden="true" />
            {t('reviews.write')}
          </Button>
        ) : eligibility ? (
          <p className="text-sm text-fg-muted">{t('reviews.buyersOnly')}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('common.filter')}>
        <label className="sr-only" htmlFor={`${targetId}-sort`}>
          {t('catalog.sortBy')}
        </label>
        <Select id={`${targetId}-sort`} value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])} className="h-9 w-auto py-0 text-sm">
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`reviews.sort.${s}`)}
            </option>
          ))}
        </Select>
        {[5, 4, 3, 2, 1].map((star) => (
          <button
            key={star}
            type="button"
            aria-pressed={rating === star}
            onClick={() => setRating((r) => (r === star ? null : star))}
            className={cn('inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold', rating === star ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}
          >
            {localizeDigits(star, locale)}
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{t('reviews.starsOnly', { count: star })}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={verified}
          onClick={() => setVerified((v) => !v)}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold', verified ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}
        >
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          {t('reviews.verifiedOnly')}
        </button>
      </div>

      {items === null ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-fg-muted">{filtered ? t('reviews.emptyFiltered') : t('reviews.empty')}</p>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface px-5">
            {items.map((r) => (
              <ReviewItem key={r.id} review={r} onEdit={() => (setComposing(true), formRef.current?.scrollIntoView({ block: 'center' }))} onDeleted={afterChange} />
            ))}
          </ul>
          {items.length < total ? (
            <div className="text-center">
              <Button variant="outline" loading={loadingMore} onClick={more}>
                {t('reviews.showMore')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReviewItem({ review, onEdit, onDeleted }: { review: Review; onEdit: () => void; onDeleted: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { status } = useAuth();
  const { fromApi } = useFormErrors();
  const [votes, setVotes] = useState({ helpfulCount: review.helpfulCount, notHelpfulCount: review.notHelpfulCount, myVote: review.myVote });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const vote = async (helpful: boolean) => {
    if (status !== 'authenticated') {
      toast.show(t('reviews.signInToVote'), 'info');
      return;
    }
    try {
      setVotes(await api<typeof votes>(`/reviews/${review.id}/vote`, { method: 'POST', body: { helpful } }));
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await apiRequest(`/reviews/${review.id}`, { method: 'DELETE' });
      toast.show(res.message, 'success');
      setConfirming(false);
      onDeleted();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-5">
      <div className="flex items-start gap-3">
        <Avatar name={review.user.name} src={review.user.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Link href={`/u/${review.user.username}`} className="font-semibold text-fg hover:text-primary">
              {review.user.name}
            </Link>
            <span className="text-fg-subtle">
              {format.dateTime(new Date(review.createdAt), { dateStyle: 'medium' })}
              {review.edited ? ` · ${t('reviews.edited')}` : ''}
            </span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Rating value={review.rating} label={t('book.rating', { rating: localizeDigits(review.rating, locale) })} />
            {review.verified ? (
              <Badge tone="success">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t('reviews.verified')}
              </Badge>
            ) : null}
            {review.pending ? <Badge tone="warning">{t('reviews.pending')}</Badge> : null}
          </div>
          {review.title ? <h3 className="mt-2 font-bold text-fg">{review.title}</h3> : null}
          {review.body ? <p className="mt-1 whitespace-pre-line break-words text-[15px] leading-relaxed text-fg">{review.body}</p> : null}
          {review.sellerReply ? (
            <div className="mt-3 rounded-lg border-l-4 border-secondary bg-secondary-soft/50 px-3 py-2 text-sm">
              <p className="text-xs font-semibold text-secondary-soft-fg">{review.sellerReply.store ? t('reviews.replyFrom', { store: review.sellerReply.store }) : t('reviews.sellerReply')}</p>
              <p className="mt-0.5 whitespace-pre-line text-fg">{review.sellerReply.body}</p>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {review.mine ? (
              <>
                <Button size="sm" variant="ghost" onClick={onEdit}>
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  {t('common.edit')}
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirming(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t('common.remove')}
                </Button>
              </>
            ) : review.pending ? null : (
              <>
                <span className="text-fg-muted">{t('reviews.helpfulQuestion')}</span>
                <Button size="sm" variant="ghost" aria-pressed={votes.myVote === true} className={votes.myVote === true ? 'bg-primary-soft text-primary-soft-fg' : undefined} onClick={() => vote(true)}>
                  <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                  {t('reviews.helpful', { count: votes.helpfulCount })}
                </Button>
                <Button size="sm" variant="ghost" aria-pressed={votes.myVote === false} className={votes.myVote === false ? 'bg-subtle' : undefined} onClick={() => vote(false)}>
                  <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">{t('reviews.notHelpful')}</span>
                  {format.number(votes.notHelpfulCount)}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('reviews.deleteTitle')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              {t('common.remove')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">{t('reviews.deleteText')}</p>
      </Dialog>
    </li>
  );
}

function StarInput({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const t = useTranslations('reviews');
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-fg">
        {t('yourRating')} <span className="text-danger">*</span>
      </legend>
      <div className="flex items-center gap-1" onPointerLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring" onPointerEnter={() => setHover(star)}>
            <input type="radio" name={name} value={star} checked={value === star} onChange={() => onChange(star)} className="sr-only" aria-describedby={error ? `${name}-error` : undefined} />
            <Star className={cn('h-8 w-8 transition-colors', star <= shown ? 'fill-accent text-accent-hover' : 'text-line-input')} aria-hidden="true" />
            <span className="sr-only">{t('stars', { count: star })}</span>
          </label>
        ))}
        {shown ? <span className="ml-2 text-sm text-fg-muted">{t(`ratingWord.${shown}`)}</span> : null}
      </div>
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function ReviewForm({ targetKey, targetId, reviewId, verified, onDone, onCancel }: { targetKey: 'bookId' | 'productId'; targetId: string; reviewId: string | null; verified: boolean; onDone: () => void; onCancel: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({ rating: 0, title: '', body: '' });
  const [loaded, setLoaded] = useState(!reviewId);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!reviewId) return;
    api<Array<{ id: string; rating: number; title: string | null; body: string | null }>>('/me/reviews').then(
      (mine) => {
        const own = mine.find((r) => r.id === reviewId);
        if (own) setForm({ rating: Number(own.rating), title: own.title ?? '', body: own.body ?? '' });
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, [reviewId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.rating) {
      setErrors({ rating: t('validation.rating') });
      return;
    }
    setErrors({});
    setBusy(true);
    const body = { rating: form.rating, title: form.title.trim() || (reviewId ? null : undefined), body: form.body.trim() || (reviewId ? null : undefined) };
    try {
      const res = reviewId ? await apiRequest(`/reviews/${reviewId}`, { method: 'PATCH', body }) : await apiRequest('/reviews', { method: 'POST', body: { ...body, [targetKey]: targetId } });
      toast.show(res.message, 'success');
      onDone();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      if (!Object.keys(fields).length) toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <Skeleton className="h-64 w-full" />;
  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-fg">{reviewId ? t('reviews.editYours') : t('reviews.write')}</h3>
        {verified ? (
          <Badge tone="success">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('reviews.verified')}
          </Badge>
        ) : null}
      </div>
      <StarInput value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} error={errors.rating} />
      <Field label={t('reviews.titleLabel')} error={errors.title}>
        {(p) => <Input {...p} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={160} />}
      </Field>
      <Field label={t('reviews.bodyLabel')} hint={t('reviews.guidelines')} error={errors.body}>
        {(p) => <Textarea {...p} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={6} maxLength={5000} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          {reviewId ? t('common.save') : t('reviews.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
