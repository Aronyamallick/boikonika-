import type { ReactNode } from 'react';
import { BookOpen } from 'lucide-react';

/** Centered card layout shared by the sign-in, sign-up and reset pages. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg" aria-hidden="true">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold leading-tight text-fg">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-fg-muted">{subtitle}</p> : null}
            </div>
          </div>
          {children}
        </div>
        {footer ? <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
