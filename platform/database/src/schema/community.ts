import { sql } from 'drizzle-orm';
import { AnyPgColumn, boolean, check, index, integer, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, timestamps } from './_columns';
import { books } from './catalog';
import { contentStatusEnum, postTypeEnum, visibilityEnum } from './enums';
import { users } from './identity';
import { products, sellers } from './marketplace';
import { orderItems } from './orders';

/**
 * Ratings & reviews. A user reviews a book once (aggregated across sellers) or a general product
 * once; `orderItemId` links the purchase that earns the Verified Purchase badge.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id').references(() => sellers.id, { onDelete: 'set null' }),
    orderItemId: uuid('order_item_id').references(() => orderItems.id, { onDelete: 'set null' }),
    rating: smallint('rating').notNull(),
    title: varchar('title', { length: 160 }),
    body: text('body'),
    pros: text('pros').array(),
    cons: text('cons').array(),
    isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
    status: contentStatusEnum('status').notNull().default('published'),
    /** Heuristic suspicion score (0–100) from the moderation rules; ≥ 60 holds the review for review. */
    suspicionScore: smallint('suspicion_score').notNull().default(0),
    helpfulCount: integer('helpful_count').notNull().default(0),
    notHelpfulCount: integer('not_helpful_count').notNull().default(0),
    reportCount: integer('report_count').notNull().default(0),
    sellerReply: text('seller_reply'),
    sellerRepliedAt: timestamp('seller_replied_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('reviews_user_book_unique').on(t.userId, t.bookId).where(sql`${t.bookId} is not null`),
    uniqueIndex('reviews_user_product_unique').on(t.userId, t.productId).where(sql`${t.bookId} is null and ${t.productId} is not null`),
    index('reviews_book_idx').on(t.bookId, t.status, t.createdAt),
    index('reviews_product_idx').on(t.productId, t.status, t.createdAt),
    check('reviews_rating_range', sql`${t.rating} between 1 and 5`),
    check('reviews_target_required', sql`${t.bookId} is not null or ${t.productId} is not null`),
  ],
);

export const reviewVotes = pgTable(
  'review_votes',
  {
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    helpful: boolean('helpful').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.reviewId, t.userId] })],
);

/** Social reading posts: reviews, recommendations, quotes, progress, poems, stories, questions… */
export const posts = pgTable(
  'posts',
  {
    id: id(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: postTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }),
    body: text('body').notNull(),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'set null' }),
    /** For quotes: the page/chapter the excerpt comes from (short quotes only — copyright). */
    quoteSource: varchar('quote_source', { length: 200 }),
    readingPercent: smallint('reading_percent'),
    visibility: visibilityEnum('visibility').notNull().default('public'),
    status: contentStatusEnum('status').notNull().default('published'),
    language: varchar('language', { length: 5 }),
    /** Posts in the Student Zone feed get stricter moderation. */
    isStudentZone: boolean('is_student_zone').notNull().default(false),
    subject: varchar('subject', { length: 60 }),
    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    bookmarkCount: integer('bookmark_count').notNull().default(0),
    shareCount: integer('share_count').notNull().default(0),
    reportCount: integer('report_count').notNull().default(0),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('posts_feed_idx').on(t.status, t.visibility, t.createdAt),
    index('posts_author_idx').on(t.authorId, t.createdAt),
    index('posts_book_idx').on(t.bookId, t.createdAt),
    index('posts_student_idx').on(t.isStudentZone, t.createdAt).where(sql`${t.isStudentZone}`),
    check('posts_reading_percent_range', sql`${t.readingPercent} is null or ${t.readingPercent} between 0 and 100`),
  ],
);

export const postMedia = pgTable(
  'post_media',
  {
    id: id(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    kind: varchar('kind', { length: 10 }).notNull().default('image'),
    alt: varchar('alt', { length: 300 }),
    width: integer('width'),
    height: integer('height'),
    position: smallint('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('post_media_post_idx').on(t.postId, t.position)],
);

/** Comments with one level of replies (parentId); `comment_replies` is a view over this table. */
export const comments = pgTable(
  'comments',
  {
    id: id(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    status: contentStatusEnum('status').notNull().default('published'),
    likeCount: integer('like_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    reportCount: integer('report_count').notNull().default(0),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('comments_post_idx').on(t.postId, t.createdAt), index('comments_parent_idx').on(t.parentId, t.createdAt)],
);

export const likes = pgTable(
  'likes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 20 }).notNull(), // post | comment | club_post | article
    targetId: uuid('target_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetType, t.targetId] }),
    index('likes_target_idx').on(t.targetType, t.targetId),
    check('likes_target_type_valid', sql`${t.targetType} in ('post','comment','club_post','article')`),
  ],
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 20 }).notNull(), // post | article | book | quiz
    targetId: uuid('target_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetType, t.targetId] }),
    index('bookmarks_user_time_idx').on(t.userId, t.createdAt),
    check('bookmarks_target_type_valid', sql`${t.targetType} in ('post','article','book','quiz')`),
  ],
);
