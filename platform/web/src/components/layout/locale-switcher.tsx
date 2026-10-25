'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Toggles between বাংলা and English, keeping the current page and query string. */
export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const target = locale === 'bn' ? 'en' : 'bn';
  const query = params.toString();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { locale: target }))}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm sm:px-2.5 font-semibold text-fg-muted hover:bg-subtle hover:text-fg disabled:opacity-60"
      aria-label={`${t('language')}: ${target === 'en' ? 'English' : 'বাংলা'}`}
      lang={target}
    >
      {/* On phones the short language name alone is the clearer cue, and the header has no room for both. */}
      <Languages className="hidden h-5 w-5 sm:block" aria-hidden="true" />
      <span>{target === 'en' ? 'EN' : 'বাং'}</span>
    </button>
  );
}
