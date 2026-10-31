import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, timestamps } from './_columns';
import { books } from './catalog';
import { audienceEnum, competitionStatusEnum, contentStatusEnum, visibilityEnum } from './enums';
import { users } from './identity';
import { posts } from './community';

export const quizzes = pgTable(
  'quizzes',
  {
    id: id(),
    slug: varchar('slug', { length: 140 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    subject: varchar('subject', { length: 60 }).notNull(),
    academicLevel: varchar('academic_level', { length: 20 }).notNull().default('general'),
    language: varchar('language', { length: 5 }).notNull().default('bn'),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'set null' }),
    timeLimitSeconds: integer('time_limit_seconds'),
    passPercent: smallint('pass_percent').notNull().default(60),
    status: contentStatusEnum('status').notNull().default('published'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    attemptCount: integer('attempt_count').notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex('quizzes_slug_unique').on(t.slug), index('quizzes_subject_idx').on(t.subject, t.academicLevel), check('quizzes_pass_percent_range', sql`${t.passPercent} between 1 and 100`)],
);

/** Questions with options; the correct index is never sent to clients before submission. */
export const quizQuestions = pgTable(
  'quiz_questions',
  {
    id: id(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    options: jsonb('options').$type<string[]>().notNull(),
    correctIndex: smallint('correct_index').notNull(),
    explanation: text('explanation'),
    position: smallint('position').notNull().default(0),
  },
  (t) => [index('quiz_questions_quiz_idx').on(t.quizId, t.position), check('quiz_questions_correct_index_valid', sql`${t.correctIndex} >= 0 and ${t.correctIndex} < jsonb_array_length(${t.options})`)],
);

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: id(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    answers: jsonb('answers').$type<number[]>().notNull(),
    correctCount: smallint('correct_count').notNull(),
    totalCount: smallint('total_count').notNull(),
    scorePercent: smallint('score_percent').notNull(),
    passed: boolean('passed').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('quiz_attempts_user_idx').on(t.userId, t.completedAt), index('quiz_attempts_quiz_idx').on(t.quizId)],
);

/** Personal study notes (private by default; can be shared with followers or publicly). */
export const userNotes = pgTable(
  'user_notes',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'set null' }),
    subject: varchar('subject', { length: 60 }),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    page: integer('page'),
    visibility: visibilityEnum('visibility').notNull().default('private'),
    ...timestamps(),
  },
  (t) => [index('user_notes_user_idx').on(t.userId, t.updatedAt)],
);

/** Educational events (book fairs, workshops, webinars) shown in the Student Zone. */
export const events = pgTable(
  'events',
  {
    id: id(),
    slug: varchar('slug', { length: 140 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    audience: audienceEnum('audience').notNull().default('all'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    location: varchar('location', { length: 200 }),
    onlineUrl: text('online_url'),
    organizer: varchar('organizer', { length: 200 }),
    coverKey: text('cover_key'),
    status: contentStatusEnum('status').notNull().default('published'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('events_slug_unique').on(t.slug), index('events_starts_idx').on(t.startsAt)],
);

/** Writing / book-review / quiz competitions with entries (entries are community posts). */
export const competitions = pgTable(
  'competitions',
  {
    id: id(),
    slug: varchar('slug', { length: 140 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    kind: varchar('kind', { length: 20 }).notNull(), // writing | book_review | poetry | quiz
    rules: text('rules').notNull(),
    prizes: text('prizes'),
    audience: audienceEnum('audience').notNull().default('student'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: competitionStatusEnum('status').notNull().default('draft'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('competitions_slug_unique').on(t.slug), check('competitions_time_valid', sql`${t.endsAt} > ${t.startsAt}`)],
);

export const competitionEntries = pgTable(
  'competition_entries',
  {
    id: id(),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 15 }).notNull().default('submitted'), // submitted | shortlisted | winner | disqualified
    score: smallint('score'),
    judgeNote: text('judge_note'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('competition_entries_user_unique').on(t.competitionId, t.userId)],
);

export const scholarships = pgTable(
  'scholarships',
  {
    id: id(),
    slug: varchar('slug', { length: 140 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    provider: varchar('provider', { length: 200 }).notNull(),
    description: text('description').notNull(),
    eligibility: text('eligibility'),
    amountText: varchar('amount_text', { length: 120 }),
    academicLevel: varchar('academic_level', { length: 20 }),
    deadline: date('deadline'),
    applyUrl: text('apply_url'),
    status: contentStatusEnum('status').notNull().default('published'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('scholarships_slug_unique').on(t.slug), index('scholarships_deadline_idx').on(t.deadline)],
);
