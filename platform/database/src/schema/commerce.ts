import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { citext, createdAt, id, money, timestamps } from './_columns';
import { books } from './catalog';
import { couponTypeEnum, visibilityEnum } from './enums';
import { users } from './identity';
import { productVariants, products, sellers } from './marketplace';

/** Bangladesh addresses: division → district → upazila/thana → union → area/village. */
export const addresses = pgTable(
  'addresses',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 40 }).notNull().default('home'),
    recipientName: varchar('recipient_name', { length: 120 }).notNull(),
    phone: varchar('phone', { length: 16 }).notNull(),
    division: varchar('division', { length: 30 }).notNull(),
    district: varchar('district', { length: 40 }).notNull(),
    upazila: varchar('upazila', { length: 80 }).notNull(),
    union: varchar('union_name', { length: 80 }),
    area: varchar('area', { length: 120 }).notNull(),
    addressLine: varchar('address_line', { length: 300 }).notNull(),
    postcode: varchar('postcode', { length: 4 }),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    index('addresses_user_idx').on(t.userId),
    uniqueIndex('addresses_one_default_per_user').on(t.userId).where(sql`${t.isDefault}`),
    check('addresses_phone_format', sql`${t.phone} ~ '^\\+8801[3-9][0-9]{8}$'`),
    check('addresses_postcode_format', sql`${t.postcode} is null or ${t.postcode} ~ '^[0-9]{4}$'`),
  ],
);

/** One cart per signed-in user, or per guest token (merged into the user's cart at login). */
export const carts = pgTable(
  'carts',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    guestToken: varchar('guest_token', { length: 64 }),
    couponCode: citext('coupon_code'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('carts_user_unique').on(t.userId).where(sql`${t.userId} is not null`),
    uniqueIndex('carts_guest_unique').on(t.guestToken).where(sql`${t.guestToken} is not null`),
    check('carts_owner_required', sql`${t.userId} is not null or ${t.guestToken} is not null`),
  ],
);

export const cartItems = pgTable(
  'cart_items',
  {
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    savedForLater: boolean('saved_for_later').notNull().default(false),
    addedAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cartId, t.variantId] }), check('cart_items_quantity_range', sql`${t.quantity} between 1 and 99`)],
);

export const wishlists = pgTable(
  'wishlists',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull().default('Wishlist'),
    isDefault: boolean('is_default').notNull().default(true),
    visibility: visibilityEnum('visibility').notNull().default('private'),
    ...timestamps(),
  },
  (t) => [index('wishlists_user_idx').on(t.userId), uniqueIndex('wishlists_one_default_per_user').on(t.userId).where(sql`${t.isDefault}`)],
);

/** A wishlist entry points at a book (any seller) or a specific product. */
export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: id(),
    wishlistId: uuid('wishlist_id')
      .notNull()
      .references(() => wishlists.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    notifyOnDiscount: boolean('notify_on_discount').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('wishlist_items_book_unique').on(t.wishlistId, t.bookId).where(sql`${t.bookId} is not null`),
    uniqueIndex('wishlist_items_product_unique').on(t.wishlistId, t.productId).where(sql`${t.productId} is not null`),
    check('wishlist_items_target_exactly_one', sql`num_nonnulls(${t.bookId}, ${t.productId}) = 1`),
  ],
);

/** Platform coupons (sellerId null) or seller coupons that only discount that seller's items. */
export const coupons = pgTable(
  'coupons',
  {
    id: id(),
    code: citext('code').notNull(),
    sellerId: uuid('seller_id').references(() => sellers.id, { onDelete: 'cascade' }),
    type: couponTypeEnum('type').notNull(),
    value: money('value').notNull(),
    minOrderAmount: money('min_order_amount').notNull().default('0'),
    maxDiscountAmount: money('max_discount_amount'),
    usageLimit: integer('usage_limit'),
    perUserLimit: smallint('per_user_limit').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    description: text('description'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('coupons_code_unique').on(t.code),
    check('coupons_value_positive', sql`${t.value} >= 0`),
    check('coupons_percent_range', sql`${t.type} <> 'percent' or (${t.value} > 0 and ${t.value} <= 100)`),
    check('coupons_dates_valid', sql`${t.endsAt} is null or ${t.startsAt} is null or ${t.endsAt} > ${t.startsAt}`),
    check('coupons_used_within_limit', sql`${t.usageLimit} is null or ${t.usedCount} <= ${t.usageLimit}`),
  ],
);

export const couponUsages = pgTable(
  'coupon_usages',
  {
    id: id(),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').notNull(),
    discountAmount: money('discount_amount').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('coupon_usages_coupon_user_idx').on(t.couponId, t.userId), uniqueIndex('coupon_usages_order_unique').on(t.couponId, t.orderId)],
);

/** Recently viewed books/products (bounded per user by the API) — powers "Recently viewed". */
export const recentlyViewed = pgTable(
  'recently_viewed',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 10 }).notNull(), // book | product
    targetId: uuid('target_id').notNull(),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] }), index('recently_viewed_user_time_idx').on(t.userId, t.viewedAt)],
);

export const searchHistory = pgTable(
  'search_history',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    query: varchar('query', { length: 200 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('search_history_user_time_idx').on(t.userId, t.createdAt)],
);

/** Aggregated anonymous search counts for "popular searches" (no user ids). */
export const searchQueries = pgTable(
  'search_queries',
  {
    normalized: varchar('normalized', { length: 200 }).primaryKey(),
    display: varchar('display', { length: 200 }).notNull(),
    count: integer('count').notNull().default(1),
    resultCount: integer('result_count').notNull().default(0),
    lastSearchedAt: timestamp('last_searched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('search_queries_count_idx').on(t.count)],
);

