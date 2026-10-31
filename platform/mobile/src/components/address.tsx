import { ADDRESS_LABELS, BD_DIVISIONS, formatBdPhone, placeName, radius, spacing, type Address } from '@boikonika/shared';
import { useState, type ComponentProps } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { apiRequest } from '@/lib/api';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { useTheme } from '@/lib/theme';
import { Chips } from './chips';
import { useToast } from './toast';
import { Button, Field, Input, Text } from './ui';

export function AddressLines({ address }: { address: Omit<Address, 'id' | 'label' | 'isDefault'> }) {
  const locale = useLocale();
  const place = [placeName(address.district, locale), placeName(address.division, locale)].filter((v, i, a) => a.indexOf(v) === i).join(', ');
  return (
    <View>
      <Text size="sm" weight="semibold">
        {address.recipientName} · {formatBdPhone(address.phone)}
      </Text>
      <Text size="sm" tone="muted">
        {[address.addressLine, address.area, address.union, address.upazila].filter(Boolean).join(', ')}
      </Text>
      <Text size="sm" tone="muted">
        {place}
        {address.postcode ? ` ${address.postcode}` : ''}
      </Text>
    </View>
  );
}

/** A choice from a long list (districts) as wrapping chips, so it works the same on every phone. */
function Choices({ options, value, onChange, label }: { options: Array<{ value: string; label: string }>; value: string; onChange: (v: string) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => onChange(o.value)} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radius.full, borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.surface }}>
            <Text size="sm" style={{ color: active ? c.primarySoftFg : c.text }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Add or edit a delivery address (the API validates; its messages show under each field). */
export function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const [v, setV] = useState({
    label: initial?.label ?? 'home',
    recipientName: initial?.recipientName ?? '',
    phone: initial?.phone ?? '',
    division: initial?.division ?? '',
    district: initial?.district ?? '',
    upazila: initial?.upazila ?? '',
    union: initial?.union ?? '',
    area: initial?.area ?? '',
    addressLine: initial?.addressLine ?? '',
    postcode: initial?.postcode ?? '',
    isDefault: initial?.isDefault ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof v) => (value: string | boolean) => setV((s) => ({ ...s, [key]: value }));
  const division = BD_DIVISIONS.find((d) => d.key === v.division);
  const name = (p: { en: string; bn: string }) => (locale === 'bn' ? p.bn : p.en);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const body = { ...v, union: v.union || undefined, postcode: v.postcode || undefined };
      const res = initial ? await apiRequest<Address>(`/me/addresses/${initial.id}`, { method: 'PUT', body }) : await apiRequest<Address>('/me/addresses', { method: 'POST', body });
      toast(res.message || t('addresses.saved'));
      onSaved(res.data);
    } catch (error) {
      setErrors(fieldErrors(error));
      toast(errorMessage(error, t), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const text = (key: 'recipientName' | 'phone' | 'upazila' | 'union' | 'area' | 'addressLine' | 'postcode', label: string, extra: Partial<ComponentProps<typeof Input>> = {}, required = true) => (
    <Field label={label} error={errors[key]} required={required}>
      {(a) => <Input {...a} value={String(v[key])} onChangeText={set(key)} invalid={a.invalid} {...extra} />}
    </Field>
  );

  return (
    <View style={{ gap: spacing[4] }}>
      <Field label={t('addresses.label')}>{() => <Chips label={t('addresses.label')} value={v.label} onChange={set('label')} options={ADDRESS_LABELS.map((l) => ({ value: l, label: t(`addresses.labels.${l}`) }))} />}</Field>
      {text('recipientName', t('addresses.recipientName'), { autoComplete: 'name' })}
      {text('phone', t('addresses.phone'), { keyboardType: 'phone-pad', autoComplete: 'tel' })}
      <Field label={t('addresses.division')} error={errors.division} required>
        {() => <Choices label={t('addresses.division')} value={v.division} onChange={(d) => setV((s) => ({ ...s, division: d, district: '' }))} options={BD_DIVISIONS.map((d) => ({ value: d.key, label: name(d) }))} />}
      </Field>
      {division ? (
        <Field label={t('addresses.district')} error={errors.district} required>
          {() => <Choices label={t('addresses.district')} value={v.district} onChange={set('district')} options={division.districts.map((d) => ({ value: d.key, label: name(d) }))} />}
        </Field>
      ) : null}
      {text('upazila', t('addresses.upazila'))}
      {text('union', t('addresses.union'), {}, false)}
      {text('area', t('addresses.area'))}
      {text('addressLine', t('addresses.addressLine'), { autoComplete: 'street-address' })}
      {text('postcode', t('addresses.postcode'), { keyboardType: 'number-pad', autoComplete: 'postal-code' }, false)}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <Switch value={v.isDefault} onValueChange={set('isDefault')} accessibilityLabel={t('addresses.makeDefault')} />
        <Text style={{ flex: 1 }}>{t('addresses.makeDefault')}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Button title={t('common.save')} loading={saving} onPress={save} style={{ flex: 1 }} />
        {onCancel ? <Button title={t('common.cancel')} variant="outline" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}
