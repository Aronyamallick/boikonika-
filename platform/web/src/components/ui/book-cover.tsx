import Image from 'next/image';
import { cn } from '@/lib/cn';

const palettes = [
  ['var(--bk-primary)', 'var(--bk-primary-hover)'],
  ['var(--bk-secondary)', 'var(--bk-secondary-hover)'],
  ['var(--bk-primary-soft-fg)', 'var(--bk-primary)'],
  ['var(--bk-secondary-soft-fg)', 'var(--bk-secondary)'],
];

/**
 * Book cover with a typographic fallback when the publisher has not uploaded an image —
 * so a grid never shows broken images and every cover still reads like a book.
 */
export function BookCover({ src, title, author, className, sizes = '(max-width: 640px) 45vw, 200px', priority }: { src?: string | null; title: string; author?: string; className?: string; sizes?: string; priority?: boolean }) {
  if (src) {
    return (
      <div className={cn('relative aspect-[2/3] overflow-hidden rounded-lg bg-subtle shadow-sm', className)}>
        <Image src={src} alt={title} fill sizes={sizes} className="object-cover" priority={priority} />
      </div>
    );
  }
  const hash = Array.from(title).reduce((h, ch) => (h * 31 + ch.codePointAt(0)!) >>> 0, 7);
  const [from, to] = palettes[hash % palettes.length]!;
  return (
    <div
      role="img"
      aria-label={title}
      className={cn('relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-lg p-3 text-white shadow-sm', className)}
      style={{ backgroundImage: `linear-gradient(150deg, ${from}, ${to})` }}
    >
      <span className="absolute inset-y-0 left-2 w-px bg-white/25" aria-hidden="true" />
      <p className="line-clamp-4 pl-2 font-serif text-base font-bold leading-snug" aria-hidden="true">
        {title}
      </p>
      {author ? (
        <p className="line-clamp-2 pl-2 text-xs opacity-85" aria-hidden="true">
          {author}
        </p>
      ) : null}
    </div>
  );
}
