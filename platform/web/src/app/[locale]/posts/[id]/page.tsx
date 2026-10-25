import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { serverApi } from '@/lib/api/server';
import type { PostView } from '@/lib/community';
import { absoluteUrl, alternates, jsonLd } from '@/lib/seo';
import { PostDetail } from './post-detail';

type Params = Promise<{ locale: string; id: string }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public posts render on the server (shareable, indexable); others load in the browser for the people allowed to see them. */
async function load(locale: string, id: string) {
  return UUID.test(id) ? serverApi<PostView>(`/posts/${id}`, { locale, revalidate: 30 }) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'community' });
  const post = await load(locale, id);
  if (!post) return { title: t('title'), robots: { index: false, follow: false } };
  const text = post.body.replace(/\s+/g, ' ').slice(0, 160);
  const title = post.title ?? t('postBy', { name: post.author.name });
  return {
    title,
    description: text,
    alternates: alternates(locale, `/posts/${id}`),
    openGraph: { title, description: text, type: 'article', images: post.media[0] ? [post.media[0].url] : post.book?.coverUrl ? [post.book.coverUrl] : undefined },
    robots: post.studentZone ? { index: false, follow: true } : undefined,
  };
}

export default async function PostPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const post = await load(locale, id);
  return (
    <div className="container-page max-w-2xl py-6 lg:py-8">
      {post ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              '@context': 'https://schema.org',
              '@type': 'DiscussionForumPosting',
              headline: post.title ?? post.body.slice(0, 110),
              text: post.body,
              datePublished: post.createdAt,
              dateModified: post.editedAt ?? post.createdAt,
              url: absoluteUrl(locale, `/posts/${id}`),
              author: { '@type': 'Person', name: post.author.name, url: absoluteUrl(locale, `/u/${post.author.username}`) },
              interactionStatistic: [
                { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: post.likeCount },
                { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: post.commentCount },
              ],
            }),
          }}
        />
      ) : null}
      <PostDetail id={id} initial={post} />
    </div>
  );
}
