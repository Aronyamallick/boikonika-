import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Progress towards a goal: same-hue track and fill, value and target in text, a check once reached. */
export function GoalMeter({ label, value, max, valueText, doneText, className }: { label: string; value: number; max: number; valueText: ReactNode; doneText?: string; className?: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const done = max > 0 && value >= max;
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4 shadow-sm', className)}>
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="mt-1 flex items-baseline gap-2 text-lg font-bold text-fg">
        {valueText}
        {done && doneText ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-soft-fg">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {doneText}
          </span>
        ) : null}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-soft" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
        <div className={cn('h-full rounded-full', done ? 'bg-success' : 'bg-primary')} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
