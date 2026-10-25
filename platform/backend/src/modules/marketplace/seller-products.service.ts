import { Inject, Injectable } from '@nestjs/common';
import {
  authors,
  bookAuthors,
  bookCategories,
  bookFormats,
  bookGenres,
  bookPublishers,
  books,
  buildSearchText,
  categories,
  genres,
  inventory,
  inventoryMovements,
  ownershipDeclarations,
  productImages,
  products,
  productVariants,
  publishers,
  refreshAuthorBookCounts,
  refreshBookOffers,
  refreshProductStock,
  refreshStoreProductCounts,
  type Database,
  type DbOrTx,
} from '@boikonika/database';
import { sellerBookListingSchema, sellerProductSchema, stockAdjustSchema, updateListingSchema, type Role } from '@boikonika/shared';
import { and, asc, count, desc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requestContext } from '../../common/context/request-context';
import { AppException } from '../../common/errors/app-exception';
import { isUniqueViolation } from '../../common/errors/pg';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { SettingsService } from '../settings/settings.service';
import { SellersService, uniqueSlug, type SellerRow } from './sellers.service';

type BookListing = z.output<typeof sellerBookListingSchema>;
type GeneralProduct = z.output<typeof sellerProductSchema>;
type UpdateListing = z.output<typeof updateListingSchema>;
type StockAdjust = z.output<typeof stockAdjustSchema>;

const BOOK_ROLES: Role[] = ['book_seller', 'publisher', 'author'];
const MAX_IMAGES = 8;
const DECLARATIONS: Record<string, string> = {
  reseller_physical: 'I own these physical copies and they are original, not pirated or photocopied.',
  author: 'I am the author of this book and hold the rights to sell it.',
  publisher: 'I am the publisher of this edition and hold the rights to sell it.',
  licensed_distributor: 'I am authorised by the rights holder to distribute this book.',
};

const sku = () => `BK-${randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, 'X').toUpperCase()}`;

/** Seller listings: books (attached to shared book records) and general products with variants and stock. */
@Injectable()
export class SellerProductsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sellers: SellersService,
    private readonly rbac: RbacService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ create

  async createBookListing(userId: string, input: BookListing) {
    const seller = await this.sellers.requireSeller(userId);
    const roles = await this.rbac.rolesOf(userId);
    if (!roles.some((r) => BOOK_ROLES.includes(r))) throw new AppException('FORBIDDEN', 'api.marketplace.bookRoleRequired');
    const review = await this.settings.get<boolean>('marketplace.requireListingReview', false);

    try {
      return await this.db.transaction(async (tx) => {
        let bookId: string | undefined;
        let formatId: string | undefined;
        if (input.isbn) {
          const [format] = await tx.select({ id: bookFormats.id, bookId: bookFormats.bookId }).from(bookFormats).where(eq(bookFormats.isbn13, input.isbn));
          if (format) [bookId, formatId] = [format.bookId, format.id];
          else if (!input.book && !input.bookId) throw new AppException('BAD_REQUEST', 'api.marketplace.isbnUnknown', [{ field: 'isbn', code: 'unknown', message: 'api.marketplace.isbnUnknown' }]);
        }
        if (!bookId && input.bookId) {
          const [book] = await tx.select({ id: books.id }).from(books).where(and(eq(books.id, input.bookId), isNull(books.deletedAt)));
          if (!book) throw AppException.notFound('Book');
          bookId = book.id;
        }
        if (!bookId) bookId = await this.createBook(tx, input.book!, input.isbn, userId);
        if (!formatId) formatId = await this.findOrCreateFormat(tx, bookId, input);

        const [book] = await tx.select().from(books).where(eq(books.id, bookId));
        const authorRows = await tx
          .select({ id: authors.id, name: authors.name, nameAlt: authors.nameAlt })
          .from(bookAuthors)
          .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
          .where(eq(bookAuthors.bookId, bookId));
        const [format] = await tx.select().from(bookFormats).where(eq(bookFormats.id, formatId));
        const status = review ? 'pending_review' : 'active';
        const [product] = await tx
          .insert(products)
          .values({
            sellerId: seller.id,
            type: 'book',
            bookId,
            bookFormatId: formatId,
            condition: input.condition,
            conditionNote: input.conditionNote ?? null,
            title: book!.title,
            slug: await uniqueSlug(tx, 'products', book!.title),
            description: book!.description,
            categoryId: book!.primaryCategoryId,
            status,
            price: input.price,
            compareAtPrice: input.compareAtPrice ?? null,
            weightGrams: format?.weightGrams ?? null,
            searchText: buildSearchText([book!.title, book!.subtitle, ...authorRows.flatMap((a) => [a.name, a.nameAlt]), format?.isbn13]),
            publishedAt: status === 'active' ? new Date() : null,
          })
          .returning();
        await this.createVariants(tx, product!.id, [{ name: 'Default', options: {}, sku: input.sku, price: input.price, compareAtPrice: input.compareAtPrice, stock: input.stock, weightGrams: format?.weightGrams ?? undefined }], userId);
        await tx.insert(ownershipDeclarations).values({
          userId,
          subjectType: 'product',
          subjectId: product!.id,
          capacity: input.declaration.capacity,
          statement: DECLARATIONS[input.declaration.capacity]!,
          ip: requestContext.get()?.ip ?? null,
        });
        await this.refreshAll(tx, [product!.id], [bookId], authorRows.map((a) => a.id), [seller.id]);
        await this.audit.record({ action: 'listing.create', entityType: 'product', entityId: product!.id, after: { bookId, condition: input.condition, price: input.price, stock: input.stock, status } }, tx);
        return { id: product!.id, slug: product!.slug, status, message: status === 'active' ? 'api.marketplace.listingPublished' : 'api.marketplace.listingPending' };
      });
    } catch (error) {
      if (isUniqueViolation(error, 'products_seller_book_condition_unique')) throw new AppException('CONFLICT', 'api.marketplace.alreadyListed');
      throw error;
    }
  }

  async createProduct(userId: string, input: GeneralProduct) {
    const seller = await this.sellers.requireSeller(userId);
    const roles = await this.rbac.rolesOf(userId);
    if (!roles.includes('general_seller')) throw new AppException('FORBIDDEN', 'api.marketplace.generalRoleRequired');
    await this.assertCategory(this.db, input.categoryId, 'general');
    const review = await this.settings.get<boolean>('marketplace.requireListingReview', false);
    const status = review ? 'pending_review' : 'active';
    return this.db.transaction(async (tx) => {
      const cheapest = [...input.variants].sort((a, b) => Number(a.price) - Number(b.price))[0]!;
      const [product] = await tx
        .insert(products)
        .values({
          sellerId: seller.id,
          type: 'general',
          title: input.title,
          slug: await uniqueSlug(tx, 'products', input.title),
          description: input.description ?? null,
          categoryId: input.categoryId,
          brand: input.brand ?? null,
          attributes: input.attributes,
          status,
          price: cheapest.price,
          compareAtPrice: cheapest.compareAtPrice ?? null,
          weightGrams: input.weightGrams ?? null,
          searchText: buildSearchText([input.title, input.brand, ...input.variants.map((v) => v.name), ...Object.values(input.attributes)]),
          publishedAt: status === 'active' ? new Date() : null,
        })
        .returning();
      await this.createVariants(tx, product!.id, input.variants, userId);
      await tx.insert(ownershipDeclarations).values({ userId, subjectType: 'product', subjectId: product!.id, capacity: 'reseller_physical', statement: 'I own these products and they are genuine and legal to sell.', ip: requestContext.get()?.ip ?? null });
      await this.refreshAll(tx, [product!.id], [], [], [seller.id]);
      await this.audit.record({ action: 'listing.create', entityType: 'product', entityId: product!.id, after: { type: 'general', variants: input.variants.length, status } }, tx);
      return { id: product!.id, slug: product!.slug, status, message: status === 'active' ? 'api.marketplace.listingPublished' : 'api.marketplace.listingPending' };
    });
  }

  // ------------------------------------------------------------------ read

  async list(userId: string, filter: { status?: string; q?: string; type?: 'book' | 'general'; page: number; pageSize: number }) {
    const seller = await this.sellers.requireSeller(userId);
    const where = and(
      eq(products.sellerId, seller.id),
      isNull(products.deletedAt),
      filter.status ? sql`${products.status}::text = ${filter.status}` : undefined,
      filter.type ? eq(products.type, filter.type) : undefined,
      filter.q ? ilike(products.title, `%${filter.q.replace(/[%_\\]/g, '')}%`) : undefined,
    );
    const [rows, [{ total } = { total: 0 }]] = await Promise.all([
      this.db
        .select({
          id: products.id,
          slug: products.slug,
          type: products.type,
          title: products.title,
          condition: products.condition,
          status: products.status,
          price: products.price,
          compareAtPrice: products.compareAtPrice,
          totalStock: products.totalStock,
          salesCount: products.salesCount,
          viewCount: products.viewCount,
          rejectionReason: products.rejectionReason,
          updatedAt: products.updatedAt,
          // Written with the table name: Drizzle leaves columns unqualified in a single-table select,
          // and a bare "id" inside the subquery would mean the image's own id.
          imageKey: sql<string | null>`(select i.storage_key from product_images i where i.product_id = "products"."id" order by i.position limit 1)`,
          coverKey: sql<string | null>`(select b.cover_key from books b where b.id = "products"."book_id")`,
        })
        .from(products)
        .where(where)
        .orderBy(desc(products.updatedAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db.select({ total: count() }).from(products).where(where),
    ]);
    return {
      items: rows.map(({ imageKey, coverKey, ...r }) => ({ ...r, updatedAt: r.updatedAt.toISOString(), imageUrl: this.storage.publicUrl(imageKey ?? coverKey) })),
      meta: { page: filter.page, pageSize: filter.pageSize, total },
    };
  }

  async get(userId: string, productId: string) {
    const { product } = await this.owned(userId, productId);
    const [variants, images] = await Promise.all([
      this.db
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          name: productVariants.name,
          options: productVariants.options,
          price: productVariants.price,
          compareAtPrice: productVariants.compareAtPrice,
          isActive: productVariants.isActive,
          onHand: inventory.quantityOnHand,
          reserved: inventory.quantityReserved,
          lowStockThreshold: inventory.lowStockThreshold,
        })
        .from(productVariants)
        .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
        .where(eq(productVariants.productId, productId))
        .orderBy(asc(productVariants.position)),
      this.db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.position)),
    ]);
    return {
      id: product.id,
      slug: product.slug,
      type: product.type,
      bookId: product.bookId,
      title: product.title,
      description: product.description,
      condition: product.condition,
      conditionNote: product.conditionNote,
      brand: product.brand,
      categoryId: product.categoryId,
      attributes: product.attributes,
      status: product.status,
      rejectionReason: product.rejectionReason,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      totalStock: product.totalStock,
      variants,
      images: images.map((i) => ({ id: i.id, url: this.storage.publicUrl(i.storageKey), alt: i.alt })),
    };
  }

  /** Existing edition for an ISBN (so sellers attach offers instead of duplicating books). */
  async lookupIsbn(userId: string, isbn: string) {
    const seller = await this.sellers.requireSeller(userId);
    const [row] = await this.db.execute<Record<string, unknown>>(sql`
      select f.id as format_id, f.format, f.edition, f.publication_year, f.pages, b.id as book_id, b.slug, b.title, b.cover_key,
        (select string_agg(a.name, ', ') from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id and ba.role = 'author') as authors,
        array(select p.condition::text from products p where p.book_format_id = f.id and p.seller_id = ${seller.id} and p.deleted_at is null) as my_conditions
      from book_formats f join books b on b.id = f.book_id where f.isbn13 = ${isbn} and b.deleted_at is null`).then((r) => r.rows);
    if (!row) return null;
    return {
      bookId: row.book_id,
      formatId: row.format_id,
      slug: row.slug,
      title: row.title,
      authors: row.authors,
      format: row.format,
      edition: row.edition,
      publicationYear: row.publication_year,
      pages: row.pages,
      coverUrl: this.storage.publicUrl(row.cover_key as string | null),
      alreadyListedConditions: row.my_conditions,
    };
  }

  // ------------------------------------------------------------------ update

  async update(userId: string, productId: string, input: UpdateListing) {
    const { product, seller } = await this.owned(userId, productId);
    if (input.categoryId) await this.assertCategory(this.db, input.categoryId, product.type === 'book' ? 'book' : 'general');
    let status = product.status;
    if (input.status) {
      if (product.status === 'rejected' || product.status === 'suspended') throw AppException.forbidden();
      const review = await this.settings.get<boolean>('marketplace.requireListingReview', false);
      status = input.status === 'active' && review && product.status !== 'active' ? 'pending_review' : input.status;
    }
    await this.db.transaction(async (tx) => {
      const changes: Partial<typeof products.$inferInsert> = {};
      if (input.title !== undefined && product.type === 'general') changes.title = input.title;
      if (input.description !== undefined && product.type === 'general') changes.description = input.description;
      if (input.conditionNote !== undefined) changes.conditionNote = input.conditionNote;
      if (input.brand !== undefined && product.type === 'general') changes.brand = input.brand;
      if (input.categoryId !== undefined && product.type === 'general') changes.categoryId = input.categoryId;
      if (status !== product.status) {
        changes.status = status;
        if (status === 'active' && !product.publishedAt) changes.publishedAt = new Date();
      }
      if (Object.keys(changes).length) await tx.update(products).set(changes).where(eq(products.id, productId));
      for (const v of input.variants ?? []) {
        const set: Partial<typeof productVariants.$inferInsert> = {};
        if (v.price !== undefined) set.price = v.price;
        if (v.compareAtPrice !== undefined) set.compareAtPrice = v.compareAtPrice;
        if (v.isActive !== undefined) set.isActive = v.isActive;
        if (!Object.keys(set).length) continue;
        const [updated] = await tx.update(productVariants).set(set).where(and(eq(productVariants.id, v.id), eq(productVariants.productId, productId))).returning({ price: productVariants.price, compareAtPrice: productVariants.compareAtPrice });
        if (!updated) throw AppException.notFound('Variant');
        if (updated.compareAtPrice !== null && Number(updated.compareAtPrice) < Number(updated.price)) {
          throw AppException.validation([{ field: 'variants', code: 'compare_at', message: 'validation.compareAtPrice' }]);
        }
      }
      await this.refreshAll(tx, [productId], product.bookId ? [product.bookId] : [], [], [seller.id]);
      await this.audit.record({ action: 'listing.update', entityType: 'product', entityId: productId, before: { status: product.status, price: product.price }, after: { ...changes, variants: input.variants } }, tx);
    });
    return this.get(userId, productId);
  }

  async remove(userId: string, productId: string): Promise<void> {
    const { product, seller } = await this.owned(userId, productId);
    await this.db.transaction(async (tx) => {
      await tx.update(products).set({ deletedAt: new Date(), status: 'archived' }).where(eq(products.id, productId));
      await this.refreshAll(tx, [productId], product.bookId ? [product.bookId] : [], [], [seller.id]);
      await this.audit.record({ action: 'listing.delete', entityType: 'product', entityId: productId }, tx);
    });
  }

  async addImages(userId: string, productId: string, files: Buffer[]) {
    const { product } = await this.owned(userId, productId);
    const [{ total } = { total: 0 }] = await this.db.select({ total: count() }).from(productImages).where(eq(productImages.productId, productId));
    if (total + files.length > MAX_IMAGES) throw AppException.validation([{ field: 'images', code: 'too_many', message: 'api.marketplace.imagesLimit' }]);
    const processed = await Promise.all(files.map((f) => processUpload(f, { allowed: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 8 * 1024 * 1024, image: { maxWidth: 1400, maxHeight: 1400, format: 'webp', quality: 85 } })));
    const stored = processed.map((p) => ({ ...p, key: `products/${productId}/${randomUUID()}.webp` }));
    await Promise.all(stored.map((s) => this.storage.put('public', s.key, s.body, s.contentType)));
    await this.db.transaction(async (tx) => {
      await tx.insert(productImages).values(stored.map((s, i) => ({ productId, storageKey: s.key, width: s.width ?? null, height: s.height ?? null, position: total + i, alt: product.title.slice(0, 200) })));
      // The first photo of a seller's book becomes the book cover when the book has none yet.
      if (product.bookId) await tx.update(books).set({ coverKey: stored[0]!.key }).where(and(eq(books.id, product.bookId), isNull(books.coverKey)));
    });
    return this.get(userId, productId);
  }

  async removeImage(userId: string, productId: string, imageId: string) {
    await this.owned(userId, productId);
    const [removed] = await this.db.delete(productImages).where(and(eq(productImages.id, imageId), eq(productImages.productId, productId))).returning();
    if (!removed) throw AppException.notFound('Image');
    const [usedAsCover] = await this.db.select({ id: books.id }).from(books).where(eq(books.coverKey, removed.storageKey));
    if (!usedAsCover) await this.storage.delete('public', removed.storageKey);
    return this.get(userId, productId);
  }

  /** Stock changes always go through the append-only ledger; reserved units cannot be removed. */
  async adjustStock(userId: string, input: StockAdjust) {
    const seller = await this.sellers.requireSeller(userId);
    const [variant] = await this.db
      .select({ productId: productVariants.productId, bookId: products.bookId })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(productVariants.id, input.variantId), eq(products.sellerId, seller.id), isNull(products.deletedAt)));
    if (!variant) throw AppException.notFound('Variant');
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(inventory)
        .set({ quantityOnHand: sql`${inventory.quantityOnHand} + ${input.delta}`, updatedAt: new Date() })
        .where(and(eq(inventory.variantId, input.variantId), sql`${inventory.quantityOnHand} + ${input.delta} >= ${inventory.quantityReserved}`))
        .returning({ onHand: inventory.quantityOnHand, reserved: inventory.quantityReserved });
      if (!row) throw new AppException('CONFLICT', 'api.marketplace.stockBelowReserved', [{ field: 'delta', code: 'below_reserved', message: 'api.marketplace.stockBelowReserved' }]);
      await tx.insert(inventoryMovements).values({ variantId: input.variantId, reason: input.reason, onHandDelta: input.delta, note: input.note ?? null, actorId: userId });
      await this.refreshAll(tx, [variant.productId], variant.bookId ? [variant.bookId] : [], [], [seller.id]);
      return { variantId: input.variantId, onHand: row.onHand, reserved: row.reserved, available: row.onHand - row.reserved };
    });
  }

  async movements(userId: string, variantId: string) {
    const seller = await this.sellers.requireSeller(userId);
    return this.db
      .select({ id: inventoryMovements.id, reason: inventoryMovements.reason, onHandDelta: inventoryMovements.onHandDelta, reservedDelta: inventoryMovements.reservedDelta, note: inventoryMovements.note, createdAt: inventoryMovements.createdAt })
      .from(inventoryMovements)
      .innerJoin(productVariants, eq(productVariants.id, inventoryMovements.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(inventoryMovements.variantId, variantId), eq(products.sellerId, seller.id)))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(100);
  }

  // ------------------------------------------------------------------ internals

  private async owned(userId: string, productId: string): Promise<{ product: typeof products.$inferSelect; seller: SellerRow }> {
    const seller = await this.sellers.requireSeller(userId);
    const [product] = await this.db.select().from(products).where(and(eq(products.id, productId), eq(products.sellerId, seller.id), isNull(products.deletedAt)));
    // Another seller's listing looks exactly like a missing one.
    if (!product) throw AppException.notFound('Product');
    return { product, seller };
  }

  private async createVariants(tx: DbOrTx, productId: string, variants: Array<{ name: string; options: Record<string, string>; sku?: string; price: string; compareAtPrice?: string; stock: number; weightGrams?: number }>, actorId: string) {
    const rows = await tx
      .insert(productVariants)
      .values(variants.map((v, position) => ({ productId, sku: v.sku ?? sku(), name: v.name, options: v.options, price: v.price, compareAtPrice: v.compareAtPrice ?? null, weightGrams: v.weightGrams ?? null, isDefault: position === 0, position })))
      .returning({ id: productVariants.id });
    await tx.insert(inventory).values(rows.map((r, i) => ({ variantId: r.id, quantityOnHand: variants[i]!.stock })));
    const opening = rows.map((r, i) => ({ variantId: r.id, reason: 'initial' as const, onHandDelta: variants[i]!.stock, actorId })).filter((m) => m.onHandDelta > 0);
    if (opening.length) await tx.insert(inventoryMovements).values(opening);
  }

  private async createBook(tx: DbOrTx, data: NonNullable<BookListing['book']>, isbn: string | undefined, userId: string): Promise<string> {
    await this.assertCategory(tx, data.categoryId, 'book');
    const authorIds = [...data.authorIds];
    if (authorIds.length) {
      const found = await tx.select({ id: authors.id }).from(authors).where(inArray(authors.id, authorIds));
      if (found.length !== authorIds.length) throw AppException.validation([{ field: 'book.authorIds', code: 'unknown', message: 'errors.notFound' }]);
    }
    for (const name of data.authorNames) authorIds.push(await this.findOrCreateAuthor(tx, name));
    const translatorIds: string[] = [];
    for (const name of data.translatorNames) translatorIds.push(await this.findOrCreateAuthor(tx, name));
    let publisherId = data.publisherId;
    if (!publisherId && data.publisherName) {
      const [existing] = await tx.select({ id: publishers.id }).from(publishers).where(sql`lower(${publishers.name}) = lower(${data.publisherName})`);
      publisherId = existing?.id ?? (await tx.insert(publishers).values({ name: data.publisherName, slug: await uniqueSlug(tx, 'publishers', data.publisherName) }).returning({ id: publishers.id }))[0]!.id;
    }
    const people = authorIds.length ? await tx.select({ name: authors.name, nameAlt: authors.nameAlt }).from(authors).where(inArray(authors.id, [...authorIds, ...translatorIds])) : [];
    const [publisher] = publisherId ? await tx.select({ name: publishers.name }).from(publishers).where(eq(publishers.id, publisherId)) : [];
    const [book] = await tx
      .insert(books)
      .values({
        slug: await uniqueSlug(tx, 'books', data.title),
        title: data.title,
        subtitle: data.subtitle || null,
        originalTitle: data.originalTitle || null,
        description: data.description || null,
        language: data.language,
        primaryCategoryId: data.categoryId,
        ageGroup: data.ageGroup ?? null,
        academicLevel: data.academicLevel ?? null,
        seriesName: data.seriesName ?? null,
        seriesNumber: data.seriesNumber ?? null,
        firstPublishedYear: data.firstPublishedYear ?? null,
        searchText: buildSearchText([...people.flatMap((p) => [p.name, p.nameAlt]), publisher?.name, isbn, data.seriesName]),
        createdBy: userId,
      })
      .returning({ id: books.id });
    const bookId = book!.id;
    if (authorIds.length) await tx.insert(bookAuthors).values(authorIds.map((authorId, position) => ({ bookId, authorId, role: 'author', position }))).onConflictDoNothing();
    if (translatorIds.length) await tx.insert(bookAuthors).values(translatorIds.map((authorId, position) => ({ bookId, authorId, role: 'translator', position }))).onConflictDoNothing();
    if (publisherId) await tx.insert(bookPublishers).values({ bookId, publisherId });
    await tx.insert(bookCategories).values({ bookId, categoryId: data.categoryId });
    if (data.genres.length) {
      const genreRows = await tx.select({ id: genres.id }).from(genres).where(inArray(genres.key, data.genres));
      if (genreRows.length) await tx.insert(bookGenres).values(genreRows.map((g) => ({ bookId, genreId: g.id })));
    }
    return bookId;
  }

  private async findOrCreateFormat(tx: DbOrTx, bookId: string, input: BookListing): Promise<string> {
    if (!input.isbn) {
      const [existing] = await tx
        .select({ id: bookFormats.id })
        .from(bookFormats)
        .where(and(eq(bookFormats.bookId, bookId), eq(bookFormats.format, input.format.format), isNull(bookFormats.isbn13), input.format.edition ? eq(bookFormats.edition, input.format.edition) : isNull(bookFormats.edition)));
      if (existing) return existing.id;
    }
    const [publisher] = await tx.select({ publisherId: bookPublishers.publisherId }).from(bookPublishers).where(eq(bookPublishers.bookId, bookId)).limit(1);
    const [format] = await tx
      .insert(bookFormats)
      .values({
        bookId,
        format: input.format.format,
        isbn13: input.isbn ?? null,
        edition: input.format.edition ?? null,
        publicationYear: input.format.publicationYear ?? null,
        pages: input.format.pages ?? null,
        weightGrams: input.format.weightGrams ?? null,
        publisherId: publisher?.publisherId ?? null,
      })
      .returning({ id: bookFormats.id });
    if (input.isbn) await tx.update(books).set({ searchText: sql`trim(${books.searchText} || ' ' || ${input.isbn})` }).where(eq(books.id, bookId));
    return format!.id;
  }

  private async findOrCreateAuthor(tx: DbOrTx, name: string): Promise<string> {
    const [existing] = await tx.select({ id: authors.id }).from(authors).where(sql`lower(${authors.name}) = lower(${name}) or lower(${authors.nameAlt}) = lower(${name})`).limit(1);
    if (existing) return existing.id;
    const [created] = await tx.insert(authors).values({ name, slug: await uniqueSlug(tx, 'authors', name) }).returning({ id: authors.id });
    return created!.id;
  }

  private async assertCategory(tx: DbOrTx, categoryId: string, kind: 'book' | 'general'): Promise<void> {
    const [category] = await tx.select({ appliesTo: categories.appliesTo }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.isActive, true)));
    if (!category || (category.appliesTo !== kind && category.appliesTo !== 'both')) {
      throw AppException.validation([{ field: kind === 'book' ? 'book.categoryId' : 'categoryId', code: 'invalid', message: 'api.marketplace.categoryInvalid' }]);
    }
  }

  private async refreshAll(tx: DbOrTx, productIds: string[], bookIds: string[], authorIds: string[], sellerIds: string[]) {
    await refreshProductStock(tx, productIds);
    await refreshBookOffers(tx, bookIds);
    if (bookIds.length && !authorIds.length) {
      const rows = await tx.select({ id: bookAuthors.authorId }).from(bookAuthors).where(inArray(bookAuthors.bookId, bookIds));
      authorIds = rows.map((r) => r.id);
    }
    await refreshAuthorBookCounts(tx, authorIds);
    await refreshStoreProductCounts(tx, sellerIds);
  }
}
