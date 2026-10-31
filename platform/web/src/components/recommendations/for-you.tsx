'use client';

import { Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { BookCard } from '@/components/catalog/book-card';
import { Shelf } from '@/components/catalog/shelf';
import { api } from '@/lib/api/client';
import { localized, type BookCardData, type LocalizedText } from '@/lib/catalog';

type Reason = { kind: 'author' | 'readers' | 'genre' | 'category' | 'search' | 'popular'; label?: string | LocalizedText };
interface ForYouData {
  personalized: boolean;
  items: Array<BookCardData & { reason: Reason }>;
  basedOn: { title: string; slug: string } | null;
  becauseYouRead: BookCardData[];
}

/** Signed-in readers' personal shelves on the home page: picks with a reason each, and "because you read …". */
export function ForYou() {
  const t = useTranslations('recommendations');
  const locale = useLocale();
  const { status } = useAuth();
  const [data, setData] = useState<ForYouData | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    api<ForYouData>('/me/recommendations', { query: { limit: 16 } }).then(setData, () => setData(null));
  }, [status]);

  if (status !== 'authenticated' || !data?.personalized || !data.items.length) return null;
  const why = (r: Reason) => {
    const label = typeof r.label === 'string' ? r.label : r.label ? localized(r.label, locale) : '';
    return t(`reason.${r.kind}`, { label });
  };
  return (
    <>
      <Shelf
        id="for-you"
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent-hover" aria-hidden="true" />
            {t('forYou')}
          </span>
        }
        subtitle={t('forYouText')}
        href="/account/profile#personalization"
        linkLabel={t('why')}
      >
        {data.items.map((b) => (
          <div key={b.id} className="flex w-full flex-col">
            <BookCard book={b} />
            <p className="mt-1 line-clamp-2 text-xs text-secondary">{why(b.reason)}</p>
          </div>
        ))}
      </Shelf>
      {data.basedOn && data.becauseYouRead.length ? (
        <Shelf id="because-you-read" title={t('becauseYouRead', { title: data.basedOn.title })} href={`/books/${data.basedOn.slug}`} linkLabel={t('viewBook')}>
          {data.becauseYouRead.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </Shelf>
      ) : null}
    </>
  );
}
