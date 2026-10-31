import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, i18n, id, timestamps } from './_columns';
import { books, digitalAssets } from './catalog';
import { challengeStatusEnum, challengeTypeEnum, libraryShelfEnum, visibilityEnum } from './enums';
import { users } from './identity';
import { orderItems } from './orders';

export const badges = pgTable(
  'badges',
  {
    id: id(),
    key: varchar('key', { length: 50 }).notNull(),
    name: i18n('name').notNull(),
    description: i18n('description').notNull(),
    icon: varchar('icon', { length: 60 }).notNull(),
    /** Machine-readable rule evaluated by the gamification service, e.g. {"booksCompleted": 10}. */
    criteria: jsonb('criteria').$type<Record<string, number | string>>().notNull(),
    xpReward: integer('xp_reward').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('badges_key_unique').on(t.key)],
);

export const userBadges = pgTable(
  'user_badges',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    badgeId: uuid('badge_id')
      .notNull()
      .references(() => badges.id, { onDelete: 'cascade' }),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeId] })],
);

/** Reading challenges: 7-day/30-day streaks, page targets, monthly books, themed challenges. */
export const readingChallenges = pgTable(
  'reading_challenges',
  {
    id: id(),
    slug: varchar('slug', { length: 80 }).notNull(),
    title: i18n('title').notNull(),
    description: i18n('description').notNull(),
    type: challengeTypeEnum('type').notNull(),
    target: integer('target').notNull(),
    durationDays: smallint('duration_days'),
    /** Optional filter: only books with this genre/language count (e.g. Bangla literature). */
    genreKey: varchar('genre_key', { length: 40 }),
    language: varchar('language', { length: 5 }),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    badgeId: uuid('badge_id').references(() => badges.id, { onDelete: 'set null' }),
    xpReward: integer('xp_reward').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    participantCount: integer('participant_count').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('reading_challenges_slug_unique').on(t.slug), check('reading_challenges_target_positive', sql`${t.target} > 0`)],
);

export const challengeParticipants = pgTable(
  'challenge_participants',
  {
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => readingChallenges.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    progress: integer('progress').notNull().default(0),
    status: challengeStatusEnum('status').notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    deadlineAt: timestamp('deadline_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.userId] }), index('challenge_participants_user_idx').on(t.userId, t.status)],
);

/** Current position in a book (one row per user per book). */
export const readingProgress = pgTable(
  'reading_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    currentPage: integer('current_page').notNull().default(0),
    totalPages: integer('total_pages'),
    percent: smallint('percent').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), check('reading_progress_percent_range', sql`${t.percent} between 0 and 100`), check('reading_progress_page_non_negative', sql`${t.currentPage} >= 0`)],
);

/** Timed reading sessions (reading timer) — the basis for goals, streaks and statistics. */
export const readingSessions = pgTable(
  'reading_sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    minutes: integer('minutes').notNull(),
    pages: integer('pages').notNull().default(0),
    source: varchar('source', { length: 10 }).notNull().default('timer'), // timer | manual
    localDate: date('local_date').notNull(), // Asia/Dhaka calendar day the session counts for
    createdAt: createdAt(),
  },
  (t) => [
    index('reading_sessions_user_day_idx').on(t.userId, t.localDate),
    check('reading_sessions_minutes_range', sql`${t.minutes} between 1 and 600`),
    check('reading_sessions_pages_range', sql`${t.pages} between 0 and 2000`),
    check('reading_sessions_time_valid', sql`${t.endedAt} > ${t.startedAt}`),
  ],
);

/** Daily/weekly goals plus optional break reminders (digital wellbeing). */
export const readingGoals = pgTable(
  'reading_goals',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    dailyMinutes: smallint('daily_minutes').notNull().default(20),
    weeklyMinutes: smallint('weekly_minutes').notNull().default(120),
    yearlyBooks: smallint('yearly_books').notNull().default(12),
    breakReminderMinutes: smallint('break_reminder_minutes'), // null = off
    monthlySummaryEmail: boolean('monthly_summary_email').notNull().default(true),
    ...timestamps(),
  },
  (t) => [check('reading_goals_daily_range', sql`${t.dailyMinutes} between 1 and 600`), check('reading_goals_break_range', sql`${t.breakReminderMinutes} is null or ${t.breakReminderMinutes} between 10 and 180`)],
);

/** My Library: books a user owns (purchased/added) and the shelf they are on. */
export const userLibrary = pgTable(
  'user_library',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    shelf: libraryShelfEnum('shelf').notNull(),
    source: varchar('source', { length: 12 }).notNull().default('manual'), // purchase | manual | free | gift
    orderItemId: uuid('order_item_id').references(() => orderItems.id, { onDelete: 'set null' }),
    /** Entitled to the digital file (purchased e-book or free book). */
    hasDigitalAccess: boolean('has_digital_access').notNull().default(false),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), index('user_library_shelf_idx').on(t.userId, t.shelf, t.updatedAt)],
);

export const readingLists = pgTable(
  'reading_lists',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    visibility: visibilityEnum('visibility').notNull().default('private'),
    itemCount: integer('item_count').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('reading_lists_user_idx').on(t.userId)],
);

export const readingListItems = pgTable(
  'reading_list_items',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => readingLists.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    note: varchar('note', { length: 300 }),
    position: integer('position').notNull().default(0),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.bookId] })],
);

/** Append-only reading history (started, progressed, finished, opened digital copy). */
export const readingHistory = pgTable(
  'reading_history',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    event: varchar('event', { length: 20 }).notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('reading_history_user_time_idx').on(t.userId, t.createdAt)],
);

export const downloads = pgTable(
  'downloads',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    digitalAssetId: uuid('digital_asset_id')
      .notNull()
      .references(() => digitalAssets.id, { onDelete: 'cascade' }),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('downloads_user_asset_idx').on(t.userId, t.digitalAssetId, t.createdAt)],
);

/**
 * XP ledger. The unique (user, source, sourceId) key means each real activity (a finished book, an
 * approved review, a completed quiz) rewards XP at most once — spam and repeats earn nothing.
 */
export const xpEvents = pgTable(
  'xp_events',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 30 }).notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    xp: integer('xp').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('xp_events_source_unique').on(t.userId, t.source, t.sourceId), index('xp_events_user_time_idx').on(t.userId, t.createdAt), check('xp_events_xp_range', sql`${t.xp} between -1000 and 1000`)],
);

/** Cached per-user reading statistics for profiles and summaries. */
export const userStats = pgTable('user_stats', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  xpTotal: integer('xp_total').notNull().default(0),
  level: smallint('level').notNull().default(1),
  booksCompleted: integer('books_completed').notNull().default(0),
  pagesRead: integer('pages_read').notNull().default(0),
  minutesRead: integer('minutes_read').notNull().default(0),
  reviewsWritten: integer('reviews_written').notNull().default(0),
  postsPublished: integer('posts_published').notNull().default(0),
  quizzesPassed: integer('quizzes_passed').notNull().default(0),
  currentStreak: smallint('current_streak').notNull().default(0),
  longestStreak: smallint('longest_streak').notNull().default(0),
  lastReadOn: date('last_read_on'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
