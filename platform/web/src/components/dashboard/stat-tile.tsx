'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Label · value · optional signed change vs the previous period. Direction is carried by an arrow
 * and the sign as well as colour; `upIsGood` decides whether a rise reads as success or danger.
 */
export function StatTile({
  label,
  value,
  change,
  comparison,
  upIsGood = true,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  /** Percentage change (12.5 = +12.5%); null when there is nothing to compare with; omit to hide. */
  change?: number | null;
  /** e.g. "vs previous 30 days". */
  comparison?: string;
  upIsGood?: boolean;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  const t = useTranslations('dashboard');
  const format = useFormatter();
  const good = change !== undefined && change !== null && change !== 0 && change > 0 === upIsGood;
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        {icon ? <span className="text-fg-subtle" aria-hidden="true">{icon}</span> : null}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-fg">{value}</p>
      {change !== undefined ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {change === null ? (
            <span className="text-fg-muted">{t('noComparison')}</span>
          ) : (
            <>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold',
                  change === 0 ? 'bg-subtle text-fg-muted' : good ? 'bg-success-soft text-success-soft-fg' : 'bg-danger-soft text-danger-soft-fg',
                )}
              >
                {change > 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : change < 0 ? <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" /> : <Minus className="h-3.5 w-3.5" aria-hidden="true" />}
                {format.number(change / 100, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' })}
              </span>
              {comparison ? <span className="text-fg-muted">{comparison}</span> : null}
            </>
          )}
        </p>
      ) : null}
      {hint ? <p className="mt-2 text-xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}

/** Date-range presets as a segmented radio group (one row, above the content it scopes). */
export function RangePresets<T extends number>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  const t = useTranslations('dashboard');
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5 shadow-sm">
      {options.map((days) => (
        <button
          key={days}
          type="button"
          role="radio"
          aria-checked={value === days}
          onClick={() => onChange(days)}
          onKeyDown={(e) => {
            const i = options.indexOf(value);
            const next = e.key === 'ArrowRight' ? options[(i + 1) % options.length] : e.key === 'ArrowLeft' ? options[(i - 1 + options.length) % options.length] : undefined;
            if (next === undefined) return;
            e.preventDefault();
            onChange(next);
            (e.currentTarget.parentElement?.querySelector(`[data-days="${next}"]`) as HTMLButtonElement | null)?.focus();
          }}
          tabIndex={value === days ? 0 : -1}
          data-days={days}
          className={cn('rounded-md px-3 py-1.5 text-sm font-semibold transition-colors', value === days ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:bg-subtle hover:text-fg')}
        >
          {t('lastDays', { count: days })}
        </button>
      ))}
    </div>
  );
}
