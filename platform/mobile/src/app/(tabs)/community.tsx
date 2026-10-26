import { FEED_TABS, type FeedTab, type PostView } from '@boikonika/shared';
import { router } from 'expo-router';
import { PenLine } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { Chips } from '@/components/chips';
import { PostCard } from '@/components/community';
import { Fab } from '@/components/fab';
import { List } from '@/components/list';
import { EmptyState, ErrorState, Loading, OfflineNotice, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useInfinite } from '@/lib/use-api';

export default function CommunityScreen() {
  const t = useTranslations('community');
  const { status } = useAuth();
  const [tab, setTab] = useState<FeedTab>('for_you');
  const feed = useInfinite<PostView>('/feed', { persist: true, query: { tab } });
  const tabs = FEED_TABS.filter((v) => v !== 'following' || status === 'authenticated');

  return (
    <View style={{ flex: 1 }}>
      <List
        data={feed.items}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        refreshing={feed.refreshing}
        onRefresh={feed.reload}
        onEndReached={feed.loadMore}
        loadingMore={feed.loadingMore}
        header={
          <>
            <Text size="sm" tone="muted">
              {t('guidelinesShort')}
            </Text>
            <Chips label={t('feedLabel')} value={tab} onChange={setTab} options={tabs.map((v) => ({ value: v, label: t(`tabs.${v}`) }))} />
            {feed.offline ? <OfflineNotice /> : null}
          </>
        }
        empty={feed.loading ? <Loading /> : feed.error ? <ErrorState offline={feed.error.code === 'NETWORK'} onRetry={feed.reload} /> : <EmptyState title={tab === 'following' ? t('emptyFollowing') : t('empty')} />}
      />
      <Fab icon={PenLine} label={t('newPost')} onPress={() => router.push(status === 'authenticated' ? '/posts/new' : '/login')} />
    </View>
  );
}
