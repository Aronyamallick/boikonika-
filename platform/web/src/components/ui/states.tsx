'use client';

import { BookOpen, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';

export function EmptyState({ icon, title, text, action, className }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center', className)}>
      <div className="mb-4 rounded-full bg-primary-soft p-3 text-primary-soft-fg" aria-hidden="true">
        {icon ?? <BookOpen className="h-6 w-6" />}
      </div>
      <p className="text-base font-semibold text-fg">{title}</p>
      {text ? <p className="mt-1 max-w-md text-sm text-fg-muted">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, text, retryLabel, onRetry, offline }: { title: ReactNode; text?: ReactNode; retryLabel?: string; onRetry?: () => void; offline?: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <div className="mb-4 rounded-full bg-danger-soft p-3 text-danger-soft-fg" aria-hidden="true">
        {offline ? <WifiOff className="h-6 w-6" /> : <RefreshCw className="h-6 w-6" />}
      </div>
      <p className="text-base font-semibold text-fg">{title}</p>
      {text ? <p className="mt-1 max-w-md text-sm text-fg-muted">{text}</p> : null}
      {onRetry && retryLabel ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
