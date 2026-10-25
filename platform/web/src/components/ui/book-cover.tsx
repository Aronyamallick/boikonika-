import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * Fallback cover colours are fixed (not theme tokens) so white text keeps at least 4.5:1 contrast
 * in light and dark mode alike.
 */
const palettes = [
  ['#1E3A8A', '#2563EB'],
  ['#134E4A', '#0F766E'],
  ['#7C2D12', '#B45309'],
  ['#1E293B', '#475569'],
  ['#4C1D95', '#6D28D9'],
  ['#881337', '#BE123C'],
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
