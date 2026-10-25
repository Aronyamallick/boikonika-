'use client';

import { LIBRARY_SHELVES, type LibraryShelf } from '@boikonika/shared';
import { BookOpen, Flame, Lock, PenSquare, Settings2, Sparkles, Trash2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ColumnChart } from '@/components/dashboard/column-chart';
import { RangePresets } from '@/components/dashboard/stat-tile';
import { DownloadButton } from '@/components/digital/download-button';
import { BadgeIcon } from '@/components/reading/badge-icon';
import { LogReadingDialog, type SessionDraft } from '@/components/reading/log-reading-dialog';
import { GoalMeter } from '@/components/reading/meter';
import { ProgressDialog } from '@/components/reading/progress-dialog';
import { ReadingTimer } from '@/components/reading/reading-timer';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';
import { localized, type BadgeProgress, type LibraryItem, type LibraryPage, type ReadingGoals, type ReadingStats } from '@/lib/reading';
import { DownloadsPanel, HistoryPanel, WishlistPanel } from './library-extras';

const TABS = ['shelves', 'wishlist', 'downloads', 'history', 'stats', 'achievements'] as const;
type ShelfFilter = LibraryShelf | '' | 'ebooks';
const RANGES = [7, 30, 90] as const;
const utcDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};

export function LibraryView({ initialTab, initialFilter }: { initialTab?: string; initialFilter?: ShelfFilter }) {
  const t = useTranslations();
  const format = useFormatter();
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [reading, setReading] = useState<LibraryItem[]>([]);
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [logging, setLogging] = useState(false);
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);

  const loadStats = useCallback(() => {
    api<ReadingStats>('/me/reading/stats', { query: { days } }).then(setStats, () => setFailed(true));
    api<LibraryPage>('/me/library', { query: { shelf: 'currently_reading', pageSize: 60 } }).then((p) => setReading(p.items), () => undefined);
  }, [days]);
  useEffect(loadStats, [loadStats, version]);
  const refresh = () => setVersion((v) => v + 1);
  const openLog = (d: SessionDraft | null) => (setDraft(d), setLogging(true));

  if (failed && !stats) return <ErrorState title={t('common.errorTitle')} text={t('common.errorText')} retryLabel={t('common.retry')} onRetry={() => (setFailed(false), refresh())} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('library.title')}</h1>
          <p className="mt-1 text-fg-muted">{t('library.intro')}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ReadingTimer breakMinutes={stats?.goals.breakReminderMinutes ?? null} onStop={(d) => openLog(d)} />
          <Button onClick={() => openLog(null)}>
            <PenSquare className="h-4 w-4" aria-hidden="true" />
            {t('library.logReading')}
          </Button>
        </div>
      </header>

      {stats ? (
        <section aria-label={t('library.summary')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <GoalMeter label={t('library.today')} value={stats.today.minutes} max={stats.today.goal} valueText={t('library.minutesOf', { value: stats.today.minutes, goal: stats.today.goal })} doneText={t('library.goalReached')} />
          <GoalMeter label={t('library.thisWeek')} value={stats.week.minutes} max={stats.week.goal} valueText={t('library.minutesOf', { value: stats.week.minutes, goal: stats.week.goal })} doneText={t('library.goalReached')} />
          <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <p className="text-sm text-fg-muted">{t('library.streak')}</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-bold text-fg">
              <Flame className={cn('h-5 w-5', stats.streak.current ? 'text-accent-hover' : 'text-fg-subtle')} aria-hidden="true" />
              {t('library.days', { count: stats.streak.current })}
            </p>
            <p className="mt-1 text-xs text-fg-muted">{t('library.longest', { count: stats.streak.longest })}</p>
          </div>
          <GoalMeter label={t('library.booksThisYear')} value={stats.year.books} max={stats.year.goal} valueText={t('library.booksOf', { value: stats.year.books, goal: stats.year.goal })} doneText={t('library.goalReached')} />
        </section>
      ) : (
        <Skeleton className="h-28 w-full" />
      )}

      {stats ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-sm">
          <Sparkles className="h-5 w-5 text-secondary" aria-hidden="true" />
          <span className="font-bold text-fg">{t('library.level', { level: stats.level.level })}</span>
          <span className="text-fg-muted">{t('library.xp', { xp: stats.level.xp })}</span>
          <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-secondary-soft" role="meter" aria-label={t('library.nextLevel')} aria-valuemin={stats.level.levelStartXp} aria-valuemax={stats.level.nextLevelXp} aria-valuenow={stats.level.xp}>
            <div className="h-full rounded-full bg-secondary" style={{ width: `${((stats.level.xp - stats.level.levelStartXp) / Math.max(1, stats.level.nextLevelXp - stats.level.levelStartXp)) * 100}%` }} />
          </div>
          <span className="text-xs text-fg-muted">{t('library.toNext', { xp: stats.level.nextLevelXp - stats.level.xp })}</span>
        </div>
      ) : null}

      <Tabs
        defaultIndex={Math.max(0, TABS.indexOf((initialTab ?? 'shelves') as (typeof TABS)[number]))}
        tabs={[
          { label: t('library.tabShelves'), content: <Shelves version={version} initialFilter={initialFilter} onChanged={refresh} onLog={(bookId) => openLog({ minutes: 20, source: 'manual', bookId })} /> },
          { label: t('library.tabWishlist'), content: <WishlistPanel /> },
          { label: t('library.tabDownloads'), content: <DownloadsPanel version={version} /> },
          { label: t('library.tabHistory'), content: <HistoryPanel version={version} /> },
          {
            label: t('library.tabStats'),
            content: stats ? (
              <StatsPanel
                stats={stats}
                days={days}
                setDays={setDays}
                onChanged={refresh}
                dayLabel={(d) => format.dateTime(utcDay(d), { day: 'numeric', month: 'short', timeZone: 'UTC' })}
              />
            ) : (
              <Skeleton className="h-72 w-full" />
            ),
          },
          { label: t('library.tabAchievements'), content: <Achievements version={version} /> },
        ]}
      />

      <LogReadingDialog open={logging} draft={draft} books={reading} onClose={() => setLogging(false)} onLogged={refresh} />
    </div>
  );
}

function Shelves({ version, initialFilter = '', onChanged, onLog }: { version: number; initialFilter?: ShelfFilter; onChanged: () => void; onLog: (bookId: string) => void }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [shelf, setShelf] = useState<ShelfFilter>(initialFilter);
  const [data, setData] = useState<LibraryPage | null>(null);
  const [editing, setEditing] = useState<LibraryItem | null>(null);

  useEffect(() => {
    const query = shelf === 'ebooks' ? { digital: 1, pageSize: 60 } : { shelf: shelf || undefined, pageSize: 60 };
    api<LibraryPage>('/me/library', { query }).then(setData, () => setData({ items: [], shelves: {}, digitalCount: 0, page: 1, pageSize: 60, total: 0 }));
  }, [shelf, version]);

  const move = async (item: LibraryItem, next: LibraryShelf) => {
    try {
      await api(`/me/library/${item.book.id}`, { method: 'PUT', body: { shelf: next } });
      toast.show(t('library.shelvedOn', { shelf: t(`library.shelves.${next}`) }), 'success');
      onChanged();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };
  const remove = async (item: LibraryItem) => {
    try {
      const res = await apiRequest(`/me/library/${item.book.id}`, { method: 'DELETE' });
      toast.show(res.message, 'success');
      onChanged();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };

  const total = Object.values(data?.shelves ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('library.shelf')}>
        {(['', 'currently_reading', 'want_to_read', 'completed', 'purchased', 'owned', 'ebooks'] as const).map((s) => (
          <button
            key={s || 'all'}
            type="button"
            aria-pressed={shelf === s}
            onClick={() => setShelf(s)}
            className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold', shelf === s ? 'bg-primary text-primary-fg' : 'bg-subtle text-fg-muted hover:text-fg')}
          >
            {s === 'ebooks' ? t('library.ebooks') : s ? t(`library.shelves.${s}`) : t('common.all')}
            <span className={cn('rounded-full px-1.5 text-xs', shelf === s ? 'bg-primary-fg/20' : 'bg-surface')}>{format.number(s === 'ebooks' ? (data?.digitalCount ?? 0) : s ? (data?.shelves[s] ?? 0) : total)}</span>
          </button>
        ))}
      </div>
      {!data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title={shelf === 'ebooks' ? t('library.noEbooks') : shelf ? t('library.emptyShelf') : t('library.empty')}
          text={shelf === 'ebooks' ? t('library.noEbooksText') : t('library.emptyText')}
          action={
            <Link href="/books" className="font-semibold text-primary hover:underline">
              {t('library.browse')}
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((item) => (
            <li key={item.book.id} className="flex gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
              <Link href={`/books/${item.book.slug}`} className="w-16 shrink-0" tabIndex={-1} aria-hidden="true">
                <BookCover src={item.book.coverUrl} title={item.book.title} className="w-16 p-1 text-[7px]" sizes="4rem" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/books/${item.book.slug}`} className="line-clamp-2 font-bold text-fg hover:text-primary">
                  {item.book.title}
                </Link>
                {item.book.authors.length ? <p className="line-clamp-1 text-sm text-fg-muted">{item.book.authors.join(', ')}</p> : null}
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone={item.shelf === 'completed' ? 'success' : item.shelf === 'currently_reading' ? 'primary' : 'neutral'}>{t(`library.shelves.${item.shelf}`)}</Badge>
                  {item.source === 'purchase' && item.shelf !== 'purchased' ? <Badge tone="neutral">{t('library.bought')}</Badge> : null}
                  {item.hasDigitalAccess ? <Badge tone="secondary">{t('digital.ebook')}</Badge> : null}
                </p>
                {item.shelf === 'currently_reading' || (item.progress.percent > 0 && item.shelf !== 'completed') ? (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-primary-soft" role="progressbar" aria-label={t('library.progressOf', { title: item.book.title })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress.percent}>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${item.progress.percent}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-fg-muted">
                      {item.progress.totalPages
                        ? t('library.pageOf', { page: item.progress.currentPage, total: item.progress.totalPages, percent: item.progress.percent })
                        : t('library.percentRead', { percent: item.progress.percent })}
                    </p>
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {item.hasDigitalAccess ? <DownloadButton bookId={item.book.id} title={item.book.title} size="sm" variant="secondary" onDone={onChanged} /> : null}
                  {item.shelf !== 'completed' ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                        {t('library.updateProgress')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onLog(item.book.id)}>
                        {t('library.logReading')}
                      </Button>
                    </>
                  ) : null}
                  <label className="sr-only" htmlFor={`move-${item.book.id}`}>
                    {t('library.moveTo', { title: item.book.title })}
                  </label>
                  <Select id={`move-${item.book.id}`} value="" onChange={(e) => e.target.value && move(item, e.target.value as LibraryShelf)} className="h-9 w-auto py-0 text-sm">
                    <option value="">{t('library.move')}</option>
                    {LIBRARY_SHELVES.filter((s) => s !== 'purchased' && s !== item.shelf).map((s) => (
                      <option key={s} value={s}>
                        {t(`library.shelves.${s}`)}
                      </option>
                    ))}
                  </Select>
                  {item.source !== 'purchase' ? (
                    <Button size="icon" variant="ghost" className="text-danger" aria-label={t('library.removeBook', { title: item.book.title })} onClick={() => remove(item)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ProgressDialog item={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  );
}

function StatsPanel({ stats, days, setDays, onChanged, dayLabel }: { stats: ReadingStats; days: (typeof RANGES)[number]; setDays: (d: (typeof RANGES)[number]) => void; onChanged: () => void; dayLabel: (d: string) => string }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const [goalsOpen, setGoalsOpen] = useState(false);
  const removeSession = async (id: string) => {
    try {
      const res = await apiRequest(`/me/reading/sessions/${id}`, { method: 'DELETE' });
      toast.show(res.message, 'success');
      onChanged();
    } catch {
      toast.show(t('errors.generic'), 'danger');
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangePresets value={days} options={RANGES} onChange={setDays} label={t('dashboard.period')} />
        <p className="text-sm text-fg-muted">{t('library.periodTotals', { minutes: stats.period.minutes, pages: stats.period.pages })}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ColumnChart
          title={t('library.minutesPerDay')}
          subtitle={t('dashboard.lastDays', { count: stats.days })}
          integer
          categoryLabel={t('dashboard.day')}
          emptyText={t('library.noReading')}
          data={stats.series.map((s) => ({ key: s.day, label: dayLabel(s.day), value: s.minutes, display: t('library.minutesValue', { count: s.minutes }) }))}
        />
        <ColumnChart
          title={t('library.pagesPerDay')}
          subtitle={t('dashboard.lastDays', { count: stats.days })}
          integer
          categoryLabel={t('dashboard.day')}
          emptyText={t('library.noReading')}
          data={stats.series.map((s) => ({ key: s.day, label: dayLabel(s.day), value: s.pages, display: t('library.pagesValue', { count: s.pages }) }))}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="recent-sessions" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 id="recent-sessions" className="mb-3 font-bold text-fg">
            {t('library.recentSessions')}
          </h2>
          {stats.recentSessions.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('library.noSessions')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {stats.recentSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold text-fg">{t('library.sessionLine', { minutes: s.minutes, pages: s.pages })}</span>
                    <span className="block truncate text-xs text-fg-muted">
                      {dayLabel(s.day)} · {s.book ? s.book.title : t('library.noBook')} · {t(`library.source.${s.source}`)}
                    </span>
                  </span>
                  <Button size="icon" variant="ghost" aria-label={t('library.deleteSession')} onClick={() => removeSession(s.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="goals" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="goals" className="font-bold text-fg">
              {t('library.goals')}
            </h2>
            <Button size="sm" variant="outline" onClick={() => setGoalsOpen(true)}>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              {t('common.edit')}
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-fg-muted">{t('library.dailyGoal')}</dt>
              <dd className="font-semibold text-fg">{t('library.minutesValue', { count: stats.goals.dailyMinutes })}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('library.weeklyGoal')}</dt>
              <dd className="font-semibold text-fg">{t('library.minutesValue', { count: stats.goals.weeklyMinutes })}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('library.yearlyGoal')}</dt>
              <dd className="font-semibold text-fg">{t('library.booksValue', { count: stats.goals.yearlyBooks })}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('library.breakReminders')}</dt>
              <dd className="font-semibold text-fg">{stats.goals.breakReminderMinutes ? t('library.everyMinutes', { count: stats.goals.breakReminderMinutes }) : t('library.off')}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-fg-muted">{t('library.totalsLine', { books: stats.totals.booksCompleted, pages: format.number(stats.totals.pagesRead), hours: format.number(Math.round(stats.totals.minutesRead / 6) / 10) })}</p>
        </section>
      </div>
      <GoalsDialog open={goalsOpen} goals={stats.goals} onClose={() => setGoalsOpen(false)} onSaved={onChanged} />
    </div>
  );
}

function GoalsDialog({ open, goals, onClose, onSaved }: { open: boolean; goals: ReadingGoals; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({ dailyMinutes: '', weeklyMinutes: '', yearlyBooks: '', breakReminderMinutes: '', monthlySummaryEmail: true });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ dailyMinutes: String(goals.dailyMinutes), weeklyMinutes: String(goals.weeklyMinutes), yearlyBooks: String(goals.yearlyBooks), breakReminderMinutes: goals.breakReminderMinutes ? String(goals.breakReminderMinutes) : '', monthlySummaryEmail: goals.monthlySummaryEmail });
  }, [open, goals]);
  const num = (v: string) => Number(v.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))));
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await apiRequest('/me/reading/goals', {
        method: 'PUT',
        body: { dailyMinutes: num(form.dailyMinutes), weeklyMinutes: num(form.weeklyMinutes), yearlyBooks: num(form.yearlyBooks), breakReminderMinutes: form.breakReminderMinutes ? num(form.breakReminderMinutes) : null, monthlySummaryEmail: form.monthlySummaryEmail },
      });
      toast.show(res.message, 'success');
      onSaved();
      onClose();
    } catch (err) {
      setErrors(fromApi(err).fields);
    } finally {
      setBusy(false);
    }
  };
  const set = (k: 'dailyMinutes' | 'weeklyMinutes' | 'yearlyBooks') => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('library.goals')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={busy} onClick={() => save()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={save} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('library.dailyGoal')} error={errors.dailyMinutes} hint={t('library.minutesUnit')}>
            {(p) => <Input {...p} value={form.dailyMinutes} onChange={set('dailyMinutes')} inputMode="numeric" maxLength={3} />}
          </Field>
          <Field label={t('library.weeklyGoal')} error={errors.weeklyMinutes} hint={t('library.minutesUnit')}>
            {(p) => <Input {...p} value={form.weeklyMinutes} onChange={set('weeklyMinutes')} inputMode="numeric" maxLength={4} />}
          </Field>
        </div>
        <Field label={t('library.yearlyGoal')} error={errors.yearlyBooks} hint={t('library.booksUnit')}>
          {(p) => <Input {...p} value={form.yearlyBooks} onChange={set('yearlyBooks')} inputMode="numeric" maxLength={3} />}
        </Field>
        <Field label={t('library.breakReminders')} error={errors.breakReminderMinutes} hint={t('library.breakHint')}>
          {(p) => (
            <Select {...p} value={form.breakReminderMinutes} onChange={(e) => setForm((f) => ({ ...f, breakReminderMinutes: e.target.value }))}>
              <option value="">{t('library.off')}</option>
              {[20, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {t('library.everyMinutes', { count: m })}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Checkbox label={t('library.monthlySummary')} checked={form.monthlySummaryEmail} onChange={(e) => setForm((f) => ({ ...f, monthlySummaryEmail: e.target.checked }))} />
      </form>
    </Dialog>
  );
}

function Achievements({ version }: { version: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const [data, setData] = useState<{ badges: BadgeProgress[] } | null>(null);
  useEffect(() => {
    api<{ badges: BadgeProgress[] }>('/me/achievements').then(setData, () => setData({ badges: [] }));
  }, [version]);
  if (!data) return <Skeleton className="h-64 w-full" />;
  const earned = data.badges.filter((b) => b.earnedAt).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">{t('library.badgesEarned', { earned, total: data.badges.length })}</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.badges.map((b) => (
          <li key={b.key} className={cn('flex gap-3 rounded-xl border p-4 shadow-sm', b.earnedAt ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface')}>
            <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', b.earnedAt ? 'bg-accent text-accent-fg' : 'bg-subtle text-fg-subtle')}>
              {b.earnedAt ? <BadgeIcon name={b.icon} className="h-6 w-6" /> : <Lock className="h-5 w-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-fg">{localized(b.name, locale)}</p>
              <p className="text-sm text-fg-muted">{localized(b.description, locale)}</p>
              {b.earnedAt ? (
                <p className="mt-1 text-xs font-semibold text-accent-soft-fg">{t('library.earnedOn', { date: format.dateTime(new Date(b.earnedAt), { dateStyle: 'medium' }) })}</p>
              ) : (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-primary-soft" role="progressbar" aria-label={localized(b.name, locale)} aria-valuemin={0} aria-valuemax={b.target} aria-valuenow={b.current}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(b.current / Math.max(1, b.target)) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">{t('library.badgeProgress', { current: b.current, target: b.target, xp: b.xpReward })}</p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
