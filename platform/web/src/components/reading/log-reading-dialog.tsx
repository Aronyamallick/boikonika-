'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import type { LibraryItem } from '@/lib/reading';

export interface SessionDraft {
  minutes: number;
  startedAt?: string;
  source: 'timer' | 'manual';
  bookId?: string;
}

const toInt = (v: string) => Number(v.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).trim());

/**
 * Log reading time: minutes, optionally a book from "Currently reading" and the page reached (the
 * pages read are worked out from the previous position), or pages read without a book.
 */
export function LogReadingDialog({ open, draft, books, onClose, onLogged }: { open: boolean; draft: SessionDraft | null; books: LibraryItem[]; onClose: () => void; onLogged: () => void }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({ bookId: '', minutes: '', currentPage: '', pages: '', daysAgo: '0' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const book = books.find((b) => b.book.id === draft?.bookId) ?? books[0];
    setForm({ bookId: draft?.bookId ?? book?.book.id ?? '', minutes: draft ? String(draft.minutes) : '', currentPage: '', pages: '', daysAgo: '0' });
    setErrors({});
  }, [open, draft, books]);

  const selected = books.find((b) => b.book.id === form.bookId);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const minutes = toInt(form.minutes);
    const found: FieldErrors = {};
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) found.minutes = t('validation.minutes');
    const currentPage = form.currentPage.trim() ? toInt(form.currentPage) : undefined;
    if (currentPage !== undefined && (!Number.isInteger(currentPage) || currentPage < 0)) found.currentPage = t('validation.integer');
    if (currentPage !== undefined && selected?.progress.totalPages && currentPage > selected.progress.totalPages) found.currentPage = t('validation.pageBeyondEnd');
    const pages = form.pages.trim() ? toInt(form.pages) : undefined;
    if (pages !== undefined && (!Number.isInteger(pages) || pages < 0)) found.pages = t('validation.integer');
    setErrors(found);
    if (Object.keys(found).length) return;
    const daysAgo = Number(form.daysAgo);
    const startedAt = draft?.startedAt ?? (daysAgo ? new Date(Date.now() - daysAgo * 86_400_000 - minutes * 60_000).toISOString() : undefined);
    setBusy(true);
    try {
      const res = await apiRequest<{ finishedBook: boolean; completedChallenges: string[] }>('/me/reading/sessions', {
        method: 'POST',
        body: { minutes, bookId: form.bookId || undefined, currentPage: form.bookId ? currentPage : undefined, pages: form.bookId ? undefined : pages, startedAt, source: draft?.source ?? 'manual' },
      });
      toast.show(res.data.finishedBook ? t('library.finishedToast') : res.message, 'success');
      if (res.data.completedChallenges.length) toast.show(t('library.challengeToast', { count: res.data.completedChallenges.length }), 'success');
      onLogged();
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
      open={open}
      onClose={onClose}
      title={t('library.logTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={busy} onClick={() => submit()}>
            {t('library.logSave')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label={t('library.minutes')} required error={errors.minutes}>
          {(p) => <Input {...p} value={form.minutes} onChange={set('minutes')} inputMode="numeric" maxLength={3} autoFocus={!draft} />}
        </Field>
        {draft?.startedAt ? null : (
          <Field label={t('library.when')}>
            {(p) => (
              <Select {...p} value={form.daysAgo} onChange={set('daysAgo')}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? t('library.today') : d === 1 ? t('library.yesterday') : format.dateTime(new Date(Date.now() - d * 86_400_000), { weekday: 'long', day: 'numeric', month: 'short' })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={t('library.book')}>
          {(p) => (
            <Select {...p} value={form.bookId} onChange={set('bookId')}>
              <option value="">{t('library.noBook')}</option>
              {books.map((b) => (
                <option key={b.book.id} value={b.book.id}>
                  {b.book.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {form.bookId ? (
          <Field
            label={t('library.pageReached')}
            error={errors.currentPage}
            hint={selected ? t('library.pageHint', { from: format.number(selected.progress.currentPage), total: selected.progress.totalPages ? format.number(selected.progress.totalPages) : '—' }) : undefined}
          >
            {(p) => <Input {...p} value={form.currentPage} onChange={set('currentPage')} inputMode="numeric" maxLength={5} />}
          </Field>
        ) : (
          <Field label={t('library.pagesRead')} error={errors.pages}>
            {(p) => <Input {...p} value={form.pages} onChange={set('pages')} inputMode="numeric" maxLength={4} />}
          </Field>
        )}
      </form>
    </Dialog>
  );
}
