'use client';

import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { BilingualField, emptyBilingual, toBilingual, type Bilingual } from '@/components/admin/content-fields';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link, useRouter } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface PageForm {
  id?: string;
  slug: string;
  title: Bilingual;
  body: Bilingual;
  status: 'published' | 'draft';
  seoDescription: string;
  updatedAt?: string;
}

/** Edit an information page in both languages; "new" creates one at a chosen address. */
export default function AdminPageEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const t = useTranslations('adminContent');
  const format = useFormatter();
  const toast = useToast();
  const router = useRouter();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState<PageForm | null>(isNew ? { slug: '', title: emptyBilingual(), body: emptyBilingual(), status: 'published', seoDescription: '' } : null);
  const [failed, setFailed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api<PageForm & { title: Partial<Bilingual>; body: Partial<Bilingual> }>(`/admin/cms/pages/${id}`).then(
      (p) => setForm({ ...p, title: toBilingual(p.title), body: toBilingual(p.body), seoDescription: p.seoDescription ?? '' }),
      () => setFailed(true),
    );
  }, [id, isNew]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setErrors({});
    try {
      const body = { title: form.title, body: form.body, status: form.status, seoDescription: form.seoDescription || undefined };
      const res = isNew
        ? await apiRequest<PageForm>('/admin/cms/pages', { method: 'POST', body: { ...body, slug: form.slug } })
        : await apiRequest<PageForm>(`/admin/cms/pages/${id}`, { method: 'PUT', body });
      toast.show(res.message, 'success');
      if (isNew) router.replace(`/admin/content/pages/${res.data.id}`);
      else setForm({ ...form, ...res.data, title: toBilingual(res.data.title), body: toBilingual(res.data.body), seoDescription: res.data.seoDescription ?? '' });
    } catch (err) {
      const parsed = fromApi(err);
      setErrors(parsed.fields);
      toast.show(Object.keys(parsed.fields).length ? t('fixErrors') : parsed.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <ErrorState title={t('pageNotFound')} />;
  if (!form) return <Skeleton className="h-96 w-full" />;
  return (
    <RequirePermission permission="cms.manage">
      <Link href="/admin/content?tab=pages" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('backToPages')}
      </Link>
      <form onSubmit={save} noValidate className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{isNew ? t('newPage') : form.title.en || form.title.bn}</h1>
            {!isNew && form.updatedAt ? <p className="text-sm text-fg-subtle">{t('editedOn', { date: format.dateTime(new Date(form.updatedAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</p> : null}
          </div>
          {!isNew && form.status === 'published' ? (
            <Link href={`/pages/${form.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              {t('viewLive')}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        <div className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm sm:grid-cols-2">
          <Field label={t('address')} hint={isNew ? t('addressHint') : t('addressFixed')} error={errors.slug} required={isNew}>
            {(p) => (
              <div className="flex items-center rounded-lg border border-line-input bg-surface focus-within:ring-2 focus-within:ring-ring/40">
                <span className="pl-3 text-sm text-fg-subtle">/pages/</span>
                <Input {...p} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} readOnly={!isNew} maxLength={80} className="border-0 pl-1 focus:ring-0" />
              </div>
            )}
          </Field>
          <Field label={t('status')} hint={t('statusHint')}>
            {(p) => (
              <Select {...p} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PageForm['status'] })}>
                <option value="published">{t('statuses.published')}</option>
                <option value="draft">{t('statuses.draft')}</option>
              </Select>
            )}
          </Field>
          <div className="sm:col-span-2">
            <BilingualField name="title" label={t('pageTitle')} value={form.title} onChange={(title) => setForm({ ...form, title })} errors={errors} required maxLength={120} />
          </div>
          <Field label={t('seoDescription')} hint={t('seoDescriptionHint')} error={errors.seoDescription} className="sm:col-span-2">
            {(p) => <Input {...p} value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} maxLength={300} />}
          </Field>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <BilingualField name="body" label={t('body')} hint={t('bodyHint')} value={form.body} onChange={(body) => setForm({ ...form, body })} errors={errors} required markdown rows={18} />
        </div>
        <div className="sticky bottom-4 flex justify-end gap-2 rounded-xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
          <Button type="submit" loading={busy}>
            {t('savePage')}
          </Button>
        </div>
      </form>
    </RequirePermission>
  );
}
