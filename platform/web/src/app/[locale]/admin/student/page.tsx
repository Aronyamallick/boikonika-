'use client';

import { ACADEMIC_LEVELS, COMPETITION_KINDS, COMPETITION_STATUSES } from '@boikonika/shared';
import { Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import type { Competition, EducationEvent, Scholarship } from '@/lib/student';

/** A create form that posts JSON and shows field errors from the API. */
function useSubmit(path: string, onDone: () => void) {
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const submit = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErrors({});
    try {
      const res = await apiRequest(path, { method: 'POST', body });
      toast.show(res.message, 'success');
      onDone();
      return true;
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      if (!Object.keys(fields).length) toast.show(message, 'danger');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { submit, errors, busy };
}
const iso = (local: string) => (local ? new Date(local).toISOString() : '');

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="mb-4 font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}

export default function AdminStudentPage() {
  const t = useTranslations();
  return (
    <RequirePermission permission="student.manage">
      <h1 className="text-2xl font-bold">{t('adminStudent.title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('adminStudent.text')}</p>
      <Tabs
        tabs={[
          { label: t('student.competitions'), content: <Competitions /> },
          { label: t('student.events'), content: <Events /> },
          { label: t('student.scholarships'), content: <Scholarships /> },
        ]}
      />
    </RequirePermission>
  );
}

function Events() {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const [items, setItems] = useState<EducationEvent[]>([]);
  const load = useCallback(() => api<EducationEvent[]>('/education-events', { query: { limit: 50 } }).then(setItems, () => undefined), []);
  useEffect(() => {
    void load();
  }, [load]);
  const { submit, errors, busy } = useSubmit('/admin/student/events', load);
  const [form, setForm] = useState({ title: '', startsAt: '', endsAt: '', location: '', organizer: '', onlineUrl: '', audience: 'student', description: '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await submit({ ...form, startsAt: iso(form.startsAt), endsAt: form.endsAt ? iso(form.endsAt) : undefined, onlineUrl: form.onlineUrl || undefined, location: form.location || undefined, organizer: form.organizer || undefined, description: form.description || undefined });
    if (ok) setForm((f) => ({ ...f, title: '', startsAt: '', endsAt: '', description: '' }));
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title={t('adminStudent.newEvent')}>
        <form onSubmit={onSubmit} noValidate className="space-y-3">
          <Field label={t('clubs.eventTitle')} required error={errors.title}>
            {(p) => <Input {...p} value={form.title} onChange={set('title')} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('clubs.startsAt')} required error={errors.startsAt}>
              {(p) => <Input {...p} type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />}
            </Field>
            <Field label={t('clubs.endsAt')} error={errors.endsAt}>
              {(p) => <Input {...p} type="datetime-local" value={form.endsAt} onChange={set('endsAt')} />}
            </Field>
            <Field label={t('clubs.location')}>{(p) => <Input {...p} value={form.location} onChange={set('location')} />}</Field>
            <Field label={t('adminStudent.organizer')}>{(p) => <Input {...p} value={form.organizer} onChange={set('organizer')} />}</Field>
            <Field label={t('clubs.onlineUrl')} error={errors.onlineUrl}>
              {(p) => <Input {...p} type="url" value={form.onlineUrl} onChange={set('onlineUrl')} placeholder="https://" />}
            </Field>
            <Field label={t('adminStudent.audience')}>
              {(p) => (
                <Select {...p} value={form.audience} onChange={set('audience')}>
                  {(['student', 'teacher', 'parent', 'all'] as const).map((a) => (
                    <option key={a} value={a}>
                      {t(`adminStudent.audiences.${a}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label={t('clubs.eventDescription')}>{(p) => <Textarea {...p} value={form.description} onChange={set('description')} rows={3} />}</Field>
          <Button type="submit" loading={busy}>
            {t('clubs.addEvent')}
          </Button>
        </form>
      </Card>
      <Card title={t('student.events')}>
        <ul className="divide-y divide-line">
          {items.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-semibold text-fg">{e.title}</span>
                <span className="block text-xs text-fg-muted">{format.dateTime(new Date(e.startsAt), { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </span>
              <Button size="icon" variant="ghost" className="text-danger" aria-label={t('clubs.deleteEvent', { title: e.title })} onClick={async () => (await apiRequest(`/admin/student/events/${e.id}`, { method: 'DELETE' }).then((r) => toast.show(r.message, 'success')), load())}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Scholarships() {
  const t = useTranslations();
  const toast = useToast();
  const [items, setItems] = useState<Scholarship[]>([]);
  const load = useCallback(() => api<Scholarship[]>('/scholarships', { query: { limit: 50 } }).then(setItems, () => undefined), []);
  useEffect(() => {
    void load();
  }, [load]);
  const { submit, errors, busy } = useSubmit('/admin/student/scholarships', load);
  const [form, setForm] = useState({ title: '', provider: '', description: '', eligibility: '', amountText: '', academicLevel: '', deadline: '', applyUrl: '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || undefined]));
    if (await submit(body)) setForm({ title: '', provider: '', description: '', eligibility: '', amountText: '', academicLevel: '', deadline: '', applyUrl: '' });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title={t('adminStudent.newScholarship')}>
        <form onSubmit={onSubmit} noValidate className="space-y-3">
          <Field label={t('adminStudent.scholarshipTitle')} required error={errors.title}>
            {(p) => <Input {...p} value={form.title} onChange={set('title')} />}
          </Field>
          <Field label={t('adminStudent.provider')} required error={errors.provider}>
            {(p) => <Input {...p} value={form.provider} onChange={set('provider')} />}
          </Field>
          <Field label={t('adminStudent.description')} required error={errors.description}>
            {(p) => <Textarea {...p} value={form.description} onChange={set('description')} rows={3} />}
          </Field>
          <Field label={t('adminStudent.eligibility')}>{(p) => <Textarea {...p} value={form.eligibility} onChange={set('eligibility')} rows={2} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('adminStudent.amount')}>{(p) => <Input {...p} value={form.amountText} onChange={set('amountText')} />}</Field>
            <Field label={t('student.level')}>
              {(p) => (
                <Select {...p} value={form.academicLevel} onChange={set('academicLevel')}>
                  <option value="">{t('student.allLevels')}</option>
                  {ACADEMIC_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`student.levels.${l}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('adminStudent.deadlineLabel')} error={errors.deadline}>
              {(p) => <Input {...p} type="date" value={form.deadline} onChange={set('deadline')} />}
            </Field>
            <Field label={t('adminStudent.applyUrl')} error={errors.applyUrl}>
              {(p) => <Input {...p} type="url" value={form.applyUrl} onChange={set('applyUrl')} placeholder="https://" />}
            </Field>
          </div>
          <Button type="submit" loading={busy}>
            {t('common.save')}
          </Button>
        </form>
      </Card>
      <Card title={t('student.scholarships')}>
        <ul className="divide-y divide-line">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-semibold text-fg">{s.title}</span>
                <span className="block text-xs text-fg-muted">{[s.provider, s.deadline].filter(Boolean).join(' · ')}</span>
              </span>
              <Button size="icon" variant="ghost" className="text-danger" aria-label={`${t('common.remove')} ${s.title}`} onClick={async () => (await apiRequest(`/admin/student/scholarships/${s.id}`, { method: 'DELETE' }).then((r) => toast.show(r.message, 'success')), load())}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

interface Entry {
  id: string;
  status: string;
  score: number | null;
  post: { id: string; title: string | null; excerpt: string };
  author: { username: string; name: string };
}

function Competitions() {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [items, setItems] = useState<Competition[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const load = useCallback(() => api<Competition[]>('/admin/student/competitions').then(setItems, () => undefined), []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (selected) api<Entry[]>(`/admin/student/competitions/${selected}/entries`).then(setEntries, () => setEntries([]));
  }, [selected]);
  const { submit, errors, busy } = useSubmit('/admin/student/competitions', load);
  const [form, setForm] = useState({ title: '', kind: 'writing', rules: '', prizes: '', startsAt: '', endsAt: '', status: 'draft' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setStatus = async (slug: string, status: string) => {
    try {
      await api(`/admin/student/competitions/${slug}/status`, { method: 'PUT', body: { status } });
      toast.show(t('common.saved'), 'success');
      void load();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };
  const judge = async (entry: Entry, status: string, score?: number) => {
    try {
      await api(`/admin/student/entries/${entry.id}`, { method: 'PUT', body: { status, score } });
      setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, status, score: score ?? e.score } : e)));
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };
  return (
    <div className="space-y-6">
      <Card title={t('adminStudent.newCompetition')}>
        <form
          noValidate
          className="grid gap-3 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await submit({ ...form, prizes: form.prizes || undefined, startsAt: iso(form.startsAt), endsAt: iso(form.endsAt) })) setForm({ title: '', kind: 'writing', rules: '', prizes: '', startsAt: '', endsAt: '', status: 'draft' });
          }}
        >
          <Field label={t('adminStudent.competitionTitle')} required error={errors.title}>
            {(p) => <Input {...p} value={form.title} onChange={set('title')} />}
          </Field>
          <Field label={t('adminStudent.kind')}>
            {(p) => (
              <Select {...p} value={form.kind} onChange={set('kind')}>
                {COMPETITION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`student.competitionKinds.${k}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('student.rules')} required error={errors.rules} className="md:col-span-2">
            {(p) => <Textarea {...p} value={form.rules} onChange={set('rules')} rows={4} />}
          </Field>
          <Field label={t('student.prizes')} className="md:col-span-2">
            {(p) => <Textarea {...p} value={form.prizes} onChange={set('prizes')} rows={2} />}
          </Field>
          <Field label={t('clubs.startsAt')} required error={errors.startsAt}>
            {(p) => <Input {...p} type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />}
          </Field>
          <Field label={t('clubs.endsAt')} required error={errors.endsAt}>
            {(p) => <Input {...p} type="datetime-local" value={form.endsAt} onChange={set('endsAt')} />}
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" loading={busy}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Card>
      <Card title={t('student.competitions')}>
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <Link href={`/student-zone/competitions/${c.slug}`} className="font-semibold text-fg hover:text-primary">
                  {c.title}
                </Link>
                <span className="block text-xs text-fg-muted">{t('student.entries', { count: c.entryCount })}</span>
              </span>
              <label htmlFor={`status-${c.id}`} className="sr-only">
                {t('common.status')}
              </label>
              <Select id={`status-${c.id}`} value={c.status} onChange={(e) => setStatus(c.slug, e.target.value)} className="h-9 w-auto py-0 text-sm">
                {COMPETITION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`student.competitionStatus.${s}`)}
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="outline" onClick={() => setSelected(selected === c.slug ? null : c.slug)} aria-expanded={selected === c.slug}>
                {t('adminStudent.entriesButton')}
              </Button>
              {selected === c.slug ? (
                <ul className="mt-2 w-full space-y-2">
                  {entries.length === 0 ? <li className="text-fg-muted">{t('adminStudent.noEntries')}</li> : null}
                  {entries.map((e) => (
                    <li key={e.id} className="rounded-lg bg-subtle p-3">
                      <p className="font-semibold text-fg">
                        <Link href={`/posts/${e.post.id}`} className="hover:text-primary">
                          {e.post.title ?? e.post.excerpt.slice(0, 60)}
                        </Link>{' '}
                        <span className="font-normal text-fg-muted">· {e.author.name}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{e.post.excerpt}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={e.status === 'winner' ? 'success' : e.status === 'disqualified' ? 'danger' : 'neutral'}>{t(`student.entryStatuses.${e.status}`)}</Badge>
                        {(['shortlisted', 'winner', 'disqualified'] as const).map((s) => (
                          <Button key={s} size="sm" variant="ghost" onClick={() => judge(e, s, e.score ?? undefined)}>
                            {t(`student.entryStatuses.${s}`)}
                          </Button>
                        ))}
                        <label htmlFor={`score-${e.id}`} className="sr-only">
                          {t('adminStudent.score')}
                        </label>
                        <Input id={`score-${e.id}`} defaultValue={e.score ?? ''} inputMode="numeric" className="h-9 w-20" onBlur={(ev) => ev.target.value && judge(e, e.status, Number(ev.target.value))} placeholder={t('adminStudent.score')} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
