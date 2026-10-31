'use client';

import { CheckCircle2, Gift, Tablet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { AddToCart } from '@/components/cart/add-to-cart';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import type { BookDetail, BookOffer } from '@/lib/catalog';
import { formatBytes } from '@/lib/digital';
import { useFormErrors } from '@/lib/forms/errors';
import { DownloadButton } from './download-button';

/** The e-book edition on a book page: buy it, take it free, or download the copy I already have. */
export function EbookPanel({ bookId, title, digital, offer }: { bookId: string; title: string; digital: NonNullable<BookDetail['digital']>; offer: BookOffer | null }) {
  const t = useTranslations('digital');
  const locale = useLocale();
  const { status } = useAuth();
  const pathname = usePathname();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [owned, setOwned] = useState<boolean | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    api<{ hasDigitalAccess: boolean } | null>(`/me/library/${bookId}`).then((r) => setOwned(r?.hasDigitalAccess === true), () => setOwned(false));
  }, [status, bookId]);

  const claim = async () => {
    setClaiming(true);
    try {
      const res = await apiRequest(`/me/library/${bookId}/free`, { method: 'POST' });
      setOwned(true);
      toast.show(res.message, 'success');
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setClaiming(false);
    }
  };

  const facts = [digital.format.toUpperCase(), digital.pageCount ? t('pages', { count: digital.pageCount }) : null, formatBytes(digital.sizeBytes, locale)].filter(Boolean).join(' · ');
  return (
    <section aria-labelledby="ebook" className="rounded-xl border border-secondary/30 bg-secondary-soft/40 p-5 shadow-sm">
      <h2 id="ebook" className="flex items-center gap-2 text-lg font-bold text-fg">
        <Tablet className="h-5 w-5 text-secondary" aria-hidden="true" />
        {t('ebook')}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">{facts}</p>

      {owned ? (
        <div className="mt-3 space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success-text">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t('inYourLibrary')}
          </p>
          <DownloadButton bookId={bookId} title={title} className="w-full" />
        </div>
      ) : digital.free ? (
        <div className="mt-3 space-y-3">
          <Badge tone="success">{t('free')}</Badge>
          {status === 'anonymous' ? (
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses({ variant: 'secondary', className: 'w-full' })}>
              <Gift className="h-4 w-4" aria-hidden="true" />
              {t('getFree')}
            </Link>
          ) : (
            <Button variant="secondary" className="w-full" loading={claiming} disabled={owned === null && status === 'authenticated'} onClick={claim}>
              <Gift className="h-4 w-4" aria-hidden="true" />
              {t('getFree')}
            </Button>
          )}
        </div>
      ) : offer?.variantId ? (
        <div className="mt-3 space-y-3">
          <Price amount={offer.price} compareAt={offer.compareAtPrice} locale={locale} />
          <AddToCart variantId={offer.variantId} available={1} buyNow />
          <p className="text-xs text-fg-muted">{t('soldBy', { store: offer.store.name })}</p>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-fg-muted">{t('anyDevice')}</p>
    </section>
  );
}
