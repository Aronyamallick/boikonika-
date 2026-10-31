import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const control =
  'block w-full rounded-lg border border-line-input bg-surface px-3.5 text-[15px] text-fg placeholder:text-fg-subtle ' +
  'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ' +
  'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-subtle aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, 'h-11', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-28 py-2.5 leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, 'h-11 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: 'var(--bk-select-chevron, none)' }} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={props.id ?? id} className={cn('inline-flex cursor-pointer items-start gap-2.5 text-sm text-fg', className)}>
      <input id={props.id ?? id} type="checkbox" className="mt-0.5 h-4.5 w-4.5 shrink-0 rounded border-line-input accent-[var(--bk-primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Label + control + hint + error with correct ARIA wiring. The render prop receives the
 * ids so any control (Input, Select, custom) gets aria-describedby / aria-invalid.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; required?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-fg">
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {error ? (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
