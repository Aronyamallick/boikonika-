'use client';

import { ACADEMIC_LEVELS, AGE_GROUPS, BOOK_CONDITIONS, BOOK_LANGUAGES, INTEREST_KEYS } from '@boikonika/shared';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Link, useRouter } from '@/i18n/navigation';
import { toQuery } from '@/lib/catalog';
import { cn } from '@/lib/cn';

export interface CategoryOption {
  path: string;
  label: string;
  depth: number;
}

const MULTI = new Set(['language', 'condition']);
const PHYSICAL_FORMATS = ['paperback', 'hardcover'] as const;
const PICK_LABELS = { '': 'catalog.anyPick', editors: 'catalog.picksEditors', students: 'catalog.picksStudents', teachers: 'catalog.picksTeachers' } as const;

/** Reads a filter form into query params (checkbox groups become comma lists). */
function formParams(form: HTMLFormElement): Record<string, string> {
  const data = new FormData(form);
  const out: Record<string, string[]> = {};
  for (const [key, value] of data.entries()) {
    if (typeof value !== 'string' || value === '') continue;
    (out[key] ??= []).push(value);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, MULTI.has(k) || k === 'format' ? v.join(',') : v[v.length - 1]!]));
}

/**
 * Book filters as a plain GET form (works without JavaScript); with JavaScript, choices apply
 * immediately. On small screens the panel opens from a "Filters" button.
 */
export function BookFilters({ path, values, categories, kind = 'books' }: { path: string; values: Record<string, string>; categories?: CategoryOption[]; kind?: 'books' | 'products' }) {
  const t = useTranslations();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const list = (key: string) => (values[key] ?? '').split(',').filter(Boolean);
  const active = Object.keys(values).filter((k) => !['sort', 'page', 'q'].includes(k)).length;

  const apply = () => {
    if (!formRef.current) return;
    const params = formParams(formRef.current);
    startTransition(() => router.push(`${path}${toQuery({ ...params, sort: values.sort, q: values.q })}`, { scroll: false }));
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    apply();
    setOpen(false);
  };

  const group = 'space-y-2.5 border-t border-line pt-4 first:border-0 first:pt-0';
  const legend = 'mb-2 text-sm font-bold text-fg';

  return (
    <div>
      <div className="flex items-center gap-3 lg:hidden">
        <Button variant="outline" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="catalog-filters">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t('common.filters')}
          {active ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-fg">{active}</span> : null}
        </Button>
        {pending ? <Spinner className="h-4 w-4" label={t('common.loading')} /> : null}
      </div>
      <div className={cn('fixed inset-0 z-50 bg-black/40 lg:hidden', open ? 'block' : 'hidden')} onClick={() => setOpen(false)} aria-hidden="true" />
      <form
        id="catalog-filters"
        ref={formRef}
        method="get"
        action={path}
        onSubmit={onSubmit}
        onChange={(e) => {
          // Number inputs apply on submit so typing a price doesn't reload on every key.
          if ((e.target as unknown as HTMLInputElement).type !== 'number') apply();
        }}
        aria-label={t('common.filters')}
        className={cn(
          'space-y-4',
          open ? 'fixed inset-y-0 right-0 z-50 w-[min(22rem,90vw)] overflow-y-auto bg-surface p-5 shadow-xl' : 'hidden',
          'lg:static lg:z-auto lg:block lg:w-auto lg:overflow-visible lg:bg-transparent lg:p-0 lg:shadow-none',
        )}
      >
        <div className="flex items-center justify-between lg:hidden">
          <p className="text-lg font-bold">{t('common.filters')}</p>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t('common.close')}>
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <div className="hidden items-center justify-between lg:flex">
          <p className="text-sm font-bold uppercase tracking-wide text-fg-muted">{t('common.filters')}</p>
          {pending ? <Spinner className="h-4 w-4" label={t('common.loading')} /> : null}
        </div>

        {categories?.length ? (
          <div className={group}>
            <label htmlFor="f-category" className={legend + ' block'}>
              {t('catalog.category')}
            </label>
            <Select id="f-category" name="category" defaultValue={values.category ?? ''} key={`c-${values.category ?? ''}`}>
              <option value="">{t('catalog.allCategories')}</option>
              {categories.map((c) => (
                <option key={c.path} value={c.path}>
                  {`${'  '.repeat(Math.max(0, c.depth - 1))}${c.label}`}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        {kind === 'books' ? (
          <>
            <div className={group}>
              <label htmlFor="f-genre" className={legend + ' block'}>
                {t('catalog.genre')}
              </label>
              <Select id="f-genre" name="genre" defaultValue={values.genre ?? ''} key={`g-${values.genre ?? ''}`}>
                <option value="">{t('catalog.anyGenre')}</option>
                {INTEREST_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {t(`interests.${k}`)}
                  </option>
                ))}
              </Select>
            </div>

            <fieldset className={group}>
              <legend className={legend}>{t('catalog.language')}</legend>
              {BOOK_LANGUAGES.map((l) => (
                <Checkbox key={`${l}-${list('language').includes(l)}`} name="language" value={l} defaultChecked={list('language').includes(l)} label={t(`book.languages.${l}`)} className="flex" />
              ))}
            </fieldset>

            <fieldset className={group}>
              <legend className={legend}>{t('catalog.condition')}</legend>
              {BOOK_CONDITIONS.map((c) => (
                <Checkbox key={`${c}-${list('condition').includes(c)}`} name="condition" value={c} defaultChecked={list('condition').includes(c)} label={t(`book.conditions.${c}`)} className="flex" />
              ))}
            </fieldset>

            <fieldset className={group}>
              <legend className={legend}>{t('catalog.format')}</legend>
              {PHYSICAL_FORMATS.map((f) => (
                <Checkbox key={`${f}-${list('format').includes(f)}`} name="format" value={f} defaultChecked={list('format').includes(f)} label={t(`book.formats.${f}`)} className="flex" />
              ))}
            </fieldset>
          </>
        ) : null}

        <fieldset className={group}>
          <legend className={legend}>{t('catalog.price')}</legend>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="f-min">
              {t('search.minPrice')}
            </label>
            <Input id="f-min" name="minPrice" type="number" inputMode="numeric" min={0} placeholder={t('search.minPrice')} defaultValue={values.minPrice ?? ''} key={`min-${values.minPrice ?? ''}`} className="h-10" />
            <span aria-hidden="true" className="text-fg-subtle">
              –
            </span>
            <label className="sr-only" htmlFor="f-max">
              {t('search.maxPrice')}
            </label>
            <Input id="f-max" name="maxPrice" type="number" inputMode="numeric" min={0} placeholder={t('search.maxPrice')} defaultValue={values.maxPrice ?? ''} key={`max-${values.maxPrice ?? ''}`} className="h-10" />
          </div>
        </fieldset>

        {kind === 'books' ? (
          <fieldset className={group}>
            <legend className={legend}>{t('catalog.rating')}</legend>
            {['', '4', '3'].map((r) => (
              <label key={`${r}-${values.minRating ?? ''}`} className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
                <input type="radio" name="minRating" value={r} defaultChecked={(values.minRating ?? '') === r} className="h-4 w-4 accent-[var(--bk-primary)]" />
                {r ? t('catalog.minRating', { rating: r }) : t('catalog.anyRating')}
              </label>
            ))}
          </fieldset>
        ) : null}

        <fieldset className={group}>
          <legend className={legend}>{t('catalog.availability')}</legend>
          <Checkbox key={`s-${values.inStock}`} name="inStock" value="1" defaultChecked={!!values.inStock} label={t('search.onlyInStock')} className="flex" />
          <Checkbox key={`d-${values.discounted}`} name="discounted" value="1" defaultChecked={!!values.discounted} label={t('search.onlyDiscount')} className="flex" />
          {kind === 'books' ? <Checkbox key={`f-${values.free}`} name="free" value="1" defaultChecked={!!values.free} label={t('catalog.freeOnly')} className="flex" /> : null}
        </fieldset>

        {kind === 'books' ? (
          <>
            <fieldset className={group}>
              <legend className={legend}>{t('catalog.picks')}</legend>
              {(['', 'editors', 'students', 'teachers'] as const).map((p) => (
                <label key={`${p}-${values.pick ?? ''}`} className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
                  <input type="radio" name="pick" value={p} defaultChecked={(values.pick ?? '') === p} className="h-4 w-4 accent-[var(--bk-primary)]" />
                  {t(PICK_LABELS[p])}
                </label>
              ))}
            </fieldset>

            <div className={cn(group, 'grid grid-cols-2 gap-3 space-y-0')}>
              <div className="space-y-1.5">
                <label htmlFor="f-age" className="block text-sm font-bold text-fg">
                  {t('catalog.ageGroup')}
                </label>
                <Select id="f-age" name="ageGroup" defaultValue={values.ageGroup ?? ''} key={`a-${values.ageGroup ?? ''}`} className="h-10">
                  <option value="">{t('catalog.any')}</option>
                  {AGE_GROUPS.map((a) => (
                    <option key={a} value={a}>
                      {t(`catalog.ages.${a}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="f-level" className="block text-sm font-bold text-fg">
                  {t('catalog.academicLevel')}
                </label>
                <Select id="f-level" name="academicLevel" defaultValue={values.academicLevel ?? ''} key={`l-${values.academicLevel ?? ''}`} className="h-10">
                  <option value="">{t('catalog.any')}</option>
                  {ACADEMIC_LEVELS.map((a) => (
                    <option key={a} value={a}>
                      {t(`catalog.levels.${a}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </>
        ) : null}

        {values.sort ? <input type="hidden" name="sort" value={values.sort} /> : null}
        {values.q ? <input type="hidden" name="q" value={values.q} /> : null}
        <div className="sticky bottom-0 flex gap-2 border-t border-line bg-surface pt-4 lg:static lg:bg-transparent">
          <Button type="submit" className="flex-1">
            {t('catalog.apply')}
          </Button>
          {active ? (
            <Link href={`${path}${toQuery({ q: values.q, sort: values.sort })}`} className="inline-flex h-11 items-center px-3 text-sm font-semibold text-primary hover:underline" onClick={() => setOpen(false)}>
              {t('common.clearFilters')}
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}

/** Sort control; navigates on change (and is a normal GET form without JavaScript). */
export function SortSelect({ path, values, options }: { path: string; values: Record<string, string>; options: Array<{ value: string; label: string }> }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form method="get" action={path} className="flex items-center gap-2">
      {Object.entries(values)
        .filter(([k]) => k !== 'sort' && k !== 'page')
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <label htmlFor="sort" className="shrink-0 text-sm text-fg-muted">
        {t('catalog.sortBy')}
      </label>
      <Select
        id="sort"
        name="sort"
        defaultValue={values.sort ?? 'relevance'}
        className="h-10 w-auto min-w-44"
        onChange={(e) => {
          const { page: _page, ...rest } = values;
          startTransition(() => router.push(`${path}${toQuery({ ...rest, sort: e.target.value === 'relevance' ? undefined : e.target.value })}`, { scroll: false }));
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {pending ? <Spinner className="h-4 w-4" label={t('common.loading')} /> : null}
      <noscript>
        <Button type="submit" variant="outline" size="sm">
          {t('common.sort')}
        </Button>
      </noscript>
    </form>
  );
}
