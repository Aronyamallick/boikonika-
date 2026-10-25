'use client';

import { formatMoney, isMoneyString, STOCK_ADJUST_REASONS, toEnglishDigits } from '@boikonika/shared';
import { Archive, ExternalLink, FileEdit, History, ImagePlus, Send, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FormSection, optionalInt } from '@/components/seller/form-parts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link, useRouter } from '@/i18n/navigation';
import { api, apiRequest, ApiError } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import { STATUS_TONE, type ListingDetail, type ListingVariant, type StockMovement } from '@/lib/seller';

const MAX_IMAGES = 8;

/** A listing with one variant (every book listing) has no meaningful variant name to show. */
function useVariantLabel(listing: ListingDetail) {
  const t = useTranslations();
  return (v: ListingVariant) => (listing.variants.length > 1 ? v.name : listing.condition ? t(`book.conditions.${listing.condition}`) : t('seller.defaultVariant'));
}
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

export function ManageListing({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [failed, setFailed] = useState<'missing' | 'error' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(null);
    api<ListingDetail>(`/seller/products/${id}`).then(setListing, (e) => setFailed(e instanceof ApiError && e.status === 404 ? 'missing' : 'error'));
  }, [id]);
  useEffect(load, [load]);

  const run = async (key: string, task: () => Promise<string | void>) => {
    setBusy(key);
    try {
      const message = await task();
      if (message) toast.show(message, 'success');
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setBusy(null);
    }
  };

  if (failed) {
    return failed === 'missing' ? (
      <ErrorState title={t('common.notFoundTitle')} text={t('common.notFoundText')} />
    ) : (
      <ErrorState title={t('common.errorTitle')} text={t('common.errorText')} retryLabel={t('common.retry')} onRetry={load} />
    );
  }
  if (!listing) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const setStatus = (status: 'active' | 'draft' | 'archived') =>
    run(status, async () => {
      const res = await apiRequest<ListingDetail>(`/seller/products/${id}`, { method: 'PATCH', body: { status } });
      setListing(res.data);
      return res.message;
    });
  const locked = listing.status === 'rejected' || listing.status === 'suspended';
  // Book listings redirect from their product URL to the book page.
  const publicHref = `/products/${listing.slug}`;

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={STATUS_TONE[listing.status] ?? 'neutral'}>{t(`status.product.${listing.status}`)}</Badge>
          {listing.condition ? <Badge tone="neutral">{t(`book.conditions.${listing.condition}`)}</Badge> : null}
        </div>
        <h1 className="text-2xl font-bold text-fg">{listing.title}</h1>
        {listing.rejectionReason && locked ? <Alert tone="danger">{t('seller.rejectedReason', { reason: listing.rejectionReason })}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          {listing.status !== 'active' && !locked && listing.status !== 'pending_review' ? (
            <Button size="sm" loading={busy === 'active'} onClick={() => setStatus('active')}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {t('seller.publish')}
            </Button>
          ) : null}
          {listing.status === 'active' ? (
            <Button size="sm" variant="outline" loading={busy === 'draft'} onClick={() => setStatus('draft')}>
              <FileEdit className="h-4 w-4" aria-hidden="true" />
              {t('seller.unpublish')}
            </Button>
          ) : null}
          {listing.status !== 'archived' && !locked ? (
            <Button size="sm" variant="outline" loading={busy === 'archived'} onClick={() => setStatus('archived')}>
              <Archive className="h-4 w-4" aria-hidden="true" />
              {t('seller.archive')}
            </Button>
          ) : null}
          {listing.status === 'active' ? (
            <Link href={publicHref} className="inline-flex h-9 items-center gap-1.5 px-2 text-sm font-semibold text-primary hover:underline">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t('adminProducts.view')}
            </Link>
          ) : null}
          <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t('seller.deleteListing')}
          </Button>
        </div>
      </header>

      <Photos listing={listing} onChange={setListing} />
      {listing.type === 'general' || listing.condition !== 'new' ? <Details listing={listing} onSaved={setListing} /> : null}
      <Prices listing={listing} onSaved={setListing} />
      <Stock listing={listing} onChanged={load} />

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('seller.deleteListing')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={busy === 'delete'}
              onClick={() =>
                run('delete', async () => {
                  const res = await apiRequest<null>(`/seller/products/${id}`, { method: 'DELETE' });
                  router.replace('/seller/products');
                  return res.message;
                })
              }
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-fg-muted">{t('seller.deleteConfirm')}</p>
      </Dialog>
    </div>
  );
}

function Photos({ listing, onChange }: { listing: ListingDetail; onChange: (l: ListingDetail) => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const room = MAX_IMAGES - listing.images.length;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const chosen = Array.from(files).slice(0, room);
    const tooBig = chosen.find((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig) {
      toast.show(t('errors.tooLarge'), 'danger');
      return;
    }
    const body = new FormData();
    chosen.forEach((f) => body.append('images', f));
    setUploading(true);
    try {
      onChange(await api<ListingDetail>(`/seller/products/${listing.id}/images`, { method: 'POST', body }));
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <FormSection title={t('seller.images')}>
      <p className="-mt-2 text-sm text-fg-muted">{t('seller.imagesHint')}</p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {listing.images.map((img, i) => (
          <li key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-subtle">
            <Image src={img.url} alt={img.alt ?? ''} fill sizes="10rem" className="object-cover" />
            {i === 0 ? <span className="absolute left-1.5 top-1.5 rounded bg-surface/90 px-1.5 text-[11px] font-semibold text-fg">★</span> : null}
            <button
              type="button"
              disabled={removing === img.id}
              onClick={async () => {
                setRemoving(img.id);
                try {
                  onChange(await api<ListingDetail>(`/seller/products/${listing.id}/images/${img.id}`, { method: 'DELETE' }));
                } catch (e) {
                  toast.show(fromApi(e).message, 'danger');
                } finally {
                  setRemoving(null);
                }
              }}
              className="absolute right-1.5 top-1.5 rounded-md bg-surface/90 p-1.5 text-danger shadow-sm hover:bg-surface"
              aria-label={`${t('seller.removeImage')} ${i + 1}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {room > 0 ? (
          <li className="aspect-square">
            <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line-strong text-sm font-semibold text-fg-muted hover:border-primary hover:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40">
              <ImagePlus className="h-6 w-6" aria-hidden="true" />
              {uploading ? t('common.uploading') : t('seller.addImages')}
              <input ref={input} type="file" accept={IMAGE_TYPES} multiple className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files)} />
            </label>
          </li>
        ) : null}
      </ul>
    </FormSection>
  );
}

function Details({ listing, onSaved }: { listing: ListingDetail; onSaved: (l: ListingDetail) => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({ title: listing.title, description: listing.description ?? '', conditionNote: listing.conditionNote ?? '', brand: listing.brand ?? '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isBook = listing.type === 'book';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      // A book's description belongs to the shared book record; sellers describe their copy's condition.
      const body = isBook ? { conditionNote: form.conditionNote.trim() || null } : { title: form.title, description: form.description, brand: form.brand.trim() || null };
      const res = await apiRequest<ListingDetail>(`/seller/products/${listing.id}`, { method: 'PATCH', body });
      onSaved(res.data);
      toast.show(res.message, 'success');
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      toast.show(message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <FormSection title={t('seller.details')}>
        {isBook ? null : (
          <>
            <Field label={t('seller.productTitle')} required error={errors.title}>
              {(p) => <Input {...p} value={form.title} onChange={set('title')} maxLength={300} />}
            </Field>
            <Field label={t('seller.brand')} error={errors.brand}>
              {(p) => <Input {...p} value={form.brand} onChange={set('brand')} maxLength={120} />}
            </Field>
          </>
        )}
        {isBook ? null : (
          <Field label={t('seller.description')} error={errors.description}>
            {(p) => <Textarea {...p} value={form.description} onChange={set('description')} rows={5} maxLength={10000} />}
          </Field>
        )}
        {isBook ? (
          <Field label={t('seller.conditionNote')} hint={t('seller.conditionNoteHint')} error={errors.conditionNote}>
            {(p) => <Textarea {...p} value={form.conditionNote} onChange={set('conditionNote')} rows={2} maxLength={500} />}
          </Field>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {t('common.save')}
          </Button>
        </div>
      </FormSection>
    </form>
  );
}

function Prices({ listing, onSaved }: { listing: ListingDetail; onSaved: (l: ListingDetail) => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const initial = (vs: ListingVariant[]) => Object.fromEntries(vs.map((v) => [v.id, { price: v.price, compareAtPrice: v.compareAtPrice ?? '', isActive: v.isActive }]));
  const [rows, setRows] = useState(() => initial(listing.variants));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const label = useVariantLabel(listing);
  useEffect(() => setRows(initial(listing.variants)), [listing.variants]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const found: FieldErrors = {};
    const variants = listing.variants.map((v, i) => {
      const row = rows[v.id]!;
      const price = toEnglishDigits(row.price).trim();
      const compare = toEnglishDigits(row.compareAtPrice).trim();
      if (!isMoneyString(price)) found[`variants.${i}.price`] = t('validation.money');
      if (compare && (!isMoneyString(compare) || Number(compare) < Number(price))) found[`variants.${i}.compareAtPrice`] = t('validation.compareAtPrice');
      return { id: v.id, price, compareAtPrice: compare || null, isActive: row.isActive };
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const res = await apiRequest<ListingDetail>(`/seller/products/${listing.id}`, { method: 'PATCH', body: { variants } });
      onSaved(res.data);
      toast.show(res.message, 'success');
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      toast.show(message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <FormSection title={t('seller.variantPrices')}>
        {listing.variants.map((v, i) => {
          const row = rows[v.id]!;
          const update = (patch: Partial<typeof row>) => setRows((r) => ({ ...r, [v.id]: { ...row, ...patch } }));
          return (
            <fieldset key={v.id} className="grid gap-4 border-b border-line pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
              <legend className="mb-2 font-semibold text-fg sm:sr-only">{label(v)}</legend>
              <p className="hidden truncate pb-3 font-semibold text-fg sm:block" aria-hidden="true">
                {label(v)}
              </p>
              <Field label={t('seller.price')} error={errors[`variants.${i}.price`]}>
                {(p) => <Input {...p} value={row.price} onChange={(e) => update({ price: e.target.value })} inputMode="decimal" />}
              </Field>
              <Field label={t('seller.compareAtPrice')} error={errors[`variants.${i}.compareAtPrice`]}>
                {(p) => <Input {...p} value={row.compareAtPrice} onChange={(e) => update({ compareAtPrice: e.target.value })} inputMode="decimal" />}
              </Field>
              {listing.variants.length > 1 ? <Checkbox checked={row.isActive} onChange={(e) => update({ isActive: e.target.checked })} label={t('seller.active')} className="pb-3" /> : <span />}
            </fieldset>
          );
        })}
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {t('common.save')}
          </Button>
        </div>
      </FormSection>
    </form>
  );
}

function Stock({ listing, onChanged }: { listing: ListingDetail; onChanged: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [variantId, setVariantId] = useState(listing.variants[0]?.id ?? '');
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<string>('restock');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<StockMovement[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const label = useVariantLabel(listing);

  useEffect(() => {
    if (!showHistory || !variantId) return;
    setHistory(null);
    api<StockMovement[]>(`/seller/inventory/${variantId}/movements`).then(setHistory, () => setHistory([]));
  }, [showHistory, variantId, listing]);

  const adjust = async (e: FormEvent) => {
    e.preventDefault();
    const n = optionalInt(delta.replace(/^\+/, '').replace('−', '-'));
    if (n === undefined || Number.isNaN(n) || n === 0) {
      setError(t('validation.nonZero'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await apiRequest('/seller/inventory/adjust', { method: 'POST', body: { variantId, delta: n, reason, note: note.trim() || undefined } });
      toast.show(res.message, 'success');
      setDelta('');
      setNote('');
      onChanged();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setError(fields.delta ?? message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSection title={t('seller.stockTitle')}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-fg-subtle">
            <tr>
              <th scope="col" className="py-2 pr-4 font-semibold">
                {t('seller.variantName')}
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                {t('seller.onHand')}
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                {t('seller.reserved')}
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                {t('seller.available')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {listing.variants.map((v) => {
              const onHand = v.onHand ?? 0;
              const reserved = v.reserved ?? 0;
              return (
                <tr key={v.id}>
                  <th scope="row" className="py-2.5 pr-4 font-medium text-fg">
                    {label(v)}
                    <span className="block text-xs font-normal text-fg-subtle">{formatMoney(v.price, locale, { hideZeroDecimals: true })}</span>
                  </th>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{format.number(onHand)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{format.number(reserved)}</td>
                  <td className={`py-2.5 text-right font-semibold tabular-nums ${onHand - reserved > 0 ? 'text-fg' : 'text-danger'}`}>{format.number(Math.max(0, onHand - reserved))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={adjust} noValidate className="space-y-4 rounded-lg bg-subtle p-4">
        <p className="font-semibold text-fg">{t('seller.adjust')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {listing.variants.length > 1 ? (
            <Field label={t('seller.variantName')}>
              {(p) => (
                <Select {...p} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                  {listing.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <Field label={t('seller.delta')} error={error}>
            {(p) => <Input {...p} value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="numeric" placeholder="+10" />}
          </Field>
          <Field label={t('seller.reason')}>
            {(p) => (
              <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
                {STOCK_ADJUST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`seller.reasons.${r}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={t('seller.note')}>{(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}</Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" aria-expanded={showHistory} onClick={() => setShowHistory((s) => !s)}>
            <History className="h-4 w-4" aria-hidden="true" />
            {t('seller.history')}
          </Button>
          <Button type="submit" loading={saving}>
            {t('common.update')}
          </Button>
        </div>
      </form>

      {showHistory ? (
        history === null ? (
          <Skeleton className="h-24 w-full" />
        ) : history.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('seller.noHistory')}</p>
        ) : (
          <ol className="divide-y divide-line text-sm">
            {history.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-4 py-2">
                <div>
                  <p className="font-medium text-fg">{t(`seller.reasons.${m.reason}`)}</p>
                  {m.note ? <p className="text-fg-muted">{m.note}</p> : null}
                  <p className="text-xs text-fg-subtle">{format.dateTime(new Date(m.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <p className={`shrink-0 font-semibold tabular-nums ${m.onHandDelta > 0 ? 'text-success' : m.onHandDelta < 0 ? 'text-danger' : 'text-fg-muted'}`}>
                  {m.onHandDelta > 0 ? '+' : ''}
                  {format.number(m.onHandDelta)}
                  {m.reservedDelta ? <span className="ml-2 text-xs font-normal text-fg-subtle">({t('seller.reserved')} {m.reservedDelta > 0 ? '+' : ''}{format.number(m.reservedDelta)})</span> : null}
                </p>
              </li>
            ))}
          </ol>
        )
      ) : null}
    </FormSection>
  );
}
