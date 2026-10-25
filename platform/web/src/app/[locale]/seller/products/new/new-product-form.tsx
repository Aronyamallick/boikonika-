'use client';

import { isMoneyString, toEnglishDigits } from '@boikonika/shared';
import { PackagePlus, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { categoryOptions } from '@/components/catalog/category-options';
import { FormSection, optionalInt } from '@/components/seller/form-parts';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import type { CategoryNode } from '@/lib/catalog';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

type VariantRow = { key: number; name: string; sku: string; price: string; compareAtPrice: string; stock: string };
type AttributeRow = { key: number; name: string; value: string };

let rowKey = 0;
const newVariant = (name = ''): VariantRow => ({ key: ++rowKey, name, sku: '', price: '', compareAtPrice: '', stock: '1' });

export function NewProductForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [categories, setCategories] = useState<Array<{ id: string; label: string; depth: number }>>([]);
  const [details, setDetails] = useState({ title: '', description: '', categoryId: '', brand: '', weightGrams: '' });
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>(() => [newVariant()]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<CategoryNode[]>('/categories', { query: { for: 'general' }, auth: false }).then((tree) => {
      const byPath = new Map<string, string>();
      const walk = (nodes: CategoryNode[]) => nodes.forEach((n) => (byPath.set(n.path, n.id), walk(n.children)));
      walk(tree);
      setCategories(categoryOptions(tree, locale).map((o) => ({ id: byPath.get(o.path)!, label: o.label, depth: o.depth })));
    }, () => undefined);
  }, [locale]);

  const setD = (k: keyof typeof details) => (e: { target: { value: string } }) => setDetails((d) => ({ ...d, [k]: e.target.value }));
  const setV = (key: number, k: keyof Omit<VariantRow, 'key'>) => (e: { target: { value: string } }) => setVariants((rows) => rows.map((r) => (r.key === key ? { ...r, [k]: e.target.value } : r)));
  const setA = (key: number, k: 'name' | 'value') => (e: { target: { value: string } }) => setAttributes((rows) => rows.map((r) => (r.key === key ? { ...r, [k]: e.target.value } : r)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: FieldErrors = {};
    if (details.title.trim().length < 2) found.title = t('validation.required');
    if (!details.categoryId) found.categoryId = t('validation.required');
    variants.forEach((v, i) => {
      const price = toEnglishDigits(v.price).trim();
      const compare = toEnglishDigits(v.compareAtPrice).trim();
      const stock = optionalInt(v.stock);
      if (!v.name.trim() && variants.length > 1) found[`variants.${i}.name`] = t('validation.required');
      if (!isMoneyString(price)) found[`variants.${i}.price`] = t('validation.money');
      if (compare && (!isMoneyString(compare) || Number(compare) < Number(price))) found[`variants.${i}.compareAtPrice`] = t('validation.compareAtPrice');
      if (stock === undefined || Number.isNaN(stock) || stock < 0) found[`variants.${i}.stock`] = t('validation.required');
    });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const body = {
      title: details.title,
      description: details.description || undefined,
      categoryId: details.categoryId,
      brand: details.brand.trim() || undefined,
      weightGrams: optionalInt(details.weightGrams),
      attributes: Object.fromEntries(attributes.filter((a) => a.name.trim() && a.value.trim()).map((a) => [a.name.trim(), a.value.trim()])),
      variants: variants.map((v) => ({
        name: v.name.trim() || t('seller.defaultVariant'),
        sku: v.sku.trim() || undefined,
        price: toEnglishDigits(v.price).trim(),
        compareAtPrice: toEnglishDigits(v.compareAtPrice).trim() || undefined,
        stock: optionalInt(v.stock),
      })),
    };
    setSubmitting(true);
    try {
      const res = await apiRequest<{ id: string }>('/seller/products', { method: 'POST', body });
      toast.show(res.message, 'success');
      router.push(`/seller/products/${res.data.id}`);
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      setFormError(message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-fg">{t('seller.navNewProduct')}</h1>
      <FormSection step={1} title={t('seller.details')}>
        <Field label={t('seller.productTitle')} required error={errors.title}>
          {(p) => <Input {...p} value={details.title} onChange={setD('title')} maxLength={300} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('seller.category')} required error={errors.categoryId}>
            {(p) => (
              <Select {...p} value={details.categoryId} onChange={setD('categoryId')}>
                <option value="">{t('seller.chooseCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${'  '.repeat(Math.max(0, c.depth - 1))}${c.label}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('seller.brand')} error={errors.brand}>
            {(p) => <Input {...p} value={details.brand} onChange={setD('brand')} maxLength={120} />}
          </Field>
        </div>
        <Field label={t('seller.description')} error={errors.description}>
          {(p) => <Textarea {...p} value={details.description} onChange={setD('description')} rows={5} maxLength={10000} />}
        </Field>
        <Field label={t('seller.weight')} error={errors.weightGrams} className="max-w-xs">
          {(p) => <Input {...p} value={details.weightGrams} onChange={setD('weightGrams')} inputMode="numeric" maxLength={5} />}
        </Field>
      </FormSection>

      <FormSection step={2} title={t('seller.attributes')}>
        {attributes.map((a) => (
          <div key={a.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <Field label={t('seller.attributeName')}>{(p) => <Input {...p} value={a.name} onChange={setA(a.key, 'name')} maxLength={40} />}</Field>
            <Field label={t('seller.attributeValue')}>{(p) => <Input {...p} value={a.value} onChange={setA(a.key, 'value')} maxLength={200} />}</Field>
            <Button variant="ghost" size="icon" onClick={() => setAttributes((rows) => rows.filter((r) => r.key !== a.key))} aria-label={t('common.remove')}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setAttributes((rows) => [...rows, { key: ++rowKey, name: '', value: '' }])} disabled={attributes.length >= 20}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('seller.addAttribute')}
        </Button>
      </FormSection>

      <FormSection step={3} title={t('seller.variantsTitle')}>
        <p className="-mt-2 text-sm text-fg-muted">{t('seller.variantsHint')}</p>
        {variants.map((v, i) => (
          <fieldset key={v.key} className="rounded-lg border border-line p-4">
            <legend className="sr-only">{v.name || t('seller.defaultVariant')}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('seller.variantName')} required={variants.length > 1} error={errors[`variants.${i}.name`]}>
                {(p) => <Input {...p} value={v.name} onChange={setV(v.key, 'name')} placeholder={t('seller.defaultVariant')} maxLength={160} />}
              </Field>
              <Field label={t('seller.sku')} error={errors[`variants.${i}.sku`]}>
                {(p) => <Input {...p} value={v.sku} onChange={setV(v.key, 'sku')} maxLength={64} className="font-mono" />}
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label={t('seller.price')} required error={errors[`variants.${i}.price`]}>
                {(p) => <Input {...p} value={v.price} onChange={setV(v.key, 'price')} inputMode="decimal" />}
              </Field>
              <Field label={t('seller.compareAtPrice')} error={errors[`variants.${i}.compareAtPrice`]}>
                {(p) => <Input {...p} value={v.compareAtPrice} onChange={setV(v.key, 'compareAtPrice')} inputMode="decimal" />}
              </Field>
              <Field label={t('seller.stock')} required error={errors[`variants.${i}.stock`]}>
                {(p) => <Input {...p} value={v.stock} onChange={setV(v.key, 'stock')} inputMode="numeric" />}
              </Field>
            </div>
            {variants.length > 1 ? (
              <Button variant="ghost" size="sm" className="mt-3 text-danger" onClick={() => setVariants((rows) => rows.filter((r) => r.key !== v.key))}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('seller.removeVariant')}
              </Button>
            ) : null}
          </fieldset>
        ))}
        <Button variant="outline" size="sm" onClick={() => setVariants((rows) => [...rows, newVariant()])} disabled={variants.length >= 30}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('seller.addVariant')}
        </Button>
      </FormSection>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={submitting}>
          <PackagePlus className="h-4 w-4" aria-hidden="true" />
          {submitting ? t('seller.submitting') : t('seller.submit')}
        </Button>
      </div>
    </form>
  );
}
