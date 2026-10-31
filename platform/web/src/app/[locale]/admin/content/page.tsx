'use client';

import { ARTICLE_KINDS, FAQ_CATEGORIES, type FaqCategory } from '@boikonika/shared';
import { FilePlus2, FileText, HelpCircle, Plus, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { BilingualField, MoveButtons, emptyBilingual, moved, toBilingual, type Bilingual } from '@/components/admin/content-fields';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { localized, type LocalizedText } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

const TABS = ['pages', 'articles', 'faqs'] as const;

export default function AdminContentPage() {
  return (
    <RequirePermission permission="cms.manage">
      <Suspense>
        <ContentDesk />
      </Suspense>
    </RequirePermission>
  );
}

function ContentDesk() {
  const t = useTranslations('adminContent');
  const tab = useSearchParams().get('tab');
  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('text')}</p>
      <Tabs
        defaultIndex={Math.max(0, TABS.indexOf(tab as (typeof TABS)[number]))}
        tabs={[
          { label: t('tabPages'), content: <PagesTab /> },
          { label: t('tabArticles'), content: <ArticlesTab /> },
          { label: t('tabFaqs'), content: <FaqsTab /> },
        ]}
      />
    </>
  );
}

// ------------------------------------------------------------------ pages

interface PageRow {
  id: string;
  slug: string;
  title: LocalizedText;
  status: string;
  updatedAt: string;
  editor: string | null;
}

function PagesTab() {
  const t = useTranslations('adminContent');
  const locale = useLocale();
  const format = useFormatter();
  const [rows, setRows] = useState<PageRow[] | null>(null);
  useEffect(() => {
    api<PageRow[]>('/admin/cms/pages').then(setRows, () => setRows([]));
  }, []);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link href="/admin/content/pages/new" className={buttonClasses({ size: 'sm' })}>
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          {t('newPage')}
        </Link>
      </div>
      {!rows ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm shadow-sm">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <Link href={`/admin/content/pages/${p.id}`} className="font-semibold text-fg hover:text-primary">
                  {localized(p.title, locale)}
                </Link>
                <p className="text-xs text-fg-subtle">
                  /pages/{p.slug} · {t('editedOn', { date: format.dateTime(new Date(p.updatedAt), { dateStyle: 'medium' }) })}
                  {p.editor ? ` · ${p.editor}` : ''}
                </p>
              </div>
              <Badge tone={p.status === 'published' ? 'success' : 'neutral'}>{t(`statuses.${p.status}`)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ articles

interface ArticleRow {
  id: string;
  slug: string;
  kind: string;
  title: string;
  status: string;
  language: string;
  viewCount: number;
  updatedAt: string;
  publishedAt: string | null;
  author: { name: string } | null;
}
const PAGE_SIZE = 20;

function ArticlesTab() {
  const t = useTranslations('adminContent');
  const tc = useTranslations('content');
  const format = useFormatter();
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ArticleRow[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setRows(null);
    apiRequest<ArticleRow[]>('/admin/cms/articles', { query: { kind: kind || undefined, status: status || undefined, q: query || undefined, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [kind, status, query, page]);
  const search = (e: FormEvent) => (e.preventDefault(), setPage(1), setQuery(q.trim()));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={search} role="search" className="flex min-w-56 flex-1 gap-2">
          <label htmlFor="articles-q" className="sr-only">
            {t('searchArticles')}
          </label>
          <Input id="articles-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchArticles')} className="h-10 flex-1" />
          <Button type="submit" size="icon" variant="outline" aria-label={t('searchArticles')}>
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
        <label htmlFor="articles-kind" className="sr-only">
          {t('kind')}
        </label>
        <Select id="articles-kind" value={kind} onChange={(e) => (setKind(e.target.value), setPage(1))} className="h-10 w-44">
          <option value="">{t('anyKind')}</option>
          {ARTICLE_KINDS.map((k) => (
            <option key={k} value={k}>
              {tc(`kinds.${k}`)}
            </option>
          ))}
        </Select>
        <label htmlFor="articles-status" className="sr-only">
          {t('status')}
        </label>
        <Select id="articles-status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="h-10 w-36">
          <option value="">{t('anyStatus')}</option>
          <option value="published">{t('statuses.published')}</option>
          <option value="draft">{t('statuses.draft')}</option>
        </Select>
        <Link href="/admin/content/articles/new" className={buttonClasses({ size: 'sm', className: 'h-10' })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('newArticle')}
        </Link>
      </div>
      {!rows ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title={t('noArticles')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm shadow-sm">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <Link href={`/admin/content/articles/${a.id}`} className="font-semibold text-fg hover:text-primary" lang={a.language}>
                  {a.title}
                </Link>
                <p className="text-xs text-fg-subtle">
                  {tc(`kinds.${a.kind}`)} · {a.language.toUpperCase()} · {t('editedOn', { date: format.dateTime(new Date(a.updatedAt), { dateStyle: 'medium' }) })}
                  {a.status === 'published' ? ` · ${tc('views', { count: a.viewCount })}` : ''}
                </p>
              </div>
              <Badge tone={a.status === 'published' ? 'success' : 'neutral'}>{t(`statuses.${a.status}`)}</Badge>
            </li>
          ))}
        </ul>
      )}
      <AdminPager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  );
}

// ------------------------------------------------------------------ FAQs

interface FaqRow {
  id: string;
  category: FaqCategory;
  question: LocalizedText;
  answer: LocalizedText;
  isPublished: boolean;
}
type FaqDraft = { id?: string; category: FaqCategory; question: Bilingual; answer: Bilingual; isPublished: boolean };

function FaqsTab() {
  const t = useTranslations('adminContent');
  const th = useTranslations('help');
  const tc = useTranslations('common');
  const locale = useLocale();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [rows, setRows] = useState<FaqRow[] | null>(null);
  const [editing, setEditing] = useState<FaqDraft | null>(null);
  const [removing, setRemoving] = useState<FaqRow | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<FaqRow[]>('/admin/cms/faqs').then(setRows, () => setRows([]));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setErrors({});
    try {
      const body = { category: editing.category, question: editing.question, answer: editing.answer, isPublished: editing.isPublished };
      const res = editing.id ? await apiRequest<FaqRow[]>(`/admin/cms/faqs/${editing.id}`, { method: 'PUT', body }) : await apiRequest<FaqRow[]>('/admin/cms/faqs', { method: 'POST', body });
      setRows(res.data);
      toast.show(res.message, 'success');
      setEditing(null);
    } catch (e) {
      const parsed = fromApi(e);
      setErrors(parsed.fields);
      if (!Object.keys(parsed.fields).length) toast.show(parsed.message, 'danger');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      const res = await apiRequest<FaqRow[]>(`/admin/cms/faqs/${removing.id}`, { method: 'DELETE' });
      setRows(res.data);
      toast.show(res.message, 'success');
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setRemoving(null);
    }
  };
  const move = async (category: FaqCategory, from: number, to: number) => {
    if (!rows) return;
    const group = moved(
      rows.filter((f) => f.category === category),
      from,
      to,
    );
    const next = FAQ_CATEGORIES.flatMap((c) => (c === category ? group : rows.filter((f) => f.category === c)));
    setRows(next);
    try {
      await apiRequest('/admin/cms/faqs/order', { method: 'PUT', body: { ids: group.map((f) => f.id) } });
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
      load();
    }
  };

  if (!rows) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => (setErrors({}), setEditing({ category: 'general', question: emptyBilingual(), answer: emptyBilingual(), isPublished: true }))}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('newFaq')}
        </Button>
      </div>
      {rows.length === 0 ? <EmptyState icon={<HelpCircle className="h-6 w-6" />} title={t('noFaqs')} /> : null}
      {FAQ_CATEGORIES.map((category) => {
        const group = rows.filter((f) => f.category === category);
        if (!group.length) return null;
        return (
          <section key={category} aria-labelledby={`faq-cat-${category}`}>
            <h2 id={`faq-cat-${category}`} className="mb-2 font-bold">
              {th(`categories.${category}`)}
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm shadow-sm">
              {group.map((f, i) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                  <MoveButtons index={i} count={group.length} label={localized(f.question, locale)} onMove={(from, to) => move(category, from, to)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('font-semibold text-fg', !f.isPublished && 'text-fg-muted')}>{localized(f.question, locale)}</p>
                    {!f.isPublished ? <Badge tone="neutral">{t('hidden')}</Badge> : null}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => (setErrors({}), setEditing({ id: f.id, category: f.category, question: toBilingual(f.question), answer: toBilingual(f.answer), isPublished: f.isPublished }))}>
                    {tc('edit')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(f)}>
                    {tc('delete')}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? t('editFaq') : t('newFaq')}
        closeLabel={tc('close')}
        className="w-[min(94vw,760px)]"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {tc('cancel')}
            </Button>
            <Button loading={busy} onClick={save}>
              {tc('save')}
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="space-y-4">
            <Field label={t('category')} error={errors.category} required>
              {(p) => (
                <Select {...p} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as FaqCategory })}>
                  {FAQ_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {th(`categories.${c}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <BilingualField name="question" label={t('question')} value={editing.question} onChange={(question) => setEditing({ ...editing, question })} errors={errors} required maxLength={300} />
            <BilingualField name="answer" label={t('answer')} value={editing.answer} onChange={(answer) => setEditing({ ...editing, answer })} errors={errors} required markdown rows={6} maxLength={5000} />
            <Checkbox label={t('showOnHelp')} checked={editing.isPublished} onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })} />
          </div>
        ) : null}
      </Dialog>
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('deleteFaqTitle')}
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
        <p className="text-sm text-fg-muted">{removing ? localized(removing.question, locale) : ''}</p>
      </Dialog>
    </div>
  );
}
