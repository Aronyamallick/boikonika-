import { Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/cn';

/** Plain GET form so search works without JavaScript; the search page adds autocomplete. */
export async function SearchBox({ action, defaultValue, className, size = 'md' }: { action: string; defaultValue?: string; className?: string; size?: 'md' | 'lg' }) {
  const t = await getTranslations('search');
  return (
    <form action={action} method="get" role="search" className={cn('relative w-full', className)}>
      <label htmlFor={`q-${size}`} className="sr-only">
        {t('placeholder')}
      </label>
      <Search className={cn('pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle', size === 'lg' ? 'h-5 w-5' : 'h-4.5 w-4.5')} aria-hidden="true" />
      <input
        id={`q-${size}`}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={t('placeholder')}
        autoComplete="off"
        enterKeyHint="search"
        className={cn(
          'w-full rounded-full border border-line-input bg-surface pl-11 pr-4 text-fg placeholder:text-fg-subtle shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
          size === 'lg' ? 'h-14 text-base' : 'h-11 text-[15px]',
        )}
      />
    </form>
  );
}
