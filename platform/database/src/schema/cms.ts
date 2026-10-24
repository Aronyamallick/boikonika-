import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { i18n, id, timestamps } from './_columns';
import { articleKindEnum, audienceEnum, contentStatusEnum, sectionTypeEnum } from './enums';
import { users } from './identity';

export const banners = pgTable(
  'banners',
  {
    id: id(),
    title: i18n('title').notNull(),
    subtitle: i18n('subtitle'),
    imageKey: text('image_key').notNull(),
    mobileImageKey: text('mobile_image_key'),
    link: varchar('link', { length: 500 }),
    ctaLabel: i18n('cta_label'),
    placement: varchar('placement', { length: 30 }).notNull().default('home'), // home | category | student_zone | checkout
    position: smallint('position').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('banners_placement_idx').on(t.placement, t.isActive, t.position)],
);

export interface HomepageSectionConfig {
  /** For book_list: where books come from. */
  source?: 'manual' | 'trending' | 'best_sellers' | 'new_releases' | 'editors_picks' | 'student_picks' | 'teacher_picks' | 'discounted' | 'used' | 'free' | 'hidden_gems' | 'category';
  bookIds?: string[];
  authorIds?: string[];
  categoryId?: string;
  bannerIds?: string[];
  limit?: number;
  /** Free-form content for hero/testimonials sections. */
  content?: Record<string, unknown>;
}

/** Admin-controlled homepage: sections can be enabled, reordered, retitled and configured without code. */
export const homepageSections = pgTable(
  'homepage_sections',
  {
    id: id(),
    key: varchar('key', { length: 60 }).notNull(),
    type: sectionTypeEnum('type').notNull(),
    title: i18n('title').notNull(),
    subtitle: i18n('subtitle'),
    config: jsonb('config').$type<HomepageSectionConfig>().notNull().default(sql`'{}'::jsonb`),
    position: smallint('position').notNull().default(0),
    isEnabled: boolean('is_enabled').notNull().default(true),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('homepage_sections_key_unique').on(t.key), index('homepage_sections_order_idx').on(t.isEnabled, t.position)],
);

/** Static pages (terms, privacy, about, contact, help). Body is sanitised Markdown per language. */
export const cmsPages = pgTable(
  'cms_pages',
  {
    id: id(),
    slug: varchar('slug', { length: 80 }).notNull(),
    title: i18n('title').notNull(),
    body: i18n('body').notNull(),
    status: contentStatusEnum('status').notNull().default('published'),
    seo: jsonb('seo').$type<{ title?: string; description?: string }>(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('cms_pages_slug_unique').on(t.slug)],
);

/** Blog posts, educational articles, announcements, study resources and help-centre articles. */
export const articles = pgTable(
  'articles',
  {
    id: id(),
    slug: varchar('slug', { length: 160 }).notNull(),
    kind: articleKindEnum('kind').notNull(),
    title: varchar('title', { length: 220 }).notNull(),
    excerpt: varchar('excerpt', { length: 400 }),
    body: text('body').notNull(),
    coverKey: text('cover_key'),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    audience: audienceEnum('audience').notNull().default('all'),
    subject: varchar('subject', { length: 60 }),
    academicLevel: varchar('academic_level', { length: 20 }),
    language: varchar('language', { length: 5 }).notNull().default('bn'),
    tags: text('tags').array(),
    status: contentStatusEnum('status').notNull().default('draft'),
    viewCount: integer('view_count').notNull().default(0),
    likeCount: integer('like_count').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('articles_slug_unique').on(t.slug), index('articles_listing_idx').on(t.kind, t.status, t.publishedAt), index('articles_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops'))],
);

export const faqs = pgTable(
  'faqs',
  {
    id: id(),
    category: varchar('category', { length: 40 }).notNull().default('general'), // general | orders | payments | sellers | authors | account
    question: i18n('question').notNull(),
    answer: i18n('answer').notNull(),
    position: smallint('position').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(true),
    ...timestamps(),
  },
  (t) => [index('faqs_category_idx').on(t.category, t.position)],
);

/** Testimonials shown on the landing page — only published with the reader's consent. */
export const testimonials = pgTable('testimonials', {
  id: id(),
  name: varchar('name', { length: 120 }).notNull(),
  role: i18n('role'),
  quote: i18n('quote').notNull(),
  avatarKey: text('avatar_key'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  consentGivenAt: timestamp('consent_given_at', { withTimezone: true }).notNull(),
  position: smallint('position').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  ...timestamps(),
});
