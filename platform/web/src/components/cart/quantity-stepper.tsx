'use client';

import { MAX_CART_QUANTITY } from '@boikonika/shared';
import { Minus, Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

/** − n + control (buttons with names; the value is announced as it changes). */
export function QuantityStepper({ value, max, onChange, disabled, label }: { value: number; max: number; onChange: (next: number) => void; disabled?: boolean; label: string }) {
  const t = useTranslations('cart');
  const format = useFormatter();
  const limit = Math.max(1, Math.min(MAX_CART_QUANTITY, max));
  const button = 'inline-flex h-9 w-9 items-center justify-center text-fg-muted hover:bg-subtle hover:text-fg disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center overflow-hidden rounded-lg border border-line-input bg-surface', disabled && 'opacity-60')}>
      <button type="button" className={button} onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label={t('decrease')}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <output className="min-w-9 text-center text-sm font-semibold tabular-nums text-fg" aria-live="polite">
        {format.number(value)}
      </output>
      <button type="button" className={button} onClick={() => onChange(value + 1)} disabled={disabled || value >= limit} aria-label={t('increase')}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
