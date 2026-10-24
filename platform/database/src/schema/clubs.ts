import { sql } from 'drizzle-orm';
import { AnyPgColumn, boolean, check, date, index, integer, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, timestamps } from './_columns';
import { books } from './catalog';
import { clubPurposeEnum, clubTypeEnum, contentStatusEnum, joinPolicyEnum, memberRoleEnum, memberStatusEnum } from './enums';
import { users } from './identity';

/** Book clubs and Student Zone study groups (purpose = study). */
export const bookClubs = pgTable(
  'book_clubs',
  {
    id: id(),
    slug: varchar('slug', { length: 140 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),
    type: clubTypeEnum('type').notNull().default('public'),
    purpose: clubPurposeEnum('purpose').notNull().default('reading'),
    subject: varchar('subject', { length: 60 }),
    institutionName: varchar('institution_name', { length: 200 }),
    joinPolicy: joinPolicyEnum('join_policy').notNull().default('open'),
    coverKey: text('cover_key'),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    memberCount: integer('member_count').notNull().default(0),
    status: contentStatusEnum('status').notNull().default('published'),
    rules: text('rules'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('book_clubs_slug_unique').on(t.slug), index('book_clubs_type_idx').on(t.type, t.purpose), index('book_clubs_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops'))],
);

export const bookClubMembers = pgTable(
  'book_club_members',
  {
    clubId: uuid('club_id')
      .notNull()
      .references(() => bookClubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('member'),
    status: memberStatusEnum('status').notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.userId] }), index('book_club_members_user_idx').on(t.userId, t.status)],
);

/** Club discussions (threaded one level via parentId) and announcements. */
export const bookClubPosts = pgTable(
  'book_club_posts',
  {
    id: id(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => bookClubs.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => bookClubPosts.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }),
    body: text('body').notNull(),
    kind: varchar('kind', { length: 20 }).notNull().default('discussion'), // discussion | announcement
    isPinned: boolean('is_pinned').notNull().default(false),
    status: contentStatusEnum('status').notNull().default('published'),
    likeCount: integer('like_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('book_club_posts_club_idx').on(t.clubId, t.createdAt), index('book_club_posts_parent_idx').on(t.parentId)],
);

export const bookClubEvents = pgTable(
  'book_club_events',
  {
    id: id(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => bookClubs.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    location: varchar('location', { length: 200 }),
    onlineUrl: text('online_url'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('book_club_events_club_idx').on(t.clubId, t.startsAt), check('book_club_events_time_valid', sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`)],
);

/** Book of the month and reading schedule (chapters/pages due by a date). */
export const bookClubBooks = pgTable(
  'book_club_books',
  {
    id: id(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => bookClubs.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    month: date('month').notNull(), // first day of the month
    status: varchar('status', { length: 12 }).notNull().default('upcoming'), // upcoming | current | finished
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('book_club_books_club_month_unique').on(t.clubId, t.month)],
);

export const bookClubSchedule = pgTable(
  'book_club_schedule',
  {
    id: id(),
    clubBookId: uuid('club_book_id')
      .notNull()
      .references(() => bookClubBooks.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    fromPage: integer('from_page'),
    toPage: integer('to_page'),
    dueOn: date('due_on').notNull(),
    position: smallint('position').notNull().default(0),
  },
  (t) => [index('book_club_schedule_book_idx').on(t.clubBookId, t.position)],
);

export const bookClubPolls = pgTable(
  'book_club_polls',
  {
    id: id(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => bookClubs.id, { onDelete: 'cascade' }),
    question: varchar('question', { length: 300 }).notNull(),
    allowMultiple: boolean('allow_multiple').notNull().default(false),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('book_club_polls_club_idx').on(t.clubId)],
);

export const bookClubPollOptions = pgTable(
  'book_club_poll_options',
  {
    id: id(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => bookClubPolls.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 200 }).notNull(),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'set null' }),
    voteCount: integer('vote_count').notNull().default(0),
    position: smallint('position').notNull().default(0),
  },
  (t) => [index('book_club_poll_options_poll_idx').on(t.pollId)],
);

export const bookClubPollVotes = pgTable(
  'book_club_poll_votes',
  {
    pollId: uuid('poll_id')
      .notNull()
      .references(() => bookClubPolls.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => bookClubPollOptions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.optionId, t.userId] }), index('book_club_poll_votes_user_idx').on(t.pollId, t.userId)],
);

