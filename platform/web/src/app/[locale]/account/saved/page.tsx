import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { PostFeed } from '@/components/community/post-feed';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'community' });
  return { title: t('savedPosts'), robots: { index: false, follow: false } };
}

export default async function SavedPostsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('community');
  return (
    <RequireAuth>
      <div className="container-page max-w-2xl space-y-5 py-6 lg:py-8">
        <header>
          <h1 className="text-2xl font-bold text-fg">{t('savedPosts')}</h1>
          <p className="mt-1 text-fg-muted">{t('savedIntro')}</p>
        </header>
        <PostFeed endpoint="/me/bookmarks" label={t('savedPosts')} empty={t('noSaved')} />
      </div>
    </RequireAuth>
  );
}
