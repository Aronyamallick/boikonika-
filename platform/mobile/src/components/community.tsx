import { localizeDigits, radius, spacing, type ClubCard as ClubCardData, type PostView } from '@boikonika/shared';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Bookmark, BookmarkCheck, Heart, MessageCircle, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFormatter, useLocale, useTranslations } from 'use-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/lib/theme';
import { Cover } from './books';
import { useToast } from './toast';
import { Badge, Card, Text } from './ui';

export function Avatar({ name, uri, size = 36 }: { name: string; uri: string | null; size?: number }) {
  const { c } = useTheme();
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.skeleton }} alt="" />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.secondarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text size="sm" weight="bold" style={{ color: c.secondarySoftFg }}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function Action({ icon: Icon, label, count, active, onPress }: { icon: typeof Heart; label: string; count?: number; active?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const locale = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[2], opacity: pressed ? 0.7 : 1 })}
    >
      <Icon size={20} color={active ? c.primary : c.textMuted} fill={active && Icon === Heart ? c.primary : 'none'} />
      {count !== undefined ? (
        <Text size="sm" tone={active ? 'primary' : 'muted'}>
          {localizeDigits(count, locale)}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A community post with like, comment and save. Tapping the text opens the post and its comments. */
export function PostCard({ post: initial, full }: { post: PostView; full?: boolean }) {
  const t = useTranslations('community');
  const tAll = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const { status } = useAuth();
  const toast = useToast();
  const [post, setPost] = useState(initial);
  const open = () => router.push(`/posts/${post.id}` as Href);

  const requireSignIn = () => {
    if (status === 'authenticated') return false;
    toast(t('signInToInteract'));
    router.push('/login');
    return true;
  };
  const toggleLike = async () => {
    if (requireSignIn()) return;
    const liked = !post.liked;
    setPost((p) => ({ ...p, liked, likeCount: p.likeCount + (liked ? 1 : -1) }));
    try {
      const res = await api<{ liked: boolean; likeCount: number }>(`/posts/${post.id}/like`, { method: liked ? 'PUT' : 'DELETE' });
      setPost((p) => ({ ...p, ...res }));
    } catch (error) {
      setPost((p) => ({ ...p, liked: !liked, likeCount: p.likeCount + (liked ? -1 : 1) }));
      toast(errorMessage(error, tAll), 'danger');
    }
  };
  const toggleSave = async () => {
    if (requireSignIn()) return;
    const bookmarked = !post.bookmarked;
    setPost((p) => ({ ...p, bookmarked }));
    try {
      await api(`/posts/${post.id}/bookmark`, { method: bookmarked ? 'PUT' : 'DELETE' });
      toast(bookmarked ? t('saved') : t('unsaved'));
    } catch (error) {
      setPost((p) => ({ ...p, bookmarked: !bookmarked }));
      toast(errorMessage(error, tAll), 'danger');
    }
  };

  return (
    <Card style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <Avatar name={post.author.name} uri={post.author.avatarUrl} />
        <View style={{ flex: 1 }}>
          <Text weight="semibold" numberOfLines={1}>
            {post.author.name}
          </Text>
          <Text size="xs" tone="subtle">
            {format.relativeTime(new Date(post.createdAt))}
            {post.editedAt ? ` · ${t('edited')}` : ''}
          </Text>
        </View>
        <Badge label={t(`types.${post.type}` as 'types.discussion')} tone="primary" />
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel={t('postBy', { name: post.author.name })} onPress={full ? undefined : open} disabled={full} style={{ gap: spacing[2] }}>
        {post.status === 'pending' ? <Badge label={t('pendingReview')} tone="warning" /> : null}
        {post.title ? (
          <Text size="lg" weight="bold">
            {post.title}
          </Text>
        ) : null}
        <Text numberOfLines={full ? undefined : 6} style={post.type === 'quote' ? { fontStyle: 'italic' } : undefined}>
          {post.body}
        </Text>
        {post.quoteSource ? (
          <Text size="sm" tone="muted">
            — {post.quoteSource}
          </Text>
        ) : null}
        {post.readingPercent !== null ? (
          <Text size="sm" tone="muted">
            {t('readingProgress')}: {localizeDigits(post.readingPercent, locale)}%
          </Text>
        ) : null}
      </Pressable>
      {post.media.length ? (
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          {post.media.slice(0, full ? 4 : 2).map((m, i) => (
            <Image key={m.url} source={{ uri: m.url }} style={{ flex: 1, aspectRatio: m.width && m.height ? m.width / m.height : 1, maxHeight: 280, borderRadius: radius.md }} contentFit="cover" alt={m.alt ?? t('imageAlt', { n: i + 1, name: post.author.name })} />
          ))}
        </View>
      ) : null}
      {post.book ? <BookTagRow book={post.book} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -spacing[2] }}>
        <Action icon={Heart} label={t('like')} count={post.likeCount} active={post.liked} onPress={toggleLike} />
        <Action icon={MessageCircle} label={t('comments')} count={post.commentCount} onPress={open} />
        <View style={{ flex: 1 }} />
        <Action icon={post.bookmarked ? BookmarkCheck : Bookmark} label={t('save')} active={post.bookmarked} onPress={toggleSave} />
      </View>
    </Card>
  );
}

function BookTagRow({ book }: { book: NonNullable<PostView['book']> }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={book.title}
      onPress={() => router.push(`/books/${book.slug}` as Href)}
      style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'center', backgroundColor: c.bgSubtle, borderRadius: radius.md, padding: spacing[2] }}
    >
      <Cover uri={book.coverUrl} title={book.title} width={36} rounded={4} />
      <View style={{ flex: 1 }}>
        <Text size="sm" weight="semibold" numberOfLines={1}>
          {book.title}
        </Text>
        <Text size="xs" tone="muted" numberOfLines={1}>
          {book.authors.join(', ')}
        </Text>
      </View>
    </Pressable>
  );
}

export function ClubCard({ club }: { club: ClubCardData }) {
  const t = useTranslations('clubs');
  const { c } = useTheme();
  return (
    <Card onPress={() => router.push(`/clubs/${club.slug}` as Href)} accessibilityLabel={club.name} style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'center' }}>
        {club.coverUrl ? (
          <Image source={{ uri: club.coverUrl }} style={{ width: 48, height: 48, borderRadius: radius.md }} alt="" />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} color={c.primarySoftFg} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text weight="semibold" numberOfLines={1}>
            {club.name}
          </Text>
          <Text size="xs" tone="muted">
            {t('members', { count: club.memberCount })} · {club.purpose === 'study' ? t('studyGroup') : t(`types.${club.type}`)}
          </Text>
        </View>
        {club.membership?.status === 'active' ? <Badge label={t(`roles.${club.membership.role}`)} tone="success" /> : null}
      </View>
      {club.description ? (
        <Text size="sm" tone="muted" numberOfLines={2}>
          {club.description}
        </Text>
      ) : null}
      {club.currentBook ? (
        <Text size="sm" numberOfLines={1}>
          {t('reading', { title: club.currentBook.title })}
        </Text>
      ) : null}
    </Card>
  );
}
