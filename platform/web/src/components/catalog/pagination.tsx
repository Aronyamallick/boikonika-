import { localizeDigits } from '@boikonika/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { toQuery } from '@/lib/catalog';
import { cn } from '@/lib/cn';

/** Numbered pagination with plain links (crawlable, works without JavaScript). */
export function Pagination({ path, params, page, pageSize, total }: { path: string; params: Record<string, string>; page: number; pageSize: number; total: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => `${path}${toQuery({ ...params, page: p > 1 ? p : undefined })}`;
  const windowed = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))).sort((a, b) => a - b);
  const item = 'inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold';
  return (
    <nav aria-label={t('catalog.pagination')} className="mt-10 flex flex-col items-center gap-3">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={cn(item, 'text-fg-muted hover:bg-subtle hover:text-fg')}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t('common.previous')}</span>
            </Link>
          ) : null}
        </li>
        {windowed.map((p, i) => (
          <li key={p} className="flex items-center gap-1">
            {i > 0 && p - windowed[i - 1]! > 1 ? (
              <span className="px-1 text-fg-subtle" aria-hidden="true">
                …
              </span>
            ) : null}
            <Link
              href={href(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={t('catalog.goToPage', { page: localizeDigits(p, locale) })}
              className={cn(item, p === page ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:bg-subtle hover:text-fg')}
            >
              {localizeDigits(p, locale)}
            </Link>
          </li>
        ))}
        <li>
          {page < pages ? (
            <Link href={href(page + 1)} rel="next" className={cn(item, 'text-fg-muted hover:bg-subtle hover:text-fg')}>
              <span className="sr-only sm:not-sr-only">{t('common.next')}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </li>
      </ul>
      <p className="text-xs text-fg-subtle">{t('catalog.pageOf', { page: localizeDigits(page, locale), pages: localizeDigits(pages, locale) })}</p>
    </nav>
  );
}
