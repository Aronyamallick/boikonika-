import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { localized } from '@/lib/catalog';
import type { Banner } from '@/lib/content';
import { cn } from '@/lib/cn';

/**
 * Staff banners: wide images with their text laid over a dark fade so it stays readable on any
 * picture. Several banners scroll sideways (no autoplay, so nothing moves on its own).
 */
export function BannerStrip({ banners, locale, label, priority }: { banners: Banner[]; locale: string; label: string; priority?: boolean }) {
  if (!banners.length) return null;
  return (
    <div role="region" aria-label={label} className="container-page">
      <ul className={cn('flex gap-4', banners.length > 1 && 'snap-x snap-mandatory overflow-x-auto pb-2 [scrollbar-width:thin]')}>
        {banners.map((b, i) => {
          const title = localized(b.title, locale);
          const subtitle = localized(b.subtitle, locale);
          const cta = localized(b.ctaLabel, locale);
          const content = (
            <>
              <picture>
                {b.mobileImageUrl ? <source media="(max-width: 639px)" srcSet={b.mobileImageUrl} /> : null}
                <img src={b.imageUrl ?? undefined} alt="" loading={priority && i === 0 ? 'eager' : 'lazy'} fetchPriority={priority && i === 0 ? 'high' : undefined} className="h-full w-full object-cover" />
              </picture>
              <span className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent sm:via-black/30" aria-hidden="true" />
              <span className="absolute inset-0 flex flex-col justify-end p-5 text-white sm:justify-center sm:p-10">
                <span className="max-w-xl text-2xl font-extrabold leading-tight drop-shadow sm:text-4xl">{title}</span>
                {subtitle ? <span className="mt-2 max-w-lg text-sm opacity-95 sm:text-lg">{subtitle}</span> : null}
                {b.link && cta ? (
                  <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-fg shadow">
                    {cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : null}
              </span>
            </>
          );
          const shape = 'relative block aspect-[4/3] overflow-hidden rounded-2xl bg-subtle shadow-sm sm:aspect-[3/1]';
          return (
            <li key={b.id} className={cn('shrink-0 snap-start', banners.length > 1 ? 'w-[88%] sm:w-[92%]' : 'w-full')}>
              {b.link ? (
                b.link.startsWith('/') ? (
                  <Link href={b.link} className={cn(shape, 'focus-visible:outline-4 focus-visible:outline-offset-2')}>
                    {content}
                  </Link>
                ) : (
                  <a href={b.link} target="_blank" rel="noopener noreferrer" className={cn(shape, 'focus-visible:outline-4 focus-visible:outline-offset-2')}>
                    {content}
                  </a>
                )
              ) : (
                <div className={shape}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
