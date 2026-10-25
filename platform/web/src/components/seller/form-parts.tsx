'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Numbered card section of a long seller form. */
export function FormSection({ step, title, children, className }: { step?: number; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-6', className)}>
      <h2 className="mb-5 flex items-center gap-3 text-lg font-bold text-fg">
        {step ? (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm text-primary-soft-fg" aria-hidden="true">
            {step}
          </span>
        ) : null}
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Splits a comma (or Bangla comma) separated list of names. */
export const splitNames = (value: string): string[] =>
  value
    .split(/[,،،]/)
    .map((s) => s.normalize('NFC').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** Optional positive integer from a text field (accepts Bangla digits). */
export function optionalInt(value: string): number | undefined {
  const digits = value.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).trim();
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isInteger(n) ? n : Number.NaN;
}
