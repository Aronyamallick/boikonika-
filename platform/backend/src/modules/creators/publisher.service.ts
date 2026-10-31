import { Inject, Injectable } from '@nestjs/common';
import { publishers, type Database } from '@boikonika/database';
import type { publisherProfileSchema } from '@boikonika/shared';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { AuditService } from '../audit/audit.service';
import { bookStatsSql, dailySeriesSql } from './author.service';

type Row = Record<string, unknown>;

/** The verified publisher's page: profile, catalogue performance across all sellers, and its authors. */
@Injectable()
export class PublisherService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private async own(userId: string) {
    const [publisher] = await this.db.select().from(publishers).where(eq(publishers.ownerId, userId));
    if (!publisher) throw new AppException('FORBIDDEN', 'api.creators.noPublisherProfile');
    return publisher;
  }

  async dashboard(userId: string) {
    const publisher = await this.own(userId);
    const mine = sql`(exists(select 1 from book_publishers bp where bp.book_id = b.id and bp.publisher_id = ${publisher.id}) or exists(select 1 from book_formats f where f.book_id = b.id and f.publisher_id = ${publisher.id}))`;
    const [bookRows, series, authorRows] = await Promise.all([
      this.db.execute<Row>(bookStatsSql(sql`b.status = 'published' and ${mine}`)),
      this.db.execute<Row>(dailySeriesSql(mine)),
      this.db.execute<Row>(sql`
        select a.id, a.slug, a.name, a.is_verified, count(distinct ba.book_id)::int as books
        from authors a join book_authors ba on ba.author_id = a.id join books b on b.id = ba.book_id
        where b.deleted_at is null and ${mine}
        group by a.id order by count(distinct ba.book_id) desc, a.name limit 50`),
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
    return {
      profile: { id: publisher.id, slug: publisher.slug, name: publisher.name, nameAlt: publisher.nameAlt, description: publisher.description, website: publisher.website, foundedYear: publisher.foundedYear, logoUrl: this.storage.publicUrl(publisher.logoKey), verified: publisher.isVerified },
      stats: { books: books.length, followers: publisher.followerCount, sales: books.reduce((n, b) => n + b.sales, 0), views: books.reduce((n, b) => n + b.views, 0), authors: authorRows.rows.length },
      series: series.rows.map((r) => ({ day: r.day as string, views: Number(r.views), sales: Number(r.sales) })),
      books,
      authors: authorRows.rows.map((a) => ({ id: a.id, slug: a.slug, name: a.name, verified: !!a.is_verified, books: Number(a.books) })),
    };
  }

  async updateProfile(userId: string, input: z.output<typeof publisherProfileSchema>) {
    const publisher = await this.own(userId);
    const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length) {
      await this.db.update(publishers).set({ ...changes, updatedAt: new Date() }).where(eq(publishers.id, publisher.id));
      await this.audit.record({ action: 'publisher.profile.update', entityType: 'publisher', entityId: publisher.id, after: changes });
    }
    return (await this.dashboard(userId)).profile;
  }

  async setLogo(userId: string, file: Buffer) {
    const publisher = await this.own(userId);
    const processed = await processUpload(file, { allowed: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, image: { maxWidth: 600, maxHeight: 600, format: 'webp', crop: true } });
    const key = `publishers/${publisher.id}/${randomUUID()}.${processed.extension}`;
    await this.storage.put('public', key, processed.body, processed.contentType);
    await this.db.update(publishers).set({ logoKey: key, updatedAt: new Date() }).where(eq(publishers.id, publisher.id));
    if (publisher.logoKey && !/^https?:/.test(publisher.logoKey)) await this.storage.delete('public', publisher.logoKey);
    return { url: this.storage.publicUrl(key) };
  }
}
