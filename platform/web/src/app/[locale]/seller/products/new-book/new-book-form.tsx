'use client';

import { ACADEMIC_LEVELS, AGE_GROUPS, BOOK_CONDITIONS, BOOK_LANGUAGES, INTEREST_KEYS, isMoneyString, normalizeIsbn, OWNERSHIP_CAPACITIES, toEnglishDigits, toIsbn13 } from '@boikonika/shared';
import { BookOpen, ScanBarcode } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { FormSection, optionalInt, splitNames } from '@/components/seller/form-parts';
import { Alert } from '@/components/ui/alert';
import { BookCover } from '@/components/ui/book-cover';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { localized, type CategoryNode } from '@/lib/catalog';
import { categoryOptions } from '@/components/catalog/category-options';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import type { IsbnMatch } from '@/lib/seller';

type Lookup = { state: 'idle' } | { state: 'found'; match: IsbnMatch } | { state: 'new'; isbn: string | null };

const emptyBook = { title: '', subtitle: '', originalTitle: '', description: '', language: 'bn', categoryId: '', authors: '', translators: '', publisher: '', firstPublishedYear: '', ageGroup: '', academicLevel: '', seriesName: '', seriesNumber: '' };
const emptyFormat = { format: 'paperback', edition: '', publicationYear: '', pages: '', weightGrams: '' };
const emptyOffer = { condition: 'new', conditionNote: '', price: '', compareAtPrice: '', stock: '1', sku: '' };

export function NewBookForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { fromChecks, fromApi } = useFormErrors();
  const [isbnInput, setIsbnInput] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [looking, setLooking] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; label: string; depth: number }>>([]);
  const [book, setBook] = useState(emptyBook);
  const [genres, setGenres] = useState<string[]>([]);
  const [format, setFormat] = useState(emptyFormat);
  const [offer, setOffer] = useState(emptyOffer);
  const [capacity, setCapacity] = useState<string>('reseller_physical');
  const [declared, setDeclared] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<CategoryNode[]>('/categories', { query: { for: 'book' }, auth: false }).then((tree) => {
      // Options carry ids for the API; labels and indentation come from the shared flattener.
      const byPath = new Map<string, string>();
      const walk = (nodes: CategoryNode[]) => nodes.forEach((n) => (byPath.set(n.path, n.id), walk(n.children)));
      walk(tree);
      setCategories(categoryOptions(tree, locale).map((o) => ({ id: byPath.get(o.path)!, label: o.label, depth: o.depth })));
    }, () => undefined);
  }, [locale]);

  const findIsbn = async (e?: FormEvent) => {
    e?.preventDefault();
    const isbn = toIsbn13(normalizeIsbn(toEnglishDigits(isbnInput)));
    if (!isbn) {
      setErrors({ isbn: t('validation.isbn') });
      return;
    }
    setErrors({});
    setLooking(true);
    try {
      const match = await api<IsbnMatch | null>('/seller/books/lookup', { query: { isbn } });
      setLookup(match ? { state: 'found', match } : { state: 'new', isbn });
      if (match) setFormat((f) => ({ ...f, format: match.format }));
    } catch (err) {
      setFormError(fromApi(err).message);
    } finally {
      setLooking(false);
    }
  };

  const setB = (k: keyof typeof emptyBook) => (e: { target: { value: string } }) => setBook((b) => ({ ...b, [k]: e.target.value }));
  const setF = (k: keyof typeof emptyFormat) => (e: { target: { value: string } }) => setFormat((f) => ({ ...f, [k]: e.target.value }));
  const setO = (k: keyof typeof emptyOffer) => (e: { target: { value: string } }) => setOffer((o) => ({ ...o, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (lookup.state === 'idle') return;
    const isNew = lookup.state === 'new';
    const price = toEnglishDigits(offer.price).trim();
    const compareAt = toEnglishDigits(offer.compareAtPrice).trim();
    const stock = optionalInt(offer.stock);
    const authors = splitNames(book.authors);
    const checks = fromChecks({
      'book.title': isNew && !book.title.trim() && 'validation.required',
      'book.categoryId': isNew && !book.categoryId && 'validation.required',
      'book.authorNames': isNew && !authors.length && 'validation.required',
      price: (!price || !isMoneyString(price)) && 'validation.money',
      compareAtPrice: compareAt && (!isMoneyString(compareAt) || Number(compareAt) < Number(price)) && 'validation.compareAtPrice',
      stock: (stock === undefined || Number.isNaN(stock) || stock < 0) && 'validation.required',
      'format.pages': Number.isNaN(optionalInt(format.pages) ?? 0) && 'validation.required',
      'declaration.accepted': !declared && 'validation.declaration',
    });
    setErrors(checks);
    setFormError(null);
    if (Object.keys(checks).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const body = {
      ...(lookup.state === 'found' ? { bookId: lookup.match.bookId, isbn: toIsbn13(normalizeIsbn(toEnglishDigits(isbnInput))) ?? undefined } : {}),
      ...(isNew
        ? {
            isbn: lookup.isbn ?? undefined,
            book: {
              title: book.title,
              subtitle: book.subtitle || undefined,
              originalTitle: book.originalTitle || undefined,
              description: book.description || undefined,
              language: book.language,
              categoryId: book.categoryId,
              genres,
              authorNames: authors,
              translatorNames: splitNames(book.translators),
              publisherName: book.publisher.trim() || undefined,
              firstPublishedYear: optionalInt(book.firstPublishedYear),
              ageGroup: book.ageGroup || undefined,
              academicLevel: book.academicLevel || undefined,
              seriesName: book.seriesName.trim() || undefined,
              seriesNumber: optionalInt(book.seriesNumber),
            },
          }
        : {}),
      format: {
        format: format.format,
        edition: format.edition.trim() || undefined,
        publicationYear: optionalInt(format.publicationYear),
        pages: optionalInt(format.pages),
        weightGrams: optionalInt(format.weightGrams),
      },
      condition: offer.condition,
      conditionNote: offer.condition !== 'new' && offer.conditionNote.trim() ? offer.conditionNote.trim() : undefined,
      price,
      compareAtPrice: compareAt || undefined,
      stock,
      sku: offer.sku.trim() || undefined,
      declaration: { capacity, accepted: declared },
    };
    setSubmitting(true);
    try {
      const res = await apiRequest<{ id: string; status: string }>('/seller/books', { method: 'POST', body });
      toast.show(res.message, 'success');
      router.push(`/seller/products/${res.data.id}`);
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      setFormError(message);
      setSubmitting(false);
    }
  };

  const matchLabel = (key: string) => errors[key] ?? null;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-fg">{t('seller.navNewBook')}</h1>
      </header>

      <FormSection step={1} title={t('seller.isbnStep')}>
        <form onSubmit={findIsbn} className="flex flex-wrap items-end gap-3">
          <Field label={t('seller.isbnLabel')} hint={t('seller.isbnHint')} error={matchLabel('isbn')} className="min-w-60 flex-1">
            {(p) => <Input {...p} value={isbnInput} onChange={(e) => setIsbnInput(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="978…" className="font-mono" />}
          </Field>
          <div className="flex gap-2 pb-[1.6rem]">
            <Button type="submit" loading={looking}>
              <ScanBarcode className="h-4 w-4" aria-hidden="true" />
              {t('seller.lookup')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsbnInput('');
                setLookup({ state: 'new', isbn: null });
              }}
            >
              {t('seller.noIsbn')}
            </Button>
          </div>
        </form>
        {lookup.state === 'found' ? (
          <div className="flex gap-4 rounded-lg bg-success-soft p-4 text-success-soft-fg" role="status">
            <BookCover src={lookup.match.coverUrl} title={lookup.match.title} className="w-16 shrink-0" sizes="4rem" />
            <div className="min-w-0 text-sm">
              <p className="font-bold">{lookup.match.title}</p>
              {lookup.match.authors ? <p>{lookup.match.authors}</p> : null}
              <p className="mt-1">{[t(`book.formats.${lookup.match.format}`), lookup.match.edition, lookup.match.publicationYear].filter(Boolean).join(' · ')}</p>
              <p className="mt-2">{t('seller.found')}</p>
              {lookup.match.alreadyListedConditions.length ? (
                <p className="mt-1 font-semibold">{t('seller.alreadyListed', { conditions: lookup.match.alreadyListedConditions.map((c) => t(`book.conditions.${c}`)).join(', ') })}</p>
              ) : null}
            </div>
          </div>
        ) : lookup.state === 'new' && lookup.isbn ? (
          <Alert tone="info">{t('seller.notFound')}</Alert>
        ) : null}
      </FormSection>

      {lookup.state === 'idle' ? null : (
        <form onSubmit={submit} noValidate className="space-y-6">
          {lookup.state === 'new' ? (
            <FormSection step={2} title={t('seller.bookStep')}>
              <Field label={t('seller.bookTitle')} required error={matchLabel('book.title')}>
                {(p) => <Input {...p} value={book.title} onChange={setB('title')} maxLength={300} />}
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('seller.subtitle')} error={matchLabel('book.subtitle')}>
                  {(p) => <Input {...p} value={book.subtitle} onChange={setB('subtitle')} maxLength={300} />}
                </Field>
                <Field label={t('seller.originalTitle')} error={matchLabel('book.originalTitle')}>
                  {(p) => <Input {...p} value={book.originalTitle} onChange={setB('originalTitle')} maxLength={300} />}
                </Field>
              </div>
              <Field label={t('seller.authors')} hint={t('seller.authorsHint')} required error={matchLabel('book.authorNames')}>
                {(p) => <Input {...p} value={book.authors} onChange={setB('authors')} />}
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('seller.translators')} hint={t('seller.authorsHint')} error={matchLabel('book.translatorNames')}>
                  {(p) => <Input {...p} value={book.translators} onChange={setB('translators')} />}
                </Field>
                <Field label={t('seller.publisher')} error={matchLabel('book.publisherName')}>
                  {(p) => <Input {...p} value={book.publisher} onChange={setB('publisher')} maxLength={200} />}
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('seller.category')} required error={matchLabel('book.categoryId')}>
                  {(p) => (
                    <Select {...p} value={book.categoryId} onChange={setB('categoryId')}>
                      <option value="">{t('seller.chooseCategory')}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {`${'  '.repeat(Math.max(0, c.depth - 1))}${c.label}`}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={t('seller.language')} error={matchLabel('book.language')}>
                  {(p) => (
                    <Select {...p} value={book.language} onChange={setB('language')}>
                      {BOOK_LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {t(`book.languages.${l}`)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-fg">{t('seller.genres')}</legend>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_KEYS.map((g) => {
                    const on = genres.includes(g);
                    return (
                      <label key={g} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${on ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-line-input text-fg hover:border-primary'} ${!on && genres.length >= 5 ? 'opacity-50' : ''}`}>
                        <input type="checkbox" className="sr-only" checked={on} disabled={!on && genres.length >= 5} onChange={() => setGenres((list) => (on ? list.filter((x) => x !== g) : [...list, g]))} />
                        {t(`interests.${g}`)}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <Field label={t('seller.description')} error={matchLabel('book.description')}>
                {(p) => <Textarea {...p} value={book.description} onChange={setB('description')} rows={5} maxLength={10000} />}
              </Field>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label={t('seller.firstPublishedYear')} error={matchLabel('book.firstPublishedYear')}>
                  {(p) => <Input {...p} value={book.firstPublishedYear} onChange={setB('firstPublishedYear')} inputMode="numeric" maxLength={4} />}
                </Field>
                <Field label={t('catalog.ageGroup')} error={matchLabel('book.ageGroup')}>
                  {(p) => (
                    <Select {...p} value={book.ageGroup} onChange={setB('ageGroup')}>
                      <option value="">{t('catalog.any')}</option>
                      {AGE_GROUPS.map((a) => (
                        <option key={a} value={a}>
                          {t(`catalog.ages.${a}`)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={t('catalog.academicLevel')} error={matchLabel('book.academicLevel')}>
                  {(p) => (
                    <Select {...p} value={book.academicLevel} onChange={setB('academicLevel')}>
                      <option value="">{t('catalog.any')}</option>
                      {ACADEMIC_LEVELS.map((a) => (
                        <option key={a} value={a}>
                          {t(`catalog.levels.${a}`)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
                <Field label={t('seller.seriesName')} error={matchLabel('book.seriesName')}>
                  {(p) => <Input {...p} value={book.seriesName} onChange={setB('seriesName')} maxLength={200} />}
                </Field>
                <Field label={t('seller.seriesNumber')} error={matchLabel('book.seriesNumber')}>
                  {(p) => <Input {...p} value={book.seriesNumber} onChange={setB('seriesNumber')} inputMode="numeric" maxLength={3} />}
                </Field>
              </div>
            </FormSection>
          ) : null}

          <FormSection step={lookup.state === 'new' ? 3 : 2} title={t('seller.formatStep')}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('seller.formatLabel')} error={matchLabel('format')}>
                {(p) => (
                  <Select {...p} value={format.format} onChange={setF('format')} disabled={lookup.state === 'found'}>
                    {(['paperback', 'hardcover'] as const).map((f) => (
                      <option key={f} value={f}>
                        {t(`book.formats.${f}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('seller.edition')} error={matchLabel('format.edition')}>
                {(p) => <Input {...p} value={format.edition} onChange={setF('edition')} maxLength={80} />}
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t('seller.publicationYear')} error={matchLabel('format.publicationYear')}>
                {(p) => <Input {...p} value={format.publicationYear} onChange={setF('publicationYear')} inputMode="numeric" maxLength={4} />}
              </Field>
              <Field label={t('seller.pages')} error={matchLabel('format.pages')}>
                {(p) => <Input {...p} value={format.pages} onChange={setF('pages')} inputMode="numeric" maxLength={5} />}
              </Field>
              <Field label={t('seller.weight')} error={matchLabel('format.weightGrams')}>
                {(p) => <Input {...p} value={format.weightGrams} onChange={setF('weightGrams')} inputMode="numeric" maxLength={5} />}
              </Field>
            </div>
          </FormSection>

          <FormSection step={lookup.state === 'new' ? 4 : 3} title={t('seller.offerStep')}>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-fg">{t('seller.conditionLabel')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {BOOK_CONDITIONS.map((c) => (
                  <label key={c} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${offer.condition === c ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-line-input text-fg'}`}>
                    <input type="radio" name="condition" value={c} checked={offer.condition === c} onChange={setO('condition')} className="h-4 w-4 accent-[var(--bk-primary)]" />
                    {t(`book.conditions.${c}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            {offer.condition !== 'new' ? (
              <Field label={t('seller.conditionNote')} hint={t('seller.conditionNoteHint')} error={matchLabel('conditionNote')}>
                {(p) => <Textarea {...p} value={offer.conditionNote} onChange={setO('conditionNote')} rows={2} maxLength={500} />}
              </Field>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t('seller.price')} required error={matchLabel('price')}>
                {(p) => <Input {...p} value={offer.price} onChange={setO('price')} inputMode="decimal" />}
              </Field>
              <Field label={t('seller.compareAtPrice')} hint={t('seller.compareAtHint')} error={matchLabel('compareAtPrice')}>
                {(p) => <Input {...p} value={offer.compareAtPrice} onChange={setO('compareAtPrice')} inputMode="decimal" />}
              </Field>
              <Field label={t('seller.stock')} required error={matchLabel('stock')}>
                {(p) => <Input {...p} value={offer.stock} onChange={setO('stock')} inputMode="numeric" />}
              </Field>
            </div>
            <Field label={t('seller.sku')} error={matchLabel('sku')} className="max-w-xs">
              {(p) => <Input {...p} value={offer.sku} onChange={setO('sku')} maxLength={64} className="font-mono" />}
            </Field>
          </FormSection>

          <FormSection step={lookup.state === 'new' ? 5 : 4} title={t('seller.rightsStep')}>
            <Field label={t('seller.capacity')} error={matchLabel('declaration.capacity')}>
              {(p) => (
                <Select {...p} value={capacity} onChange={(e) => setCapacity(e.target.value)}>
                  {OWNERSHIP_CAPACITIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`seller.capacities.${c}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div>
              <Checkbox checked={declared} onChange={(e) => setDeclared(e.target.checked)} label={t('seller.declare')} aria-invalid={errors['declaration.accepted'] ? true : undefined} />
              {errors['declaration.accepted'] ? (
                <p className="mt-1 text-sm text-danger" role="alert">
                  {errors['declaration.accepted']}
                </p>
              ) : null}
            </div>
          </FormSection>

          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={submitting}>
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {submitting ? t('seller.submitting') : t('seller.submit')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
