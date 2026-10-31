import { Clock, Eye } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Breadcrumbs, type Crumb } from '@/components/catalog/breadcrumbs';
import { JsonLd } from '@/components/catalog/json-ld';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { absoluteUrl } from '@/lib/seo';
import { articleHref, type ArticleDetail } from '@/lib/content';
import { ArticleCard } from './article-card';
import { Markdown } from './markdown';
import { ViewBeacon } from './view-beacon';

/** A full article (blog or help) with author, dates, structured data and related reading. */
export async function ArticleView({ article, crumbs }: { article: ArticleDetail; crumbs: Crumb[] }) {
  const t = await getTranslations('content');
  const format = await getFormatter();
  const locale = await getLocale();
  return (
    <div className="container-page py-6 sm:py-10">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': article.kind === 'help' ? 'TechArticle' : 'Article',
          headline: article.title,
          description: article.excerpt,
          inLanguage: article.language,
          image: article.coverUrl ?? undefined,
          datePublished: article.publishedAt ?? undefined,
          dateModified: article.updatedAt,
          author: article.author ? { '@type': 'Person', name: article.author.name } : { '@type': 'Organization', name: 'Boikonika' },
          publisher: { '@type': 'Organization', name: 'Boikonika' },
          mainEntityOfPage: absoluteUrl(locale, articleHref(article)),
        }}
      />
      <ViewBeacon articleId={article.id} />
      <Breadcrumbs items={[...crumbs, { label: article.title }]} />
      <article className="mx-auto mt-6 max-w-3xl" lang={article.language}>
        <header className="mb-6">
          <Badge tone={article.kind === 'announcement' ? 'accent' : article.kind === 'help' ? 'secondary' : 'primary'}>{t(`kinds.${article.kind}`)}</Badge>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-fg sm:text-4xl">{article.title}</h1>
          {article.excerpt && article.kind !== 'help' ? <p className="mt-3 text-lg text-fg-muted">{article.excerpt}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
            {article.author ? (
              <span className="inline-flex items-center gap-2">
                <Avatar name={article.author.name} src={article.author.avatarUrl} size="sm" />
                <span className="font-medium text-fg">{article.author.name}</span>
              </span>
            ) : null}
            {article.publishedAt ? <time dateTime={article.publishedAt}>{format.dateTime(new Date(article.publishedAt), { dateStyle: 'long' })}</time> : null}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {t('readMinutes', { count: article.readMinutes })}
            </span>
            {article.kind !== 'help' ? (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-4 w-4" aria-hidden="true" />
                {t('views', { count: article.viewCount })}
              </span>
            ) : null}
          </div>
        </header>
        {article.coverUrl ? (
          <img src={article.coverUrl} alt="" className="mb-8 aspect-[16/9] w-full rounded-2xl object-cover shadow-sm" />
        ) : null}
        <Markdown source={article.body} />
        {article.tags.length ? (
          <p className="mt-8 flex flex-wrap gap-2 border-t border-line pt-5">
            {article.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                #{tag}
              </Badge>
            ))}
          </p>
        ) : null}
      </article>
      {article.related.length ? (
        <section aria-labelledby="related-title" className="mx-auto mt-12 max-w-5xl">
          <h2 id="related-title" className="mb-4 text-xl font-bold">
            {t('related')}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {article.related.map((a) => (
              <li key={a.id}>
                <ArticleCard article={a} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
