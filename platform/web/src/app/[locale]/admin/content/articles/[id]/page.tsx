'use client';

import { ARTICLE_AUDIENCES, ARTICLE_KINDS, type ArticleKind } from '@boikonika/shared';
import { ArrowLeft, ExternalLink, ImagePlus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { MarkdownEditor } from '@/components/admin/content-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link, useRouter } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { articleHref } from '@/lib/content';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface ArticleForm {
  id?: string;
  slug?: string;
  kind: ArticleKind;
  title: string;
  excerpt: string;
  body: string;
  language: 'bn' | 'en';
  audience: string;
  tags: string;
  status: 'draft' | 'published';
  coverUrl?: string | null;
}

/** Write or edit an article. Saving as draft keeps it private; publishing puts it on the blog or help centre. */
export default function AdminArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const t = useTranslations('adminContent');
  const tc = useTranslations('content');
  const tcom = useTranslations('common');
  const toast = useToast();
  const router = useRouter();
  const { fromApi } = useFormErrors();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ArticleForm | null>(isNew ? { kind: 'blog', title: '', excerpt: '', body: '', language: 'bn', audience: 'all', tags: '', status: 'draft' } : null);
  const [failed, setFailed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<'draft' | 'published' | 'cover' | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api<Omit<ArticleForm, 'tags'> & { tags: string[] }>(`/admin/cms/articles/${id}`).then((a) => setForm({ ...a, tags: a.tags.join(', ') }), () => setFailed(true));
  }, [id, isNew]);

  const save = async (status: 'draft' | 'published') => {
    if (!form) return;
    setBusy(status);
    setErrors({});
    const body = {
      kind: form.kind,
      title: form.title,
      excerpt: form.excerpt || undefined,
      body: form.body,
      language: form.language,
      audience: form.audience,
      tags: form.tags
        .split(/[,،]/)
        .map((x) => x.trim().replace(/^#/, ''))
        .filter(Boolean),
      status,
    };
    try {
      const res = isNew ? await apiRequest<ArticleForm & { tags: string[] }>('/admin/cms/articles', { method: 'POST', body }) : await apiRequest<ArticleForm & { tags: string[] }>(`/admin/cms/articles/${id}`, { method: 'PUT', body });
      toast.show(status === 'published' ? t('publishedToast') : res.message, 'success');
      if (isNew) router.replace(`/admin/content/articles/${res.data.id}`);
      else setForm({ ...res.data, excerpt: res.data.excerpt ?? '', tags: res.data.tags.join(', ') });
    } catch (err) {
      const parsed = fromApi(err);
      setErrors(parsed.fields);
      toast.show(Object.keys(parsed.fields).length ? t('fixErrors') : parsed.message, 'danger');
    } finally {
      setBusy(null);
    }
  };
  const submit = (e: FormEvent) => (e.preventDefault(), save(form?.status ?? 'draft'));

  const uploadCover = async (file: File) => {
    if (!form?.id) return;
    setBusy('cover');
    const data = new FormData();
    data.append('file', file);
    try {
      const res = await apiRequest<{ coverUrl: string }>(`/admin/cms/articles/${form.id}/cover`, { method: 'PUT', body: data });
      setForm({ ...form, coverUrl: res.data.coverUrl });
      toast.show(res.message, 'success');
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const remove = async () => {
    try {
      const res = await apiRequest(`/admin/cms/articles/${id}`, { method: 'DELETE' });
      toast.show(res.message, 'success');
      router.replace('/admin/content?tab=articles');
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
      setRemoving(false);
    }
  };

  if (failed) return <ErrorState title={t('articleNotFound')} />;
  if (!form) return <Skeleton className="h-96 w-full" />;
  const set = <K extends keyof ArticleForm>(k: K, v: ArticleForm[K]) => setForm({ ...form, [k]: v });

  return (
    <RequirePermission permission="cms.manage">
      <Link href="/admin/content?tab=articles" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('backToArticles')}
      </Link>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {isNew ? t('newArticle') : t('editArticle')}
            {!isNew ? <Badge tone={form.status === 'published' ? 'success' : 'neutral'}>{t(`statuses.${form.status}`)}</Badge> : null}
          </h1>
          {!isNew && form.status === 'published' && form.slug ? (
            <Link href={articleHref({ kind: form.kind, slug: form.slug })} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              {t('viewLive')}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0 space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
            <Field label={t('articleTitle')} error={errors.title} required>
              {(p) => <Input {...p} lang={form.language} value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={220} className="text-lg font-semibold" />}
            </Field>
            <Field label={t('excerpt')} hint={t('excerptHint')} error={errors.excerpt}>
              {(p) => <Textarea {...p} lang={form.language} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} rows={2} maxLength={400} />}
            </Field>
            <Field label={t('body')} hint={t('articleBodyHint')} error={errors.body} required>
              {(p) => <MarkdownEditor {...p} lang={form.language} value={form.body} onChange={(v) => set('body', v)} rows={22} />}
            </Field>
          </div>
          <aside className="space-y-4">
            <div className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
              <Field label={t('kind')} error={errors.kind} required>
                {(p) => (
                  <Select {...p} value={form.kind} onChange={(e) => set('kind', e.target.value as ArticleKind)}>
                    {ARTICLE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {tc(`kinds.${k}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('language')} hint={t('languageHint')} error={errors.language} required>
                {(p) => (
                  <Select {...p} value={form.language} onChange={(e) => set('language', e.target.value as 'bn' | 'en')}>
                    <option value="bn">বাংলা</option>
                    <option value="en">English</option>
                  </Select>
                )}
              </Field>
              <Field label={t('audience')} error={errors.audience}>
                {(p) => (
                  <Select {...p} value={form.audience} onChange={(e) => set('audience', e.target.value)}>
                    {ARTICLE_AUDIENCES.map((a) => (
                      <option key={a} value={a}>
                        {t(`audiences.${a}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('tags')} hint={t('tagsHint')} error={errors.tags ?? Object.entries(errors).find(([k]) => k.startsWith('tags.'))?.[1]}>
                {(p) => <Input {...p} value={form.tags} onChange={(e) => set('tags', e.target.value)} />}
              </Field>
            </div>
            <div className="space-y-3 rounded-xl border border-line bg-surface p-5 shadow-sm">
              <p className="text-sm font-semibold">{t('cover')}</p>
              {form.coverUrl ? <img src={form.coverUrl} alt="" className="aspect-[16/9] w-full rounded-lg object-cover" /> : <div className="flex aspect-[16/9] items-center justify-center rounded-lg bg-subtle text-xs text-fg-subtle">{t('noCover')}</div>}
              {form.id ? (
                <>
                  <input ref={fileRef} id="cover-file" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                  <Button type="button" size="sm" variant="outline" loading={busy === 'cover'} onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    {form.coverUrl ? t('replaceCover') : t('addCover')}
                  </Button>
                  <p className="text-xs text-fg-subtle">{t('coverHint')}</p>
                </>
              ) : (
                <p className="text-xs text-fg-subtle">{t('coverAfterSave')}</p>
              )}
            </div>
            {!isNew ? (
              <Button type="button" variant="ghost" className="text-danger" onClick={() => setRemoving(true)}>
                {t('deleteArticle')}
              </Button>
            ) : null}
          </aside>
        </div>
        <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
          <p className="mr-auto text-sm text-fg-muted">{form.status === 'published' ? t('liveNote') : t('draftNote')}</p>
          {form.status === 'published' ? (
            <>
              <Button type="button" variant="outline" loading={busy === 'draft'} onClick={() => save('draft')}>
                {t('unpublish')}
              </Button>
              <Button type="button" loading={busy === 'published'} onClick={() => save('published')}>
                {t('saveChanges')}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" loading={busy === 'draft'} onClick={() => save('draft')}>
                {t('saveDraft')}
              </Button>
              <Button type="button" loading={busy === 'published'} onClick={() => save('published')}>
                {t('publish')}
              </Button>
            </>
          )}
        </div>
      </form>
      <Dialog
        open={removing}
        onClose={() => setRemoving(false)}
        title={t('deleteArticleTitle')}
        closeLabel={tcom('close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoving(false)}>
              {tcom('cancel')}
            </Button>
            <Button variant="danger" onClick={remove}>
              {tcom('delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">{t('deleteArticleText', { title: form.title })}</p>
      </Dialog>
    </RequirePermission>
  );
}
