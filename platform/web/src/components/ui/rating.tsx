import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Read-only star rating with an accessible text equivalent (e.g. "4.5 out of 5"). */
export function Rating({ value, label, size = 'sm', className }: { value: number; label: string; size?: 'sm' | 'md'; className?: string }) {
  const px = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className={cn('relative', px)} aria-hidden="true">
            <Star className={cn('absolute inset-0 text-line-input', px)} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn('fill-accent text-accent-hover', px)} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
