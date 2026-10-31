import { localizeDigits } from '@boikonika/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Rating } from '@/components/ui/rating';
import type { RatingSummary as Summary } from '@/lib/catalog';

/** Average plus a 5→1 star distribution (bars are decorative; counts are read out as text). */
export function RatingSummary({ rating }: { rating: Summary }) {
  const t = useTranslations();
  const locale = useLocale();
  if (!rating.count) return <p className="text-sm text-fg-muted">{t('catalog.noRatings')}</p>;
  const max = Math.max(1, ...Object.values(rating.breakdown));
  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="text-center sm:text-left">
        <p className="text-5xl font-extrabold text-fg">{localizeDigits(rating.average.toFixed(1), locale)}</p>
        <Rating value={rating.average} size="md" label={t('book.rating', { rating: localizeDigits(rating.average.toFixed(1), locale) })} className="mt-1" />
        <p className="mt-1 text-sm text-fg-muted">{t('book.ratingsCount', { count: rating.count })}</p>
      </div>
      <ul className="space-y-1.5" aria-label={t('catalog.ratingSummary')}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = rating.breakdown[String(star)] ?? 0;
          return (
            <li key={star} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 text-fg-muted">{t('catalog.starsRow', { count: star })}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(count / max) * 100}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums text-fg-muted">{localizeDigits(count, locale)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
