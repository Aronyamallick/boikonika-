'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import type { LibraryItem } from '@/lib/reading';

const toInt = (v: string) => Number(v.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).trim());

/** Correct my position in a book, or mark it finished. */
export function ProgressDialog({ item, onClose, onSaved }: { item: LibraryItem | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({ currentPage: '', totalPages: '', finished: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (item) setForm({ currentPage: String(item.progress.currentPage), totalPages: item.progress.totalPages ? String(item.progress.totalPages) : '', finished: false });
    setErrors({});
  }, [item]);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!item) return;
    const currentPage = toInt(form.currentPage);
    const totalPages = form.totalPages.trim() ? toInt(form.totalPages) : undefined;
    const found: FieldErrors = {};
    if (!Number.isInteger(currentPage) || currentPage < 0) found.currentPage = t('validation.integer');
    if (totalPages !== undefined && (!Number.isInteger(totalPages) || totalPages < 1)) found.totalPages = t('validation.integer');
    if (totalPages && currentPage > totalPages) found.currentPage = t('validation.pageBeyondEnd');
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const res = await api<{ shelf: string }>(`/me/reading/${item.book.id}/progress`, { method: 'PUT', body: { currentPage, totalPages, finished: form.finished || undefined } });
      toast.show(res.shelf === 'completed' ? t('library.finishedToast') : t('common.saved'), 'success');
      onSaved();
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
      open={!!item}
      onClose={onClose}
      title={item ? t('library.progressTitle', { title: item.book.title }) : ''}
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
      <form onSubmit={save} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('library.currentPage')} required error={errors.currentPage}>
            {(p) => <Input {...p} value={form.currentPage} onChange={(e) => setForm((f) => ({ ...f, currentPage: e.target.value }))} inputMode="numeric" maxLength={5} />}
          </Field>
          <Field label={t('library.totalPages')} error={errors.totalPages}>
            {(p) => <Input {...p} value={form.totalPages} onChange={(e) => setForm((f) => ({ ...f, totalPages: e.target.value }))} inputMode="numeric" maxLength={5} />}
          </Field>
        </div>
        <Checkbox label={t('library.markFinished')} checked={form.finished} onChange={(e) => setForm((f) => ({ ...f, finished: e.target.checked }))} />
      </form>
    </Dialog>
  );
}
