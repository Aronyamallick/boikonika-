import { radius, spacing, type AuthorCardData, type Banner, type BookCardData, type ClubCard as Club, type HomeSection, type LocalizedText } from '@boikonika/shared';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { GraduationCap, Quote, Search, Trophy, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { BookCard, SectionHeader, Shelf } from '@/components/books';
import { Avatar, ClubCard } from '@/components/community';
import { Card, ErrorState, Heading, OfflineNotice, Screen, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLocalized } from '@/lib/format';
import { openLink } from '@/lib/links';
import { useTheme } from '@/lib/theme';
import { useApi } from '@/lib/use-api';

/** Where "View all" goes for each kind of book shelf (same lists as the website). */
const SHELF_QUERY: Record<string, Record<string, string>> = {
  trending: { sort: 'popular' },
  best_sellers: { sort: 'popular' },
  new_releases: { sort: 'newest' },
  editors_picks: { pick: 'editors' },
  student_picks: { pick: 'students' },
  teacher_picks: { pick: 'teachers' },
  discounted: { discounted: '1' },
  used: { condition: 'used_like_new,used_good,used_acceptable' },
  free: { free: '1' },
  hidden_gems: { minRating: '4' },
};

type CategoryItem = { slug: string; path: string; name: LocalizedText };
type ChallengeItem = { slug: string; title: LocalizedText; description: LocalizedText; durationDays: number; xpReward: number };
type Testimonial = { id: string; name: string; role: LocalizedText; quote: LocalizedText; avatarUrl: string | null };
type ForYou = { items: Array<BookCardData & { reason: unknown }>; basedOn: { title: string } | null; becauseYouRead: BookCardData[] };

const booksHref = (query: Record<string, string>) => `/books?${new URLSearchParams(query).toString()}` as Href;

export default function HomeScreen() {
  const t = useTranslations();
  const { c } = useTheme();
  const localized = useLocalized();
  const { status } = useAuth();
  const home = useApi<HomeSection[]>('/home', { persist: true });
  const forYou = useApi<ForYou>(status === 'authenticated' ? '/me/recommendations' : null, { persist: true, query: { limit: 16 } });

  const section = (s: HomeSection) => {
    const title = localized(s.title);
    const subtitle = localized(s.subtitle) || undefined;
    switch (s.type) {
      case 'hero':
        return (
          <View key={s.key} style={{ gap: spacing[1] }}>
            <Heading level={1}>{title || t('landing.heroTitle')}</Heading>
            <Text tone="muted">{subtitle ?? t('landing.heroSubtitle')}</Text>
          </View>
        );
      case 'book_list':
        return (
          <Shelf
            key={s.key}
            title={title}
            subtitle={subtitle}
            items={s.items as BookCardData[]}
            keyOf={(b) => b.id}
            renderItem={(b) => <BookCard book={b} />}
            onViewAll={s.config.source && SHELF_QUERY[s.config.source] ? () => router.push(booksHref(SHELF_QUERY[s.config.source!]!)) : undefined}
          />
        );
      case 'category_grid':
        return (
          <View key={s.key} style={{ gap: spacing[3] }}>
            <SectionHeader title={title} subtitle={subtitle} actionLabel={t('common.viewAll')} onAction={() => router.push('/explore')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              {(s.items as CategoryItem[]).slice(0, 8).map((cat) => (
                <Pressable
                  key={cat.path}
                  accessibilityRole="link"
                  onPress={() => router.push(`/categories/${cat.path}` as Href)}
                  style={({ pressed }) => ({ width: '48.5%', minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 })}
                >
                  <Text size="sm" weight="semibold" numberOfLines={2}>
                    {localized(cat.name)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      case 'author_list':
        return (
          <Shelf
            key={s.key}
            title={title}
            subtitle={subtitle}
            items={s.items as AuthorCardData[]}
            keyOf={(a) => a.slug}
            itemWidth={92}
            renderItem={(a) => (
              <Pressable accessibilityRole="link" accessibilityLabel={a.name} onPress={() => void openLink(`/authors/${a.slug}`)} style={{ alignItems: 'center', gap: spacing[1] }}>
                <Avatar name={a.name} uri={a.photoUrl} size={72} />
                <Text size="xs" weight="semibold" numberOfLines={2} style={{ textAlign: 'center' }}>
                  {a.name}
                </Text>
              </Pressable>
            )}
          />
        );
      case 'banner':
        return (
          <View key={s.key} style={{ gap: spacing[3] }}>
            {(s.items as Banner[]).slice(0, 3).map((b) => (
              <Pressable key={b.id} accessibilityRole={b.link ? 'link' : undefined} disabled={!b.link} onPress={() => b.link && void openLink(b.link)} style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.primarySoft }}>
                {b.mobileImageUrl || b.imageUrl ? <Image source={{ uri: b.mobileImageUrl ?? b.imageUrl! }} style={{ width: '100%', aspectRatio: 2 }} contentFit="cover" alt="" /> : null}
                <View style={{ padding: spacing[4], gap: spacing[1] }}>
                  <Text weight="bold" style={{ color: c.primarySoftFg }}>
                    {localized(b.title)}
                  </Text>
                  {localized(b.subtitle) ? <Text size="sm" style={{ color: c.primarySoftFg }}>{localized(b.subtitle)}</Text> : null}
                  {localized(b.ctaLabel) && b.link ? (
                    <Text size="sm" weight="semibold" tone="primary">
                      {localized(b.ctaLabel)} →
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        );
      case 'book_clubs':
        return (
          <View key={s.key} style={{ gap: spacing[3] }}>
            <SectionHeader title={title} subtitle={subtitle} actionLabel={t('common.viewAll')} onAction={() => router.push('/clubs')} />
            {(s.items as Club[]).slice(0, 3).map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </View>
        );
      case 'reading_challenges':
        return (
          <Shelf
            key={s.key}
            title={title}
            subtitle={subtitle ?? t('landing.challengeText')}
            items={s.items as ChallengeItem[]}
            keyOf={(ch) => ch.slug}
            itemWidth={220}
            renderItem={(ch) => (
              <Card onPress={() => void openLink(`/challenges/${ch.slug}`)} accessibilityLabel={localized(ch.title)} style={{ gap: spacing[2], minHeight: 150 }}>
                <Trophy size={22} color={c.accent} />
                <Text weight="bold" numberOfLines={2}>
                  {localized(ch.title)}
                </Text>
                <Text size="xs" tone="muted">
                  {t('landing.challengeDays', { days: ch.durationDays })} · {t('landing.challengeXp', { xp: ch.xpReward })}
                </Text>
              </Card>
            )}
          />
        );
      case 'student_zone':
        return (
          <View key={s.key} style={{ flexDirection: 'row', gap: spacing[3] }}>
            {[
              { href: '/student-zone' as Href, Icon: GraduationCap, label: title || t('landing.studentZoneTitle'), tone: [c.secondarySoft, c.secondarySoftFg] },
              { href: '/clubs' as Href, Icon: Users, label: t('landing.clubsTitle'), tone: [c.primarySoft, c.primarySoftFg] },
            ].map(({ href, Icon, label, tone }) => (
              <Pressable key={label} accessibilityRole="link" onPress={() => router.push(href)} style={{ flex: 1, gap: spacing[2], padding: spacing[4], borderRadius: radius.lg, backgroundColor: tone[0] }}>
                <Icon size={24} color={tone[1]} />
                <Text weight="bold" style={{ color: tone[1] }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      case 'testimonials':
        return (
          <Shelf
            key={s.key}
            title={title}
            items={s.items as Testimonial[]}
            keyOf={(q) => q.id}
            itemWidth={260}
            renderItem={(q) => (
              <Card style={{ gap: spacing[2], minHeight: 160 }}>
                <Quote size={20} color={c.accent} />
                <Text size="sm">{localized(q.quote)}</Text>
                <Text size="xs" weight="semibold" tone="muted">
                  {q.name}
                  {localized(q.role) ? ` · ${localized(q.role)}` : ''}
                </Text>
              </Card>
            )}
          />
        );
      default:
        // Sections the app doesn't show (seller spotlights, marketing blocks) stay on the website.
        return null;
    }
  };

  return (
    <Screen refreshing={home.refreshing} onRefresh={() => (home.reload(), forYou.reload())}>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={t('search.placeholder')}
        onPress={() => router.push('/search')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 48, paddingHorizontal: spacing[4], borderRadius: radius.full, borderWidth: 1, borderColor: c.borderInput, backgroundColor: c.surface }}
      >
        <Search size={18} color={c.textSubtle} />
        <Text tone="subtle">{t('search.placeholder')}</Text>
      </Pressable>
      {home.offline ? <OfflineNotice /> : null}
      {home.loading && !home.data ? (
        <View style={{ gap: spacing[3] }}>
          <Skeleton height={28} width="60%" />
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={190} width={128} />
            ))}
          </View>
        </View>
      ) : home.error && !home.data ? (
        <ErrorState offline={home.error.code === 'NETWORK'} onRetry={home.reload} />
      ) : null}
      {forYou.data?.items.length ? (
        <Shelf title={t('landing.recommended')} items={forYou.data.items} keyOf={(b) => b.id} renderItem={(b) => <BookCard book={b} />} />
      ) : null}
      {forYou.data?.basedOn && forYou.data.becauseYouRead.length ? (
        <Shelf title={t('landing.becauseYouRead', { title: forYou.data.basedOn.title })} items={forYou.data.becauseYouRead} keyOf={(b) => b.id} renderItem={(b) => <BookCard book={b} />} />
      ) : null}
      {(home.data ?? []).map(section)}
    </Screen>
  );
}
