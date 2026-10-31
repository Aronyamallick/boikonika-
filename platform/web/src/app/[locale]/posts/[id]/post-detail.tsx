'use client';

import { ArrowLeft, MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Comments } from '@/components/community/comments';
import { PostCard } from '@/components/community/post-card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import type { PostView } from '@/lib/community';

export function PostDetail({ id, initial }: { id: string; initial: PostView | null }) {
  const t = useTranslations('community');
  const router = useRouter();
  const { status } = useAuth();
  const [post, setPost] = useState(initial);
  const [version, setVersion] = useState(0);
  const [missing, setMissing] = useState(false);

  // Signed-in viewers get their like/save state, and can open follower-only or their own posts.
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'anonymous' && initial) return;
    api<PostView>(`/posts/${id}`).then(
      (p) => (setPost(p), setVersion((v) => v + 1)),
      (e) => e instanceof ApiError && e.status === 404 && setMissing(true),
    );
  }, [id, status, initial]);

  if (missing || (!post && status === 'anonymous')) return <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title={t('notFound')} action={<Link href="/community" className="font-semibold text-primary hover:underline">{t('backToCommunity')}</Link>} />;
  if (!post) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-6">
      <Link href="/community" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('backToCommunity')}
      </Link>
      <PostCard key={version} post={post} detail onDeleted={() => router.replace('/community')} />
      {post.status === 'published' ? <Comments postId={post.id} /> : null}
    </div>
  );
}
