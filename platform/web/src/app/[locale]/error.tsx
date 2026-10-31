'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/states';

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common');
  useEffect(() => {
    // Only the digest reaches the browser in production; details stay in server logs.
    console.error('Page error', error.digest ?? error.message);
  }, [error]);
  return (
    <div className="container-page py-16">
      <ErrorState title={t('errorTitle')} text={t('errorText')} retryLabel={t('retry')} onRetry={reset} />
    </div>
  );
}
