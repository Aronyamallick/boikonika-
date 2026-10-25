'use client';

import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { Markdown } from '@/components/content/markdown';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { localized } from '@/lib/catalog';
import type { ArticleCard, Faq } from '@/lib/content';

/** Searches FAQs and help articles as you type (after a short pause). */
export function HelpSearch() {
  const t = useTranslations('help');
  const locale = useLocale();
  const id = useId();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ faqs: Faq[]; articles: ArticleCard[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api<{ faqs: Faq[]; articles: ArticleCard[] }>('/help/search', { query: { q: query } }).then(
        (r) => (setResults(r), setFailed(false)),
        () => setFailed(true),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const count = (results?.faqs.length ?? 0) + (results?.articles.length ?? 0);
  return (
    <div role="search">
      <label htmlFor={id} className="sr-only">
        {t('searchLabel')}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-13 w-full rounded-full border border-line-input bg-surface pl-12 pr-4 text-base text-fg shadow-sm placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
          aria-describedby={`${id}-status`}
        />
      </div>
      <p id={`${id}-status`} className="sr-only" aria-live="polite">
        {results ? t('resultCount', { count }) : ''}
      </p>
      {failed ? <p className="mt-3 text-sm text-danger">{t('searchError')}</p> : null}
      {results ? (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-surface p-3 shadow-md">
          {count === 0 ? (
            <p className="p-2 text-sm text-fg-muted">
              {t('noResults')}{' '}
              <Link href="/contact" className="font-semibold text-primary hover:underline">
                {t('askUs')}
              </Link>
            </p>
          ) : null}
          {results.articles.map((a) => (
            <Link key={a.id} href={`/help/${a.slug}`} className="block rounded-lg p-2 hover:bg-subtle" lang={a.language}>
              <span className="block font-semibold text-fg">{a.title}</span>
              <span className="line-clamp-1 block text-sm text-fg-muted">{a.excerpt}</span>
            </Link>
          ))}
          {results.faqs.map((f) => (
            <details key={f.id} className="rounded-lg p-2 hover:bg-subtle">
              <summary className="cursor-pointer font-semibold text-fg">{localized(f.question, locale)}</summary>
              <Markdown source={localized(f.answer, locale)} compact className="mt-2 text-fg-muted" />
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
