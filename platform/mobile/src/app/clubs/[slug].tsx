import { spacing, type ClubDetail, type ClubPost } from '@boikonika/shared';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CalendarDays, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { Cover } from '@/components/books';
import { Avatar } from '@/components/community';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, EmptyState, ErrorState, Heading, Input, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/lib/theme';
import { useApi } from '@/lib/use-api';

export default function ClubScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTranslations('clubs');
  const tAll = useTranslations();
  const format = useFormatter();
  const { c } = useTheme();
  const toast = useToast();
  const { status } = useAuth();
  const club = useApi<ClubDetail>(`/clubs/${slug}`, { persist: true });
  const posts = useApi<ClubPost[]>(club.data?.readable ? `/clubs/${slug}/posts` : null, { persist: true, query: { pageSize: 20 } });
  const [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState('');
  const d = club.data;

  if (!d) return club.loading ? <Loading /> : <Screen><ErrorState offline={club.error?.code === 'NETWORK'} onRetry={club.reload} /></Screen>;

  const m = d.membership;
  const member = m?.status === 'active';
  const act = async (method: 'POST' | 'DELETE') => {
    if (status !== 'authenticated') return router.push('/login');
    setBusy(true);
    try {
      const res = await apiRequest(method === 'POST' ? `/clubs/${slug}/join` : `/clubs/${slug}/membership`, { method });
      toast(res.message);
      club.reload();
    } catch (error) {
      toast(errorMessage(error, tAll), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const postTopic = async () => {
    setBusy(true);
    try {
      const res = await apiRequest(`/clubs/${slug}/posts`, { method: 'POST', body: { body: topic } });
      setTopic('');
      toast(res.message);
      posts.reload();
    } catch (error) {
      toast(errorMessage(error, tAll), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const current = d.books.find((b) => b.status === 'current');
  const upcoming = d.events.filter((e) => new Date(e.endsAt ?? e.startsAt) >= new Date());

  return (
    <Screen refreshing={club.refreshing} onRefresh={() => (club.reload(), posts.reload())}>
      <Stack.Screen options={{ title: d.name }} />
      {club.offline ? <OfflineNotice /> : null}
      <View style={{ gap: spacing[2] }}>
        <Heading level={2}>{d.name}</Heading>
        <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
          <Badge label={d.purpose === 'study' ? t('studyGroup') : t(`types.${d.type}`)} tone="primary" />
          <Badge label={t('members', { count: d.memberCount })} />
          {m ? <Badge label={m.status === 'pending' ? t('requestSent') : t(`roles.${m.role}`)} tone={member ? 'success' : 'warning'} /> : null}
        </View>
        {d.institutionName ? <Text size="sm" tone="muted">{d.institutionName}</Text> : null}
        {d.description ? <Text>{d.description}</Text> : null}
      </View>

      {d.isOwner ? null : member ? (
        <Button variant="outline" title={t('leave')} loading={busy} onPress={() => act('DELETE')} />
      ) : m?.status === 'pending' ? (
        <Button variant="outline" title={t('cancelRequest')} loading={busy} onPress={() => act('DELETE')} />
      ) : m?.status === 'invited' ? (
        <Button title={t('acceptInvite')} loading={busy} onPress={() => act('POST')} />
      ) : d.joinPolicy !== 'invite' ? (
        <Button title={status !== 'authenticated' ? t('loginToJoin') : d.joinPolicy === 'open' ? t('join') : t('requestToJoin')} loading={busy} onPress={() => act('POST')} />
      ) : null}

      {current ? (
        <Card onPress={() => router.push(`/books/${current.book.slug}` as Href)} accessibilityLabel={current.book.title} style={{ flexDirection: 'row', gap: spacing[3] }}>
          <Cover uri={current.book.coverUrl} title={current.book.title} width={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text size="xs" weight="semibold" tone="primary">
              {t('bookOfMonth')}
            </Text>
            <Text weight="semibold">{current.book.title}</Text>
            <Text size="sm" tone="muted">
              {current.book.authors.join(', ')}
            </Text>
            {current.schedule[0] ? (
              <Text size="xs" tone="subtle">
                {t('nextUp', { title: current.schedule[0].title, date: format.dateTime(new Date(current.schedule[0].dueOn), { dateStyle: 'medium' }) })}
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      {!d.readable ? (
        <EmptyState icon={Lock} title={t('privateTitle')} text={t('privateText')} />
      ) : (
        <>
          {upcoming.length ? (
            <View style={{ gap: spacing[2] }}>
              <Heading level={3}>{t('tabEvents')}</Heading>
              {upcoming.map((e) => (
                <Card key={e.id} style={{ gap: spacing[1] }}>
                  <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
                    <CalendarDays size={16} color={c.primary} />
                    <Text size="sm" weight="semibold" style={{ flex: 1 }}>
                      {e.title}
                    </Text>
                  </View>
                  <Text size="sm" tone="muted">
                    {format.dateTime(new Date(e.startsAt), { dateStyle: 'medium', timeStyle: 'short' })}
                    {e.location ? ` · ${e.location}` : ''}
                  </Text>
                  {e.onlineUrl ? <Button small variant="outline" title={t('joinOnline')} onPress={() => void WebBrowser.openBrowserAsync(e.onlineUrl!)} style={{ alignSelf: 'flex-start' }} /> : null}
                </Card>
              ))}
            </View>
          ) : null}
          <View style={{ gap: spacing[2] }}>
            <Heading level={3}>{t('tabDiscussions')}</Heading>
            {posts.loading && !posts.data ? <Loading /> : null}
            {posts.data?.length === 0 ? <EmptyState title={t('noPosts')} /> : null}
            {posts.data?.map((p) => (
              <Card key={p.id} style={{ gap: spacing[2] }}>
                <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
                  <Avatar name={p.author.name} uri={p.author.avatarUrl} size={28} />
                  <Text size="sm" weight="semibold" style={{ flex: 1 }}>
                    {p.author.name}
                  </Text>
                  {p.pinned ? <Badge label={t('pinnedBadge')} tone="accent" /> : null}
                  {p.kind === 'announcement' ? <Badge label={t('announcement')} tone="primary" /> : null}
                </View>
                {p.title ? <Text weight="bold">{p.title}</Text> : null}
                <Text size="sm">{p.body}</Text>
                <Text size="xs" tone="subtle">
                  {format.relativeTime(new Date(p.createdAt))} · {tAll('common.comments', { count: p.replyCount })}
                </Text>
              </Card>
            ))}
            {member ? (
              <Card style={{ gap: spacing[2] }}>
                <Input value={topic} onChangeText={setTopic} placeholder={t('topicPlaceholder')} accessibilityLabel={t('startTopic')} multiline maxLength={5000} />
                <Button small title={t('startTopic')} loading={busy} disabled={!topic.trim()} onPress={postTopic} style={{ alignSelf: 'flex-start' }} />
              </Card>
            ) : status === 'authenticated' ? (
              <Text size="sm" tone="muted">
                {t('joinToPost')}
              </Text>
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}
