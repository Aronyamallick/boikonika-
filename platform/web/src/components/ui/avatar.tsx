import { cn } from '@/lib/cn';

const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl', xl: 'h-24 w-24 text-3xl' };

export function Avatar({ name, src, size = 'md', className }: { name: string; src?: string | null; size?: keyof typeof sizes; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => Array.from(p)[0])
    .join('')
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from user uploads with arbitrary dimensions
    <img src={src} alt={name} className={cn('shrink-0 rounded-full object-cover', sizes[size], className)} loading="lazy" />
  ) : (
    <span aria-label={name} role="img" className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-soft-fg', sizes[size], className)}>
      {initials || '?'}
    </span>
  );
}
