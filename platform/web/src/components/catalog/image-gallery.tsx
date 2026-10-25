'use client';

import { Package } from 'lucide-react';
import { localizeDigits } from '@boikonika/shared';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/** Main photo with selectable thumbnails. */
export function ImageGallery({ images, title }: { images: Array<{ url: string; alt: string | null }>; title: string }) {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const current = images[index];
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-subtle">
        {current ? (
          <Image src={current.url} alt={current.alt ?? title} fill priority sizes="(max-width: 768px) 100vw, 28rem" className="object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-fg-subtle" role="img" aria-label={title}>
            <Package className="h-16 w-16" aria-hidden="true" />
          </div>
        )}
      </div>
      {images.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t('photo', { n: localizeDigits(i + 1, locale) })}
                aria-pressed={i === index}
                className={cn('relative block h-16 w-16 overflow-hidden rounded-lg border-2 bg-subtle', i === index ? 'border-primary' : 'border-transparent hover:border-line-strong')}
              >
                <Image src={img.url} alt="" fill sizes="4rem" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
