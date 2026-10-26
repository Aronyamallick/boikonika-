import { radius, spacing, type CategoryNode } from '@boikonika/shared';
import { router, type Href } from 'expo-router';
import { BookOpen, ChevronRight, GraduationCap, HelpCircle, Library, Sparkles, Tag, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { SectionHeader } from '@/components/books';
import { ErrorState, Heading, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { useLocalized } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useApi } from '@/lib/use-api';

function LinkRow({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 52, paddingHorizontal: spacing[4], backgroundColor: pressed ? c.bgSubtle : c.surface })}>
      <Icon size={20} color={c.primary} />
      <Text weight="medium" style={{ flex: 1 }}>
        {label}
      </Text>
      <ChevronRight size={18} color={c.textSubtle} />
    </Pressable>
  );
}

/** Finding books: every category, plus the main places to browse. */
export default function ExploreScreen() {
  const t = useTranslations();
  const { c } = useTheme();
  const localized = useLocalized();
  const categories = useApi<CategoryNode[]>('/categories', { persist: true, query: { for: 'book' } });

  const links: Array<{ icon: LucideIcon; label: string; href: Href }> = [
    { icon: BookOpen, label: t('nav.books'), href: '/books' },
    { icon: Sparkles, label: t('landing.newReleases'), href: '/books?sort=newest' },
    { icon: Tag, label: t('landing.discountBooks'), href: '/books?discounted=1' },
    { icon: Library, label: t('landing.freeBooks'), href: '/books?free=1' },
    { icon: GraduationCap, label: t('nav.studentZone'), href: '/student-zone' },
    { icon: Users, label: t('nav.bookClubs'), href: '/clubs' },
    { icon: HelpCircle, label: t('nav.help'), href: '/help' },
  ];

  return (
    <Screen refreshing={categories.refreshing} onRefresh={categories.reload}>
      <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
        {links.map((l, i) => (
          <View key={l.label} style={i ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
            <LinkRow icon={l.icon} label={l.label} onPress={() => router.push(l.href)} />
          </View>
        ))}
      </View>
      <SectionHeader title={t('nav.categories')} />
      {categories.offline ? <OfflineNotice /> : null}
      {categories.loading && !categories.data ? <Loading /> : null}
      {categories.error && !categories.data ? <ErrorState offline={categories.error.code === 'NETWORK'} onRetry={categories.reload} /> : null}
      {(categories.data ?? []).map((cat) => (
        <View key={cat.path} style={{ gap: spacing[2] }}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/categories/${cat.path}` as Href)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Heading level={3}>{localized(cat.name)}</Heading>
          </Pressable>
          {cat.children.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              {cat.children.map((child) => (
                <Pressable
                  key={child.path}
                  accessibilityRole="link"
                  onPress={() => router.push(`/categories/${child.path}` as Href)}
                  style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radius.full, borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.bgSubtle : c.surface })}
                >
                  <Text size="sm">{localized(child.name)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}
