import { Inject, Injectable } from '@nestjs/common';
import { authorClaims, authors, follows, posts, refreshAuthorBookCounts, type Database } from '@boikonika/database';
import type { authorAnnouncementSchema, authorClaimSchema, authorProfileSchema } from '@boikonika/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { isUniqueViolation } from '../../common/errors/pg';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

type Row = Record<string, unknown>;
const ANNOUNCEMENTS_PER_DAY = 3;

/** Shared book table for author and publisher dashboards. */
export function bookStatsSql(filter: ReturnType<typeof sql>) {
  return sql`
    select b.id, b.slug, b.title, b.cover_key, b.rating_avg::float as rating, b.rating_count, b.sales_count, b.view_count, b.offer_count, b.min_price, b.first_published_year,
      coalesce((select sum(d.sales) from book_daily_stats d where d.book_id = b.id and d.day > now() - interval '30 days'), 0)::int as sales_30,
      coalesce((select sum(d.views) from book_daily_stats d where d.book_id = b.id and d.day > now() - interval '30 days'), 0)::int as views_30
    from books b where b.deleted_at is null and ${filter}
    order by b.sales_count desc, b.title`;
}

export function dailySeriesSql(filter: ReturnType<typeof sql>, days = 30) {
  return sql`
    with days as (select generate_series(current_date - ${days - 1}::int, current_date, interval '1 day')::date as day)
    select d.day::text as day, coalesce(sum(s.views), 0)::int as views, coalesce(sum(s.sales), 0)::int as sales
    from days d left join book_daily_stats s on s.day::date = d.day and s.book_id in (select b.id from books b where ${filter})
    group by d.day order by d.day`;
}

/** The verified author's own page: profile, books and their performance, announcements and claims. */
@Injectable()
export class AuthorService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private async own(userId: string) {
    const [author] = await this.db.select().from(authors).where(eq(authors.userId, userId));
    if (!author) throw new AppException('FORBIDDEN', 'api.creators.noAuthorProfile');
    return author;
  }

  async dashboard(userId: string) {
    const author = await this.own(userId);
    const mine = sql`exists(select 1 from book_authors ba where ba.book_id = b.id and ba.author_id = ${author.id})`;
    const [bookRows, series, reviewsRows, claims] = await Promise.all([
      this.db.execute<Row>(bookStatsSql(sql`b.status = 'published' and ${mine}`)),
      this.db.execute<Row>(dailySeriesSql(mine)),
      this.db.execute<Row>(sql`
        select r.id, r.rating, r.title, r.body, r.created_at, b.title as book_title, b.slug as book_slug, u.display_name
        from reviews r join books b on b.id = r.book_id join users u on u.id = r.user_id
        where r.status = 'published' and ${sql`exists(select 1 from book_authors ba where ba.book_id = b.id and ba.author_id = ${author.id})`}
        order by r.created_at desc limit 6`),
      this.db.select({ id: authorClaims.id, status: authorClaims.status, authorName: authors.name, createdAt: authorClaims.createdAt, reason: authorClaims.decisionReason }).from(authorClaims).innerJoin(authors, eq(authors.id, authorClaims.authorId)).where(eq(authorClaims.userId, userId)).orderBy(desc(authorClaims.createdAt)),
    ]);
    const books = bookRows.rows.map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      coverUrl: this.storage.publicUrl(b.cover_key as string | null),
      rating: Number(b.rating ?? 0),
      ratingCount: Number(b.rating_count ?? 0),
      sales: Number(b.sales_count ?? 0),
      views: Number(b.view_count ?? 0),
      sales30: Number(b.sales_30 ?? 0),
      views30: Number(b.views_30 ?? 0),
      offers: Number(b.offer_count ?? 0),
      minPrice: b.min_price as string | null,
    }));
    const rated = books.filter((b) => b.ratingCount > 0);
    const ratingCount = rated.reduce((n, b) => n + b.ratingCount, 0);
    return {
      profile: { id: author.id, slug: author.slug, name: author.name, nameAlt: author.nameAlt, bio: author.bio, website: author.website, birthYear: author.birthYear, photoUrl: this.storage.publicUrl(author.photoKey), verified: author.isVerified },
      stats: {
        books: books.length,
        followers: author.followerCount,
        sales: books.reduce((n, b) => n + b.sales, 0),
        views: books.reduce((n, b) => n + b.views, 0),
        rating: ratingCount ? Math.round((rated.reduce((n, b) => n + b.rating * b.ratingCount, 0) / ratingCount) * 10) / 10 : 0,
        ratingCount,
      },
      series: series.rows.map((r) => ({ day: r.day as string, views: Number(r.views), sales: Number(r.sales) })),
      books,
      reviews: reviewsRows.rows.map((r) => ({ id: r.id, rating: Number(r.rating), title: r.title, body: r.body, book: { title: r.book_title, slug: r.book_slug }, user: r.display_name, createdAt: new Date(r.created_at as string).toISOString() })),
      claims: claims.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    };
  }

  async updateProfile(userId: string, input: z.output<typeof authorProfileSchema>) {
    const author = await this.own(userId);
    const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length) {
      await this.db.update(authors).set({ ...changes, updatedAt: new Date() }).where(eq(authors.id, author.id));
      await this.audit.record({ action: 'author.profile.update', entityType: 'author', entityId: author.id, after: changes });
    }
    return this.dashboard(userId).then((d) => d.profile);
  }

  async setPhoto(userId: string, file: Buffer) {
    const author = await this.own(userId);
    const processed = await processUpload(file, { allowed: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, image: { maxWidth: 600, maxHeight: 600, format: 'webp', crop: true } });
    const key = `authors/${author.id}/${randomUUID()}.${processed.extension}`;
    await this.storage.put('public', key, processed.body, processed.contentType);
    await this.db.update(authors).set({ photoKey: key, updatedAt: new Date() }).where(eq(authors.id, author.id));
    if (author.photoKey && !/^https?:/.test(author.photoKey)) await this.storage.delete('public', author.photoKey);
    return { url: this.storage.publicUrl(key) };
  }

  /** A short update to everyone following the author (also shown on the author's feed as a post). */
  async announce(userId: string, input: z.output<typeof authorAnnouncementSchema>) {
    const author = await this.own(userId);
    const key = `announce:${author.id}:${new Date().toISOString().slice(0, 10)}`;
    const used = await this.redis.incr(key);
    if (used === 1) await this.redis.expire(key, 86_400);
    if (used > ANNOUNCEMENTS_PER_DAY) throw new AppException('RATE_LIMITED', 'api.creators.announceLimit').withParams({ count: ANNOUNCEMENTS_PER_DAY });
    if (input.bookId) {
      const [own] = await this.db.execute(sql`select 1 from book_authors where book_id = ${input.bookId} and author_id = ${author.id}`).then((r) => r.rows);
      if (!own) throw AppException.validation([{ field: 'bookId', code: 'not_yours', message: 'api.creators.notYourBook' }]);
    }
    const [post] = await this.db.insert(posts).values({ authorId: userId, type: 'announcement', title: input.title, body: input.body, bookId: input.bookId ?? null }).returning({ id: posts.id });
    const followers = await this.db.select({ id: follows.followerId }).from(follows).where(and(eq(follows.targetType, 'author'), eq(follows.targetId, author.id))).limit(20_000);
    for (const f of followers) {
      await this.notifications
        .notify(f.id, { type: 'author_update', titleKey: 'api.creators.announcementTitle', bodyKey: 'api.creators.announcementBody', params: { author: author.name, title: input.title }, link: `/authors/${author.slug}`, actorId: userId, groupKey: `announcement:${post!.id}` })
        .catch(() => undefined);
    }
    return { postId: post!.id, notified: followers.length };
  }

  // ------------------------------------------------------------------ claims

  async claimable(q: string) {
    const term = q.normalize('NFC').trim();
    if (term.length < 2) return [];
    const rows = await this.db.execute<Row>(sql`
      select a.id, a.slug, a.name, a.name_alt, a.book_count from authors a
      where a.user_id is null and a.status = 'published' and (a.name % ${term} or a.name_alt % ${term} or a.name ilike ${`%${term.replace(/[%_\\]/g, '')}%`} or a.name_alt ilike ${`%${term.replace(/[%_\\]/g, '')}%`})
      order by greatest(similarity(a.name, ${term}), similarity(coalesce(a.name_alt, ''), ${term})) desc limit 10`);
    return rows.rows.map((a) => ({ id: a.id, slug: a.slug, name: a.name, nameAlt: a.name_alt, bookCount: Number(a.book_count ?? 0) }));
  }

  async claim(userId: string, input: z.output<typeof authorClaimSchema>) {
    await this.own(userId);
    const [target] = await this.db.select({ id: authors.id, userId: authors.userId }).from(authors).where(eq(authors.id, input.authorId));
    if (!target) throw AppException.notFound('Author');
    if (target.userId) throw new AppException('CONFLICT', 'api.creators.alreadyClaimed');
    try {
      const [row] = await this.db.insert(authorClaims).values({ authorId: input.authorId, userId, message: input.message, evidenceUrl: input.evidenceUrl ?? null }).returning({ id: authorClaims.id });
      return { id: row!.id, status: 'pending' };
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppException('CONFLICT', 'api.creators.claimPending');
      throw error;
    }
  }

  async listClaims(status: string, page: number, pageSize: number) {
    const rows = await this.db.execute<Row>(sql`
      select c.id, c.status, c.message, c.evidence_url, c.decision_reason, c.created_at, a.id as author_id, a.name as author_name, a.slug as author_slug, a.book_count,
        u.id as user_id, u.display_name, u.username,
        (select ma.slug from authors ma where ma.user_id = u.id) as own_slug,
        (select k.legal_name from kyc_verifications k where k.user_id = u.id and k.status = 'approved' and k.requested_role = 'author' order by k.created_at desc limit 1) as legal_name
      from author_claims c join authors a on a.id = c.author_id join users u on u.id = c.user_id
      where c.status = ${status} order by c.created_at asc limit ${pageSize} offset ${(page - 1) * pageSize}`);
    const total = await this.db.execute<{ n: number }>(sql`select count(*)::int as n from author_claims where status = ${status}`);
    return {
      items: rows.rows.map((r) => ({
        id: r.id,
        status: r.status,
        message: r.message,
        evidenceUrl: r.evidence_url,
        reason: r.decision_reason,
        createdAt: new Date(r.created_at as string).toISOString(),
        author: { id: r.author_id, name: r.author_name, slug: r.author_slug, bookCount: Number(r.book_count ?? 0) },
        claimant: { id: r.user_id, name: r.display_name, username: r.username, legalName: r.legal_name, authorSlug: r.own_slug },
      })),
      meta: { page, pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  /**
   * Links the existing page to the claimant. Books from the profile created at verification move to
   * the claimed page, which then replaces it; competing claims for the page are declined.
   */
  async decideClaim(actorId: string, claimId: string, approve: boolean, reason?: string) {
    const result = await this.db.transaction(async (tx) => {
      const [claim] = await tx.select().from(authorClaims).where(eq(authorClaims.id, claimId)).for('update');
      if (!claim || claim.status !== 'pending') throw new AppException('CONFLICT', 'api.creators.claimNotPending');
      const now = new Date();
      if (!approve) {
        if (!reason || reason.length < 5) throw AppException.validation([{ field: 'reason', code: 'required', message: 'validation.reasonRequired' }]);
        await tx.update(authorClaims).set({ status: 'rejected', decisionReason: reason, decidedBy: actorId, decidedAt: now, updatedAt: now }).where(eq(authorClaims.id, claimId));
        return { claim, approved: false, slug: null as string | null };
      }
      const [target] = await tx.select().from(authors).where(eq(authors.id, claim.authorId)).for('update');
      if (!target || target.userId) throw new AppException('CONFLICT', 'api.creators.alreadyClaimed');
      const [current] = await tx.select().from(authors).where(eq(authors.userId, claim.userId)).for('update');
      if (current) {
        await tx.execute(sql`insert into book_authors (book_id, author_id, role, position) select book_id, ${target.id}, role, position from book_authors where author_id = ${current.id} on conflict do nothing`);
        await tx.execute(sql`
          insert into follows (follower_id, target_type, target_id) select follower_id, 'author', ${target.id} from follows where target_type = 'author' and target_id = ${current.id}
          on conflict do nothing`);
        await tx.execute(sql`delete from follows where target_type = 'author' and target_id = ${current.id}`);
        await tx.delete(authors).where(eq(authors.id, current.id));
      }
      await tx
        .update(authors)
        .set({
          userId: claim.userId,
          isVerified: true,
          bio: target.bio ?? current?.bio ?? null,
          photoKey: target.photoKey ?? current?.photoKey ?? null,
          followerCount: sql`(select count(*)::int from follows where target_type = 'author' and target_id = ${target.id})`,
          updatedAt: now,
        })
        .where(eq(authors.id, target.id));
      await refreshAuthorBookCounts(tx, [target.id]);
      await tx.update(authorClaims).set({ status: 'approved', decisionReason: reason ?? null, decidedBy: actorId, decidedAt: now, updatedAt: now }).where(eq(authorClaims.id, claimId));
      await tx
        .update(authorClaims)
        .set({ status: 'rejected', decisionReason: 'Another claim for this page was approved.', decidedBy: actorId, decidedAt: now, updatedAt: now })
        .where(and(eq(authorClaims.authorId, target.id), eq(authorClaims.status, 'pending')));
      return { claim, approved: true, slug: target.slug };
    });
    await this.audit.record({ action: result.approved ? 'author_claim.approve' : 'author_claim.reject', entityType: 'author', entityId: result.claim.authorId, actorId, after: { claimId, userId: result.claim.userId, reason } });
    await this.notifications
      .notify(result.claim.userId, { type: 'author_update', titleKey: result.approved ? 'api.creators.claimApprovedTitle' : 'api.creators.claimRejectedTitle', bodyKey: result.approved ? 'api.creators.claimApprovedBody' : 'api.creators.claimRejectedBody', params: { reason: reason ?? '' }, link: '/author' })
      .catch(() => undefined);
  }

}
