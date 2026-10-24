import { cn } from '@/lib/cn';

/** Original Boikonika mark: an open book with a golden "particle" of knowledge (কণিকা) above it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-9 w-9', className)} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="11" fill="var(--bk-primary)" />
      <path d="M7.5 14.2c4-1.4 8.2-1 12.5 1.6v15.6c-4.3-2.5-8.5-3-12.5-1.6z" fill="#fff" />
      <path d="M32.5 14.2c-4-1.4-8.2-1-12.5 1.6v15.6c4.3-2.5 8.5-3 12.5-1.6z" fill="#fff" fillOpacity="0.82" />
      <circle cx="20" cy="8.6" r="2.7" fill="var(--bk-accent)" />
      <path d="M20 3.6v1.6M15.6 5.4l1.1 1.1M24.4 5.4l-1.1 1.1" stroke="var(--bk-accent)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-xl font-extrabold tracking-tight text-fg">{name}</span>
    </span>
  );
}
