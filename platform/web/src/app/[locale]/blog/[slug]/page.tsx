import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArticleView } from '@/components/content/article-view';
import { serverApi } from '@/lib/api/server';
import type { ArticleDetail } from '@/lib/content';
import { alternates, localePath } from '@/lib/seo';

type Params = { params: Promise<{ locale: string; slug: string }> };
const load = (slug: string, locale: string) => serverApi<ArticleDetail>(`/articles/${encodeURIComponent(decodeURIComponent(slug))}`, { locale, revalidate: 60 });

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const a = await load(slug, locale);
  if (!a) return {};
  return {
    title: a.title,
    description: a.excerpt,
    alternates: alternates(locale, `/blog/${a.slug}`),
    openGraph: { type: 'article', title: a.title, description: a.excerpt, images: a.coverUrl ? [a.coverUrl] : undefined, publishedTime: a.publishedAt ?? undefined },
  };
}

export default async function BlogArticlePage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = await load(slug, locale);
  if (!article) notFound();
  if (article.kind === 'help') redirect(localePath(locale, `/help/${article.slug}`));
  const t = await getTranslations('blog');
  return <ArticleView article={article} crumbs={[{ label: t('title'), href: '/blog' }]} />;
}
