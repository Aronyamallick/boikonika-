import { Inject, Injectable } from '@nestjs/common';
import { authors, bookAuthors, books, products, refreshRatings, reviews, reviewVotes, sellers, users, type Database, type DbOrTx } from '@boikonika/database';
import type { reviewListQuerySchema, reviewSchema, reviewUpdateSchema } from '@boikonika/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { assertNotRestricted } from '../../common/util/restrictions';
import { isUniqueViolation } from '../../common/errors/pg';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';

type Review = typeof reviews.$inferSelect;
type Target = { bookId: string } | { productId: string };

const HOLD_SCORE = 60;
const DAILY_LIMIT = 10;

/**
 * Explainable spam heuristics: each signal adds points; at 60 the review waits for a moderator
 * instead of going live. Verified purchases from established accounts are rarely held.
 */
export function suspicionScore(input: { accountAgeHours: number; verified: boolean; rating: number; title?: string | null; body?: string | null; reviewsToday: number }): number {
  const text = `${input.title ?? ''} ${input.body ?? ''}`;
  let score = 0;
  if (input.accountAgeHours < 24) score += 30;
  if (!input.verified) score += 15;
  if (/https?:\/\/|www\.|\.com\b|\b01[3-9]\d{8}\b/i.test(text)) score += 35;
  if (/(.)\1{5,}/u.test(text)) score += 15;
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) score += 10;
  if ((input.rating === 1 || input.rating === 5) && !input.body?.trim()) score += 10;
  if (input.reviewsToday >= 5) score += 20;
  return Math.min(100, score);
}

/** Reader and buyer reviews with verified-purchase badges, helpful votes and seller replies. */
@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly gamification: GamificationService,
  ) {}

  /** The most recent delivered purchase of this book/product by the user (gives the verified badge). */
  private async purchase(tx: DbOrTx, userId: string, target: Target) {
    const [row] = await tx.execute<{ order_item_id: string; seller_id: string }>(sql`
      select oi.id as order_item_id, so.seller_id from order_items oi
      join seller_orders so on so.id = oi.seller_order_id join orders o on o.id = oi.order_id
      where o.user_id = ${userId} and so.status in ('delivered', 'returned', 'refunded') and oi.refunded_quantity < oi.quantity
        and ${'bookId' in target ? sql`oi.book_id = ${target.bookId}` : sql`oi.product_id = ${target.productId}`}
      order by so.delivered_at desc nulls last limit 1`).then((r) => r.rows);
    return row ?? null;
  }

  private async resolveTarget(input: { bookId?: string; productId?: string }): Promise<Target & { sellerId?: string }> {
    if (input.bookId) {
      const [book] = await this.db.select({ id: books.id }).from(books).where(and(eq(books.id, input.bookId), eq(books.status, 'published'), isNull(books.deletedAt)));
      if (!book) throw AppException.notFound('Book');
      return { bookId: book.id };
    }
    const [product] = await this.db.select({ id: products.id, type: products.type, bookId: products.bookId, sellerId: products.sellerId }).from(products).where(and(eq(products.id, input.productId!), isNull(products.deletedAt)));
    if (!product) throw AppException.notFound('Product');
    // Book listings are reviewed on the book itself (one page for every seller's copy).
    if (product.type === 'book' && product.bookId) return { bookId: product.bookId };
    return { productId: product.id, sellerId: product.sellerId };
  }

  async eligibility(userId: string, input: { bookId?: string; productId?: string }) {
    const target = await this.resolveTarget(input);
    const [purchase, existing] = await Promise.all([
      this.purchase(this.db, userId, target),
      this.db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.userId, userId), 'bookId' in target ? eq(reviews.bookId, target.bookId) : and(eq(reviews.productId, target.productId), isNull(reviews.bookId)))),
    ]);
    // Books can be reviewed by any reader; products only by people who bought them.
    return { canReview: !existing.length && ('bookId' in target || !!purchase), verified: !!purchase, reviewId: existing[0]?.id ?? null };
  }

  async create(userId: string, input: z.output<typeof reviewSchema>) {
    const target = await this.resolveTarget(input);
    const minBody = await this.settings.number('reviews.minBodyLength', 20);
    if (input.body && input.body.length < minBody) throw AppException.validation([{ field: 'body', code: 'too_short', message: 'api.reviews.bodyTooShort' }]).withParams({ count: minBody });
    const created = await this.db.transaction(async (tx) => {
      await assertNotRestricted(tx, userId, 'review');
      const purchase = await this.purchase(tx, userId, target);
      if ('productId' in target && !purchase) throw new AppException('FORBIDDEN', 'api.reviews.purchaseRequired');
      const [user] = await tx.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
      const [{ today } = { today: 0 }] = await tx.execute<{ today: number }>(sql`select count(*)::int as today from reviews where user_id = ${userId} and created_at > now() - interval '1 day'`).then((r) => r.rows);
      if (today >= DAILY_LIMIT) throw new AppException('RATE_LIMITED', 'api.reviews.dailyLimit');
      const score = suspicionScore({ accountAgeHours: (Date.now() - (user?.createdAt.getTime() ?? Date.now())) / 3_600_000, verified: !!purchase, rating: input.rating, title: input.title, body: input.body, reviewsToday: today });
      try {
        const [row] = await tx
          .insert(reviews)
          .values({
            userId,
            bookId: 'bookId' in target ? target.bookId : null,
            productId: 'productId' in target ? target.productId : null,
            sellerId: purchase?.seller_id ?? null,
            orderItemId: purchase?.order_item_id ?? null,
            rating: input.rating,
            title: input.title || null,
            body: input.body || null,
            isVerifiedPurchase: !!purchase,
            suspicionScore: score,
            status: score >= HOLD_SCORE ? 'pending_review' : 'published',
          })
          .returning();
        await this.refresh(tx, row!);
        if (row!.status === 'published') await this.reward(tx, row!);
        return row!;
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppException('CONFLICT', 'api.reviews.alreadyReviewed');
        throw error;
      }
    });
    if (created.status === 'published') {
      await this.notifyOwners(created);
      await this.gamification.evaluateBadges(userId).catch(() => undefined);
    }
    return { id: created.id, status: created.status };
  }

  async update(userId: string, id: string, input: z.output<typeof reviewUpdateSchema>) {
    const minBody = await this.settings.number('reviews.minBodyLength', 20);
    if (input.body && input.body.length < minBody) throw AppException.validation([{ field: 'body', code: 'too_short', message: 'api.reviews.bodyTooShort' }]).withParams({ count: minBody });
    return this.db.transaction(async (tx) => {
      const [review] = await tx.select().from(reviews).where(and(eq(reviews.id, id), eq(reviews.userId, userId))).for('update');
      if (!review) throw AppException.notFound('Review');
      if (review.status === 'removed' || review.status === 'hidden') throw new AppException('FORBIDDEN', 'api.reviews.locked');
      const next = { rating: input.rating ?? review.rating, title: input.title === undefined ? review.title : input.title, body: input.body === undefined ? review.body : input.body };
      const [user] = await tx.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
      const score = suspicionScore({ accountAgeHours: (Date.now() - (user?.createdAt.getTime() ?? Date.now())) / 3_600_000, verified: review.isVerifiedPurchase, rating: next.rating, title: next.title, body: next.body, reviewsToday: 0 });
      const [row] = await tx
        .update(reviews)
        .set({ ...next, suspicionScore: score, status: score >= HOLD_SCORE ? 'pending_review' : 'published', updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();
      await this.refresh(tx, row!);
      return { id: row!.id, status: row!.status };
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.delete(reviews).where(and(eq(reviews.id, id), eq(reviews.userId, userId))).returning();
      if (!row) throw AppException.notFound('Review');
      await this.refresh(tx, row);
    });
  }

  /** Counters and XP for a review that went live (XP once per review, a few per day). */
  private async reward(tx: DbOrTx, review: Review): Promise<void> {
    await this.gamification.bump(tx, review.userId, { reviewsWritten: 1 });
    if ((review.body ?? '').length >= 40) await this.gamification.award(tx, review.userId, 'review', review.id);
  }

  private async refresh(tx: DbOrTx, review: Review): Promise<void> {
    await refreshRatings(tx, { bookIds: review.bookId ? [review.bookId] : [], productIds: review.productId ? [review.productId] : [], sellerIds: review.sellerId ? [review.sellerId] : [] });
  }

  /** Tells the seller (and a claimed author) about a new review of their work. */
  private async notifyOwners(review: Review): Promise<void> {
    const recipients = new Set<string>();
    if (review.sellerId) {
      const [seller] = await this.db.select({ userId: sellers.userId }).from(sellers).where(eq(sellers.id, review.sellerId));
      if (seller) recipients.add(seller.userId);
    }
    let title = '';
    if (review.bookId) {
      const owners = await this.db.select({ userId: authors.userId, title: books.title, slug: books.slug }).from(bookAuthors).innerJoin(authors, eq(authors.id, bookAuthors.authorId)).innerJoin(books, eq(books.id, bookAuthors.bookId)).where(eq(bookAuthors.bookId, review.bookId));
      for (const o of owners) if (o.userId) recipients.add(o.userId);
      title = owners[0]?.title ?? (await this.db.select({ title: books.title }).from(books).where(eq(books.id, review.bookId)))[0]?.title ?? '';
    } else if (review.productId) {
      title = (await this.db.select({ title: products.title }).from(products).where(eq(products.id, review.productId)))[0]?.title ?? '';
    }
    recipients.delete(review.userId);
    for (const userId of recipients) {
      await this.notifications.notify(userId, { type: 'review', titleKey: 'api.reviews.newTitle', bodyKey: 'api.reviews.newBody', params: { title, rating: review.rating } }).catch(() => undefined);
    }
  }

  private targetWhere(target: { bookSlug?: string; productSlug?: string }) {
    return target.bookSlug
      ? sql`r.book_id = (select id from books where slug = ${target.bookSlug})`
      : sql`r.book_id is null and r.product_id = (select id from products where slug = ${target.productSlug})`;
  }

  async list(target: { bookSlug?: string; productSlug?: string }, q: z.output<typeof reviewListQuerySchema>, viewerId?: string) {
    const where = this.targetWhere(target);
    const filters = [where, sql`(r.status = 'published' ${viewerId ? sql`or r.user_id = ${viewerId}` : sql``})`];
    if (q.rating) filters.push(sql`r.rating = ${q.rating}`);
    if (q.verified) filters.push(sql`r.is_verified_purchase`);
    const condition = sql.join(filters, sql` and `);
    const order = { helpful: sql`r.helpful_count desc, r.is_verified_purchase desc, r.created_at desc`, newest: sql`r.created_at desc`, highest: sql`r.rating desc, r.created_at desc`, lowest: sql`r.rating asc, r.created_at desc` }[q.sort];
    const [rows, total] = await Promise.all([
      this.db.execute<Record<string, unknown>>(sql`
        select r.id, r.rating, r.title, r.body, r.is_verified_purchase, r.helpful_count, r.not_helpful_count, r.seller_reply, r.seller_replied_at, r.created_at, r.updated_at, r.status, r.user_id,
          u.display_name, u.username, up.avatar_key, st.name as store_name,
          ${viewerId ? sql`(select v.helpful from review_votes v where v.review_id = r.id and v.user_id = ${viewerId})` : sql`null`} as my_vote
        from reviews r join users u on u.id = r.user_id left join user_profiles up on up.user_id = u.id left join seller_stores st on st.seller_id = r.seller_id
        where ${condition} order by ${order}, r.id limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from reviews r where ${condition}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id as string,
        rating: Number(r.rating),
        title: r.title as string | null,
        body: r.body as string | null,
        verified: r.is_verified_purchase === true,
        helpfulCount: Number(r.helpful_count),
        notHelpfulCount: Number(r.not_helpful_count),
        sellerReply: r.seller_reply ? { body: r.seller_reply as string, store: r.store_name as string | null, at: new Date(r.seller_replied_at as string).toISOString() } : null,
        createdAt: new Date(r.created_at as string).toISOString(),
        edited: new Date(r.updated_at as string).getTime() - new Date(r.created_at as string).getTime() > 60_000,
        pending: r.status !== 'published',
        mine: !!viewerId && r.user_id === viewerId,
        myVote: r.my_vote === null || r.my_vote === undefined ? null : (r.my_vote as boolean),
        user: { name: r.display_name as string, username: r.username as string, avatarUrl: this.storage.publicUrl(r.avatar_key as string | null) },
      })),
      meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  /** Helpful / not helpful; voting the same way twice removes the vote. */
  async vote(userId: string, id: string, helpful: boolean) {
    return this.db.transaction(async (tx) => {
      const [review] = await tx.select({ userId: reviews.userId, status: reviews.status }).from(reviews).where(eq(reviews.id, id));
      if (!review || review.status !== 'published') throw AppException.notFound('Review');
      if (review.userId === userId) throw new AppException('BAD_REQUEST', 'api.reviews.ownVote');
      const [existing] = await tx.select().from(reviewVotes).where(and(eq(reviewVotes.reviewId, id), eq(reviewVotes.userId, userId)));
      if (existing && existing.helpful === helpful) await tx.delete(reviewVotes).where(and(eq(reviewVotes.reviewId, id), eq(reviewVotes.userId, userId)));
      else await tx.insert(reviewVotes).values({ reviewId: id, userId, helpful }).onConflictDoUpdate({ target: [reviewVotes.reviewId, reviewVotes.userId], set: { helpful } });
      const [counts] = await tx
        .update(reviews)
        .set({
          helpfulCount: sql`(select count(*)::int from review_votes where review_id = ${id} and helpful)`,
          notHelpfulCount: sql`(select count(*)::int from review_votes where review_id = ${id} and not helpful)`,
        })
        .where(eq(reviews.id, id))
        .returning({ helpfulCount: reviews.helpfulCount, notHelpfulCount: reviews.notHelpfulCount });
      return { ...counts!, myVote: existing && existing.helpful === helpful ? null : helpful };
    });
  }

  /** The seller who fulfilled the reviewed purchase can answer publicly (once; editable). */
  async reply(userId: string, id: string, body: string) {
    const [row] = await this.db
      .select({ review: reviews, sellerUserId: sellers.userId })
      .from(reviews)
      .innerJoin(sellers, eq(sellers.id, reviews.sellerId))
      .where(eq(reviews.id, id));
    if (!row || row.sellerUserId !== userId) throw AppException.notFound('Review');
    await this.db.update(reviews).set({ sellerReply: body, sellerRepliedAt: new Date() }).where(eq(reviews.id, id));
    await this.notifications.notify(row.review.userId, { type: 'review', titleKey: 'api.reviews.replyTitle', bodyKey: 'api.reviews.replyBody', params: { rating: row.review.rating } }).catch(() => undefined);
    return { sellerReply: body };
  }

  async mine(userId: string) {
    const rows = await this.db.execute<Record<string, unknown>>(sql`
      select r.id, r.rating, r.title, r.body, r.status, r.created_at, r.is_verified_purchase, b.title as book_title, b.slug as book_slug, p.title as product_title, p.slug as product_slug
      from reviews r left join books b on b.id = r.book_id left join products p on p.id = r.product_id where r.user_id = ${userId} order by r.created_at desc limit 100`);
    return rows.rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, status: r.status, verified: r.is_verified_purchase, createdAt: new Date(r.created_at as string).toISOString(), target: r.book_slug ? { type: 'book', title: r.book_title, slug: r.book_slug } : { type: 'product', title: r.product_title, slug: r.product_slug } }));
  }

  /** Latest reviews of a seller's sales (dashboard). */
  async forSeller(sellerId: string, limit = 8) {
    const rows = await this.db
      .select({ id: reviews.id, rating: reviews.rating, title: reviews.title, body: reviews.body, sellerReply: reviews.sellerReply, createdAt: reviews.createdAt, bookTitle: books.title, productTitle: products.title, user: users.displayName })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .leftJoin(books, eq(books.id, reviews.bookId))
      .leftJoin(products, eq(products.id, reviews.productId))
      .where(and(eq(reviews.sellerId, sellerId), eq(reviews.status, 'published')))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
    return rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, sellerReply: r.sellerReply, createdAt: r.createdAt.toISOString(), target: r.bookTitle ?? r.productTitle, user: r.user }));
  }
}
