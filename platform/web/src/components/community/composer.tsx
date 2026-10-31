'use client';

import { COMPOSER_POST_TYPES, MAX_POST_IMAGES, MAX_QUOTE_LENGTH, STUDY_SUBJECTS, type ComposerPostType, type StudySubject } from '@boikonika/shared';
import { ImagePlus, PenSquare, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonClasses } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import type { BookTag, PostView } from '@/lib/community';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import { BookPicker } from './book-picker';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TITLED: readonly ComposerPostType[] = ['discussion', 'recommendation', 'question', 'poem', 'story', 'essay', 'study_tip', 'educational', 'artwork'];

/** Write a post: type, text, optional book, quote source, reading progress, images, audience. */
export function Composer({ onPosted, studentZone: forceStudent = false, defaultSubject }: { onPosted: (post: PostView) => void; studentZone?: boolean; defaultSubject?: StudySubject }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const pathname = usePathname();
  const { status, user } = useAuth();
  const { fromApi } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ComposerPostType>(forceStudent ? 'study_tip' : 'discussion');
  const [form, setForm] = useState({ title: '', body: '', quoteSource: '', readingPercent: '50', visibility: 'public', subject: defaultSubject ?? '', originalWork: false, studentZone: forceStudent });
  const [book, setBook] = useState<BookTag | null>(null);
  const [images, setImages] = useState<Array<{ file: File; url: string }>>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => images.forEach((i) => URL.revokeObjectURL(i.url)), [images]);
  useEffect(() => {
    if (open) bodyRef.current?.focus();
  }, [open]);

  if (status === 'anonymous') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm text-fg-muted">{t('community.joinPrompt')}</p>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses({ size: 'sm' })}>
          {t('auth.login')}
        </Link>
      </div>
    );
  }
  if (status !== 'authenticated' || !user) return null;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const max = type === 'quote' ? MAX_QUOTE_LENGTH : 10_000;

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_POST_IMAGES) {
        toast.show(t('validation.tooManyImages'), 'danger');
        break;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.show(t('errors.tooLarge'), 'danger');
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setImages(next);
    if (fileInput.current) fileInput.current.value = '';
  };

  const reset = () => {
    setForm((f) => ({ ...f, title: '', body: '', quoteSource: '', readingPercent: '50', originalWork: false }));
    setBook(null);
    setImages([]);
    setErrors({});
    setOpen(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: FieldErrors = {};
    if (!form.body.trim()) found.body = t('validation.required');
    if (form.body.length > max) found.body = type === 'quote' ? t('validation.quoteTooLong') : t('validation.maxLength');
    if (type === 'quote' && !book && !form.quoteSource.trim()) found.quoteSource = t('validation.quoteSource');
    if (type === 'reading_progress' && !book) found.bookId = t('validation.bookRequired');
    if (type === 'artwork' && !images.length) found.images = t('validation.imageRequired');
    if (type === 'artwork' && !form.originalWork) found.originalWork = t('validation.originalWork');
    if (form.studentZone && !form.subject) found.subject = t('validation.required');
    setErrors(found);
    if (Object.keys(found).length) return;
    const data = {
      type,
      title: TITLED.includes(type) && form.title.trim() ? form.title : undefined,
      body: form.body,
      bookId: book?.id,
      quoteSource: type === 'quote' && form.quoteSource.trim() ? form.quoteSource : undefined,
      readingPercent: type === 'reading_progress' ? Number(form.readingPercent) : undefined,
      visibility: form.visibility,
      studentZone: form.studentZone,
      subject: form.studentZone ? form.subject : undefined,
      originalWork: type === 'artwork' ? form.originalWork : undefined,
    };
    const body = new FormData();
    body.append('data', JSON.stringify(data));
    images.forEach((i) => body.append('images', i.file));
    setBusy(true);
    try {
      const res = await apiRequest<PostView>('/posts', { method: 'POST', body });
      toast.show(res.message, res.data.status === 'published' ? 'success' : 'info');
      onPosted(res.data);
      reset();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      if (!Object.keys(fields).length) toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm sm:p-4">
        <Avatar name={user.displayName} src={user.avatarUrl} />
        <button type="button" onClick={() => setOpen(true)} className="flex h-11 flex-1 items-center gap-2 rounded-full border border-line-input bg-surface-sunken px-4 text-left text-fg-subtle hover:border-primary">
          <PenSquare className="h-4 w-4" aria-hidden="true" />
          {forceStudent ? t('community.studentPrompt') : t('community.prompt')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5" aria-label={t('community.newPost')}>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-fg">{t('community.whatKind')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {COMPOSER_POST_TYPES.map((k) => (
            <label key={k} className={cn('cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring', type === k ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}>
              <input type="radio" name="post-type" value={k} checked={type === k} onChange={() => (setType(k), setErrors({}))} className="sr-only" />
              {t(`community.types.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {TITLED.includes(type) ? (
        <Field label={t('community.titleLabel')} error={errors.title}>
          {(p) => <Input {...p} value={form.title} onChange={set('title')} maxLength={200} />}
        </Field>
      ) : null}

      <Field label={type === 'quote' ? t('community.quoteLabel') : t('community.bodyLabel')} required error={errors.body} hint={type === 'quote' ? t('community.quoteHint') : undefined}>
        {(p) => (
          <div>
            <Textarea {...p} ref={bodyRef} value={form.body} onChange={set('body')} rows={type === 'poem' || type === 'story' || type === 'essay' ? 10 : 5} maxLength={max} placeholder={t(`community.placeholders.${type}`)} className={cn((type === 'poem' || type === 'story' || type === 'quote') && 'font-serif')} />
            <p className={cn('mt-1 text-right text-xs', form.body.length > max * 0.9 ? 'text-warning-soft-fg' : 'text-fg-subtle')} aria-live="polite">
              {t('community.charsLeft', { count: max - form.body.length })}
            </p>
          </div>
        )}
      </Field>

      {type === 'quote' ? (
        <Field label={t('community.quoteSource')} error={errors.quoteSource} hint={t('community.quoteSourceHint')}>
          {(p) => <Input {...p} value={form.quoteSource} onChange={set('quoteSource')} maxLength={200} />}
        </Field>
      ) : null}

      <BookPicker value={book} onChange={setBook} label={type === 'reading_progress' ? t('community.whichBook') : t('community.tagBook')} required={type === 'reading_progress'} error={errors.bookId} />

      {type === 'reading_progress' ? (
        <Field label={t('community.howFar')} error={errors.readingPercent}>
          {(p) => (
            <div className="flex items-center gap-3">
              <input {...p} type="range" min={0} max={100} step={5} value={form.readingPercent} onChange={set('readingPercent')} className="flex-1 accent-[var(--bk-primary)]" />
              <span className="w-12 text-right font-semibold tabular-nums text-fg">{format.number(Number(form.readingPercent) / 100, { style: 'percent' })}</span>
            </div>
          )}
        </Field>
      ) : null}

      <div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => addImages(e.target.files)} />
        {images.length ? (
          <ul className="mb-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <li key={img.url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setImages((list) => list.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-overlay p-0.5 text-white" aria-label={t('community.removeImage', { n: i + 1 })}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={images.length >= MAX_POST_IMAGES}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {t('community.addImages', { count: MAX_POST_IMAGES })}
        </Button>
        {errors.images ? (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.images}
          </p>
        ) : null}
        {type === 'artwork' ? (
          <div className="mt-3">
            <Checkbox label={t('community.originalWork')} checked={form.originalWork} onChange={(e) => setForm((f) => ({ ...f, originalWork: e.target.checked }))} aria-invalid={errors.originalWork ? true : undefined} />
            {errors.originalWork ? <p className="mt-1 text-sm text-danger">{errors.originalWork}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('community.whoCanSee')}>
          {(p) => (
            <Select {...p} value={form.visibility} onChange={set('visibility')}>
              {(['public', 'followers', 'private'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`community.visibility.${v}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="space-y-2">
          {forceStudent ? null : <Checkbox className="mt-8" label={t('community.postInStudentZone')} checked={form.studentZone} onChange={(e) => setForm((f) => ({ ...f, studentZone: e.target.checked }))} />}
          {form.studentZone ? (
            <Field label={t('community.subject')} required error={errors.subject}>
              {(p) => (
                <Select {...p} value={form.subject} onChange={set('subject')}>
                  <option value="">—</option>
                  {STUDY_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`subjects.${s}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-fg-muted">{t('community.guidelinesShort')}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={reset}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={busy}>
          {t('community.post')}
        </Button>
      </div>
    </form>
  );
}
