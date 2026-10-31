'use client';

import { Plus, Quote } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { BilingualField, MoveButtons, emptyBilingual, moved, toBilingual, type Bilingual } from '@/components/admin/content-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import { localized, type LocalizedText } from '@/lib/catalog';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface Row {
  id: string;
  name: string;
  role: LocalizedText;
  quote: LocalizedText;
  consentGivenAt: string;
  isPublished: boolean;
}
type Draft = { id?: string; name: string; role: Bilingual; quote: Bilingual; consentGivenAt: string; isPublished: boolean };

/** Readers' words for the homepage — only with the date they agreed to be quoted. */
export function TestimonialsTab() {
  const t = useTranslations('adminHomepage');
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Row[]>('/admin/homepage/testimonials').then(setRows, () => setRows([]));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setErrors({});
    const body = { name: draft.name, role: draft.role, quote: draft.quote, consentGivenAt: draft.consentGivenAt || undefined, isPublished: draft.isPublished };
    try {
      const res = await apiRequest<Row[]>(draft.id ? `/admin/homepage/testimonials/${draft.id}` : '/admin/homepage/testimonials', { method: draft.id ? 'PUT' : 'POST', body });
      setRows(res.data);
      toast.show(res.message, 'success');
      setDraft(null);
    } catch (e) {
      const parsed = fromApi(e);
      setErrors(parsed.fields);
      if (!Object.keys(parsed.fields).length) toast.show(parsed.message, 'danger');
    } finally {
      setBusy(false);
    }
  };
  const move = async (from: number, to: number) => {
    if (!rows) return;
    const next = moved(rows, from, to);
    setRows(next);
    try {
      await apiRequest('/admin/homepage/testimonials/order', { method: 'PUT', body: { ids: next.map((r) => r.id) } });
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
      load();
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      const res = await apiRequest<Row[]>(`/admin/homepage/testimonials/${removing.id}`, { method: 'DELETE' });
      setRows(res.data);
      toast.show(res.message, 'success');
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setRemoving(null);
    }
  };

  if (!rows) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">{t('testimonialsHint')}</p>
        <Button size="sm" onClick={() => (setErrors({}), setDraft({ name: '', role: emptyBilingual(), quote: emptyBilingual(), consentGivenAt: '', isPublished: true }))}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('addTestimonial')}
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Quote className="h-6 w-6" />} title={t('noTestimonials')} />
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm shadow-sm">
              <MoveButtons index={i} count={rows.length} label={r.name} onMove={move} />
              <div className="min-w-0 flex-1">
                <p className="text-fg">“{localized(r.quote, locale)}”</p>
                <p className="mt-1 text-xs text-fg-subtle">
                  {r.name}
                  {localized(r.role, locale) ? ` · ${localized(r.role, locale)}` : ''} · {t('consentOn', { date: format.dateTime(new Date(r.consentGivenAt), { dateStyle: 'medium' }) })}
                </p>
              </div>
              {!r.isPublished ? <Badge tone="neutral">{t('hiddenBadge')}</Badge> : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => (setErrors({}), setDraft({ id: r.id, name: r.name, role: toBilingual(r.role), quote: toBilingual(r.quote), consentGivenAt: r.consentGivenAt.slice(0, 10), isPublished: r.isPublished }))}
              >
                {tc('edit')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(r)}>
                {tc('delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('editTestimonial') : t('addTestimonial')}
        closeLabel={tc('close')}
        className="w-[min(94vw,760px)]"
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {tc('cancel')}
            </Button>
            <Button loading={busy} onClick={save}>
              {tc('save')}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('personName')} error={errors.name} required>
                {(p) => <Input {...p} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} />}
              </Field>
              <Field label={t('consentDate')} hint={t('consentDateHint')} error={errors.consentGivenAt} required>
                {(p) => <Input {...p} type="date" value={draft.consentGivenAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDraft({ ...draft, consentGivenAt: e.target.value })} />}
              </Field>
            </div>
            <BilingualField name="role" label={t('personRole')} hint={t('personRoleHint')} value={draft.role} onChange={(role) => setDraft({ ...draft, role })} errors={errors} maxLength={80} />
            <BilingualField name="quote" label={t('quote')} value={draft.quote} onChange={(quote) => setDraft({ ...draft, quote })} errors={errors} required multiline rows={3} maxLength={400} />
            <Checkbox label={t('showTestimonial')} checked={draft.isPublished} onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })} />
          </div>
        ) : null}
      </Dialog>
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('deleteTestimonialTitle')}
        closeLabel={tc('close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              {tc('cancel')}
            </Button>
            <Button variant="danger" onClick={remove}>
              {tc('delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">{removing?.name}</p>
      </Dialog>
    </div>
  );
}
