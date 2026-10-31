import { localizeDigits, placeName } from '@boikonika/shared';
import { BadgeCheck, MapPin, Star, Store } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import { Link } from '@/i18n/navigation';
import type { AuthorCardData, StoreCardData } from '@/lib/catalog';

export function AuthorCard({ author }: { author: AuthorCardData }) {
  const t = useTranslations();
  return (
    <article className="group relative flex w-full min-w-0 flex-col items-center rounded-xl p-2 text-center">
      <Avatar name={author.name} src={author.photoUrl} size="xl" className="ring-2 ring-line transition-shadow group-hover:ring-primary" />
      <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-fg">
        <Link href={`/authors/${author.slug}`} className="after:absolute after:inset-0 after:rounded-xl group-focus-within:underline">
          {author.name}
        </Link>
        {author.verified ? <BadgeCheck className="ml-1 inline h-4 w-4 text-primary" aria-label={t('common.verified')} /> : null}
      </h3>
      {author.nameAlt ? <p className="line-clamp-1 text-xs text-fg-muted">{author.nameAlt}</p> : null}
      <p className="mt-1 text-xs text-fg-subtle">{t('common.books', { count: author.bookCount })}</p>
    </article>
  );
}

export function StoreCard({ store }: { store: StoreCardData }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <article className="group relative flex w-full min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      {store.logoUrl ? (
        <Avatar name={store.name} src={store.logoUrl} size="lg" className="rounded-xl" />
      ) : (
        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary-soft text-secondary-soft-fg" aria-hidden="true">
          <Store className="h-7 w-7" />
        </span>
      )}
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-fg">
          <Link href={`/stores/${store.slug}`} className="after:absolute after:inset-0 after:rounded-xl group-focus-within:underline">
            {store.name}
          </Link>
        </h3>
        {store.tagline ? <p className="line-clamp-1 text-sm text-fg-muted">{store.tagline}</p> : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-fg-subtle">
          {store.ratingAvg > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-accent text-accent-hover" aria-hidden="true" />
              {localizeDigits(store.ratingAvg.toFixed(1), locale)}
            </span>
          ) : null}
          {store.district ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {placeName(store.district, locale)}
            </span>
          ) : null}
          <span>{t('common.items', { count: store.productCount })}</span>
        </p>
      </div>
    </article>
  );
}
