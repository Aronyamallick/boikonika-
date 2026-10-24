'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Modal built on the native <dialog> element: focus trapping, Esc to close and the
 * inert background come from the browser, so it stays accessible without extra code.
 */
export function Dialog({ open, onClose, title, children, footer, closeLabel, className }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; closeLabel: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto w-[min(92vw,560px)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-lg backdrop:bg-overlay open:animate-slide-up',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-fg-muted hover:bg-subtle hover:text-fg" aria-label={closeLabel}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer ? <div className="flex justify-end gap-3 border-t border-line px-5 py-3">{footer}</div> : null}
    </dialog>
  );
}
