import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, numeric, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, currency, id, money, timestamps, tsvector } from './_columns';
import { bookFormats, books, categories } from './catalog';
import { bookConditionEnum, movementReasonEnum, productStatusEnum, productTypeEnum, sellerStatusEnum, sellerTypeEnum } from './enums';
import { users } from './identity';
import { kycVerifications } from './kyc';

/** Seller account (one per user). Becomes `active` only after KYC approval. */
export const sellers = pgTable(
  'sellers',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: sellerTypeEnum('type').notNull(),
    status: sellerStatusEnum('status').notNull().default('pending'),
    kycVerificationId: uuid('kyc_verification_id').references(() => kycVerifications.id, { onDelete: 'set null' }),
    /** Overrides the platform default commission when set (percent, e.g. 8.50). */
    commissionPercent: numeric('commission_percent', { precision: 5, scale: 2 }),
    usesPlatformShipping: boolean('uses_platform_shipping').notNull().default(true),
    statusReason: text('status_reason'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('sellers_user_unique').on(t.userId),
    index('sellers_status_idx').on(t.status),
    check('sellers_commission_range', sql`${t.commissionPercent} is null or (${t.commissionPercent} >= 0 and ${t.commissionPercent} <= 100)`),
  ],
);

export const sellerStores = pgTable(
  'seller_stores',
  {
    id: id(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    tagline: varchar('tagline', { length: 200 }),
    description: text('description'),
    logoKey: text('logo_key'),
    bannerKey: text('banner_key'),
    phone: varchar('phone', { length: 16 }),
    email: varchar('email', { length: 254 }),
    division: varchar('division', { length: 30 }),
    district: varchar('district', { length: 40 }),
    address: text('address'),
    returnPolicy: text('return_policy'),
    shippingPolicy: text('shipping_policy'),
    isFeatured: boolean('is_featured').notNull().default(false),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).notNull().default('0'),
    ratingCount: integer('rating_count').notNull().default(0),
    followerCount: integer('follower_count').notNull().default(0),
    productCount: integer('product_count').notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex('seller_stores_slug_unique').on(t.slug), uniqueIndex('seller_stores_seller_unique').on(t.sellerId), index('seller_stores_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops'))],
);

/** Payout destination (bKash/Nagad/bank). Account numbers are encrypted at rest. */
export const sellerPayoutAccounts = pgTable(
  'seller_payout_accounts',
  {
    id: id(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    method: varchar('method', { length: 20 }).notNull(), // bkash | nagad | rocket | bank
    accountName: varchar('account_name', { length: 160 }).notNull(),
    accountNumberEnc: text('account_number_enc').notNull(),
    accountNumberLast4: varchar('account_number_last4', { length: 4 }).notNull(),
    bankName: varchar('bank_name', { length: 120 }),
    branchName: varchar('branch_name', { length: 120 }),
    routingNumber: varchar('routing_number', { length: 20 }),
    isDefault: boolean('is_default').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('seller_payout_accounts_seller_idx').on(t.sellerId)],
);

/**
 * A marketplace listing. Books are specialised products: `type = 'book'` with `bookId` and
 * `bookFormatId` pointing at the shared bibliographic record, while price, stock and condition stay
 * per seller. General products (stationery, bags, electronics…) have no book link.
 */
export const products = pgTable(
  'products',
  {
    id: id(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'restrict' }),
    type: productTypeEnum('type').notNull(),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'restrict' }),
    bookFormatId: uuid('book_format_id').references(() => bookFormats.id, { onDelete: 'restrict' }),
    condition: bookConditionEnum('condition').notNull().default('new'),
    conditionNote: varchar('condition_note', { length: 500 }),
    title: varchar('title', { length: 300 }).notNull(),
    slug: varchar('slug', { length: 220 }).notNull(),
    description: text('description'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    brand: varchar('brand', { length: 120 }),
    status: productStatusEnum('status').notNull().default('draft'),
    rejectionReason: text('rejection_reason'),
    /** Lowest active variant price — denormalised for listing/sorting. */
    price: money('price').notNull(),
    compareAtPrice: money('compare_at_price'),
    currency: currency(),
    isDigital: boolean('is_digital').notNull().default(false),
    weightGrams: integer('weight_grams'),
    attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    searchText: text('search_text').notNull().default(''),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce("title", '')), 'A') || setweight(to_tsvector('simple', coalesce("brand", '') || ' ' || coalesce("search_text", '')), 'B') || setweight(to_tsvector('simple', coalesce("description", '')), 'D')`,
    ),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).notNull().default('0'),
    ratingCount: integer('rating_count').notNull().default(0),
    salesCount: integer('sales_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    totalStock: integer('total_stock').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('products_slug_unique').on(t.slug),
    index('products_seller_status_idx').on(t.sellerId, t.status),
    index('products_book_idx').on(t.bookId).where(sql`${t.bookId} is not null`),
    index('products_category_idx').on(t.categoryId, t.status),
    index('products_listing_idx').on(t.status, t.type, t.publishedAt),
    index('products_price_idx').on(t.price),
    index('products_search_idx').using('gin', t.searchVector),
    index('products_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops')),
    index('products_search_text_trgm_idx').using('gin', t.searchText.op('gin_trgm_ops')),
    index('products_book_offers_idx').on(t.bookId, t.status, t.price).where(sql`${t.deletedAt} is null`),
    // A seller lists a given edition in a given condition only once (they adjust stock instead).
    uniqueIndex('products_seller_book_condition_unique')
      .on(t.sellerId, t.bookFormatId, t.condition)
      .where(sql`${t.bookFormatId} is not null and ${t.deletedAt} is null`),
    check('products_book_requires_book', sql`(${t.type} = 'book') = (${t.bookId} is not null)`),
    check('products_price_non_negative', sql`${t.price} >= 0`),
    check('products_compare_at_valid', sql`${t.compareAtPrice} is null or ${t.compareAtPrice} >= ${t.price}`),
    check('products_currency_bdt', sql`${t.currency} = 'BDT'`),
  ],
);

/** Extra categories a product appears in (primary is products.category_id). */
export const productCategories = pgTable(
  'product_categories',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] }), index('product_categories_category_idx').on(t.categoryId)],
);

/** Every product has ≥1 variant (a single "default" variant when there are no options). */
export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 64 }).notNull(),
    name: varchar('name', { length: 160 }).notNull().default('Default'),
    options: jsonb('options').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    price: money('price').notNull(),
    compareAtPrice: money('compare_at_price'),
    currency: currency(),
    weightGrams: integer('weight_grams'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    position: smallint('position').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('product_variants_sku_unique').on(t.sku),
    index('product_variants_product_idx').on(t.productId, t.position),
    check('product_variants_price_non_negative', sql`${t.price} >= 0`),
    check('product_variants_compare_at_valid', sql`${t.compareAtPrice} is null or ${t.compareAtPrice} >= ${t.price}`),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    alt: varchar('alt', { length: 200 }),
    width: integer('width'),
    height: integer('height'),
    position: smallint('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('product_images_product_idx').on(t.productId, t.position)],
);

/**
 * Stock per variant. Reservations happen in the same transaction as order placement with a
 * conditional UPDATE, and the CHECK constraints make overselling impossible even under races.
 */
export const inventory = pgTable(
  'inventory',
  {
    variantId: uuid('variant_id')
      .primaryKey()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantityOnHand: integer('quantity_on_hand').notNull().default(0),
    quantityReserved: integer('quantity_reserved').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(3),
    trackInventory: boolean('track_inventory').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('inventory_on_hand_non_negative', sql`${t.quantityOnHand} >= 0`),
    check('inventory_reserved_non_negative', sql`${t.quantityReserved} >= 0`),
    check('inventory_reserved_le_on_hand', sql`${t.quantityReserved} <= ${t.quantityOnHand}`),
  ],
);

/** Append-only stock ledger; quantity_on_hand always equals the sum of its on-hand deltas. */
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: id(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    reason: movementReasonEnum('reason').notNull(),
    onHandDelta: integer('on_hand_delta').notNull().default(0),
    reservedDelta: integer('reserved_delta').notNull().default(0),
    referenceType: varchar('reference_type', { length: 30 }),
    referenceId: uuid('reference_id'),
    note: text('note'),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('inventory_movements_variant_idx').on(t.variantId, t.createdAt), index('inventory_movements_reference_idx').on(t.referenceType, t.referenceId)],
);
