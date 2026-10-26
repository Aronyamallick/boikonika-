import { MAX_COMMENT_LENGTH, spacing, type CommentView, type PostView } from '@boikonika/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFormatter, useTranslations } from 'use-intl';
import { Avatar, PostCard } from '@/components/community';
import { List } from '@/components/list';
import { useToast } from '@/components/toast';
import { Button, EmptyState, ErrorState, Input, Loading, Screen, Text } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/lib/theme';
import { useApi, useInfinite } from '@/lib/use-api';

function Comment({ comment, onReply, depth = 0 }: { comment: CommentView; onReply: (c: CommentView) => void; depth?: number }) {
  const t = useTranslations('community');
  const format = useFormatter();
  return (
    <View style={{ gap: spacing[2], marginLeft: depth ? spacing[8] : 0 }}>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Avatar name={comment.author.name} uri={comment.author.avatarUrl} size={28} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text size="sm" weight="semibold">
            {comment.author.name}{' '}
            <Text size="xs" tone="subtle">
              · {format.relativeTime(new Date(comment.createdAt))}
            </Text>
          </Text>
          <Text size="sm" tone={comment.deleted ? 'subtle' : 'default'}>
            {comment.deleted ? t('commentDeleted') : comment.body}
          </Text>
          {comment.pending ? (
            <Text size="xs" tone="subtle">
              {t('pendingReview')}
            </Text>
          ) : null}
          {!depth && !comment.deleted ? <Button small variant="ghost" title={t('reply')} onPress={() => onReply(comment)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} /> : null}
        </View>
      </View>
      {comment.replies?.map((r) => <Comment key={r.id} comment={r} onReply={onReply} depth={1} />)}
    </View>
  );
}

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { status } = useAuth();
  const post = useApi<PostView>(`/posts/${id}`);
  const comments = useInfinite<CommentView>(`/posts/${id}/comments`);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [sending, setSending] = useState(false);

  if (!post.data) return post.loading ? <Loading /> : <Screen><ErrorState offline={post.error?.code === 'NETWORK'} onRetry={post.reload} /></Screen>;

  const send = async () => {
    if (status !== 'authenticated') return router.push('/login');
    setSending(true);
    try {
      const res = await apiRequest(`/posts/${id}/comments`, { method: 'POST', body: { body, parentId: replyTo?.id } });
      setBody('');
      setReplyTo(null);
      toast(res.message);
      comments.reload();
      post.reload();
    } catch (error) {
      toast(errorMessage(error, t), 'danger');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: t('community.postBy', { name: post.data.author.name }) }} />
      <List
        data={comments.items}
        keyExtractor={(cm) => cm.id}
        renderItem={({ item }) => <Comment comment={item} onReply={setReplyTo} />}
        refreshing={comments.refreshing}
        onRefresh={() => (post.reload(), comments.reload())}
        onEndReached={comments.loadMore}
        loadingMore={comments.loadingMore}
        header={
          <>
            <PostCard post={post.data} full />
            <Text weight="bold">{t('community.comments')}</Text>
          </>
        }
        empty={comments.loading ? <Loading /> : comments.error ? <ErrorState onRetry={comments.reload} /> : <EmptyState title={t('community.noComments')} />}
      />
      <View style={{ gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: insets.bottom + spacing[2], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
        {status === 'authenticated' ? (
          <>
            {replyTo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text size="xs" tone="muted" style={{ flex: 1 }}>
                  {t('community.reply')}: {replyTo.author.name}
                </Text>
                <Button small variant="ghost" title={t('common.cancel')} onPress={() => setReplyTo(null)} />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'flex-end' }}>
              <Input value={body} onChangeText={setBody} placeholder={replyTo ? t('community.replyLabel') : t('community.commentLabel')} accessibilityLabel={replyTo ? t('community.replyLabel') : t('community.commentLabel')} multiline maxLength={MAX_COMMENT_LENGTH} style={{ flex: 1, minHeight: 48, maxHeight: 120 }} />
              <Button title={t('community.comment')} loading={sending} disabled={!body.trim()} onPress={send} />
            </View>
          </>
        ) : (
          <Button variant="outline" title={t('community.signInToComment')} onPress={() => router.push('/login')} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
