import { spacing, type StudentHome } from '@boikonika/shared';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Award, CalendarDays, ClipboardCheck, NotebookPen, Trophy, Users } from 'lucide-react-native';
import { View } from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { BookCard, SectionHeader, Shelf } from '@/components/books';
import { Badge, Card, ErrorState, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { openLink } from '@/lib/links';
import { useTheme } from '@/lib/theme';
import { useApi } from '@/lib/use-api';

/** Study help in one place: quizzes, study groups, events, competitions, scholarships and textbooks. */
export default function StudentZoneScreen() {
  const t = useTranslations('student');
  const tAll = useTranslations();
  const format = useFormatter();
  const { c } = useTheme();
  const home = useApi<StudentHome>('/student-zone', { persist: true });
  const d = home.data;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });

  return (
    <Screen refreshing={home.refreshing} onRefresh={home.reload}>
      <Text tone="muted">{t('intro')}</Text>
      {home.offline ? <OfflineNotice /> : null}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        {[
          { label: t('quizzes'), Icon: ClipboardCheck, onPress: () => void openLink('/student-zone/quizzes') },
          { label: t('myNotes'), Icon: NotebookPen, onPress: () => void openLink('/student-zone/notes') },
          { label: t('studyGroups'), Icon: Users, onPress: () => router.push('/clubs') },
        ].map(({ label, Icon, onPress }) => (
          <Card key={label} onPress={onPress} accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', gap: spacing[2], padding: spacing[3] }}>
            <Icon size={22} color={c.secondary} />
            <Text size="sm" weight="semibold" style={{ textAlign: 'center' }}>
              {label}
            </Text>
          </Card>
        ))}
      </View>
      {!d ? (
        home.loading ? <Loading /> : <ErrorState offline={home.error?.code === 'NETWORK'} onRetry={home.reload} />
      ) : (
        <>
          {d.quizzes.length ? (
            <View style={{ gap: spacing[2] }}>
              <SectionHeader title={t('quizzes')} subtitle={t('quizzesText')} actionLabel={tAll('common.viewAll')} onAction={() => void openLink('/student-zone/quizzes')} />
              {d.quizzes.slice(0, 4).map((q) => (
                <Card key={q.id} onPress={() => void openLink(`/student-zone/quizzes/${q.slug}`)} accessibilityLabel={q.title} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
                    <Text weight="semibold" style={{ flex: 1 }}>
                      {q.title}
                    </Text>
                    {q.passed ? <Badge label={t('passedBadge')} tone="success" /> : null}
                  </View>
                  <Text size="xs" tone="muted">
                    {tAll(`subjects.${q.subject}` as 'subjects.bangla')} · {t(`levels.${q.academicLevel}` as 'levels.general')} · {t('questions', { count: q.questionCount })}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
          {d.studyGroups.length ? (
            <View style={{ gap: spacing[2] }}>
              <SectionHeader title={t('studyGroups')} actionLabel={tAll('common.viewAll')} onAction={() => router.push('/clubs')} />
              {d.studyGroups.slice(0, 4).map((g) => (
                <Card key={g.slug} onPress={() => router.push(`/clubs/${g.slug}` as Href)} accessibilityLabel={g.name}>
                  <Text weight="semibold">{g.name}</Text>
                  <Text size="xs" tone="muted">
                    {tAll('clubs.members', { count: g.memberCount })}
                    {g.institutionName ? ` · ${g.institutionName}` : ''}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
          {d.events.length ? (
            <View style={{ gap: spacing[2] }}>
              <SectionHeader title={t('events')} />
              {d.events.map((e) => (
                <Card key={e.id} style={{ gap: 4 }} onPress={e.onlineUrl ? () => void WebBrowser.openBrowserAsync(e.onlineUrl!) : undefined} accessibilityLabel={e.title}>
                  <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
                    <CalendarDays size={16} color={c.primary} />
                    <Text weight="semibold" style={{ flex: 1 }}>
                      {e.title}
                    </Text>
                  </View>
                  <Text size="xs" tone="muted">
                    {date(e.startsAt)}
                    {e.location ? ` · ${e.location}` : ''}
                    {e.organizer ? ` · ${e.organizer}` : ''}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
          {d.competitions.length ? (
            <View style={{ gap: spacing[2] }}>
              <SectionHeader title={t('competitions')} />
              {d.competitions.map((comp) => (
                <Card key={comp.id} onPress={() => void openLink(`/student-zone/competitions/${comp.slug}`)} accessibilityLabel={comp.title} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
                    <Trophy size={16} color={c.accent} />
                    <Text weight="semibold" style={{ flex: 1 }}>
                      {comp.title}
                    </Text>
                    <Badge label={t(`competitionStatus.${comp.status}`)} tone={comp.status === 'open' ? 'success' : 'neutral'} />
                  </View>
                  <Text size="xs" tone="muted">
                    {t('until', { date: date(comp.endsAt) })} · {t('entries', { count: comp.entryCount })}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
          {d.scholarships.length ? (
            <View style={{ gap: spacing[2] }}>
              <SectionHeader title={t('scholarships')} />
              {d.scholarships.map((s) => (
                <Card key={s.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
                    <Award size={16} color={c.secondary} />
                    <Text weight="semibold" style={{ flex: 1 }}>
                      {s.title}
                    </Text>
                  </View>
                  <Text size="xs" tone="muted">
                    {s.provider}
                    {s.amountText ? ` · ${s.amountText}` : ''}
                    {s.deadline ? ` · ${t('deadline', { date: date(s.deadline) })}` : ''}
                  </Text>
                  <Text size="sm" numberOfLines={3}>
                    {s.description}
                  </Text>
                  {s.applyUrl ? (
                    <Text size="sm" weight="semibold" tone="primary" accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(s.applyUrl!)}>
                      {t('apply')} ↗
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}
          <Shelf title={t('textbooks')} subtitle={t('textbooksText')} items={d.textbooks} keyOf={(b) => b.id} renderItem={(b) => <BookCard book={b} />} onViewAll={() => router.push('/books?pick=students')} />
        </>
      )}
    </Screen>
  );
}
