import { discountPercent, formatMoney, localizeDigits } from '@boikonika/shared';
import { cn } from '@/lib/cn';
import { Badge } from './badge';

/** Formats BDT with Bangla digits in Bangla locale; shows the compare-at price and discount when present. */
export function Price({ amount, compareAt, locale, size = 'md', className }: { amount: string; compareAt?: string | null; locale: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const off = discountPercent(amount, compareAt);
  const text = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' }[size];
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-bold text-fg', text)}>{formatMoney(amount, locale, { hideZeroDecimals: true })}</span>
      {off > 0 && compareAt ? (
        <>
          <span className="text-sm text-fg-subtle line-through">{formatMoney(compareAt, locale, { hideZeroDecimals: true })}</span>
          <Badge tone="accent">−{localizeDigits(off, locale)}%</Badge>
        </>
      ) : null}
    </span>
  );
}
