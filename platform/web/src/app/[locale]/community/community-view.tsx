'use client';

import { FEED_TABS, type FeedTab } from '@boikonika/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Composer } from '@/components/community/composer';
import { PostFeed } from '@/components/community/post-feed';
import { cn } from '@/lib/cn';
import type { PostView } from '@/lib/community';

export function CommunityView() {
  const t = useTranslations('community');
  const { status } = useAuth();
  const [tab, setTab] = useState<FeedTab>('for_you');
  const [mine, setMine] = useState<PostView[]>([]);
  const tabs = FEED_TABS.filter((k) => k !== 'following' || status === 'authenticated');
  return (
    <div className="space-y-5">
      <Composer onPosted={(p) => setMine((list) => [p, ...list])} />
      <div className="flex gap-1 border-b border-line" role="group" aria-label={t('feedLabel')}>
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
            className={cn('-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold', tab === k ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-fg')}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>
      <PostFeed endpoint="/feed" query={{ tab }} prepend={mine} label={t(`tabs.${tab}`)} empty={tab === 'following' ? t('emptyFollowing') : undefined} />
    </div>
  );
}
