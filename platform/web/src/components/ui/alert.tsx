import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const styles = {
  info: { box: 'bg-info-soft text-info-soft-fg', Icon: Info },
  success: { box: 'bg-success-soft text-success-soft-fg', Icon: CheckCircle2 },
  warning: { box: 'bg-warning-soft text-warning-soft-fg', Icon: AlertTriangle },
  danger: { box: 'bg-danger-soft text-danger-soft-fg', Icon: XCircle },
} as const;

export function Alert({ tone = 'info', title, children, className }: { tone?: keyof typeof styles; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, Icon } = styles[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg px-4 py-3 text-sm', box, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
