'use client';

import { BD_DIVISIONS, findDivision } from '@boikonika/shared';
import { ImagePlus, Store } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { FormSection } from '@/components/seller/form-parts';
import { useSeller } from '@/components/seller/seller-shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import type { SellerAccount } from '@/lib/seller';

const MAX_BYTES = 5 * 1024 * 1024;

export function StoreSettings() {
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const { seller, reload } = useSeller();
  const store = seller.store;
  const [form, setForm] = useState({
    name: store?.name ?? '',
    tagline: store?.tagline ?? '',
    description: store?.description ?? '',
    phone: store?.phone ?? '',
    email: store?.email ?? '',
    division: store?.division ?? '',
    district: store?.district ?? '',
    address: store?.address ?? '',
    returnPolicy: store?.returnPolicy ?? '',
    shippingPolicy: store?.shippingPolicy ?? '',
  });
  const [images, setImages] = useState({ logo: store?.logoUrl ?? null, banner: store?.bannerUrl ?? null });
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const districts = findDivision(form.division)?.districts ?? [];
  const name = (p: { bn: string; en: string }) => (locale === 'bn' ? p.bn : p.en);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const found: FieldErrors = {};
    if (form.name.trim().length < 2) found.name = t('validation.required');
    setErrors(found);
    if (Object.keys(found).length) return;
    const nullable = (v: string) => (v.trim() ? v.trim() : null);
    setSaving(true);
    try {
      const res = await apiRequest<SellerAccount>('/seller/store', {
        method: 'PATCH',
        body: {
          name: form.name,
          tagline: nullable(form.tagline),
          description: nullable(form.description),
          phone: nullable(form.phone),
          email: nullable(form.email),
          division: nullable(form.division),
          district: nullable(form.district),
          address: nullable(form.address),
          returnPolicy: nullable(form.returnPolicy),
          shippingPolicy: nullable(form.shippingPolicy),
        },
      });
      toast.show(res.message, 'success');
      reload();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      toast.show(message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const upload = async (kind: 'logo' | 'banner', file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.show(t('errors.tooLarge'), 'danger');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    setUploading(kind);
    try {
      const res = await api<{ url: string }>(`/seller/store/${kind}`, { method: 'PUT', body });
      setImages((i) => ({ ...i, [kind]: res.url }));
      toast.show(t('common.saved'), 'success');
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-fg">{t('seller.storeTitle')}</h1>
        <p className="mt-1 text-fg-muted">{t('seller.storeText')}</p>
      </header>

      <section aria-label={`${t('seller.logo')} · ${t('seller.banner')}`} className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <div className="relative h-32 bg-gradient-to-r from-secondary-soft via-primary-soft to-accent-soft sm:h-40" style={images.banner ? { backgroundImage: `url(${images.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          <ImageButton label={`${t('seller.banner')}: ${t('seller.changeImage')}`} busy={uploading === 'banner'} onFile={(f) => upload('banner', f)} className="absolute bottom-3 right-3" />
        </div>
        <div className="flex items-end gap-4 px-5 pb-5">
          <div className="relative -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface shadow ring-4 ring-surface">
            {images.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- store-uploaded logo
              <img src={images.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <Store className="m-auto mt-5 h-10 w-10 text-secondary" aria-hidden="true" />
            )}
          </div>
          <ImageButton label={`${t('seller.logo')}: ${t('seller.changeImage')}`} busy={uploading === 'logo'} onFile={(f) => upload('logo', f)} />
        </div>
      </section>

      <form onSubmit={save} noValidate className="space-y-6">
        <FormSection title={t('seller.details')}>
          <Field label={t('seller.storeName')} required error={errors.name}>
            {(p) => <Input {...p} value={form.name} onChange={set('name')} maxLength={160} />}
          </Field>
          <Field label={t('seller.tagline')} error={errors.tagline}>
            {(p) => <Input {...p} value={form.tagline} onChange={set('tagline')} maxLength={200} />}
          </Field>
          <Field label={t('seller.description')} error={errors.description}>
            {(p) => <Textarea {...p} value={form.description} onChange={set('description')} rows={4} maxLength={3000} />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('seller.phone')} error={errors.phone}>
              {(p) => <Input {...p} value={form.phone} onChange={set('phone')} type="tel" inputMode="tel" maxLength={20} autoComplete="tel" />}
            </Field>
            <Field label={t('seller.email')} error={errors.email}>
              {(p) => <Input {...p} value={form.email} onChange={set('email')} type="email" maxLength={200} autoComplete="email" />}
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('seller.division')} error={errors.division}>
              {(p) => (
                <Select {...p} value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value, district: '' }))}>
                  <option value="">—</option>
                  {BD_DIVISIONS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {name(d)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('seller.district')} error={errors.district}>
              {(p) => (
                <Select {...p} value={form.district} onChange={set('district')} disabled={!districts.length}>
                  <option value="">—</option>
                  {districts.map((d) => (
                    <option key={d.key} value={d.key}>
                      {name(d)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label={t('seller.address')} error={errors.address}>
            {(p) => <Textarea {...p} value={form.address} onChange={set('address')} rows={2} maxLength={500} />}
          </Field>
        </FormSection>
        <FormSection title={t('catalog.policies')}>
          <Field label={t('seller.shippingPolicy')} error={errors.shippingPolicy}>
            {(p) => <Textarea {...p} value={form.shippingPolicy} onChange={set('shippingPolicy')} rows={4} maxLength={3000} />}
          </Field>
          <Field label={t('seller.returnPolicy')} error={errors.returnPolicy}>
            {(p) => <Textarea {...p} value={form.returnPolicy} onChange={set('returnPolicy')} rows={4} maxLength={3000} />}
          </Field>
        </FormSection>
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={saving}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ImageButton({ label, busy, onFile, className }: { label: string; busy: boolean; onFile: (file: File | undefined) => void; className?: string }) {
  const t = useTranslations('common');
  return (
    <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface/95 px-3 py-1.5 text-sm font-semibold text-fg shadow-sm hover:bg-surface has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${className ?? ''}`}>
      <ImagePlus className="h-4 w-4" aria-hidden="true" />
      {busy ? t('uploading') : <span>{label}</span>}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </label>
  );
}
