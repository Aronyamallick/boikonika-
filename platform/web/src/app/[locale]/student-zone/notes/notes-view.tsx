'use client';

import { STUDY_SUBJECTS } from '@boikonika/shared';
import { Lock, NotebookPen, Plus, Trash2, Users, Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BookPicker } from '@/components/community/book-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import type { BookTag } from '@/lib/community';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import type { StudyNote } from '@/lib/student';

const EMPTY = { title: '', body: '', subject: '', page: '', visibility: 'private' as StudyNote['visibility'] };
const VIS_ICON = { private: Lock, followers: Users, public: Globe } as const;

/** Personal study notes: a list by subject and an editor (private unless shared). */
export function NotesView() {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [notes, setNotes] = useState<StudyNote[] | null>(null);
  const [subject, setSubject] = useState('');
  const [editing, setEditing] = useState<StudyNote | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [book, setBook] = useState<BookTag | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<StudyNote[]>('/me/notes', { query: { subject: subject || undefined } }).then(setNotes, () => setNotes([])), [subject]);
  useEffect(() => {
    void load();
  }, [load]);

  const open = (note: StudyNote | 'new') => {
    setEditing(note);
    setErrors({});
    setBook(null);
    setForm(note === 'new' ? { ...EMPTY, subject } : { title: note.title, body: note.body, subject: note.subject ?? '', page: note.page ? String(note.page) : '', visibility: note.visibility });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const found: FieldErrors = {};
    if (!form.title.trim()) found.title = t('validation.required');
    if (!form.body.trim()) found.body = t('validation.required');
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = { title: form.title, body: form.body, subject: form.subject || undefined, page: form.page ? Number(form.page) : undefined, visibility: form.visibility, bookId: book?.id };
    setBusy(true);
    try {
      const res = editing === 'new' ? await apiRequest<StudyNote>('/me/notes', { method: 'POST', body }) : await apiRequest<StudyNote>(`/me/notes/${(editing as StudyNote).id}`, { method: 'PATCH', body });
      toast.show(res.message, 'success');
      setEditing(res.data);
      void load();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      if (!Object.keys(fields).length) toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (note: StudyNote) => {
    if (!window.confirm(t('student.deleteNoteConfirm'))) return;
    try {
      const res = await apiRequest(`/me/notes/${note.id}`, { method: 'DELETE' });
      toast.show(res.message, 'success');
      setEditing(null);
      void load();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('student.myNotes')}</h1>
          <p className="mt-1 text-fg-muted">{t('student.notesIntro')}</p>
        </div>
        <Button onClick={() => open('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('student.newNote')}
        </Button>
      </header>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <label htmlFor="notes-subject" className="sr-only">
            {t('community.subject')}
          </label>
          <Select id="notes-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">{t('student.allSubjects')}</option>
            {STUDY_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {t(`subjects.${s}`)}
              </option>
            ))}
          </Select>
          {notes === null ? (
            <Skeleton className="h-40 w-full" />
          ) : notes.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('student.noNotes')}</p>
          ) : (
            <ul className="space-y-1">
              {notes.map((n) => {
                const Icon = VIS_ICON[n.visibility];
                const active = editing !== 'new' && editing?.id === n.id;
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => open(n)} aria-current={active ? 'true' : undefined} className={cn('w-full rounded-lg px-3 py-2 text-left', active ? 'bg-primary-soft' : 'hover:bg-subtle')}>
                      <span className="flex items-center gap-2 font-semibold text-fg">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-label={t(`community.visibility.${n.visibility}`)} />
                        <span className="truncate">{n.title}</span>
                      </span>
                      <span className="block text-xs text-fg-muted">
                        {n.subject ? `${t(`subjects.${n.subject}`)} · ` : ''}
                        <RelativeTime date={n.updatedAt} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
        {editing ? (
          <form onSubmit={save} noValidate className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
            <Field label={t('student.noteTitle')} required error={errors.title}>
              {(p) => <Input {...p} value={form.title} onChange={set('title')} maxLength={200} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('community.subject')}>
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
              <Field label={t('student.notePage')}>{(p) => <Input {...p} value={form.page} onChange={set('page')} inputMode="numeric" maxLength={5} />}</Field>
              <Field label={t('community.whoCanSee')}>
                {(p) => (
                  <Select {...p} value={form.visibility} onChange={set('visibility')}>
                    {(['private', 'followers', 'public'] as const).map((v) => (
                      <option key={v} value={v}>
                        {t(`community.visibility.${v}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            {editing !== 'new' && editing.book ? (
              <p className="text-sm text-fg-muted">{t('student.noteBook', { title: editing.book.title })}</p>
            ) : (
              <BookPicker value={book} onChange={setBook} label={t('community.tagBook')} />
            )}
            <Field label={t('student.noteBody')} required error={errors.body}>
              {(p) => <Textarea {...p} value={form.body} onChange={set('body')} rows={14} maxLength={20000} className="font-[inherit]" />}
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {editing !== 'new' ? (
                <span className="flex items-center gap-2">
                  {editing.visibility !== 'private' ? <Badge tone="secondary">{t(`community.visibility.${editing.visibility}`)}</Badge> : null}
                  <Button type="button" variant="ghost" className="text-danger" onClick={() => remove(editing)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t('common.remove')}
                  </Button>
                </span>
              ) : (
                <span />
              )}
              <Button type="submit" loading={busy}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        ) : (
          <EmptyState icon={<NotebookPen className="h-6 w-6" />} title={t('student.pickNote')} text={t('student.pickNoteText')} />
        )}
      </div>
    </div>
  );
}
