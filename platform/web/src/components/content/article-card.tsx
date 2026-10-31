import { Clock, Newspaper } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { articleHref, type ArticleCard as Article } from '@/lib/content';

/** Article teaser: cover, kind, title, excerpt, reading time. The whole card is the link. */
export function ArticleCard({ article, headingLevel = 3 }: { article: Article; headingLevel?: 2 | 3 }) {
  const t = useTranslations('content');
  const format = useFormatter();
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md">
      <div className="aspect-[16/9] overflow-hidden bg-subtle">
        {article.coverUrl ? (
          <img src={article.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-soft to-secondary-soft text-primary-soft-fg" aria-hidden="true">
            <Newspaper className="h-10 w-10 opacity-60" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={article.kind === 'announcement' ? 'accent' : article.kind === 'educational' || article.kind === 'study_resource' ? 'secondary' : 'primary'}>{t(`kinds.${article.kind}`)}</Badge>
          {article.language === 'en' ? (
            <Badge tone="neutral" lang="en">
              English
            </Badge>
          ) : null}
        </p>
        <Heading className="line-clamp-2 font-bold leading-snug text-fg" lang={article.language}>
          <Link href={articleHref(article)} className="after:absolute after:inset-0 after:rounded-xl group-hover:text-primary group-focus-within:underline">
            {article.title}
          </Link>
        </Heading>
        <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-fg-muted" lang={article.language}>
          {article.excerpt}
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
          {article.publishedAt ? <time dateTime={article.publishedAt}>{format.dateTime(new Date(article.publishedAt), { dateStyle: 'medium' })}</time> : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {t('readMinutes', { count: article.readMinutes })}
          </span>
        </p>
      </div>
    </article>
  );
}
