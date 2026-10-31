import { sql } from 'drizzle-orm';
import { AnyPgColumn, boolean, char, check, index, integer, jsonb, numeric, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, i18n, id, timestamps, tsvector } from './_columns';
import { bookFormatEnum, contentStatusEnum } from './enums';
import { users } from './identity';

/**
 * Dynamic category tree shared by books and general products (no hard-coded hierarchy).
 * `path` is the materialised list of ancestor slugs, e.g. "books/academic/hsc".
 */
export const categories = pgTable(
  'categories',
  {
    id: id(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, { onDelete: 'restrict' }),
    slug: varchar('slug', { length: 120 }).notNull(),
    path: text('path').notNull(),
    depth: smallint('depth').notNull().default(0),
    name: i18n('name').notNull(),
    description: i18n('description'),
    icon: varchar('icon', { length: 60 }),
    imageKey: text('image_key'),
    /** Which product types may use this category: book, general or both. */
    appliesTo: varchar('applies_to', { length: 10 }).notNull().default('both'),
    position: integer('position').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    seo: jsonb('seo').$type<{ title?: string; description?: string }>(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('categories_path_unique').on(t.path),
    index('categories_parent_idx').on(t.parentId, t.position),
    check('categories_applies_to_valid', sql`${t.appliesTo} in ('book','general','both')`),
  ],
);

export const genres = pgTable(
  'genres',
  {
    id: id(),
    key: varchar('key', { length: 40 }).notNull(),
    name: i18n('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('genres_key_unique').on(t.key)],
);

export const tags = pgTable(
  'tags',
  {
    id: id(),
    slug: varchar('slug', { length: 80 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('tags_slug_unique').on(t.slug), index('tags_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops'))],
);

/**
 * Author profiles. An author may exist without an account (classic authors) or be claimed by a
 * verified user with the `author` role (userId set after KYC approval).
 */
export const authors = pgTable(
  'authors',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    slug: varchar('slug', { length: 140 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    nameAlt: varchar('name_alt', { length: 160 }), // other script, e.g. Bangla ↔ Latin
    bio: text('bio'),
    photoKey: text('photo_key'),
    birthYear: smallint('birth_year'),
    deathYear: smallint('death_year'),
    website: varchar('website', { length: 300 }),
    isVerified: boolean('is_verified').notNull().default(false),
    followerCount: integer('follower_count').notNull().default(0),
    bookCount: integer('book_count').notNull().default(0),
    status: contentStatusEnum('status').notNull().default('published'),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce("name", '')), 'A') || setweight(to_tsvector('simple', coalesce("name_alt", '')), 'A')`,
    ),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('authors_slug_unique').on(t.slug),
    uniqueIndex('authors_user_unique').on(t.userId).where(sql`${t.userId} is not null`),
    index('authors_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    index('authors_name_alt_trgm_idx').using('gin', t.nameAlt.op('gin_trgm_ops')),
    index('authors_search_idx').using('gin', t.searchVector),
  ],
);

/**
 * A verified author asking to manage an existing catalogue page (e.g. one created by sellers when
 * listing their books). Staff compare the evidence before linking the page to the account.
 */
export const authorClaims = pgTable(
  'author_claims',
  {
    id: id(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 12 }).notNull().default('pending'), // pending | approved | rejected
    message: text('message').notNull(),
    evidenceUrl: varchar('evidence_url', { length: 500 }),
    decisionReason: text('decision_reason'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('author_claims_status_idx').on(t.status, t.createdAt),
    uniqueIndex('author_claims_open_unique').on(t.authorId, t.userId).where(sql`${t.status} = 'pending'`),
    check('author_claims_status_valid', sql`${t.status} in ('pending', 'approved', 'rejected')`),
  ],
);

export const publishers = pgTable(
  'publishers',
  {
    id: id(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    slug: varchar('slug', { length: 140 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    nameAlt: varchar('name_alt', { length: 200 }),
    description: text('description'),
    logoKey: text('logo_key'),
    website: varchar('website', { length: 300 }),
    address: text('address'),
    foundedYear: smallint('founded_year'),
    isVerified: boolean('is_verified').notNull().default(false),
    followerCount: integer('follower_count').notNull().default(0),
    status: contentStatusEnum('status').notNull().default('published'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('publishers_slug_unique').on(t.slug), index('publishers_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops'))],
);

/** Authors a publisher manages (publisher platform). */
export const publisherAuthors = pgTable(
  'publisher_authors',
  {
    publisherId: uuid('publisher_id')
      .notNull()
      .references(() => publishers.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.publisherId, t.authorId] })],
);

/**
 * Bibliographic book record (the "work" as presented in the store). Seller listings are products
 * that reference a book format; the book page aggregates every seller's offer.
 */
export const books = pgTable(
  'books',
  {
    id: id(),
    slug: varchar('slug', { length: 200 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    subtitle: varchar('subtitle', { length: 300 }),
    originalTitle: varchar('original_title', { length: 300 }),
    description: text('description'),
    language: varchar('language', { length: 5 }).notNull().default('bn'),
    primaryCategoryId: uuid('primary_category_id').references(() => categories.id, { onDelete: 'set null' }),
    ageGroup: varchar('age_group', { length: 10 }),
    academicLevel: varchar('academic_level', { length: 20 }),
    seriesName: varchar('series_name', { length: 200 }),
    seriesNumber: smallint('series_number'),
    coverKey: text('cover_key'),
    tableOfContents: jsonb('table_of_contents').$type<Array<{ title: string; page?: number }>>(),
    /** Denormalised author/publisher/ISBN/tag text so one tsvector covers everything searchable. */
    searchText: text('search_text').notNull().default(''),
    status: contentStatusEnum('status').notNull().default('published'),
    isFree: boolean('is_free').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    // Aggregates maintained by the API (reviews, sales, views) for fast discovery queries.
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).notNull().default('0'),
    ratingCount: integer('rating_count').notNull().default(0),
    salesCount: integer('sales_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    wishlistCount: integer('wishlist_count').notNull().default(0),
    minPrice: numeric('min_price', { precision: 14, scale: 2 }),
    offerCount: integer('offer_count').notNull().default(0),
    firstPublishedYear: smallint('first_published_year'),
    editorsPick: boolean('editors_pick').notNull().default(false),
    studentPick: boolean('student_pick').notNull().default(false),
    teacherPick: boolean('teacher_pick').notNull().default(false),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce("title", '')), 'A') || setweight(to_tsvector('simple', coalesce("subtitle", '') || ' ' || coalesce("original_title", '')), 'B') || setweight(to_tsvector('simple', coalesce("search_text", '')), 'B') || setweight(to_tsvector('simple', coalesce("description", '')), 'D')`,
    ),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('books_slug_unique').on(t.slug),
    index('books_search_idx').using('gin', t.searchVector),
    index('books_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops')),
    // Typo-tolerant matching on author names (both scripts), publishers and ISBNs.
    index('books_search_text_trgm_idx').using('gin', t.searchText.op('gin_trgm_ops')),
    index('books_listing_idx').on(t.status, t.offerCount, t.publishedAt),
    index('books_category_idx').on(t.primaryCategoryId),
    index('books_published_idx').on(t.publishedAt),
    index('books_sales_idx').on(t.salesCount),
    check('books_rating_range', sql`${t.ratingAvg} >= 0 and ${t.ratingAvg} <= 5`),
  ],
);

/**
 * A concrete edition/format of a book. ISBN-13 lives here and is unique: listing an ISBN that
 * already exists attaches the seller's offer to the existing edition instead of duplicating it.
 */
export const bookFormats = pgTable(
  'book_formats',
  {
    id: id(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    format: bookFormatEnum('format').notNull(),
    isbn13: char('isbn13', { length: 13 }),
    isbn10: char('isbn10', { length: 10 }),
    edition: varchar('edition', { length: 80 }),
    publisherId: uuid('publisher_id').references(() => publishers.id, { onDelete: 'set null' }),
    publicationYear: smallint('publication_year'),
    pages: integer('pages'),
    coverKey: text('cover_key'),
    weightGrams: integer('weight_grams'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('book_formats_isbn13_unique').on(t.isbn13).where(sql`${t.isbn13} is not null`),
    index('book_formats_book_idx').on(t.bookId),
    index('book_formats_publisher_idx').on(t.publisherId),
    check('book_formats_isbn13_digits', sql`${t.isbn13} is null or ${t.isbn13} ~ '^97[89][0-9]{10}$'`),
    check('book_formats_pages_positive', sql`${t.pages} is null or ${t.pages} > 0`),
  ],
);

export const bookAuthors = pgTable(
  'book_authors',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.id, { onDelete: 'restrict' }),
    role: varchar('role', { length: 20 }).notNull().default('author'), // author | translator | editor | illustrator
    position: smallint('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.authorId, t.role] }), index('book_authors_author_idx').on(t.authorId)],
);

export const bookPublishers = pgTable(
  'book_publishers',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    publisherId: uuid('publisher_id')
      .notNull()
      .references(() => publishers.id, { onDelete: 'restrict' }),
    role: varchar('role', { length: 20 }).notNull().default('publisher'), // publisher | imprint | distributor
  },
  (t) => [primaryKey({ columns: [t.bookId, t.publisherId] }), index('book_publishers_publisher_idx').on(t.publisherId)],
);

export const bookCategories = pgTable(
  'book_categories',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.categoryId] }), index('book_categories_category_idx').on(t.categoryId)],
);

export const bookGenres = pgTable(
  'book_genres',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    genreId: uuid('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.genreId] }), index('book_genres_genre_idx').on(t.genreId)],
);

export const bookTags = pgTable(
  'book_tags',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.tagId] }), index('book_tags_tag_idx').on(t.tagId)],
);

export const bookImages = pgTable(
  'book_images',
  {
    id: id(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    alt: varchar('alt', { length: 200 }),
    kind: varchar('kind', { length: 20 }).notNull().default('gallery'), // cover | back | gallery | inside
    position: smallint('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('book_images_book_idx').on(t.bookId, t.position)],
);

/**
 * "Look inside" content: sample chapter text (markdown), sample page images (private keys served
 * through signed URLs) or a preview PDF. `previewPercent` caps how much of a digital file is shown.
 */
export const bookPreviews = pgTable(
  'book_previews',
  {
    id: id(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 20 }).notNull(), // sample_chapter | sample_pages | pdf
    title: varchar('title', { length: 200 }),
    content: text('content'),
    storageKeys: text('storage_keys').array(),
    previewPercent: smallint('preview_percent').notNull().default(10),
    position: smallint('position').notNull().default(0),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('book_previews_book_idx').on(t.bookId, t.position), check('book_previews_percent_range', sql`${t.previewPercent} between 1 and 50`)],
);

/**
 * Private digital files (e-books). Access only via short-lived signed URLs after an entitlement check.
 * `status`: active (on offer) · withdrawn (no longer sold, earlier buyers keep access) · replaced (a newer
 * file took over) · removed (taken down, e.g. after a copyright complaint — nobody can download it).
 */
export const digitalAssets = pgTable(
  'digital_assets',
  {
    id: id(),
    bookFormatId: uuid('book_format_id')
      .notNull()
      .references(() => bookFormats.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    fileName: varchar('file_name', { length: 200 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: char('sha256', { length: 64 }).notNull(),
    pageCount: integer('page_count'),
    status: varchar('status', { length: 12 }).notNull().default('active'),
    removedReason: text('removed_reason'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    rightsDeclaredAt: timestamp('rights_declared_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('digital_assets_format_idx').on(t.bookFormatId, t.status),
    index('digital_assets_sha_idx').on(t.sha256),
    check('digital_assets_status_valid', sql`${t.status} in ('active', 'withdrawn', 'replaced', 'removed')`),
  ],
);

/**
 * Rights/ownership declarations made when someone lists a book or uploads a manuscript, preview or
 * digital file (copyright protection workflow).
 */
export const ownershipDeclarations = pgTable(
  'ownership_declarations',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectType: varchar('subject_type', { length: 20 }).notNull(), // book | digital_asset | preview | product
    subjectId: uuid('subject_id').notNull(),
    capacity: varchar('capacity', { length: 30 }).notNull(), // author | publisher | licensed_distributor | reseller_physical
    statement: text('statement').notNull(),
    authorizationDocKey: text('authorization_doc_key'),
    ip: varchar('ip', { length: 45 }),
    createdAt: createdAt(),
  },
  (t) => [index('ownership_declarations_subject_idx').on(t.subjectType, t.subjectId)],
);

export const bookDailyStats = pgTable(
  'book_daily_stats',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    day: timestamp('day', { withTimezone: true, mode: 'date' }).notNull(),
    views: integer('views').notNull().default(0),
    sales: integer('sales').notNull().default(0),
    wishlists: integer('wishlists').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.day] }), index('book_daily_stats_day_idx').on(t.day)],
);
