'use client';

import { DIGITAL_CAPACITIES, DIGITAL_FILE_MAX_MB, formatMoney, MAX_SAMPLE_PAGES, type DigitalCapacity } from '@boikonika/shared';
import { AlertTriangle, BookOpenText, Download, FileUp, ImagePlus, PenLine, ShieldAlert, Tablet, Trash2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { StatTile } from '@/components/dashboard/stat-tile';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { formatBytes, saveFrom, type StudioData, type StudioEdition } from '@/lib/digital';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

type Status = 'free' | 'onSale' | 'pending' | 'notOffered' | 'withdrawn' | 'removed' | 'noFile';

function statusOf(e: StudioEdition): Status {
  if (!e.asset) return 'noFile';
  if (e.asset.status === 'removed') return 'removed';
  if (e.asset.status === 'withdrawn') return 'withdrawn';
  if (e.offer?.mode === 'free') return 'free';
  if (e.offer?.mode === 'paid') return e.offer.status === 'pending_review' ? 'pending' : 'onSale';
  return 'notOffered';
}
const STATUS_TONE: Record<Status, 'success' | 'primary' | 'warning' | 'neutral' | 'danger'> = { free: 'success', onSale: 'success', pending: 'warning', notOffered: 'warning', withdrawn: 'neutral', removed: 'danger', noFile: 'neutral' };

/** Rights holders' digital studio: upload e-books, choose free or paid, and shape the free sample. */
export function StudioView() {
  const t = useTranslations('studio');
  const [data, setData] = useState<StudioData | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    api<StudioData>('/studio/digital').then(
      (d) => {
        setData(d);
        setSelected((cur) => cur ?? d.editions[0]?.book.id ?? null);
      },
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);
  const replace = (edition: StudioEdition) => setData((d) => (d ? { ...d, editions: d.editions.map((e) => (e.book.id === edition.book.id ? edition : e)) } : d));

  if (failed && !data) return <ErrorState title={t('errorTitle')} retryLabel={t('retry')} onRetry={() => (setFailed(false), load())} />;
  if (!data) return <Skeleton className="h-96 w-full" />;
  if (!data.editions.length) {
    return (
      <EmptyState
        icon={<Tablet className="h-6 w-6" />}
        title={t('noBooks')}
        text={t('noBooksText')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/author" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
              {t('authorDashboard')}
            </Link>
            <Link href="/account/verification" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
              {t('getVerified')}
            </Link>
          </div>
        }
      />
    );
  }
  const current = data.editions.find((e) => e.book.id === selected) ?? data.editions[0]!;
  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <nav aria-label={t('booksLabel')}>
        <ul className="space-y-1.5">
          {data.editions.map((e) => {
            const status = statusOf(e);
            return (
              <li key={e.book.id}>
                <button
                  type="button"
                  aria-current={e.book.id === current.book.id ? 'true' : undefined}
                  onClick={() => setSelected(e.book.id)}
                  className={cn('flex w-full items-center gap-3 rounded-lg p-2 text-left', e.book.id === current.book.id ? 'bg-primary-soft' : 'hover:bg-subtle')}
                >
                  <BookCover src={e.book.coverUrl} title={e.book.title} className="w-10 shrink-0 p-0.5 text-[5px]" sizes="2.5rem" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold text-fg">{e.book.title}</span>
                    <Badge tone={STATUS_TONE[status]} className="mt-1">
                      {t(`status.${status}`)}
                    </Badge>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <EditionPanel key={current.book.id} edition={current} canSell={data.canSell} previewMax={data.previewMaxPercent} onChange={replace} />
    </div>
  );
}

function EditionPanel({ edition, canSell, previewMax, onChange }: { edition: StudioEdition; canSell: boolean; previewMax: number; onChange: (e: StudioEdition) => void }) {
  const t = useTranslations('studio');
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const status = statusOf(edition);
  const { asset } = edition;

  const call = async (path: string, init: { method: 'PUT' | 'POST' | 'DELETE'; body?: unknown }) => {
    try {
      const res = await apiRequest<StudioEdition>(path, init);
      onChange(res.data);
      toast.show(res.message, 'success');
      return true;
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
      return false;
    }
  };
  const ownCopy = async () => {
    try {
      const link = await api<{ url: string }>(`/studio/digital/${edition.book.id}/file-link`, { method: 'POST' });
      saveFrom(link.url);
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-fg">{edition.book.title}</h2>
          <p className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
            {edition.capacities.map((c) => (
              <Badge key={c} tone="neutral">
                {t(`capacity.${c}`)}
              </Badge>
            ))}
          </p>
        </div>
        <Link href={`/books/${edition.book.slug}`} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
          {t('viewBookPage')}
        </Link>
      </header>

      {asset?.status === 'removed' ? (
        <Alert tone="danger" title={t('removedTitle')}>
          {t('removedText', { reason: asset.removedReason ?? '' })}
        </Alert>
      ) : null}
      {edition.offeredByOther ? <Alert tone="info">{t('offeredByOther')}</Alert> : null}

      <div className="grid grid-cols-3 gap-3">
        <StatTile label={t('sales')} value={format.number(edition.sales)} />
        <StatTile label={t('readers')} value={format.number(edition.readers)} />
        <StatTile label={t('downloads')} value={format.number(edition.downloads)} />
      </div>

      <section aria-labelledby="studio-file" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h3 id="studio-file" className="flex items-center gap-2 font-bold text-fg">
          <FileUp className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('fileTitle')}
        </h3>
        {asset ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-subtle px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-fg">{asset.fileName}</p>
              <p className="text-fg-muted">
                {[asset.format.toUpperCase(), asset.pageCount ? t('pages', { count: asset.pageCount }) : null, formatBytes(asset.sizeBytes, locale), t('uploadedOn', { date: format.dateTime(new Date(asset.uploadedAt), { dateStyle: 'medium' }) })].filter(Boolean).join(' · ')}
              </p>
            </div>
            {asset.status !== 'removed' ? (
              <Button size="sm" variant="outline" onClick={ownCopy}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {t('myCopy')}
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-fg-muted">{t('noFileText')}</p>
        )}
        {asset?.status !== 'removed' ? <UploadForm edition={edition} onUploaded={onChange} /> : null}
      </section>

      {asset && asset.status !== 'removed' ? (
        <OfferForm edition={edition} canSell={canSell} onSave={(body) => call(`/studio/digital/${edition.book.id}/offer`, { method: 'PUT', body })} onWithdraw={() => call(`/studio/digital/${edition.book.id}/offer`, { method: 'DELETE' })} />
      ) : null}

      <SamplesSection edition={edition} previewMax={previewMax} call={call} onChange={onChange} />
    </div>
  );
}

function UploadForm({ edition, onUploaded }: { edition: StudioEdition; onUploaded: (e: StudioEdition) => void }) {
  const t = useTranslations('studio');
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const id = useId();
  const choices = DIGITAL_CAPACITIES.filter((c) => c === 'licensed_distributor' || edition.capacities.includes(c));
  const [file, setFile] = useState<File | null>(null);
  const [capacity, setCapacity] = useState<DigitalCapacity>(edition.capacities[0] ?? 'licensed_distributor');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setErrors({ file: t('chooseFile') });
    if (file.size > DIGITAL_FILE_MAX_MB * 1024 * 1024) return setErrors({ file: t('fileTooBig', { max: DIGITAL_FILE_MAX_MB }) });
    if (!accepted) return setErrors({ accepted: t('acceptRequired') });
    setBusy(true);
    setErrors({});
    const body = new FormData();
    body.set('data', JSON.stringify({ capacity, accepted: true }));
    body.set('file', file);
    try {
      const res = await apiRequest<StudioEdition>(`/studio/digital/${edition.book.id}/file`, { method: 'POST', body });
      onUploaded(res.data);
      toast.show(res.message, 'success');
      setFile(null);
      setAccepted(false);
      (document.getElementById(`${id}-file`) as HTMLInputElement | null)?.form?.reset();
    } catch (err) {
      const parsed = fromApi(err);
      setErrors(parsed.fields);
      toast.show(parsed.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={edition.asset ? t('replaceFile') : t('chooseFileLabel')} hint={t('fileHint', { max: DIGITAL_FILE_MAX_MB })} error={errors.file} required>
          {(props) => <Input {...props} id={`${id}-file`} type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" className="py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
        </Field>
        <Field label={t('capacityLabel')} error={errors.capacity}>
          {(props) => (
            <Select {...props} value={capacity} onChange={(e) => setCapacity(e.target.value as DigitalCapacity)}>
              {choices.map((c) => (
                <option key={c} value={c}>
                  {t(`capacity.${c}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div>
        <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} label={t(`declaration.${capacity}`)} aria-invalid={errors.accepted ? true : undefined} />
        {errors.accepted ? (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.accepted}
          </p>
        ) : null}
      </div>
      <Button type="submit" loading={busy}>
        <FileUp className="h-4 w-4" aria-hidden="true" />
        {busy ? t('uploading') : edition.asset ? t('replace') : t('upload')}
      </Button>
    </form>
  );
}

function OfferForm({ edition, canSell, onSave, onWithdraw }: { edition: StudioEdition; canSell: boolean; onSave: (body: unknown) => Promise<boolean>; onWithdraw: () => Promise<boolean> }) {
  const t = useTranslations('studio');
  const locale = useLocale();
  const [mode, setMode] = useState<'free' | 'paid'>(edition.offer?.mode ?? (canSell ? 'paid' : 'free'));
  const [price, setPrice] = useState(edition.offer?.mode === 'paid' ? edition.offer.price : (edition.lastPrice ?? ''));
  const [busy, setBusy] = useState(false);
  const name = useId();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await onSave(mode === 'free' ? { free: true } : { free: false, price });
    setBusy(false);
  };

  return (
    <section aria-labelledby="studio-offer" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <h3 id="studio-offer" className="flex items-center gap-2 font-bold text-fg">
        <Tablet className="h-5 w-5 text-secondary" aria-hidden="true" />
        {t('offerTitle')}
      </h3>
      {edition.offer?.mode === 'paid' ? <p className="mt-1 text-sm text-fg-muted">{t('currentPrice', { price: formatMoney(edition.offer.price, locale, { hideZeroDecimals: true }) })}</p> : null}
      <form onSubmit={save} className="mt-3 space-y-4">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">{t('offerTitle')}</legend>
          {(['paid', 'free'] as const).map((m) => (
            <label key={m} className={cn('flex cursor-pointer gap-3 rounded-lg border p-3.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40', mode === m ? 'border-primary bg-primary-soft/50' : 'border-line hover:border-line-strong')}>
              <input type="radio" name={name} value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-0.5 h-4 w-4 accent-[var(--bk-primary)]" />
              <span>
                <span className="block font-semibold text-fg">{t(`mode.${m}`)}</span>
                <span className="mt-0.5 block text-fg-muted">{t(`modeHint.${m}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {mode === 'paid' ? (
          canSell ? (
            <Field label={t('priceLabel')} hint={t('priceHint')} required className="max-w-xs">
              {(props) => <Input {...props} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="150" />}
            </Field>
          ) : (
            <Alert tone="warning">
              {t.rich('needSeller', {
                link: (chunks) => (
                  <Link href="/account/verification" className="font-semibold underline">
                    {chunks}
                  </Link>
                ),
              })}
            </Alert>
          )
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy} disabled={mode === 'paid' && !canSell}>
            {t('saveOffer')}
          </Button>
          {edition.onSale || edition.offer ? (
            <Button variant="ghost" className="text-danger" onClick={onWithdraw}>
              {t('withdraw')}
            </Button>
          ) : null}
        </div>
        {edition.onSale || edition.offer ? <p className="text-xs text-fg-muted">{t('withdrawHint')}</p> : null}
      </form>
    </section>
  );
}

function SamplesSection({ edition, previewMax, call, onChange }: { edition: StudioEdition; previewMax: number; call: (path: string, init: { method: 'PUT' | 'POST' | 'DELETE'; body?: unknown }) => Promise<boolean>; onChange: (e: StudioEdition) => void }) {
  const t = useTranslations('studio');
  const format = useFormatter();
  const [chapterOpen, setChapterOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const pdf = edition.previews.find((p) => p.kind === 'pdf');
  const percents = [5, 10, 15, 20, 25, 30, 40, 50].filter((p) => p <= previewMax);

  return (
    <section aria-labelledby="studio-samples" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="studio-samples" className="flex items-center gap-2 font-bold text-fg">
            <BookOpenText className="h-5 w-5 text-secondary" aria-hidden="true" />
            {t('samplesTitle')}
          </h3>
          <p className="mt-1 text-sm text-fg-muted">{t('samplesIntro')}</p>
        </div>
        <Link href={`/books/${edition.book.slug}/preview`} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
          {t('seeLookInside')}
        </Link>
      </div>

      {edition.asset?.format === 'pdf' && edition.asset.status !== 'removed' ? (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-subtle p-4">
          <Field label={t('sampleLength')} hint={pdf?.samplePages ? t('sampleLengthHint', { count: pdf.samplePages }) : t('sampleLengthMax', { max: previewMax })}>
            {(props) => (
              <Select {...props} value={pdf?.previewPercent ?? 10} onChange={(e) => call(`/studio/digital/${edition.book.id}/preview-length`, { method: 'PUT', body: { previewPercent: Number(e.target.value) } })} className="w-40">
                {percents.map((p) => (
                  <option key={p} value={p}>
                    {format.number(p / 100, { style: 'percent' })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      ) : edition.asset?.format === 'epub' ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-fg-muted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          {t('epubSampleHint')}
        </p>
      ) : null}

      {edition.previews.filter((p) => p.kind !== 'pdf').length ? (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {edition.previews
            .filter((p) => p.kind !== 'pdf')
            .map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-fg">{p.title ?? t(`kind.${p.kind}`)}</span>
                  <span className="text-xs text-fg-muted">{p.kind === 'sample_pages' ? t('pagesCount', { count: p.pages }) : t('charsCount', { count: p.chars })}</span>
                </span>
                <Button size="icon" variant="ghost" className="text-danger" aria-label={t('removeSample', { title: p.title ?? t(`kind.${p.kind}`) })} onClick={() => call(`/studio/digital/previews/${p.id}`, { method: 'DELETE' })}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setChapterOpen(true)}>
          <PenLine className="h-4 w-4" aria-hidden="true" />
          {t('addChapter')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPagesOpen(true)}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {t('addPages')}
        </Button>
      </div>
      <ChapterDialog open={chapterOpen} bookId={edition.book.id} onClose={() => setChapterOpen(false)} onSaved={onChange} />
      <PagesDialog open={pagesOpen} bookId={edition.book.id} onClose={() => setPagesOpen(false)} onSaved={onChange} />
    </section>
  );
}

function ChapterDialog({ open, bookId, onClose, onSaved }: { open: boolean; bookId: string; onClose: () => void; onSaved: (e: StudioEdition) => void }) {
  const t = useTranslations('studio');
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const formId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest<StudioEdition>(`/studio/digital/${bookId}/chapters`, { method: 'POST', body: { title, content } });
      onSaved(res.data);
      toast.show(res.message, 'success');
      setTitle('');
      setContent('');
      setErrors({});
      onClose();
    } catch (err) {
      const parsed = fromApi(err);
      setErrors(parsed.fields);
      toast.show(parsed.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('addChapter')}
      closeLabel={t('close')}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {t('saveSample')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('chapterTitle')} error={errors.title} required>
          {(props) => <Input {...props} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />}
        </Field>
        <Field label={t('chapterText')} hint={t('chapterHint')} error={errors.content} required>
          {(props) => <Textarea {...props} value={content} onChange={(e) => setContent(e.target.value)} rows={14} maxLength={40000} />}
        </Field>
      </form>
    </Dialog>
  );
}

function PagesDialog({ open, bookId, onClose, onSaved }: { open: boolean; bookId: string; onClose: () => void; onSaved: (e: StudioEdition) => void }) {
  const t = useTranslations('studio');
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!files.length) return setError(t('choosePages'));
    if (files.length > MAX_SAMPLE_PAGES) return setError(t('tooManyPages', { max: MAX_SAMPLE_PAGES }));
    setBusy(true);
    const body = new FormData();
    if (title.trim()) body.set('title', title.trim());
    for (const f of files) body.append('pages', f);
    try {
      const res = await apiRequest<StudioEdition>(`/studio/digital/${bookId}/pages`, { method: 'POST', body });
      onSaved(res.data);
      toast.show(res.message, 'success');
      setTitle('');
      setFiles([]);
      setError(null);
      onClose();
    } catch (err) {
      const parsed = fromApi(err);
      setError(parsed.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('addPages')}
      closeLabel={t('close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {t('saveSample')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('pagesTitle')}>{(props) => <Input {...props} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t('pagesTitlePlaceholder')} />}</Field>
        <Field label={t('pagesFiles')} hint={t('pagesHint', { max: MAX_SAMPLE_PAGES })} error={error} required>
          {(props) => <Input {...props} type="file" multiple accept="image/jpeg,image/png,image/webp" className="py-2" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />}
        </Field>
        <p className="flex items-start gap-2 text-xs text-fg-muted">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('pagesRights')}
        </p>
      </form>
    </Dialog>
  );
}
