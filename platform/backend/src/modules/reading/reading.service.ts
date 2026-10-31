import { Inject, Injectable } from '@nestjs/common';
import { type Database, type DbOrTx, readingGoals, readingHistory, readingProgress, readingSessions, userLibrary } from '@boikonika/database';
import type { LibraryShelf, libraryQuerySchema, progressSchema, readingGoalsSchema, readingSessionSchema } from '@boikonika/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { GamificationService } from '../gamification/gamification.service';
import { ChallengesService, DAY_MINUTES } from './challenges.service';

type Row = Record<string, unknown>;
const DEFAULT_GOALS = { dailyMinutes: 20, weeklyMinutes: 120, yearlyBooks: 12, breakReminderMinutes: null as number | null, monthlySummaryEmail: true };
/** Asia/Dhaka calendar day for a moment (reading days and streaks follow local time). */
const dhakaDay = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(at);

/**
 * My Library and the reading tracker: shelves, where I am in each book, timed or logged sessions,
 * goals, streaks and statistics. Activity feeds XP, badges and challenges.
 */
@Injectable()
export class ReadingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly gamification: GamificationService,
    private readonly challenges: ChallengesService,
  ) {}

  private async requireBook(tx: DbOrTx, bookId: string) {
    const [book] = await tx
      .execute<{ id: string; pages: number | null }>(sql`
        select b.id, (select max(f.pages) from book_formats f where f.book_id = b.id)::int as pages
        from books b where b.id = ${bookId} and b.status = 'published' and b.deleted_at is null`)
      .then((r) => r.rows);
    if (!book) throw AppException.notFound('Book');
    return { id: book.id, pages: book.pages === null ? null : Number(book.pages) };
  }

  // ------------------------------------------------------------------ library

  async library(userId: string, q: z.output<typeof libraryQuerySchema>) {
    const where = sql`l.user_id = ${userId} ${q.shelf ? sql`and l.shelf = ${q.shelf}` : sql``} ${q.digital ? sql`and l.has_digital_access` : sql``}`;
    const [rows, counts] = await Promise.all([
      this.db.execute<Row>(sql`
        select l.shelf, l.source, l.has_digital_access, l.added_at, l.updated_at, b.id, b.slug, b.title, b.cover_key, b.rating_avg::float as rating,
          coalesce((select array_agg(a.name order by ba.position) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id), '{}') as authors,
          rp.current_page, rp.total_pages, rp.percent, rp.finished_at,
          coalesce(rp.total_pages, (select max(f.pages) from book_formats f where f.book_id = b.id)) as pages
        from user_library l join books b on b.id = l.book_id
        left join reading_progress rp on rp.user_id = l.user_id and rp.book_id = l.book_id
        where ${where} and b.deleted_at is null
        order by l.updated_at desc limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ shelf: LibraryShelf; n: number; digital: number }>(sql`select shelf, count(*)::int as n, count(*) filter (where has_digital_access)::int as digital from user_library where user_id = ${userId} group by shelf`),
    ]);
    const shelves = Object.fromEntries(counts.rows.map((c) => [c.shelf, c.n]));
    const digitalCount = counts.rows.reduce((n, c) => n + c.digital, 0);
    return {
      items: rows.rows.map((r) => ({
        book: { id: r.id as string, slug: r.slug as string, title: r.title as string, coverUrl: this.storage.publicUrl(r.cover_key as string | null), authors: (r.authors as string[]) ?? [], rating: Number(r.rating ?? 0) },
        shelf: r.shelf as LibraryShelf,
        source: r.source as string,
        hasDigitalAccess: r.has_digital_access === true,
        progress: { currentPage: Number(r.current_page ?? 0), totalPages: r.pages === null ? null : Number(r.pages), percent: Number(r.percent ?? 0), finishedAt: r.finished_at ? new Date(r.finished_at as string).toISOString() : null },
        addedAt: new Date(r.added_at as string).toISOString(),
        updatedAt: new Date(r.updated_at as string).toISOString(),
      })),
      shelves,
      digitalCount,
      page: q.page,
      pageSize: q.pageSize,
      total: q.digital
        ? q.shelf
          ? (counts.rows.find((c) => c.shelf === q.shelf)?.digital ?? 0)
          : digitalCount
        : q.shelf
          ? (shelves[q.shelf] ?? 0)
          : Object.values(shelves).reduce((a, b) => a + b, 0),
    };
  }

  /** Where this book sits in my library (for the book page's shelf button). */
  async shelfOf(userId: string, bookId: string) {
    const [row] = await this.db
      .select({ shelf: userLibrary.shelf, percent: readingProgress.percent, currentPage: readingProgress.currentPage, hasDigitalAccess: userLibrary.hasDigitalAccess })
      .from(userLibrary)
      .leftJoin(readingProgress, and(eq(readingProgress.userId, userLibrary.userId), eq(readingProgress.bookId, userLibrary.bookId)))
      .where(and(eq(userLibrary.userId, userId), eq(userLibrary.bookId, bookId)));
    return row ? { shelf: row.shelf, percent: row.percent ?? 0, currentPage: row.currentPage ?? 0, hasDigitalAccess: row.hasDigitalAccess } : null;
  }

  async setShelf(userId: string, bookId: string, shelf: LibraryShelf) {
    if (shelf === 'purchased') throw AppException.badRequest('api.reading.purchasedShelf', 'shelf');
    const finished = await this.db.transaction(async (tx) => {
      await this.requireBook(tx, bookId);
      await tx
        .insert(userLibrary)
        .values({ userId, bookId, shelf, source: 'manual' })
        .onConflictDoUpdate({ target: [userLibrary.userId, userLibrary.bookId], set: { shelf, updatedAt: new Date() } });
      if (shelf === 'currently_reading') {
        await tx.insert(readingProgress).values({ userId, bookId }).onConflictDoNothing();
        await tx.insert(readingHistory).values({ userId, bookId, event: 'started' });
      }
      return shelf === 'completed' ? this.finish(tx, userId, bookId) : false;
    });
    if (finished) await this.afterActivity(userId);
    return this.shelfOf(userId, bookId);
  }

  /** Removes a book I added myself; bought books stay (they can move to another shelf). */
  async remove(userId: string, bookId: string): Promise<void> {
    const [row] = await this.db.select({ source: userLibrary.source }).from(userLibrary).where(and(eq(userLibrary.userId, userId), eq(userLibrary.bookId, bookId)));
    if (!row) throw AppException.notFound('Book');
    if (row.source === 'purchase') throw AppException.badRequest('api.reading.keepPurchased');
    await this.db.delete(userLibrary).where(and(eq(userLibrary.userId, userId), eq(userLibrary.bookId, bookId)));
  }

  /** What happened in my reading, newest first: books started and finished, e-books downloaded. */
  async history(userId: string, page: number, pageSize: number) {
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select h.id, h.event, h.created_at, b.id as book_id, b.slug, b.title, b.cover_key
        from reading_history h join books b on b.id = h.book_id
        where h.user_id = ${userId} and b.deleted_at is null order by h.created_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from reading_history where user_id = ${userId}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id as string,
        event: r.event as string,
        at: new Date(r.created_at as string).toISOString(),
        book: { id: r.book_id as string, slug: r.slug as string, title: r.title as string, coverUrl: this.storage.publicUrl(r.cover_key as string | null) },
      })),
      meta: { page, pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  // ------------------------------------------------------------------ progress & sessions

  /** Marks a book finished once: counter, XP, history and the Completed shelf. Returns true the first time. */
  private async finish(tx: DbOrTx, userId: string, bookId: string): Promise<boolean> {
    const [before] = await tx.select({ finishedAt: readingProgress.finishedAt }).from(readingProgress).where(and(eq(readingProgress.userId, userId), eq(readingProgress.bookId, bookId)));
    if (before?.finishedAt) return false;
    const now = new Date();
    await tx
      .insert(readingProgress)
      .values({ userId, bookId, percent: 100, finishedAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: [readingProgress.userId, readingProgress.bookId], set: { percent: 100, finishedAt: now, updatedAt: now, currentPage: sql`greatest(${readingProgress.currentPage}, coalesce(${readingProgress.totalPages}, 0))` } });
    await tx
      .insert(userLibrary)
      .values({ userId, bookId, shelf: 'completed', source: 'manual' })
      .onConflictDoUpdate({ target: [userLibrary.userId, userLibrary.bookId], set: { shelf: 'completed', updatedAt: now } });
    await tx.insert(readingHistory).values({ userId, bookId, event: 'finished' });
    await this.gamification.bump(tx, userId, { booksCompleted: 1 });
    await this.gamification.award(tx, userId, 'book_completed', bookId);
    return true;
  }

  async setProgress(userId: string, bookId: string, input: z.output<typeof progressSchema>) {
    const finished = await this.db.transaction(async (tx) => {
      const book = await this.requireBook(tx, bookId);
      const total = input.totalPages ?? book.pages ?? null;
      if (total && input.currentPage > total) throw AppException.validation([{ field: 'currentPage', code: 'too_big', message: 'validation.pageBeyondEnd' }]);
      const percent = input.finished ? 100 : total ? Math.min(100, Math.round((input.currentPage / total) * 100)) : 0;
      await tx
        .insert(readingProgress)
        .values({ userId, bookId, currentPage: input.currentPage, totalPages: input.totalPages ?? null, percent, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [readingProgress.userId, readingProgress.bookId],
          set: { currentPage: input.currentPage, ...(input.totalPages ? { totalPages: input.totalPages } : {}), percent: sql`case when ${readingProgress.finishedAt} is null then ${percent} else 100 end`, updatedAt: new Date() },
        });
      await tx
        .insert(userLibrary)
        .values({ userId, bookId, shelf: 'currently_reading', source: 'manual' })
        .onConflictDoUpdate({ target: [userLibrary.userId, userLibrary.bookId], set: { shelf: sql`case when ${userLibrary.shelf} in ('want_to_read', 'owned', 'purchased') then 'currently_reading'::library_shelf else ${userLibrary.shelf} end`, updatedAt: new Date() } });
      return input.finished || percent >= 100 ? this.finish(tx, userId, bookId) : false;
    });
    if (finished) await this.afterActivity(userId);
    return this.shelfOf(userId, bookId);
  }

  /**
   * Logs reading time. With a book and the page reached, the pages read come from the previous
   * position. Updates totals, the daily streak, XP for the day, challenges and badges.
   */
  async logSession(userId: string, input: z.output<typeof readingSessionSchema>) {
    const endedAt = input.startedAt ? new Date(Date.parse(input.startedAt) + input.minutes * 60_000) : new Date();
    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date(endedAt.getTime() - input.minutes * 60_000);
    const localDate = dhakaDay(startedAt);
    let finishedBook = false;
    const session = await this.db.transaction(async (tx) => {
      // A day holds at most 16 hours of reading: anything beyond that is a mistake or an attempt to farm.
      const [{ today } = { today: 0 }] = await tx
        .execute<{ today: number }>(sql`select coalesce(sum(minutes), 0)::int as today from reading_sessions where user_id = ${userId} and local_date = ${localDate}`)
        .then((r) => r.rows);
      if (Number(today) + input.minutes > 960) throw AppException.badRequest('api.reading.tooMuchTime', 'minutes');
      let pages = input.pages ?? 0;
      if (input.bookId) {
        const book = await this.requireBook(tx, input.bookId);
        if (input.currentPage !== undefined) {
          const [prev] = await tx.select().from(readingProgress).where(and(eq(readingProgress.userId, userId), eq(readingProgress.bookId, input.bookId)));
          const total = prev?.totalPages ?? book.pages ?? null;
          if (total && input.currentPage > total) throw AppException.validation([{ field: 'currentPage', code: 'too_big', message: 'validation.pageBeyondEnd' }]);
          if (input.pages === undefined) pages = Math.min(2000, Math.max(0, input.currentPage - (prev?.currentPage ?? 0)));
          const percent = total ? Math.min(100, Math.round((input.currentPage / total) * 100)) : (prev?.percent ?? 0);
          await tx
            .insert(readingProgress)
            .values({ userId, bookId: input.bookId, currentPage: input.currentPage, percent, updatedAt: endedAt })
            .onConflictDoUpdate({ target: [readingProgress.userId, readingProgress.bookId], set: { currentPage: input.currentPage, percent: sql`case when ${readingProgress.finishedAt} is null then ${percent} else 100 end`, updatedAt: endedAt } });
          if (total && input.currentPage >= total) finishedBook = await this.finish(tx, userId, input.bookId);
        }
        await tx
          .insert(userLibrary)
          .values({ userId, bookId: input.bookId, shelf: 'currently_reading', source: 'manual' })
          .onConflictDoUpdate({ target: [userLibrary.userId, userLibrary.bookId], set: { shelf: sql`case when ${userLibrary.shelf} in ('want_to_read', 'owned', 'purchased') then 'currently_reading'::library_shelf else ${userLibrary.shelf} end`, updatedAt: new Date() } });
      }
      const [row] = await tx.insert(readingSessions).values({ userId, bookId: input.bookId ?? null, startedAt, endedAt, minutes: input.minutes, pages, source: input.source, localDate }).returning();
      await this.gamification.bump(tx, userId, { minutesRead: input.minutes, pagesRead: pages });
      await this.updateStreak(tx, userId);
      // A day counts once it has at least ten minutes of reading.
      const [{ day } = { day: 0 }] = await tx.execute<{ day: number }>(sql`select coalesce(sum(minutes), 0)::int as day from reading_sessions where user_id = ${userId} and local_date = ${localDate}`).then((r) => r.rows);
      if (Number(day) >= DAY_MINUTES) await this.gamification.award(tx, userId, 'reading_day', localDate);
      return row!;
    });
    const completedChallenges = await this.afterActivity(userId);
    return { id: session.id, minutes: session.minutes, pages: session.pages, localDate: session.localDate, finishedBook, completedChallenges };
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.delete(readingSessions).where(and(eq(readingSessions.id, id), eq(readingSessions.userId, userId))).returning();
      if (!row) throw AppException.notFound('Session');
      await this.gamification.bump(tx, userId, { minutesRead: -row.minutes, pagesRead: -row.pages });
      await this.updateStreak(tx, userId);
    });
  }

  /** Consecutive reading days (Asia/Dhaka), via gaps-and-islands over the distinct days read. */
  private async updateStreak(tx: DbOrTx, userId: string): Promise<void> {
    await tx.execute(sql`
      with d as (select distinct local_date as day from reading_sessions where user_id = ${userId}),
      g as (select day, day - (row_number() over (order by day))::int as grp from d),
      runs as (select max(day) as finish, count(*)::int as len from g group by grp),
      today as (select (now() at time zone 'Asia/Dhaka')::date as t)
      insert into user_stats (user_id, current_streak, longest_streak, last_read_on)
      select ${userId},
        coalesce((select len from runs, today where finish >= today.t - 1 order by finish desc limit 1), 0),
        coalesce((select max(len) from runs), 0),
        (select max(day) from d)
      on conflict (user_id) do update set current_streak = excluded.current_streak,
        longest_streak = greatest(user_stats.longest_streak, excluded.longest_streak), last_read_on = excluded.last_read_on, updated_at = now()`);
  }

  private async afterActivity(userId: string): Promise<string[]> {
    const completed = await this.challenges.refresh(userId).catch(() => [] as string[]);
    await this.gamification.evaluateBadges(userId).catch(() => undefined);
    return completed;
  }

  // ------------------------------------------------------------------ goals & stats

  async goals(userId: string) {
    const [row] = await this.db.select().from(readingGoals).where(eq(readingGoals.userId, userId));
    return row ? { dailyMinutes: row.dailyMinutes, weeklyMinutes: row.weeklyMinutes, yearlyBooks: row.yearlyBooks, breakReminderMinutes: row.breakReminderMinutes, monthlySummaryEmail: row.monthlySummaryEmail } : DEFAULT_GOALS;
  }

  async setGoals(userId: string, input: z.output<typeof readingGoalsSchema>) {
    await this.db
      .insert(readingGoals)
      .values({ userId, ...input })
      .onConflictDoUpdate({ target: readingGoals.userId, set: { ...input, updatedAt: new Date() } });
    return this.goals(userId);
  }

  async stats(userId: string, days: number) {
    const [series, totals, recent, goals, level] = await Promise.all([
      this.db.execute<Row>(sql`
        with days as (select generate_series((now() at time zone 'Asia/Dhaka')::date - ${days - 1}::int, (now() at time zone 'Asia/Dhaka')::date, interval '1 day')::date as day)
        select d.day::text as day, coalesce(sum(s.minutes), 0)::int as minutes, coalesce(sum(s.pages), 0)::int as pages
        from days d left join reading_sessions s on s.user_id = ${userId} and s.local_date = d.day
        group by d.day order by d.day`),
      this.db.execute<Row>(sql`
        select
          coalesce(sum(minutes) filter (where local_date = (now() at time zone 'Asia/Dhaka')::date), 0)::int as today,
          coalesce(sum(minutes) filter (where local_date > (now() at time zone 'Asia/Dhaka')::date - 7), 0)::int as week,
          coalesce(sum(minutes) filter (where local_date > (now() at time zone 'Asia/Dhaka')::date - ${days}::int), 0)::int as period_minutes,
          coalesce(sum(pages) filter (where local_date > (now() at time zone 'Asia/Dhaka')::date - ${days}::int), 0)::int as period_pages,
          (select count(*)::int from reading_progress where user_id = ${userId} and finished_at >= date_trunc('year', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka') as books_this_year
        from reading_sessions where user_id = ${userId}`),
      this.db.execute<Row>(sql`
        select s.id, s.minutes, s.pages, s.local_date::text as day, s.source, b.title, b.slug from reading_sessions s left join books b on b.id = s.book_id
        where s.user_id = ${userId} order by s.started_at desc limit 10`),
      this.goals(userId),
      this.gamification.summary(userId),
    ]);
    const t = totals.rows[0] ?? {};
    const yesterday = dhakaDay(new Date(Date.now() - 86_400_000));
    // The stored streak is from the last session; it lapses once a whole day passes without reading.
    const currentStreak = level.lastReadOn && level.lastReadOn >= yesterday ? level.currentStreak : 0;
    return {
      days,
      series: series.rows.map((r) => ({ day: r.day as string, minutes: Number(r.minutes), pages: Number(r.pages) })),
      today: { minutes: Number(t.today ?? 0), goal: goals.dailyMinutes },
      week: { minutes: Number(t.week ?? 0), goal: goals.weeklyMinutes },
      year: { books: Number(t.books_this_year ?? 0), goal: goals.yearlyBooks },
      period: { minutes: Number(t.period_minutes ?? 0), pages: Number(t.period_pages ?? 0) },
      streak: { current: currentStreak, longest: level.longestStreak, lastReadOn: level.lastReadOn },
      level: { level: level.level, xp: level.xp, levelStartXp: level.levelStartXp, nextLevelXp: level.nextLevelXp },
      totals: { booksCompleted: level.booksCompleted, pagesRead: level.pagesRead, minutesRead: level.minutesRead },
      recentSessions: recent.rows.map((r) => ({ id: r.id as string, minutes: Number(r.minutes), pages: Number(r.pages), day: r.day as string, source: r.source as string, book: r.slug ? { title: r.title as string, slug: r.slug as string } : null })),
      goals,
    };
  }
}
