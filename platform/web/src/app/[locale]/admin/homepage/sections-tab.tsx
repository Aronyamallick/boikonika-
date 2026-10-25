'use client';

import { BOOK_SOURCES, LIST_SECTION_TYPES, MAX_MANUAL_BOOKS, SINGLE_SECTION_TYPES, type BookSource } from '@boikonika/shared';
import { Plus, Search, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BilingualField, MoveButtons, emptyBilingual, moved, toBilingual, type Bilingual } from '@/components/admin/content-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import { localized, type BookCardData, type CategoryNode, type LocalizedText } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

type PickedBook = { id: string; title: string; coverUrl: string | null };
interface Section {
  id: string;
  key: string;
  type: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  isEnabled: boolean;
  custom: boolean;
  config: { limit?: number; source?: BookSource; bookIds: string[]; categoryId?: string; bannerIds: string[] };
  books: PickedBook[];
  category: { id: string; name: LocalizedText; path: string } | null;
}
interface BannerOption {
  id: string;
  title: LocalizedText;
  placement: string;
  live: boolean;
}
type Draft = { id?: string; type: string; title: Bilingual; subtitle: Bilingual; isEnabled: boolean; limit: string; source: BookSource; books: PickedBook[]; categoryId: string; bannerIds: string[] };

/** Types staff can add more of (built-in blocks such as the hero appear once). */
const ADDABLE = ['book_list', 'banner', 'author_list', 'category_grid', 'book_clubs', 'reading_challenges', 'featured_sellers', 'articles', 'testimonials'] as const;
const isList = (type: string) => (LIST_SECTION_TYPES as readonly string[]).includes(type);
const isSingle = (type: string) => (SINGLE_SECTION_TYPES as readonly string[]).includes(type);

export function SectionsTab() {
  const t = useTranslations('adminHomepage');
  const tc = useTranslations('common');
  const locale = useLocale();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [rows, setRows] = useState<Section[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Section | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Section[]>('/admin/homepage/sections').then(setRows, () => setRows([]));
  }, []);
  useEffect(load, [load]);

  const body = (d: Draft) => ({
    title: d.title,
    subtitle: d.subtitle,
    isEnabled: d.isEnabled,
    config: {
      limit: isList(d.type) && d.limit ? Number(d.limit) : undefined,
      source: d.type === 'book_list' ? d.source : undefined,
      bookIds: d.type === 'book_list' && d.source === 'manual' ? d.books.map((b) => b.id) : undefined,
      categoryId: d.type === 'book_list' && d.source === 'category' ? d.categoryId || undefined : undefined,
      bannerIds: d.type === 'banner' && d.bannerIds.length ? d.bannerIds : undefined,
    },
  });
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setErrors({});
    try {
      const res = draft.id
        ? await apiRequest<Section[]>(`/admin/homepage/sections/${draft.id}`, { method: 'PUT', body: body(draft) })
        : await apiRequest<Section[]>('/admin/homepage/sections', { method: 'POST', body: { ...body(draft), type: draft.type } });
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
  // The box flips at once; if saving fails it flips back.
  const toggle = async (s: Section) => {
    const flip = (on: boolean) => setRows((list) => list?.map((x) => (x.id === s.id ? { ...x, isEnabled: on } : x)) ?? list);
    flip(!s.isEnabled);
    try {
      const res = await apiRequest<Section[]>(`/admin/homepage/sections/${s.id}`, { method: 'PUT', body: body({ ...toDraft(s), isEnabled: !s.isEnabled }) });
      setRows(res.data);
      toast.show(s.isEnabled ? t('hiddenToast') : t('shownToast'), 'success');
    } catch (e) {
      flip(s.isEnabled);
      toast.show(fromApi(e).message, 'danger');
    }
  };
  const move = async (from: number, to: number) => {
    if (!rows) return;
    const next = moved(rows, from, to);
    setRows(next);
    try {
      await apiRequest('/admin/homepage/sections/order', { method: 'PUT', body: { ids: next.map((s) => s.id) } });
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
      load();
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      const res = await apiRequest<Section[]>(`/admin/homepage/sections/${removing.id}`, { method: 'DELETE' });
      setRows(res.data);
      toast.show(res.message, 'success');
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setRemoving(null);
    }
  };

  if (!rows) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">{t('sectionsHint')}</p>
        <Button size="sm" onClick={() => (setErrors({}), setDraft(newDraft('book_list')))}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('addSection')}
        </Button>
      </div>
      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm shadow-sm">
        {rows.map((s, i) => {
          const title = localized(s.title, locale) || t(`types.${s.type}`);
          return (
            <li key={s.id} className={cn('flex flex-wrap items-center gap-3 px-3 py-2.5', !s.isEnabled && 'bg-subtle/60')}>
              <MoveButtons index={i} count={rows.length} label={title} onMove={move} />
              <div className="min-w-0 flex-1">
                <p className={cn('font-semibold', s.isEnabled ? 'text-fg' : 'text-fg-muted')}>{title}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
                  <Badge tone="neutral">{t(`types.${s.type}`)}</Badge>
                  {s.type === 'book_list' && s.config.source ? <span>{t(`sources.${s.config.source}`)}</span> : null}
                  {s.config.source === 'manual' ? <span>· {t('bookCount', { count: s.books.length })}</span> : null}
                  {s.category ? <span>· {localized(s.category.name, locale)}</span> : null}
                  {s.custom ? <span>· {t('custom')}</span> : null}
                </p>
              </div>
              <Checkbox label={t('show')} checked={s.isEnabled} onChange={() => toggle(s)} />
              <Button size="sm" variant="ghost" onClick={() => (setErrors({}), setDraft(toDraft(s)))}>
                {tc('edit')}
              </Button>
              {s.custom ? (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(s)}>
                  {tc('delete')}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
      <SectionDialog draft={draft} setDraft={setDraft} errors={errors} busy={busy} onSave={save} />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('deleteSectionTitle')}
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
        <p className="text-sm text-fg-muted">{removing ? localized(removing.title, locale) : ''}</p>
      </Dialog>
    </div>
  );
}

const newDraft = (type: string): Draft => ({ type, title: emptyBilingual(), subtitle: emptyBilingual(), isEnabled: true, limit: '12', source: 'trending', books: [], categoryId: '', bannerIds: [] });
const toDraft = (s: Section): Draft => ({
  id: s.id,
  type: s.type,
  title: toBilingual(s.title),
  subtitle: toBilingual(s.subtitle),
  isEnabled: s.isEnabled,
  limit: s.config.limit ? String(s.config.limit) : '12',
  source: s.config.source ?? 'trending',
  books: s.books,
  categoryId: s.config.categoryId ?? '',
  bannerIds: s.config.bannerIds,
});

function SectionDialog({ draft, setDraft, errors, busy, onSave }: { draft: Draft | null; setDraft: (d: Draft | null) => void; errors: FieldErrors; busy: boolean; onSave: () => void }) {
  const t = useTranslations('adminHomepage');
  const tc = useTranslations('common');
  return (
    <Dialog
      open={!!draft}
      onClose={() => setDraft(null)}
      title={draft?.id ? t('editSection') : t('addSection')}
      closeLabel={tc('close')}
      className="w-[min(94vw,760px)]"
      footer={
        <>
          <Button variant="outline" onClick={() => setDraft(null)}>
            {tc('cancel')}
          </Button>
          <Button loading={busy} onClick={onSave}>
            {tc('save')}
          </Button>
        </>
      }
    >
      {draft ? (
        <div className="space-y-4">
          {!draft.id ? (
            <Field label={t('sectionType')} required>
              {(p) => (
                <Select {...p} value={draft.type} onChange={(e) => setDraft({ ...newDraft(e.target.value), title: draft.title, subtitle: draft.subtitle })}>
                  {ADDABLE.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <p className="text-sm text-fg-muted">{t(`typeHints.${draft.type}`)}</p>
          <BilingualField name="title" label={t('sectionTitle')} value={draft.title} onChange={(title) => setDraft({ ...draft, title })} errors={errors} required maxLength={120} />
          <BilingualField name="subtitle" label={t('sectionSubtitle')} value={draft.subtitle} onChange={(subtitle) => setDraft({ ...draft, subtitle })} errors={errors} maxLength={200} />
          {draft.type === 'book_list' ? (
            <Field label={t('source')} error={errors['config.source']} required>
              {(p) => (
                <Select {...p} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as BookSource })}>
                  {BOOK_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {t(`sources.${s}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          {draft.type === 'book_list' && draft.source === 'manual' ? <BookPicker books={draft.books} onChange={(books) => setDraft({ ...draft, books })} error={errors['config.bookIds']} /> : null}
          {draft.type === 'book_list' && draft.source === 'category' ? <CategorySelect value={draft.categoryId} onChange={(categoryId) => setDraft({ ...draft, categoryId })} error={errors['config.categoryId']} /> : null}
          {draft.type === 'banner' ? <BannerChooser value={draft.bannerIds} onChange={(bannerIds) => setDraft({ ...draft, bannerIds })} /> : null}
          {isList(draft.type) && !(draft.type === 'book_list' && draft.source === 'manual') ? (
            <Field label={t('limit')} hint={t('limitHint')} error={errors['config.limit']}>
              {(p) => <Input {...p} type="number" min={1} max={24} value={draft.limit} onChange={(e) => setDraft({ ...draft, limit: e.target.value })} className="max-w-28" />}
            </Field>
          ) : null}
          {isSingle(draft.type) ? <p className="rounded-lg bg-subtle p-3 text-sm text-fg-muted">{t('builtInNote')}</p> : null}
          <Checkbox label={t('showOnHomepage')} checked={draft.isEnabled} onChange={(e) => setDraft({ ...draft, isEnabled: e.target.checked })} />
        </div>
      ) : null}
    </Dialog>
  );
}

/** Search the catalogue and build an ordered, hand-picked list of books. */
function BookPicker({ books, onChange, error }: { books: PickedBook[]; onChange: (b: PickedBook[]) => void; error?: string }) {
  const t = useTranslations('adminHomepage');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<BookCardData[] | null>(null);
  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setResults(null);
    api<BookCardData[]>('/books', { query: { q: q.trim(), pageSize: 8 } }).then(setResults, () => setResults([]));
  };
  const full = books.length >= MAX_MANUAL_BOOKS;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{t('pickedBooks', { count: books.length, max: MAX_MANUAL_BOOKS })}</legend>
      {books.length ? (
        <ol className="divide-y divide-line rounded-lg border border-line">
          {books.map((b, i) => (
            <li key={b.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <MoveButtons index={i} count={books.length} label={b.title} onMove={(from, to) => onChange(moved(books, from, to))} />
              {b.coverUrl ? <img src={b.coverUrl} alt="" className="h-10 w-7 rounded object-cover" /> : <span className="h-10 w-7 rounded bg-subtle" />}
              <span className="min-w-0 flex-1 truncate">{b.title}</span>
              <button type="button" onClick={() => onChange(books.filter((x) => x.id !== b.id))} className="rounded p-1 text-fg-muted hover:bg-subtle hover:text-danger" aria-label={t('removeBook', { title: b.title })}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {error && !books.length ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={search} className="flex gap-2" role="search">
        <label htmlFor="pick-q" className="sr-only">
          {t('findBooks')}
        </label>
        <Input id="pick-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('findBooks')} className="h-10 flex-1" />
        <Button type="submit" size="icon" variant="outline" aria-label={t('findBooks')}>
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
      {results ? (
        results.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('noBooksFound')}</p>
        ) : (
          <ul className="max-h-64 divide-y divide-line overflow-auto rounded-lg border border-line">
            {results.map((b) => {
              const picked = books.some((x) => x.id === b.id);
              return (
                <li key={b.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                  {b.coverUrl ? <img src={b.coverUrl} alt="" className="h-10 w-7 rounded object-cover" /> : <span className="h-10 w-7 rounded bg-subtle" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{b.title}</span>
                    <span className="block truncate text-xs text-fg-muted">{b.authors.map((a) => a.name).join(', ')}</span>
                  </span>
                  <Button size="sm" variant="outline" disabled={picked || full} onClick={() => onChange([...books, { id: b.id, title: b.title, coverUrl: b.coverUrl }])}>
                    {picked ? t('added') : t('add')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </fieldset>
  );
}

function CategorySelect({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const t = useTranslations('adminHomepage');
  const locale = useLocale();
  const [tree, setTree] = useState<CategoryNode[] | null>(null);
  useEffect(() => {
    api<CategoryNode[]>('/categories', { query: { for: 'book' } }).then(setTree, () => setTree([]));
  }, []);
  const flat: Array<{ id: string; label: string }> = [];
  const walk = (nodes: CategoryNode[], depth: number) => nodes.forEach((n) => (flat.push({ id: n.id, label: `${'— '.repeat(depth)}${localized(n.name, locale)}` }), walk(n.children ?? [], depth + 1)));
  walk(tree ?? [], 0);
  return (
    <Field label={t('category')} error={error} required>
      {(p) => (
        <Select {...p} value={value} onChange={(e) => onChange(e.target.value)} disabled={!tree}>
          <option value="">{t('chooseCategory')}</option>
          {flat.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** Pick which banners a banner section shows; none picked means every running homepage banner. */
function BannerChooser({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const t = useTranslations('adminHomepage');
  const locale = useLocale();
  const [banners, setBanners] = useState<BannerOption[] | null>(null);
  useEffect(() => {
    api<BannerOption[]>('/admin/cms/banners').then(setBanners, () => setBanners([]));
  }, []);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{t('whichBanners')}</legend>
      <p className="text-sm text-fg-subtle">{t('whichBannersHint')}</p>
      {!banners ? (
        <Skeleton className="h-16 w-full" />
      ) : banners.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noBannersYet')}</p>
      ) : (
        <ul className="space-y-1.5">
          {banners.map((b) => (
            <li key={b.id}>
              <Checkbox
                label={
                  <span>
                    {localized(b.title, locale)} <span className="text-fg-subtle">· {b.live ? t('live') : t('notLive')}</span>
                  </span>
                }
                checked={value.includes(b.id)}
                onChange={(e) => onChange(e.target.checked ? [...value, b.id] : value.filter((id) => id !== b.id))}
              />
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
