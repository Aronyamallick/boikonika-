import { localizeDigits } from '@boikonika/shared';
import { Package } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Price } from '@/components/ui/price';
import { Rating } from '@/components/ui/rating';
import { Link } from '@/i18n/navigation';
import type { ProductCardData } from '@/lib/catalog';
import { cn } from '@/lib/cn';

export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <article className={cn('group relative flex w-full min-w-0 flex-col', className)}>
      <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-subtle">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt="" fill sizes="(max-width: 640px) 45vw, 200px" className="object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full items-center justify-center text-fg-subtle" aria-hidden="true">
            <Package className="h-10 w-10" />
          </div>
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-fg">
        <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none group-focus-within:underline">
          {product.title}
        </Link>
      </h3>
      {product.store ? <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted">{product.store.name}</p> : null}
      {product.ratingCount > 0 ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-fg-muted">
          <Rating value={product.ratingAvg} label={t('book.rating', { rating: localizeDigits(product.ratingAvg.toFixed(1), locale) })} />
          <span>({localizeDigits(product.ratingCount, locale)})</span>
        </p>
      ) : null}
      <div className="mt-auto pt-1.5">
        {product.inStock ? <Price amount={product.price} compareAt={product.compareAtPrice} locale={locale} size="sm" /> : <p className="text-xs text-fg-subtle">{t('common.outOfStock')}</p>}
      </div>
    </article>
  );
}
