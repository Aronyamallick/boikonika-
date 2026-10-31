import { LIBRARY_SHELVES, localizeDigits, radius, spacing, type LibraryItem, type LibraryPage, type LibraryShelf, type ReadingStats } from '@boikonika/shared';
import { router, type Href } from 'expo-router';
import { Flame, Pause, Play, Timer } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { Cover } from '@/components/books';
import { Chips } from '@/components/chips';
import { List } from '@/components/list';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { useToast } from '@/components/toast';
import { Button, Card, EmptyState, ErrorState, Field, Input, Loading, OfflineNotice, Screen, Text } from '@/components/ui';
import { api, apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { useTheme } from '@/lib/theme';
import { useApi } from '@/lib/use-api';

type Filter = LibraryShelf | 'all';

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ height: 6, borderRadius: 3, backgroundColor: c.bgSubtle, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', backgroundColor: c.secondary }} />
    </View>
  );
}

function Summary({ stats }: { stats: ReadingStats }) {
  const t = useTranslations('library');
  const { c } = useTheme();
  const tiles = [
    { label: t('today'), value: t('minutesOf', { value: stats.today.minutes, goal: stats.today.goal }) },
    { label: t('streak'), value: t('days', { count: stats.streak.current }) },
    { label: t('booksThisYear'), value: t('booksOf', { value: stats.year.books, goal: stats.year.goal }) },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: spacing[2] }}>
      {tiles.map((tile, i) => (
        <View key={tile.label} style={{ flex: 1, padding: spacing[3], borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 2 }}>
          {i === 1 ? <Flame size={16} color={c.accent} /> : null}
          <Text size="xs" tone="muted">
            {tile.label}
          </Text>
          <Text size="sm" weight="bold">
            {tile.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The reading timer: counts while open and logs the session (with the page reached) when stopped. */
function useTimer() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [pauseStart, setPauseStart] = useState<number | null>(null);
  const [, tick] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (startedAt && !pauseStart) interval.current = setInterval(() => tick((n) => n + 1), 1000);
    return () => void (interval.current && clearInterval(interval.current));
  }, [startedAt, pauseStart]);
  const elapsed = startedAt ? (pauseStart ?? Date.now()) - startedAt - pausedMs : 0;
  return {
    running: !!startedAt,
    paused: !!pauseStart,
    elapsed,
    start: () => (setStartedAt(Date.now()), setPausedMs(0), setPauseStart(null)),
    toggle: () => (pauseStart ? (setPausedMs((p) => p + Date.now() - pauseStart), setPauseStart(null)) : setPauseStart(Date.now())),
    stop: () => {
      const result = { minutes: Math.max(1, Math.round(elapsed / 60000)), startedAt: startedAt ? new Date(startedAt).toISOString() : undefined };
      setStartedAt(null);
      setPauseStart(null);
      return result;
    },
  };
}

function Item({ item, onChanged }: { item: LibraryItem; onChanged: () => void }) {
  const t = useTranslations();
  const { c } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(String(item.progress.currentPage || ''));
  const [total, setTotal] = useState(item.progress.totalPages ? String(item.progress.totalPages) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const timer = useTimer();
  const { book, progress } = item;
  const mmss = `${Math.floor(timer.elapsed / 60000)}:${String(Math.floor(timer.elapsed / 1000) % 60).padStart(2, '0')}`;

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setErrors({});
    try {
      const message = await fn();
      if (message) toast(message);
      onChanged();
    } catch (error) {
      setErrors(fieldErrors(error));
      toast(errorMessage(error, t), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const saveProgress = (finished?: boolean) =>
    run(async () => {
      const totalPages = total ? Number(total) : undefined;
      await api(`/me/reading/${book.id}/progress`, { method: 'PUT', body: { currentPage: finished && totalPages ? totalPages : Number(page || 0), totalPages, finished: finished || undefined } });
      setOpen(false);
      return finished ? t('library.finishedToast') : t('common.saved');
    });
  const move = (shelf: LibraryShelf) => run(async () => (await apiRequest(`/me/library/${book.id}`, { method: 'PUT', body: { shelf } })).message);
  const stopTimer = () =>
    run(async () => {
      const { minutes, startedAt } = timer.stop();
      return (await apiRequest('/me/reading/sessions', { method: 'POST', body: { bookId: book.id, minutes, startedAt, source: 'timer', currentPage: page ? Number(page) : undefined } })).message;
    });

  return (
    <Card style={{ gap: spacing[3] }}>
      <Pressable accessibilityRole="link" accessibilityLabel={book.title} onPress={() => router.push(`/books/${book.slug}` as Href)} style={{ flexDirection: 'row', gap: spacing[3] }}>
        <Cover uri={book.coverUrl} title={book.title} width={56} rounded={radius.sm} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text weight="semibold" numberOfLines={2}>
            {book.title}
          </Text>
          <Text size="sm" tone="muted" numberOfLines={1}>
            {book.authors.join(', ')}
          </Text>
          <Text size="xs" tone="subtle">
            {progress.totalPages ? t('library.pageOf', { page: progress.currentPage, total: progress.totalPages, percent: progress.percent }) : t(`library.shelves.${item.shelf}`)}
          </Text>
          {progress.totalPages ? <ProgressBar percent={progress.percent} label={t('library.progressOf', { title: book.title })} /> : null}
        </View>
      </Pressable>
      {timer.running ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Timer size={18} color={c.text} />
          <Text weight="bold" accessibilityLabel={t('library.timerLabel')} style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
            {mmss}
          </Text>
          <Button small variant="outline" icon={timer.paused ? Play : Pause} title={timer.paused ? t('library.resume') : t('library.pause')} onPress={timer.toggle} />
          <Button small title={t('library.stopTimer')} loading={busy} onPress={stopTimer} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
          <Button small variant="outline" title={t('library.updateProgress')} onPress={() => setOpen((o) => !o)} />
          <Button small variant="ghost" icon={Timer} title={t('library.startTimer')} onPress={timer.start} />
        </View>
      )}
      {open ? (
        <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Field label={t('library.currentPage')} error={errors.currentPage}>
                {(a) => <Input {...a} value={page} onChangeText={setPage} keyboardType="number-pad" />}
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('library.totalPages')} error={errors.totalPages}>
                {(a) => <Input {...a} value={total} onChangeText={setTotal} keyboardType="number-pad" />}
              </Field>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
            <Button small title={t('common.save')} loading={busy} onPress={() => saveProgress()} />
            <Button small variant="secondary" title={t('library.markFinished')} disabled={busy} onPress={() => saveProgress(true)} />
          </View>
          <Chips label={t('library.moveTo', { title: book.title })} value={item.shelf} onChange={move} options={LIBRARY_SHELVES.map((s) => ({ value: s, label: t(`library.shelves.${s}`) }))} />
        </View>
      ) : null}
    </Card>
  );
}

export default function LibraryScreen() {
  const t = useTranslations('library');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { status } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const signedIn = status === 'authenticated';
  const library = useApi<LibraryPage>(signedIn ? '/me/library' : null, { persist: true, query: { shelf: filter === 'all' ? undefined : filter, pageSize: 60 } });
  const stats = useApi<ReadingStats>(signedIn ? '/me/reading/stats' : null, { persist: true, query: { days: 7 } });
  const reload = () => (library.reload(), stats.reload());

  if (status === 'loading') return <Loading />;
  if (!signedIn)
    return (
      <Screen>
        <SignInPrompt title={t('title')} text={t('intro')} />
      </Screen>
    );

  const counts = library.data?.shelves ?? {};
  return (
    <List
      data={library.data?.items ?? []}
      keyExtractor={(i) => i.book.id}
      renderItem={({ item }) => <Item item={item} onChanged={reload} />}
      refreshing={library.refreshing}
      onRefresh={reload}
      header={
        <>
          {library.offline ? <OfflineNotice /> : null}
          {stats.data ? <Summary stats={stats.data} /> : null}
          <Chips
            label={t('shelf')}
            value={filter}
            onChange={setFilter}
            options={[{ value: 'all' as Filter, label: tc('all') }, ...LIBRARY_SHELVES.map((s) => ({ value: s as Filter, label: counts[s] ? `${t(`shelves.${s}`)} (${localizeDigits(counts[s]!, locale)})` : t(`shelves.${s}`) }))]}
          />
        </>
      }
      empty={
        library.loading ? (
          <Loading />
        ) : library.error ? (
          <ErrorState offline={library.error.code === 'NETWORK'} onRetry={library.reload} />
        ) : (
          <EmptyState title={filter === 'all' ? t('empty') : t('emptyShelf')} text={filter === 'all' ? t('emptyText') : undefined} action={<Button small title={t('browse')} onPress={() => router.push('/books')} />} />
        )
      }
    />
  );
}
