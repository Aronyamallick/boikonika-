import { formatMoney, localizeDigits } from '@boikonika/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Price } from '@/components/ui/price';
import { Rating } from '@/components/ui/rating';
import { Link } from '@/i18n/navigation';
import type { BookCardData } from '@/lib/catalog';
import { cn } from '@/lib/cn';

/**
 * Book tile for shelves, grids and search results. The whole card is one link (the title), so
 * keyboard and screen-reader users get a single, well-named stop per book.
 */
export function BookCard({ book, priority, className }: { book: BookCardData; priority?: boolean; className?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const authors = book.authors.map((a) => a.name).join(', ');
  const href = `/books/${book.slug}`;
  return (
    <article className={cn('group relative flex w-full min-w-0 flex-col', className)}>
      <BookCover src={book.coverUrl} title={book.title} author={authors} priority={priority} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md" />
      <h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-fg">
        <Link href={href} className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none group-focus-within:underline">
          {book.title}
        </Link>
      </h3>
      {authors ? <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted">{authors}</p> : null}
      {book.ratingCount > 0 ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-fg-muted">
          <Rating value={book.ratingAvg} label={t('book.rating', { rating: localizeDigits(book.ratingAvg.toFixed(1), locale) })} />
          <span>({localizeDigits(book.ratingCount, locale)})</span>
        </p>
      ) : null}
      {book.isFree || book.hasUsed ? (
        <p className="mt-1.5 flex flex-wrap gap-1">
          {book.isFree ? <Badge tone="success">{t('catalog.freeBadge')}</Badge> : null}
          {book.hasUsed ? <Badge tone="secondary">{t('catalog.used')}</Badge> : null}
        </p>
      ) : null}
      <div className="mt-auto pt-1.5">
        {book.minPrice && book.inStock ? (
          book.offerCount > 1 ? (
            <p className="text-sm text-fg-muted">{t.rich('catalog.from', { price: formatMoney(book.minPrice!, locale, { hideZeroDecimals: true }), b: (chunks) => <span className="font-bold text-fg">{chunks}</span> })}</p>
          ) : (
            <Price amount={book.minPrice} compareAt={book.compareAtPrice} locale={locale} size="sm" />
          )
        ) : book.isFree ? (
          <p className="text-sm font-bold text-success-text">{t('common.free')}</p>
        ) : (
          <p className="text-xs text-fg-subtle">{t('catalog.unavailable')}</p>
        )}
      </div>
    </article>
  );
}
