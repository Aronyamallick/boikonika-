'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddToCart } from '@/components/cart/add-to-cart';
import { Price } from '@/components/ui/price';
import type { ProductVariant } from '@/lib/catalog';
import { cn } from '@/lib/cn';

/** Variant choice (size, colour, pack) with its own price and availability. */
export function VariantPicker({ variants }: { variants: ProductVariant[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const [selected, setSelected] = useState(() => variants.find((v) => v.available > 0)?.id ?? variants[0]?.id);
  const variant = variants.find((v) => v.id === selected) ?? variants[0];
  if (!variant) return null;
  return (
    <div className="space-y-4">
      <Price amount={variant.price} compareAt={variant.compareAtPrice} locale={locale} size="lg" />
      {variants.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-fg">{t('catalog.chooseVariant')}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <label
                key={v.id}
                className={cn(
                  'cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40',
                  v.id === variant.id ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-line-input text-fg hover:border-primary',
                  v.available <= 0 && 'opacity-60',
                )}
              >
                <input type="radio" name="variant" value={v.id} checked={v.id === variant.id} onChange={() => setSelected(v.id)} className="sr-only" />
                {v.name}
                {v.available <= 0 ? <span className="sr-only"> ({t('common.outOfStock')})</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <p className={variant.available > 0 ? (variant.available <= 3 ? 'text-sm font-semibold text-warning-soft-fg' : 'text-sm text-success') : 'text-sm text-fg-subtle'} aria-live="polite">
        {variant.available > 0 ? (variant.available <= 3 ? t('catalog.lowStock', { count: variant.available }) : t('common.inStock')) : t('common.outOfStock')}
      </p>
      <AddToCart variantId={variant.id} available={variant.available} size="lg" buyNow />
    </div>
  );
}
