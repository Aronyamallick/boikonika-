import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  bookFormats,
  bookPreviews,
  books,
  buildSearchText,
  digitalAssets,
  downloads,
  inventory,
  ownershipDeclarations,
  products,
  productVariants,
  readingHistory,
  refreshBookOffers,
  refreshProductStock,
  refreshStoreProductCounts,
  userLibrary,
  type Database,
  type DbOrTx,
} from '@boikonika/database';
import {
  DEFAULT_PREVIEW_PERCENT,
  DOWNLOAD_LINK_TTL,
  MAX_PREVIEWS_PER_BOOK,
  MAX_SAMPLE_PAGES,
  PREVIEW_PERCENT_CEILING,
  type DigitalCapacity,
  type digitalOfferSchema,
  type digitalUploadSchema,
  type sampleChapterSchema,
} from '@boikonika/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { AuditService } from '../audit/audit.service';
import { SellersService, uniqueSlug } from '../marketplace/sellers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { buildSamplePdf, inspectEbook, samplePageCount } from './ebook-files';

type Row = Record<string, unknown>;
type Asset = typeof digitalAssets.$inferSelect;

const STATEMENTS: Record<DigitalCapacity, string> = {
  author: 'I am the author of this book and hold the digital rights to publish this file.',
  publisher: 'I am the publisher of this book and hold the digital rights to publish this file.',
  licensed_distributor: 'I am licensed by the rights holder to distribute this book in digital form.',
};
/** Preview images and sample PDFs are handed out through links this short-lived (seconds). */
const PREVIEW_LINK_TTL = 1800;
const sku = () => `EB-${randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, 'X').toUpperCase()}`;
/** A download name readers recognise: the book's own title (Bangla kept), safe for every OS. */
const downloadName = (title: string, extension: string) => `${title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'book'}.${extension}`;
const extensionOf = (mime: string) => (mime === 'application/pdf' ? 'pdf' : 'epub');
/** Plain-ASCII download name for clients that ignore the exact (Bangla) one: the slug when it is ASCII. */
const asciiName = (slug: string, ext: string) => `${/^[a-z0-9-]+$/i.test(slug) ? slug : 'ebook'}.${ext}`;

/**
 * Digital editions. Only a book's verified author or verified publisher may upload its e-book, with a
 * rights declaration on record; files sit in private storage and leave it only through short-lived
 * signed links after an entitlement check (bought, free, or rights holder), each download logged.
 */
@Injectable()
export class DigitalService {
  private readonly logger = new Logger('Digital');

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly sellers: SellersService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ rights

  /** In what capacity this user holds a book's rights: as its linked author, or as its verified publisher. */
  async rightsFor(userId: string, bookId: string, tx: DbOrTx = this.db): Promise<{ author: boolean; publisherId: string | null }> {
    const [row] = await tx
      .execute<{ author: boolean; publisher_id: string | null }>(sql`
        select exists(select 1 from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = ${bookId} and a.user_id = ${userId}) as author,
          (select p.id from publishers p where p.owner_id = ${userId} and p.is_verified
             and (exists(select 1 from book_publishers bp where bp.book_id = ${bookId} and bp.publisher_id = p.id)
               or exists(select 1 from book_formats f where f.book_id = ${bookId} and f.publisher_id = p.id))
           limit 1) as publisher_id`)
      .then((r) => r.rows);
    return { author: row?.author === true, publisherId: row?.publisher_id ?? null };
  }

  private async requireRights(userId: string, bookId: string, capacity?: DigitalCapacity, tx: DbOrTx = this.db) {
    const rights = await this.rightsFor(userId, bookId, tx);
    if (!rights.author && !rights.publisherId) throw AppException.forbidden('api.digital.notRightsHolder');
    if ((capacity === 'author' && !rights.author) || (capacity === 'publisher' && !rights.publisherId)) {
      throw AppException.validation([{ field: 'capacity', code: 'mismatch', message: 'api.digital.capacityMismatch' }]);
    }
    return rights;
  }

  private async requireBook(bookId: string, tx: DbOrTx = this.db) {
    const [book] = await tx.select({ id: books.id, slug: books.slug, title: books.title, isFree: books.isFree }).from(books).where(and(eq(books.id, bookId), eq(books.status, 'published'), sql`${books.deletedAt} is null`));
    if (!book) throw AppException.notFound('Book');
    return book;
  }

  /** The file readers get: the newest one that is neither replaced nor taken down. */
  private async currentAsset(bookId: string, tx: DbOrTx = this.db, statuses: Asset['status'][] = ['active', 'withdrawn']): Promise<Asset | null> {
    const [asset] = await tx
      .select({ asset: digitalAssets })
      .from(digitalAssets)
      .innerJoin(bookFormats, eq(bookFormats.id, digitalAssets.bookFormatId))
      .where(and(eq(bookFormats.bookId, bookId), eq(bookFormats.format, 'digital'), inArray(digitalAssets.status, statuses)))
      .orderBy(sql`${digitalAssets.createdAt} desc`)
      .limit(1);
    return asset?.asset ?? null;
  }

  private async previewCeiling(): Promise<number> {
    return Math.min(PREVIEW_PERCENT_CEILING, Math.max(1, await this.settings.number('preview.maxPercent', 20)));
  }

  // ------------------------------------------------------------------ studio (rights holders)

  /** Books this user can publish digitally, with each one's file, offer, samples and reach. */
  async studio(userId: string, bookId?: string) {
    const rows = await this.db.execute<Row>(sql`
      with mine as (
        select b.id,
          exists(select 1 from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id and a.user_id = ${userId}) as as_author,
          exists(select 1 from publishers p where p.owner_id = ${userId} and p.is_verified
            and (exists(select 1 from book_publishers bp where bp.book_id = b.id and bp.publisher_id = p.id)
              or exists(select 1 from book_formats f where f.book_id = b.id and f.publisher_id = p.id))) as as_publisher
        from books b where b.status = 'published' and b.deleted_at is null ${bookId ? sql`and b.id = ${bookId}` : sql``}
      )
      select b.id, b.slug, b.title, b.cover_key, b.is_free, m.as_author, m.as_publisher,
        x.id as asset_id, x.file_name, x.mime_type, x.size_bytes, x.page_count, x.status as asset_status, x.removed_reason, x.created_at as uploaded_at,
        p.id as product_id, p.slug as product_slug, p.status as product_status, p.price, p.compare_at_price, p.sales_count,
        (select se.user_id from products op join sellers se on se.id = op.seller_id
          where op.book_id = b.id and op.is_digital and op.status = 'active' and op.deleted_at is null and se.user_id <> ${userId} limit 1) is not null as offered_by_other,
        (select count(*)::int from downloads d join digital_assets dx on dx.id = d.digital_asset_id join book_formats df on df.id = dx.book_format_id where df.book_id = b.id) as downloads,
        (select count(*)::int from user_library l where l.book_id = b.id and l.has_digital_access) as readers,
        coalesce((select json_agg(json_build_object('id', bp.id, 'kind', bp.kind, 'title', bp.title, 'previewPercent', bp.preview_percent, 'pages', coalesce(array_length(bp.storage_keys, 1), 0), 'chars', coalesce(length(bp.content), 0)) order by bp.position, bp.created_at)
          from book_previews bp where bp.book_id = b.id), '[]') as previews
      from mine m join books b on b.id = m.id
      left join lateral (
        select dx.* from digital_assets dx join book_formats df on df.id = dx.book_format_id
        where df.book_id = b.id and df.format = 'digital' and dx.status <> 'replaced' order by dx.created_at desc limit 1
      ) x on true
      left join lateral (
        select op.* from products op join sellers se on se.id = op.seller_id
        where op.book_id = b.id and op.is_digital and op.deleted_at is null and se.user_id = ${userId} order by op.created_at desc limit 1
      ) p on true
      where m.as_author or m.as_publisher
      order by x.created_at desc nulls last, b.title limit 200`);
    const editions = rows.rows.map((r) => {
      const asset = r.asset_id
        ? {
            id: r.asset_id as string,
            fileName: r.file_name as string,
            format: extensionOf(r.mime_type as string),
            sizeBytes: Number(r.size_bytes),
            pageCount: r.page_count === null ? null : Number(r.page_count),
            status: r.asset_status as Asset['status'],
            removedReason: (r.removed_reason as string | null) ?? null,
            uploadedAt: new Date(r.uploaded_at as string).toISOString(),
          }
        : null;
      const productActive = r.product_status === 'active' || r.product_status === 'pending_review';
      const onSale = asset?.status === 'active' && (r.is_free === true || productActive);
      return {
        book: { id: r.id as string, slug: r.slug as string, title: r.title as string, coverUrl: this.storage.publicUrl(r.cover_key as string | null) },
        capacities: [...(r.as_author ? (['author'] as const) : []), ...(r.as_publisher ? (['publisher'] as const) : [])],
        asset,
        offer: asset?.status === 'active' && r.is_free === true ? { mode: 'free' as const } : r.product_id && productActive ? { mode: 'paid' as const, price: r.price as string, compareAtPrice: (r.compare_at_price as string | null) ?? null, status: r.product_status as string, productSlug: r.product_slug as string } : null,
        lastPrice: (r.price as string | null) ?? null,
        onSale,
        offeredByOther: r.offered_by_other === true,
        sales: Number(r.sales_count ?? 0),
        downloads: Number(r.downloads ?? 0),
        readers: Number(r.readers ?? 0),
        previews: (r.previews as Array<{ id: string; kind: string; title: string | null; previewPercent: number; pages: number; chars: number }>).map((p) => ({
          ...p,
          samplePages: p.kind === 'pdf' && asset?.pageCount ? samplePageCount(asset.pageCount, p.previewPercent) : null,
        })),
      };
    });
    const [seller] = await this.db.execute<{ status: string }>(sql`select status from sellers where user_id = ${userId}`).then((r) => r.rows);
    return { editions, canSell: seller?.status === 'active', previewMaxPercent: await this.previewCeiling() };
  }

  private async edition(userId: string, bookId: string) {
    const { editions } = await this.studio(userId, bookId);
    if (!editions[0]) throw AppException.notFound('Book');
    return editions[0];
  }

  async upload(userId: string, bookId: string, file: Buffer, input: z.output<typeof digitalUploadSchema>, ip?: string) {
    const book = await this.requireBook(bookId);
    const rights = await this.requireRights(userId, bookId, input.capacity === 'licensed_distributor' ? undefined : input.capacity);
    const info = await inspectEbook(file);
    // A file already published for another book, or taken down after a complaint, cannot come back here.
    const [seen] = await this.db
      .execute<{ status: string; book_id: string }>(sql`
        select x.status, f.book_id from digital_assets x join book_formats f on f.id = x.book_format_id
        where x.sha256 = ${info.sha256} and (x.status = 'removed' or f.book_id <> ${bookId}) order by x.status = 'removed' desc limit 1`)
      .then((r) => r.rows);
    if (seen) throw new AppException('CONFLICT', seen.status === 'removed' ? 'api.digital.fileTakenDown' : 'api.digital.fileElsewhere');

    const assetId = randomUUID();
    const key = `ebooks/${bookId}/${assetId}.${info.extension}`;
    await this.storage.put('private', key, file, info.type);
    let replaced: Asset[] = [];
    try {
      replaced = await this.db.transaction(async (tx) => {
        // One upload per book at a time.
        await tx.execute(sql`select id from books where id = ${bookId} for update`);
        const [removed] = await tx
          .select({ id: digitalAssets.id })
          .from(digitalAssets)
          .innerJoin(bookFormats, eq(bookFormats.id, digitalAssets.bookFormatId))
          .where(and(eq(bookFormats.bookId, bookId), eq(digitalAssets.status, 'removed')))
          .limit(1);
        if (removed) throw new AppException('CONFLICT', 'api.digital.underTakedown');
        let [format] = await tx.select({ id: bookFormats.id, pages: bookFormats.pages }).from(bookFormats).where(and(eq(bookFormats.bookId, bookId), eq(bookFormats.format, 'digital'))).orderBy(bookFormats.createdAt).limit(1);
        if (!format) {
          [format] = await tx
            .insert(bookFormats)
            .values({ bookId, format: 'digital', publisherId: rights.publisherId, pages: info.pageCount })
            .returning({ id: bookFormats.id, pages: bookFormats.pages });
        } else if (info.pageCount && !format.pages) {
          await tx.update(bookFormats).set({ pages: info.pageCount }).where(eq(bookFormats.id, format.id));
        }
        const previous = await tx
          .update(digitalAssets)
          .set({ status: 'replaced', updatedAt: new Date() })
          .where(and(eq(digitalAssets.bookFormatId, format!.id), inArray(digitalAssets.status, ['active', 'withdrawn'])))
          .returning();
        const now = new Date();
        await tx.insert(digitalAssets).values({
          id: assetId,
          bookFormatId: format!.id,
          storageKey: key,
          fileName: downloadName(book.title, info.extension),
          mimeType: info.type,
          sizeBytes: file.length,
          sha256: info.sha256,
          pageCount: info.pageCount,
          status: 'active',
          uploadedBy: userId,
          rightsDeclaredAt: now,
        });
        await tx.insert(ownershipDeclarations).values({ userId, subjectType: 'digital_asset', subjectId: assetId, capacity: input.capacity, statement: STATEMENTS[input.capacity], ip: ip?.slice(0, 45) ?? null });
        await this.audit.record({ action: 'digital.upload', entityType: 'digital_asset', entityId: assetId, actorId: userId, after: { bookId, sha256: info.sha256, sizeBytes: file.length, type: info.type, replaced: previous.map((p) => p.id) } }, tx);
        return previous;
      });
    } catch (error) {
      await this.storage.delete('private', key);
      throw error;
    }
    // Replaced files are kept on record but no longer stored.
    for (const old of replaced) await this.storage.delete('private', old.storageKey);
    if (info.extension === 'pdf') await this.refreshPdfSample(bookId, book.title, { source: file, actorId: userId }).catch((e) => this.logger.warn(`Sample for ${bookId} failed: ${(e as Error).message}`));
    else await this.dropPdfSample(bookId);
    return this.edition(userId, bookId);
  }

  /** Free for everyone, or sold through the rights holder's own store at their price. */
  async setOffer(userId: string, bookId: string, input: z.output<typeof digitalOfferSchema>) {
    const book = await this.requireBook(bookId);
    const rights = await this.requireRights(userId, bookId);
    const asset = await this.currentAsset(bookId);
    if (!asset) throw AppException.badRequest('api.digital.uploadFirst');
    const seller = input.free ? null : await this.sellers.requireSeller(userId);
    const review = !input.free && (await this.settings.get<boolean>('marketplace.requireListingReview', false));

    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select id from books where id = ${bookId} for update`);
      const [other] = await tx.execute(sql`
        select 1 from products op join sellers se on se.id = op.seller_id
        where op.book_id = ${bookId} and op.is_digital and op.status in ('active', 'pending_review') and op.deleted_at is null and se.user_id <> ${userId} limit 1`).then((r) => r.rows);
      if (other) throw new AppException('CONFLICT', 'api.digital.offeredByOther');
      if (asset.status === 'withdrawn') await tx.update(digitalAssets).set({ status: 'active', updatedAt: new Date() }).where(eq(digitalAssets.id, asset.id));
      const [existing] = await tx.execute<{ id: string; seller_id: string }>(sql`
        select op.id, op.seller_id from products op join sellers se on se.id = op.seller_id
        where op.book_id = ${bookId} and op.is_digital and op.deleted_at is null and se.user_id = ${userId} order by op.created_at desc limit 1`).then((r) => r.rows);

      if (input.free) {
        await tx.update(books).set({ isFree: true, updatedAt: new Date() }).where(eq(books.id, bookId));
        if (existing) await tx.update(products).set({ status: 'archived', updatedAt: new Date() }).where(eq(products.id, existing.id));
      } else {
        await tx.update(books).set({ isFree: false, updatedAt: new Date() }).where(eq(books.id, bookId));
        const status = review ? 'pending_review' : 'active';
        if (existing) {
          await tx.update(products).set({ status, price: input.price!, compareAtPrice: input.compareAtPrice ?? null, publishedAt: status === 'active' ? sql`coalesce(${products.publishedAt}, now())` : undefined, updatedAt: new Date() }).where(eq(products.id, existing.id));
          await tx.update(productVariants).set({ price: input.price!, compareAtPrice: input.compareAtPrice ?? null, isActive: true }).where(eq(productVariants.productId, existing.id));
        } else {
          const [meta] = await tx.execute<{ description: string | null; category_id: string | null; subtitle: string | null; names: string[] | null }>(sql`
            select b.description, b.primary_category_id as category_id, b.subtitle,
              (select array_agg(x) from (select a.name as x from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id
                union all select a.name_alt from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id and a.name_alt is not null) n) as names
            from books b where b.id = ${bookId}`).then((r) => r.rows);
          const [format] = await tx.select({ id: bookFormats.id }).from(bookFormats).where(eq(bookFormats.id, asset.bookFormatId));
          const [product] = await tx
            .insert(products)
            .values({
              sellerId: seller!.id,
              type: 'book',
              bookId,
              bookFormatId: format!.id,
              condition: 'new',
              title: book.title,
              slug: await uniqueSlug(tx, 'products', `${book.title} ebook`),
              description: meta?.description ?? null,
              categoryId: meta?.category_id ?? null,
              status,
              price: input.price!,
              compareAtPrice: input.compareAtPrice ?? null,
              isDigital: true,
              searchText: buildSearchText([book.title, meta?.subtitle, ...(meta?.names ?? []), 'ebook ই-বুক']),
              publishedAt: status === 'active' ? new Date() : null,
            })
            .returning({ id: products.id });
          const [variant] = await tx
            .insert(productVariants)
            .values({ productId: product!.id, sku: sku(), name: 'E-book', options: { format: extensionOf(asset.mimeType).toUpperCase() }, price: input.price!, compareAtPrice: input.compareAtPrice ?? null, isDefault: true, position: 0 })
            .returning({ id: productVariants.id });
          // Copies of a file never run out.
          await tx.insert(inventory).values({ variantId: variant!.id, quantityOnHand: 0, trackInventory: false });
          await tx.insert(ownershipDeclarations).values({ userId, subjectType: 'product', subjectId: product!.id, capacity: rights.publisherId && !rights.author ? 'publisher' : 'author', statement: STATEMENTS[rights.publisherId && !rights.author ? 'publisher' : 'author'] });
        }
      }
      const productIds = (await tx.execute<{ id: string }>(sql`select id from products where book_id = ${bookId} and is_digital`)).rows.map((r) => r.id);
      await refreshProductStock(tx, productIds);
      await refreshBookOffers(tx, [bookId]);
      if (seller) await refreshStoreProductCounts(tx, [seller.id]);
      await this.audit.record({ action: 'digital.offer', entityType: 'book', entityId: bookId, actorId: userId, after: { free: input.free, price: input.price ?? null } }, tx);
    });
    return this.edition(userId, bookId);
  }

  /** Stops offering the e-book. Readers who already have it keep access to the file. */
  async withdraw(userId: string, bookId: string) {
    await this.requireBook(bookId);
    await this.requireRights(userId, bookId);
    await this.db.transaction(async (tx) => {
      const asset = await this.currentAsset(bookId, tx, ['active']);
      if (asset) await tx.update(digitalAssets).set({ status: 'withdrawn', updatedAt: new Date() }).where(eq(digitalAssets.id, asset.id));
      await this.stopSelling(tx, bookId, userId);
      await this.audit.record({ action: 'digital.withdraw', entityType: 'book', entityId: bookId, actorId: userId }, tx);
    });
    return this.edition(userId, bookId);
  }

  /** Takes the e-book off sale: free flag cleared, digital listings archived (only `onlyUserId`'s when given). */
  private async stopSelling(tx: DbOrTx, bookId: string, onlyUserId?: string) {
    await tx.update(books).set({ isFree: false, updatedAt: new Date() }).where(eq(books.id, bookId));
    const archived = await tx.execute<{ id: string; seller_id: string }>(sql`
      update products op set status = 'archived', updated_at = now() from sellers se
      where se.id = op.seller_id and op.book_id = ${bookId} and op.is_digital and op.status in ('active', 'pending_review', 'draft')
        ${onlyUserId ? sql`and se.user_id = ${onlyUserId}` : sql``}
      returning op.id, op.seller_id`);
    await refreshProductStock(tx, archived.rows.map((r) => r.id));
    await refreshBookOffers(tx, [bookId]);
    await refreshStoreProductCounts(tx, [...new Set(archived.rows.map((r) => r.seller_id))]);
  }

  // ------------------------------------------------------------------ samples ("look inside")

  async setPreviewPercent(userId: string, bookId: string, percent: number) {
    const book = await this.requireBook(bookId);
    await this.requireRights(userId, bookId);
    const max = await this.previewCeiling();
    if (percent > max) throw AppException.validation([{ field: 'previewPercent', code: 'too_long', message: 'validation.previewTooLong' }]).withParams({ max });
    const asset = await this.currentAsset(bookId);
    if (!asset || asset.mimeType !== 'application/pdf') throw AppException.badRequest('api.digital.pdfOnlySample');
    await this.refreshPdfSample(bookId, book.title, { percent, actorId: userId });
    return this.edition(userId, bookId);
  }

  /** (Re)builds the free sample PDF from the start of the current PDF file. */
  private async refreshPdfSample(bookId: string, title: string, options: { source?: Buffer; percent?: number; actorId?: string }) {
    const asset = await this.currentAsset(bookId);
    if (!asset || asset.mimeType !== 'application/pdf') return this.dropPdfSample(bookId);
    const [existing] = await this.db.select().from(bookPreviews).where(and(eq(bookPreviews.bookId, bookId), eq(bookPreviews.kind, 'pdf')));
    const percent = Math.min(options.percent ?? existing?.previewPercent ?? DEFAULT_PREVIEW_PERCENT, await this.previewCeiling());
    const source = options.source ?? (await this.storage.read('private', asset.storageKey))?.body;
    if (!source) return;
    const sample = await buildSamplePdf(source, percent, title);
    const key = `previews/${bookId}/${randomUUID()}.pdf`;
    await this.storage.put('private', key, sample.body, 'application/pdf');
    if (existing) await this.db.update(bookPreviews).set({ storageKeys: [key], previewPercent: percent }).where(eq(bookPreviews.id, existing.id));
    else await this.db.insert(bookPreviews).values({ bookId, kind: 'pdf', storageKeys: [key], previewPercent: percent, position: -1, uploadedBy: options.actorId ?? null });
    for (const old of existing?.storageKeys ?? []) await this.storage.delete('private', old);
  }

  private async dropPdfSample(bookId: string) {
    const removed = await this.db.delete(bookPreviews).where(and(eq(bookPreviews.bookId, bookId), eq(bookPreviews.kind, 'pdf'))).returning();
    for (const key of removed.flatMap((p) => p.storageKeys ?? [])) await this.storage.delete('private', key);
  }

  private async assertRoomForPreview(bookId: string) {
    const [{ n } = { n: 0 }] = await this.db.execute<{ n: number }>(sql`select count(*)::int as n from book_previews where book_id = ${bookId}`).then((r) => r.rows);
    if (n >= MAX_PREVIEWS_PER_BOOK) throw AppException.badRequest('api.digital.tooManySamples');
  }

  async addChapter(userId: string, bookId: string, input: z.output<typeof sampleChapterSchema>) {
    await this.requireBook(bookId);
    const rights = await this.requireRights(userId, bookId);
    await this.assertRoomForPreview(bookId);
    await this.db.transaction(async (tx) => {
      const [preview] = await tx
        .insert(bookPreviews)
        .values({ bookId, kind: 'sample_chapter', title: input.title, content: input.content, position: sql`(select coalesce(max(position), 0) + 1 from book_previews where book_id = ${bookId})`, uploadedBy: userId })
        .returning({ id: bookPreviews.id });
      await tx.insert(ownershipDeclarations).values({ userId, subjectType: 'preview', subjectId: preview!.id, capacity: rights.author ? 'author' : 'publisher', statement: STATEMENTS[rights.author ? 'author' : 'publisher'] });
    });
    return this.edition(userId, bookId);
  }

  async addPages(userId: string, bookId: string, files: Buffer[], title?: string) {
    await this.requireBook(bookId);
    const rights = await this.requireRights(userId, bookId);
    if (!files.length) throw AppException.validation([{ field: 'pages', code: 'required', message: 'validation.required' }]);
    if (files.length > MAX_SAMPLE_PAGES) throw AppException.validation([{ field: 'pages', code: 'too_many', message: 'validation.tooManyPages' }]).withParams({ max: MAX_SAMPLE_PAGES });
    await this.assertRoomForPreview(bookId);
    const processed = await Promise.all(files.map((f) => processUpload(f, { allowed: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 8 * 1024 * 1024, image: { maxWidth: 1400, maxHeight: 2000, format: 'webp', quality: 82 } })));
    const keys = processed.map(() => `previews/${bookId}/${randomUUID()}.webp`);
    await Promise.all(processed.map((p, i) => this.storage.put('private', keys[i]!, p.body, p.contentType)));
    try {
      await this.db.transaction(async (tx) => {
        const [preview] = await tx
          .insert(bookPreviews)
          .values({ bookId, kind: 'sample_pages', title: title?.trim().slice(0, 200) || null, storageKeys: keys, position: sql`(select coalesce(max(position), 0) + 1 from book_previews where book_id = ${bookId})`, uploadedBy: userId })
          .returning({ id: bookPreviews.id });
        await tx.insert(ownershipDeclarations).values({ userId, subjectType: 'preview', subjectId: preview!.id, capacity: rights.author ? 'author' : 'publisher', statement: STATEMENTS[rights.author ? 'author' : 'publisher'] });
      });
    } catch (error) {
      await Promise.all(keys.map((k) => this.storage.delete('private', k)));
      throw error;
    }
    return this.edition(userId, bookId);
  }

  async removePreview(userId: string, previewId: string) {
    const [preview] = await this.db.select().from(bookPreviews).where(eq(bookPreviews.id, previewId));
    if (!preview) throw AppException.notFound('Preview');
    await this.requireRights(userId, preview.bookId);
    await this.db.delete(bookPreviews).where(eq(bookPreviews.id, previewId));
    for (const key of preview.storageKeys ?? []) await this.storage.delete('private', key);
    return this.edition(userId, preview.bookId);
  }

  /** The rights holder's own copy of the current file (also after a withdrawal). */
  async ownFile(userId: string, bookId: string) {
    const book = await this.requireBook(bookId);
    await this.requireRights(userId, bookId);
    const asset = await this.currentAsset(bookId);
    if (!asset) throw AppException.notFound('File');
    return { url: await this.storage.signedUrl(asset.storageKey, DOWNLOAD_LINK_TTL, asset.fileName, true, asciiName(book.slug, extensionOf(asset.mimeType))), fileName: asset.fileName };
  }

  // ------------------------------------------------------------------ readers

  /** Adds a free e-book to my library with access to the file. */
  async claimFree(userId: string, bookId: string) {
    const book = await this.requireBook(bookId);
    const asset = await this.currentAsset(bookId, this.db, ['active']);
    if (!book.isFree || !asset) throw AppException.badRequest('api.digital.notFree');
    await this.grantFree(this.db, userId, bookId);
    return { hasDigitalAccess: true };
  }

  private async grantFree(tx: DbOrTx, userId: string, bookId: string) {
    await tx
      .insert(userLibrary)
      .values({ userId, bookId, shelf: 'owned', source: 'free', hasDigitalAccess: true })
      .onConflictDoUpdate({ target: [userLibrary.userId, userLibrary.bookId], set: { hasDigitalAccess: true, updatedAt: new Date() } });
  }

  /**
   * A short-lived link to the e-book for someone entitled to it: bought, claimed free, or the rights
   * holder. Each download is logged and capped per day.
   */
  async download(userId: string, bookId: string, meta: { ip?: string; userAgent?: string }) {
    const book = await this.requireBook(bookId);
    const asset = await this.currentAsset(bookId);
    if (!asset) throw new AppException('NOT_FOUND', 'api.digital.noFile');
    const [entry] = await this.db.select({ access: userLibrary.hasDigitalAccess }).from(userLibrary).where(and(eq(userLibrary.userId, userId), eq(userLibrary.bookId, bookId)));
    let entitled = entry?.access === true;
    if (!entitled && book.isFree && asset.status === 'active') {
      await this.grantFree(this.db, userId, bookId);
      entitled = true;
    }
    if (!entitled) {
      const rights = await this.rightsFor(userId, bookId);
      entitled = rights.author || !!rights.publisherId;
    }
    if (!entitled) throw AppException.forbidden('api.digital.notEntitled');

    const perDay = await this.settings.number('digital.downloadsPerDay', 10);
    const [{ recent } = { recent: 0 }] = await this.db
      .execute<{ recent: number }>(sql`select count(*)::int as recent from downloads where user_id = ${userId} and digital_asset_id = ${asset.id} and created_at > now() - interval '24 hours'`)
      .then((r) => r.rows);
    if (recent >= perDay) throw new AppException('RATE_LIMITED', 'api.digital.downloadLimit').withParams({ count: perDay });

    await this.db.transaction(async (tx) => {
      await tx.insert(downloads).values({ userId, digitalAssetId: asset.id, ip: meta.ip?.slice(0, 45) ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null });
      await tx.insert(readingHistory).values({ userId, bookId, event: 'downloaded', detail: { format: extensionOf(asset.mimeType) } });
    });
    return {
      url: await this.storage.signedUrl(asset.storageKey, DOWNLOAD_LINK_TTL, asset.fileName, true, asciiName(book.slug, extensionOf(asset.mimeType))),
      expiresAt: new Date(Date.now() + DOWNLOAD_LINK_TTL * 1000).toISOString(),
      fileName: asset.fileName,
      format: extensionOf(asset.mimeType),
      sizeBytes: asset.sizeBytes,
      remainingToday: perDay - recent - 1,
    };
  }

  async downloadHistory(userId: string, page: number, pageSize: number) {
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select d.id, d.created_at, x.file_name, x.mime_type, x.size_bytes, x.status, b.id as book_id, b.slug, b.title, b.cover_key
        from downloads d join digital_assets x on x.id = d.digital_asset_id join book_formats f on f.id = x.book_format_id join books b on b.id = f.book_id
        where d.user_id = ${userId} and b.deleted_at is null order by d.created_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from downloads where user_id = ${userId}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id as string,
        at: new Date(r.created_at as string).toISOString(),
        fileName: r.file_name as string,
        format: extensionOf(r.mime_type as string),
        sizeBytes: Number(r.size_bytes),
        // Replaced files are re-downloaded as the current version; removed ones are gone.
        available: r.status !== 'removed',
        book: { id: r.book_id as string, slug: r.slug as string, title: r.title as string, coverUrl: this.storage.publicUrl(r.cover_key as string | null) },
      })),
      meta: { page, pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  // ------------------------------------------------------------------ public "look inside"

  /** Everything a reader may see before buying: description, contents, sample chapters, pages and PDF. */
  async preview(slug: string) {
    const [book] = await this.db
      .execute<Row>(sql`
        select b.id, b.slug, b.title, b.subtitle, b.cover_key, b.description, b.table_of_contents, b.is_free,
          coalesce((select array_agg(a.name order by ba.position) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id and ba.role = 'author'), '{}') as authors
        from books b where b.slug = ${slug} and b.status = 'published' and b.deleted_at is null`)
      .then((r) => r.rows);
    if (!book) throw AppException.notFound('Book');
    const bookId = book.id as string;
    const [rows, asset] = await Promise.all([this.db.select().from(bookPreviews).where(eq(bookPreviews.bookId, bookId)).orderBy(bookPreviews.position, bookPreviews.createdAt), this.currentAsset(bookId, this.db, ['active'])]);
    const previews = await Promise.all(
      rows
        // The PDF sample follows the file: hidden while the e-book is withdrawn or taken down.
        .filter((p) => p.kind !== 'pdf' || asset?.mimeType === 'application/pdf')
        .map(async (p) => ({
          id: p.id,
          kind: p.kind as 'sample_chapter' | 'sample_pages' | 'pdf',
          title: p.title,
          content: p.kind === 'sample_chapter' ? p.content : null,
          pages: p.kind === 'sample_pages' ? await Promise.all((p.storageKeys ?? []).map((k) => this.storage.signedUrl(k, PREVIEW_LINK_TTL))) : [],
          pdfUrl: p.kind === 'pdf' && p.storageKeys?.[0] ? await this.storage.signedUrl(p.storageKeys[0], PREVIEW_LINK_TTL, `${String(book.title).slice(0, 80)} (sample).pdf`, false, asciiName(`${String(book.slug)}-sample`, 'pdf')) : null,
          samplePages: p.kind === 'pdf' && asset?.pageCount ? samplePageCount(asset.pageCount, p.previewPercent) : null,
          previewPercent: p.previewPercent,
        })),
    );
    return {
      book: {
        id: bookId,
        slug: book.slug as string,
        title: book.title as string,
        subtitle: (book.subtitle as string | null) ?? null,
        coverUrl: this.storage.publicUrl(book.cover_key as string | null),
        description: (book.description as string | null) ?? null,
        authors: (book.authors as string[]) ?? [],
        tableOfContents: (book.table_of_contents as Array<{ title: string; page?: number }> | null) ?? null,
      },
      digital: asset ? { format: extensionOf(asset.mimeType), pageCount: asset.pageCount, sizeBytes: asset.sizeBytes, isFree: book.is_free === true } : null,
      previews,
    };
  }

  // ------------------------------------------------------------------ copyright takedowns (staff)

  async adminList(filter: { status?: string; q?: string; page: number; pageSize: number }) {
    const where = [sql`x.status <> 'replaced'`];
    if (filter.status) where.push(sql`x.status = ${filter.status}`);
    if (filter.q) where.push(sql`b.title ilike ${`%${filter.q.replace(/[%_\\]/g, '')}%`}`);
    const condition = sql.join(where, sql` and `);
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select x.id, x.file_name, x.mime_type, x.size_bytes, x.page_count, x.status, x.removed_reason, x.created_at, x.sha256,
          b.id as book_id, b.slug, b.title, b.cover_key, u.display_name as uploader, u.username,
          (select json_build_object('capacity', od.capacity, 'statement', od.statement, 'at', od.created_at) from ownership_declarations od
            where od.subject_type = 'digital_asset' and od.subject_id = x.id order by od.created_at desc limit 1) as declaration,
          (select count(*)::int from downloads d where d.digital_asset_id = x.id) as downloads
        from digital_assets x join book_formats f on f.id = x.book_format_id join books b on b.id = f.book_id left join users u on u.id = x.uploaded_by
        where ${condition} order by x.created_at desc limit ${filter.pageSize} offset ${(filter.page - 1) * filter.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from digital_assets x join book_formats f on f.id = x.book_format_id join books b on b.id = f.book_id where ${condition}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id as string,
        fileName: r.file_name as string,
        format: extensionOf(r.mime_type as string),
        sizeBytes: Number(r.size_bytes),
        pageCount: r.page_count === null ? null : Number(r.page_count),
        status: r.status as Asset['status'],
        removedReason: (r.removed_reason as string | null) ?? null,
        uploadedAt: new Date(r.created_at as string).toISOString(),
        sha256: r.sha256 as string,
        downloads: Number(r.downloads ?? 0),
        uploader: r.uploader ? { name: r.uploader as string, username: r.username as string | null } : null,
        declaration: r.declaration as { capacity: string; statement: string; at: string } | null,
        book: { id: r.book_id as string, slug: r.slug as string, title: r.title as string, coverUrl: this.storage.publicUrl(r.cover_key as string | null) },
      })),
      meta: { page: filter.page, pageSize: filter.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  /**
   * Takes a file down (e.g. upheld copyright complaint): nobody can download it, sales and the free
   * offer stop, and the sample PDF goes. The file itself is kept privately so a counter-notice can
   * restore it.
   */
  async takedown(actorId: string, assetId: string, reason: string) {
    const asset = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ asset: digitalAssets, bookId: bookFormats.bookId })
        .from(digitalAssets)
        .innerJoin(bookFormats, eq(bookFormats.id, digitalAssets.bookFormatId))
        .where(eq(digitalAssets.id, assetId))
        .for('update');
      if (!row) throw AppException.notFound('File');
      if (row.asset.status === 'removed') throw AppException.conflict('api.digital.alreadyRemoved');
      await tx.update(digitalAssets).set({ status: 'removed', removedReason: reason, updatedAt: new Date() }).where(eq(digitalAssets.id, assetId));
      await this.stopSelling(tx, row.bookId);
      await this.audit.record({ action: 'digital.takedown', entityType: 'digital_asset', entityId: assetId, actorId, before: { status: row.asset.status }, after: { status: 'removed', reason } }, tx);
      return row;
    });
    await this.dropPdfSample(asset.bookId);
    if (asset.asset.uploadedBy) {
      await this.notifications
        .notify(asset.asset.uploadedBy, { type: 'listing', titleKey: 'api.digital.takedownTitle', bodyKey: 'api.digital.takedownBody', params: { reason }, link: '/studio/digital' })
        .catch(() => undefined);
    }
    return { status: 'removed' as const };
  }

  /** Restores a taken-down file (counter-notice accepted). It comes back withdrawn: the rights holder re-offers it. */
  async restore(actorId: string, assetId: string) {
    const [row] = await this.db
      .select({ asset: digitalAssets, bookId: bookFormats.bookId, title: books.title })
      .from(digitalAssets)
      .innerJoin(bookFormats, eq(bookFormats.id, digitalAssets.bookFormatId))
      .innerJoin(books, eq(books.id, bookFormats.bookId))
      .where(eq(digitalAssets.id, assetId));
    if (!row) throw AppException.notFound('File');
    if (row.asset.status !== 'removed') throw AppException.conflict('api.digital.notRemoved');
    await this.db.transaction(async (tx) => {
      await tx.update(digitalAssets).set({ status: 'withdrawn', removedReason: null, updatedAt: new Date() }).where(eq(digitalAssets.id, assetId));
      await this.audit.record({ action: 'digital.restore', entityType: 'digital_asset', entityId: assetId, actorId, before: { status: 'removed' }, after: { status: 'withdrawn' } }, tx);
    });
    if (row.asset.mimeType === 'application/pdf') await this.refreshPdfSample(row.bookId, row.title, { actorId }).catch(() => undefined);
    if (row.asset.uploadedBy) {
      await this.notifications.notify(row.asset.uploadedBy, { type: 'listing', titleKey: 'api.digital.restoredTitle', bodyKey: 'api.digital.restoredBody', params: { title: row.title }, link: '/studio/digital' }).catch(() => undefined);
    }
    return { status: 'withdrawn' as const };
  }
}
