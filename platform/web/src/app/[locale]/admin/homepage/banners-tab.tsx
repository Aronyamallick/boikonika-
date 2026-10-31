'use client';

import { BANNER_PLACEMENTS, type BannerPlacement } from '@boikonika/shared';
import { ImageIcon, Plus } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { BilingualField, MoveButtons, emptyBilingual, moved, toBilingual, type Bilingual } from '@/components/admin/content-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import { localized, type LocalizedText } from '@/lib/catalog';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface BannerRow {
  id: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  ctaLabel: LocalizedText;
  link: string | null;
  placement: BannerPlacement;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  live: boolean;
  imageUrl: string | null;
  mobileImageUrl: string | null;
}
type Draft = {
  id?: string;
  title: Bilingual;
  subtitle: Bilingual;
  ctaLabel: Bilingual;
  link: string;
  placement: BannerPlacement;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  image: File | null;
  mobileImage: File | null;
  removeMobileImage: boolean;
  imageUrl: string | null;
  mobileImageUrl: string | null;
};

/** ISO time ↔ the value of a datetime-local input (in the browser's own time zone). */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function BannersTab() {
  const t = useTranslations('adminHomepage');
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [rows, setRows] = useState<BannerRow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<BannerRow | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<BannerRow[]>('/admin/cms/banners').then(setRows, () => setRows([]));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setErrors({});
    const data = new FormData();
    data.append(
      'data',
      JSON.stringify({
        title: draft.title,
        subtitle: draft.subtitle,
        ctaLabel: draft.ctaLabel,
        link: draft.link.trim() || undefined,
        placement: draft.placement,
        startsAt: fromLocalInput(draft.startsAt),
        endsAt: fromLocalInput(draft.endsAt),
        isActive: draft.isActive,
        ...(draft.id ? { removeMobileImage: draft.removeMobileImage } : {}),
      }),
    );
    if (draft.image) data.append('image', draft.image);
    if (draft.mobileImage) data.append('mobileImage', draft.mobileImage);
    try {
      const res = await apiRequest<BannerRow[]>(draft.id ? `/admin/cms/banners/${draft.id}` : '/admin/cms/banners', { method: draft.id ? 'PUT' : 'POST', body: data });
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
  const move = async (placement: BannerPlacement, from: number, to: number) => {
    if (!rows) return;
    const group = moved(
      rows.filter((b) => b.placement === placement),
      from,
      to,
    );
    setRows(BANNER_PLACEMENTS.flatMap((p) => (p === placement ? group : rows.filter((b) => b.placement === p))));
    try {
      await apiRequest('/admin/cms/banners/order', { method: 'PUT', body: { ids: group.map((b) => b.id) } });
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
      load();
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      const res = await apiRequest<BannerRow[]>(`/admin/cms/banners/${removing.id}`, { method: 'DELETE' });
      setRows(res.data);
      toast.show(res.message, 'success');
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setRemoving(null);
    }
  };
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const state = (b: BannerRow) => (b.live ? 'live' : !b.isActive ? 'off' : b.startsAt && new Date(b.startsAt) > new Date() ? 'scheduled' : 'ended');

  if (!rows) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">{t('bannersHint')}</p>
        <Button
          size="sm"
          onClick={() => (
            setErrors({}),
            setDraft({ title: emptyBilingual(), subtitle: emptyBilingual(), ctaLabel: emptyBilingual(), link: '', placement: 'home', startsAt: '', endsAt: '', isActive: true, image: null, mobileImage: null, removeMobileImage: false, imageUrl: null, mobileImageUrl: null })
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('addBanner')}
        </Button>
      </div>
      {rows.length === 0 ? <EmptyState icon={<ImageIcon className="h-6 w-6" />} title={t('noBanners')} text={t('noBannersText')} /> : null}
      {BANNER_PLACEMENTS.map((placement) => {
        const group = rows.filter((b) => b.placement === placement);
        if (!group.length) return null;
        return (
          <section key={placement} aria-labelledby={`banners-${placement}`}>
            <h2 id={`banners-${placement}`} className="mb-2 font-bold">
              {t(`placements.${placement}`)}
            </h2>
            <ul className="space-y-2">
              {group.map((b, i) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm shadow-sm">
                  <MoveButtons index={i} count={group.length} label={localized(b.title, locale)} onMove={(from, to) => move(placement, from, to)} />
                  {b.imageUrl ? <img src={b.imageUrl} alt="" className="aspect-[3/1] w-36 rounded-lg object-cover" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-fg">{localized(b.title, locale)}</p>
                    <p className="text-xs text-fg-subtle">
                      {b.link ?? t('noLink')}
                      {b.startsAt ? ` · ${t('from', { date: when(b.startsAt) })}` : ''}
                      {b.endsAt ? ` · ${t('until', { date: when(b.endsAt) })}` : ''}
                    </p>
                  </div>
                  <Badge tone={b.live ? 'success' : state(b) === 'scheduled' ? 'info' : 'neutral'}>{t(`bannerStates.${state(b)}`)}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (
                      setErrors({}),
                      setDraft({
                        id: b.id,
                        title: toBilingual(b.title),
                        subtitle: toBilingual(b.subtitle),
                        ctaLabel: toBilingual(b.ctaLabel),
                        link: b.link ?? '',
                        placement: b.placement,
                        startsAt: toLocalInput(b.startsAt),
                        endsAt: toLocalInput(b.endsAt),
                        isActive: b.isActive,
                        image: null,
                        mobileImage: null,
                        removeMobileImage: false,
                        imageUrl: b.imageUrl,
                        mobileImageUrl: b.mobileImageUrl,
                      })
                    )}
                  >
                    {tc('edit')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(b)}>
                    {tc('delete')}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('editBanner') : t('addBanner')}
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
              <ImageField label={t('image')} hint={t('imageHint')} required={!draft.id} file={draft.image} url={draft.imageUrl} wide error={errors.image} onFile={(image) => setDraft({ ...draft, image })} />
              <div className="space-y-2">
                <ImageField label={t('mobileImage')} hint={t('mobileImageHint')} file={draft.mobileImage} url={draft.removeMobileImage ? null : draft.mobileImageUrl} onFile={(mobileImage) => setDraft({ ...draft, mobileImage, removeMobileImage: false })} />
                {draft.id && draft.mobileImageUrl && !draft.mobileImage ? <Checkbox label={t('removeMobileImage')} checked={draft.removeMobileImage} onChange={(e) => setDraft({ ...draft, removeMobileImage: e.target.checked })} /> : null}
              </div>
            </div>
            <BilingualField name="title" label={t('bannerTitle')} value={draft.title} onChange={(title) => setDraft({ ...draft, title })} errors={errors} required maxLength={120} />
            <BilingualField name="subtitle" label={t('bannerSubtitle')} value={draft.subtitle} onChange={(subtitle) => setDraft({ ...draft, subtitle })} errors={errors} maxLength={200} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('link')} hint={t('linkHint')} error={errors.link}>
                {(p) => <Input {...p} value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="/books?pick=editors" maxLength={500} />}
              </Field>
              <Field label={t('placement')}>
                {(p) => (
                  <Select {...p} value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value as BannerPlacement })}>
                    {BANNER_PLACEMENTS.map((pl) => (
                      <option key={pl} value={pl}>
                        {t(`placements.${pl}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <BilingualField name="ctaLabel" label={t('ctaLabel')} hint={t('ctaLabelHint')} value={draft.ctaLabel} onChange={(ctaLabel) => setDraft({ ...draft, ctaLabel })} errors={errors} maxLength={40} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('startsAt')} hint={t('startsAtHint')} error={errors.startsAt}>
                {(p) => <Input {...p} type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />}
              </Field>
              <Field label={t('endsAt')} hint={t('endsAtHint')} error={errors.endsAt}>
                {(p) => <Input {...p} type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />}
              </Field>
            </div>
            <Checkbox label={t('bannerOn')} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
          </div>
        ) : null}
      </Dialog>
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('deleteBannerTitle')}
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

/** File input with a preview of the chosen (or current) image. */
function ImageField({ label, hint, required, file, url, wide, error, onFile }: { label: string; hint: string; required?: boolean; file: File | null; url: string | null; wide?: boolean; error?: string; onFile: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const shown = preview ?? url;
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(p) => (
        <div className="space-y-2">
          {shown ? <img src={shown} alt="" className={`${wide ? 'aspect-[3/1]' : 'aspect-[4/3] max-w-40'} w-full rounded-lg object-cover`} /> : null}
          <input {...p} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-subtle file:px-3 file:py-2 file:text-sm file:font-semibold file:text-fg hover:file:bg-line" />
        </div>
      )}
    </Field>
  );
}
