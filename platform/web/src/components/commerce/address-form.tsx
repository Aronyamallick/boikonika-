'use client';

import { ADDRESS_LABELS, BD_DIVISIONS, findDivision, formatBdPhone } from '@boikonika/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { apiRequest } from '@/lib/api/client';
import type { Address } from '@/lib/commerce';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

type Values = Omit<Address, 'id' | 'isDefault' | 'union' | 'postcode'> & { union: string; postcode: string; isDefault: boolean };

const empty: Values = { label: 'home', recipientName: '', phone: '', division: '', district: '', upazila: '', union: '', area: '', addressLine: '', postcode: '', isDefault: false };

/** Create or edit a Bangladesh delivery address (division → district lists from the official data). */
export function AddressForm({ address, onSaved, onCancel, submitLabel }: { address?: Address; onSaved: (saved: Address) => void; onCancel?: () => void; submitLabel?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const { fromApi } = useFormErrors();
  const [values, setValues] = useState<Values>(() =>
    address ? { ...address, union: address.union ?? '', postcode: address.postcode ?? '', phone: address.phone.replace(/^\+88/, '') } : empty,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const name = (p: { bn: string; en: string }) => (locale === 'bn' ? p.bn : p.en);
  const districts = findDivision(values.division)?.districts ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const required: Array<keyof Values> = ['recipientName', 'phone', 'division', 'district', 'upazila', 'area', 'addressLine'];
    const missing = Object.fromEntries(required.filter((k) => !String(values[k]).trim()).map((k) => [k, t('validation.required')]));
    setErrors(missing);
    setFormError(null);
    if (Object.keys(missing).length) return;
    setSaving(true);
    try {
      const res = await apiRequest<Address>(address ? `/me/addresses/${address.id}` : '/me/addresses', { method: address ? 'PUT' : 'POST', body: values });
      onSaved(res.data);
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-fg">{t('addresses.label')}</legend>
        <div className="flex gap-2">
          {ADDRESS_LABELS.map((l) => (
            <label key={l} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${values.label === l ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-line-input text-fg'}`}>
              <input type="radio" name="label" value={l} checked={values.label === l} onChange={() => setValues((v) => ({ ...v, label: l }))} className="sr-only" />
              {t(`addresses.labels.${l}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('addresses.recipientName')} required error={errors.recipientName}>
          {(p) => <Input {...p} value={values.recipientName} onChange={set('recipientName')} autoComplete="name" maxLength={120} />}
        </Field>
        <Field label={t('addresses.phone')} required error={errors.phone}>
          {(p) => <Input {...p} value={values.phone} onChange={set('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" maxLength={20} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('addresses.division')} required error={errors.division}>
          {(p) => (
            <Select {...p} value={values.division} onChange={(e) => setValues((v) => ({ ...v, division: e.target.value, district: '' }))} autoComplete="address-level1">
              <option value="">{t('addresses.choose')}</option>
              {BD_DIVISIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {name(d)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('addresses.district')} required error={errors.district}>
          {(p) => (
            <Select {...p} value={values.district} onChange={set('district')} disabled={!districts.length} autoComplete="address-level2">
              <option value="">{t('addresses.choose')}</option>
              {districts.map((d) => (
                <option key={d.key} value={d.key}>
                  {name(d)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('addresses.upazila')} required error={errors.upazila}>
          {(p) => <Input {...p} value={values.upazila} onChange={set('upazila')} maxLength={80} autoComplete="address-level3" />}
        </Field>
        <Field label={t('addresses.union')} error={errors.union}>
          {(p) => <Input {...p} value={values.union} onChange={set('union')} maxLength={80} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label={t('addresses.area')} required error={errors.area}>
          {(p) => <Input {...p} value={values.area} onChange={set('area')} maxLength={120} />}
        </Field>
        <Field label={t('addresses.postcode')} error={errors.postcode}>
          {(p) => <Input {...p} value={values.postcode} onChange={set('postcode')} inputMode="numeric" maxLength={4} autoComplete="postal-code" />}
        </Field>
      </div>
      <Field label={t('addresses.addressLine')} required error={errors.addressLine}>
        {(p) => <Input {...p} value={values.addressLine} onChange={set('addressLine')} maxLength={300} autoComplete="street-address" />}
      </Field>
      <Checkbox checked={values.isDefault} onChange={(e) => setValues((v) => ({ ...v, isDefault: e.target.checked }))} label={t('addresses.makeDefault')} />
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button type="submit" loading={saving}>
          {submitLabel ?? t('common.save')}
        </Button>
      </div>
    </form>
  );
}

/** One-line summary of an address for lists and order pages. */
export function AddressLines({ address, locale }: { address: { recipientName: string; phone: string; addressLine: string; area: string; upazila: string; union?: string | null; district: string; division: string; postcode?: string | null }; locale: string }) {
  const place = (key: string) => {
    for (const dv of BD_DIVISIONS) {
      const hit = dv.key === key ? dv : dv.districts.find((d) => d.key === key);
      if (hit) return locale === 'bn' ? hit.bn : hit.en;
    }
    return key;
  };
  return (
    <address className="not-italic text-sm leading-relaxed text-fg-muted">
      <span className="font-semibold text-fg">{address.recipientName}</span> · {formatBdPhone(address.phone)}
      <br />
      {[address.addressLine, address.area, address.union, address.upazila].filter(Boolean).join(', ')}
      <br />
      {[place(address.district), place(address.division)].filter((v, i, a) => a.indexOf(v) === i).join(', ')}
      {address.postcode ? ` ${address.postcode}` : ''}
    </address>
  );
}
