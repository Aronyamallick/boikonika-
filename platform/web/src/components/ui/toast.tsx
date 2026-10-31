'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'danger' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{ show: (message: string, tone?: ToastTone) => void } | null>(null);

export function ToastProvider({ children, closeLabel }: { children: ReactNode; closeLabel: string }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-2), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === 'danger' ? 6000 : 3500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);
  const icons = { success: CheckCircle2, danger: XCircle, info: Info };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end">
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'danger' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3 text-sm shadow-lg',
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', t.tone === 'success' ? 'text-success-text' : t.tone === 'danger' ? 'text-danger' : 'text-info')} aria-hidden="true" />
              <p className="flex-1 text-fg">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-fg-subtle hover:text-fg" aria-label={closeLabel}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
