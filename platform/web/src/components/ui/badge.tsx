import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-subtle text-fg-muted border-line',
  primary: 'bg-primary-soft text-primary-soft-fg border-transparent',
  secondary: 'bg-secondary-soft text-secondary-soft-fg border-transparent',
  accent: 'bg-accent-soft text-accent-soft-fg border-transparent',
  success: 'bg-success-soft text-success-soft-fg border-transparent',
  warning: 'bg-warning-soft text-warning-soft-fg border-transparent',
  danger: 'bg-danger-soft text-danger-soft-fg border-transparent',
  info: 'bg-info-soft text-info-soft-fg border-transparent',
};

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)} {...props} />;
}
