import { ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { absoluteUrl } from '@/lib/seo';
import { JsonLd } from './json-ld';

export interface Crumb {
  label: string;
  href?: string;
}

/** Visible breadcrumb trail plus schema.org BreadcrumbList for search engines. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const all: Crumb[] = [{ label: t('nav.home'), href: '/' }, ...items];
  return (
    <nav aria-label={t('catalog.breadcrumbs')} className="text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-fg-muted">
        {all.map((c, i) => (
          <li key={`${c.label}-${i}`} className="inline-flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden="true" /> : null}
            {c.href && i < all.length - 1 ? (
              <Link href={c.href} className="truncate hover:text-fg hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-fg" aria-current={i === all.length - 1 ? 'page' : undefined}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, ...(c.href ? { item: absoluteUrl(locale, c.href) } : {}) })),
        }}
      />
    </nav>
  );
}
