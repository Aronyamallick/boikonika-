import { z } from 'zod';
import { ACADEMIC_LEVELS, AGE_GROUPS, BOOK_LANGUAGES, INTEREST_KEYS } from '../constants/interests';
import { BOOK_CONDITIONS, BOOK_FORMATS } from '../constants/statuses';
import { toEnglishDigits } from '../utils/bangla';
import { isMoneyString } from '../utils/money';
import { normalizeIsbn, toIsbn13 } from '../utils/isbn';

/** Unicode-normalised (NFC) trimmed text, so Bangla typed with different keyboards matches. */
export const nfcText = (min: number, max: number) =>
  z
    .string({ error: 'validation.required' })
    .transform((v) => v.normalize('NFC').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(min, { error: 'validation.required' }).max(max, { error: 'validation.maxLength' }));

/** Decimal BDT amount as a string with at most 2 decimals ("250", "249.50"). */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => toEnglishDigits(String(v)).trim())
  .refine((v) => isMoneyString(v) && Number(v) >= 0 && Number(v) <= 9_999_999.99, { error: 'validation.money' })
  .transform((v) => Number(v).toFixed(2));

export const isbnSchema = z
  .string()
  .transform((v, ctx) => {
    const isbn = toIsbn13(normalizeIsbn(toEnglishDigits(v)));
    if (!isbn) {
      ctx.addIssue({ code: 'custom', message: 'validation.isbn' });
      return z.NEVER;
    }
    return isbn;
  });

export const CATALOG_SORTS = ['relevance', 'newest', 'popular', 'price_asc', 'price_desc', 'rating'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

const csv = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).max(values.length));

const flag = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1')
  .optional();

export const bookListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(200).optional(),
  genre: z.enum(INTEREST_KEYS).optional(),
  author: z.string().trim().max(140).optional(),
  publisher: z.string().trim().max(140).optional(),
  store: z.string().trim().max(120).optional(),
  language: csv(BOOK_LANGUAGES).optional(),
  condition: csv(BOOK_CONDITIONS).optional(),
  format: csv(BOOK_FORMATS).optional(),
  ageGroup: z.enum(AGE_GROUPS).optional(),
  academicLevel: z.enum(ACADEMIC_LEVELS).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  inStock: flag,
  discounted: flag,
  free: flag,
  pick: z.enum(['editors', 'students', 'teachers']).optional(),
  sort: z.enum(CATALOG_SORTS).default('relevance'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type BookListQuery = z.input<typeof bookListQuerySchema>;

export const productListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(200).optional(),
  brand: z.string().trim().max(120).optional(),
  store: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: flag,
  discounted: flag,
  sort: z.enum(CATALOG_SORTS).default('relevance'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

export const OWNERSHIP_CAPACITIES = ['reseller_physical', 'author', 'publisher', 'licensed_distributor'] as const;

const newBookSchema = z.object({
  title: nfcText(1, 300),
  subtitle: nfcText(0, 300).optional(),
  originalTitle: nfcText(0, 300).optional(),
  description: z.string().max(10_000).transform((v) => v.normalize('NFC').trim()).optional(),
  language: z.enum(BOOK_LANGUAGES).default('bn'),
  categoryId: z.uuid({ error: 'validation.required' }),
  genres: z.array(z.enum(INTEREST_KEYS)).max(5).default([]),
  /** Existing author ids and/or new author names (created as unverified profiles). */
  authorIds: z.array(z.uuid()).max(10).default([]),
  authorNames: z.array(nfcText(2, 160)).max(10).default([]),
  translatorNames: z.array(nfcText(2, 160)).max(5).default([]),
  publisherId: z.uuid().optional(),
  publisherName: nfcText(2, 200).optional(),
  ageGroup: z.enum(AGE_GROUPS).optional(),
  academicLevel: z.enum(ACADEMIC_LEVELS).optional(),
  firstPublishedYear: z.number().int().min(1000).max(new Date().getFullYear() + 1).optional(),
  seriesName: nfcText(1, 200).optional(),
  seriesNumber: z.number().int().min(1).max(999).optional(),
});

const offerFields = {
  condition: z.enum(BOOK_CONDITIONS).default('new'),
  conditionNote: z.string().trim().max(500).optional(),
  price: moneySchema,
  compareAtPrice: moneySchema.optional(),
  stock: z.coerce.number().int().min(0).max(100_000),
  sku: z.string().trim().regex(/^[A-Za-z0-9._-]{3,64}$/, { error: 'validation.sku' }).optional(),
};

/**
 * A seller's book listing: an existing edition (by ISBN or book id) or a new book record, plus the
 * offer (condition, price, stock). Sellers declare their right to sell it.
 */
export const sellerBookListingSchema = z
  .object({
    isbn: isbnSchema.optional(),
    bookId: z.uuid().optional(),
    book: newBookSchema.optional(),
    format: z.object({
      format: z.enum(BOOK_FORMATS).default('paperback'),
      edition: nfcText(1, 80).optional(),
      publicationYear: z.number().int().min(1000).max(new Date().getFullYear() + 1).optional(),
      pages: z.number().int().min(1).max(20_000).optional(),
      weightGrams: z.number().int().min(1).max(20_000).optional(),
    }),
    ...offerFields,
    declaration: z.object({ capacity: z.enum(OWNERSHIP_CAPACITIES), accepted: z.literal(true, { error: 'validation.declaration' }) }),
  })
  .refine((v) => v.isbn || v.bookId || v.book, { error: 'validation.bookRequired', path: ['book'] })
  .refine((v) => !v.compareAtPrice || Number(v.compareAtPrice) >= Number(v.price), { error: 'validation.compareAtPrice', path: ['compareAtPrice'] })
  .refine((v) => v.format.format !== 'digital' && v.format.format !== 'audiobook', { error: 'validation.physicalOnly', path: ['format'] });
export type SellerBookListingInput = z.input<typeof sellerBookListingSchema>;

export const variantSchema = z
  .object({
    name: nfcText(1, 160),
    options: z.record(z.string().max(40), z.string().max(80)).default({}),
    sku: z.string().trim().regex(/^[A-Za-z0-9._-]{3,64}$/, { error: 'validation.sku' }).optional(),
    price: moneySchema,
    compareAtPrice: moneySchema.optional(),
    stock: z.coerce.number().int().min(0).max(100_000),
    weightGrams: z.number().int().min(1).max(50_000).optional(),
  })
  .refine((v) => !v.compareAtPrice || Number(v.compareAtPrice) >= Number(v.price), { error: 'validation.compareAtPrice', path: ['compareAtPrice'] });

export const sellerProductSchema = z.object({
  title: nfcText(2, 300),
  description: z.string().max(10_000).transform((v) => v.normalize('NFC').trim()).optional(),
  categoryId: z.uuid({ error: 'validation.required' }),
  brand: nfcText(1, 120).optional(),
  attributes: z.record(z.string().max(40), z.string().max(200)).default({}),
  weightGrams: z.number().int().min(1).max(50_000).optional(),
  variants: z.array(variantSchema).min(1).max(30),
});
export type SellerProductInput = z.input<typeof sellerProductSchema>;

/** Editable fields of an existing listing (book or general); stock changes go through adjustments. */
export const updateListingSchema = z.object({
  title: nfcText(2, 300).optional(),
  description: z.string().max(10_000).transform((v) => v.normalize('NFC').trim()).optional(),
  conditionNote: z.string().trim().max(500).nullable().optional(),
  brand: nfcText(1, 120).nullable().optional(),
  categoryId: z.uuid().optional(),
  status: z.enum(['active', 'archived', 'draft']).optional(),
  variants: z
    .array(z.object({ id: z.uuid(), price: moneySchema.optional(), compareAtPrice: moneySchema.nullable().optional(), isActive: z.boolean().optional() }))
    .max(30)
    .optional(),
});

export const STOCK_ADJUST_REASONS = ['restock', 'adjustment', 'damaged', 'return'] as const;
export const stockAdjustSchema = z.object({
  variantId: z.uuid(),
  delta: z.coerce.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, { error: 'validation.nonZero' }),
  reason: z.enum(STOCK_ADJUST_REASONS),
  note: z.string().trim().max(300).optional(),
});

export const moderationDecisionSchema = z.object({ reason: z.string().trim().max(1000).optional() });

export const storeSettingsSchema = z.object({
  name: nfcText(2, 160).optional(),
  tagline: nfcText(0, 200).nullable().optional(),
  description: z.string().max(3000).transform((v) => v.normalize('NFC').trim()).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  email: z.email({ error: 'validation.email' }).nullable().optional(),
  division: z.string().trim().max(30).nullable().optional(),
  district: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  returnPolicy: z.string().trim().max(3000).nullable().optional(),
  shippingPolicy: z.string().trim().max(3000).nullable().optional(),
});
