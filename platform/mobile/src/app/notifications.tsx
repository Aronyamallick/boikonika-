import { spacing, type NotificationItem } from '@boikonika/shared';
import { Bell } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { Chips } from '@/components/chips';
import { List } from '@/components/list';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button, EmptyState, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { openLink } from '@/lib/links';
import { useTheme } from '@/lib/theme';
import { useInfinite } from '@/lib/use-api';

export default function NotificationsScreen() {
  const t = useTranslations('notifications');
  const format = useFormatter();
  const { c } = useTheme();
  const { status } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const list = useInfinite<NotificationItem>(status === 'authenticated' ? '/me/notifications' : null, { query: { unread: filter === 'unread' ? 1 : undefined, limit: 30 } });
  const [read, setRead] = useState<Set<string>>(new Set());

  if (status === 'anonymous') return <Screen><SignInPrompt /></Screen>;

  const open = (n: NotificationItem) => {
    if (!n.read && !read.has(n.id)) {
      setRead((s) => new Set(s).add(n.id));
      void api(`/me/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
    }
    if (n.link) void openLink(n.link);
  };
  const markAll = async () => {
    await api('/me/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    list.reload();
    setRead(new Set());
  };

  return (
    <List
      data={list.items}
      keyExtractor={(n) => n.id}
      gap={0}
      refreshing={list.refreshing}
      onRefresh={list.reload}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <Chips label={t('filter')} value={filter} onChange={setFilter} options={[{ value: 'all', label: t('all') }, { value: 'unread', label: t('unreadOnly') }]} />
          </View>
          <Button small variant="ghost" title={t('markAllRead')} onPress={markAll} />
        </View>
      }
      renderItem={({ item: n }) => {
        const unread = !n.read && !read.has(n.id);
        return (
          <Pressable accessibilityRole={n.link ? 'link' : 'button'} accessibilityLabel={`${unread ? `${t('unread')}: ` : ''}${n.title}`} onPress={() => open(n)} style={({ pressed }) => ({ flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border, opacity: pressed ? 0.8 : 1 })}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 9, backgroundColor: unread ? c.primary : 'transparent' }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight={unread ? 'bold' : 'semibold'}>{n.title}</Text>
              <Text size="sm" tone="muted">
                {n.body}
              </Text>
              <Text size="xs" tone="subtle">
                {format.relativeTime(new Date(n.createdAt))} · {t(`types.${n.type}`)}
              </Text>
            </View>
          </Pressable>
        );
      }}
      empty={list.loading ? <Loading /> : list.error ? <ErrorState offline={list.error.code === 'NETWORK'} onRetry={list.reload} /> : <EmptyState icon={Bell} title={filter === 'unread' ? t('noUnread') : t('empty')} text={t('emptyText')} />}
    />
  );
}
