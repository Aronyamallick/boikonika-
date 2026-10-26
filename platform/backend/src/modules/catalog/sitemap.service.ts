import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@boikonika/database';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { ACTIVE_OFFER } from './catalog.sql';

export interface SitemapEntry {
  path: string;
  updatedAt: string;
}

const CACHE_KEY = 'sitemap:v1';
/** The list is public and costs ten queries, so it is built at most every 15 minutes. */
const CACHE_SECONDS = 900;
/** Search engines get at most 50,000 URLs per sitemap; books take most of the room. */
const LIMITS = { books: 30_000, products: 8_000, authors: 5_000, other: 1_500 };

/**
 * Every public page worth indexing, with when it last changed — only what anyone can see without an
 * account (published, not deleted, on offer). Private clubs, drafts and people's profiles are left out.
 */
@Injectable()
export class SitemapService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async entries(): Promise<SitemapEntry[]> {
    const cached = await this.redis.get(CACHE_KEY).catch(() => null);
    if (cached) return JSON.parse(cached) as SitemapEntry[];
    const entries = await this.build();
    await this.redis.set(CACHE_KEY, JSON.stringify(entries), 'EX', CACHE_SECONDS).catch(() => undefined);
    return entries;
  }

  private async build(): Promise<SitemapEntry[]> {
    const q = (query: ReturnType<typeof sql>) => this.db.execute<{ path: string; updated_at: Date | string }>(query).then((r) => r.rows);
    const groups = await Promise.all([
      q(sql`select '/books/' || slug as path, updated_at from books where status = 'published' and deleted_at is null and (offer_count > 0 or is_free) order by updated_at desc limit ${LIMITS.books}`),
      q(sql`select '/products/' || p.slug as path, p.updated_at from products p join sellers se on se.id = p.seller_id where p.type = 'general' and ${ACTIVE_OFFER} and se.status = 'active' order by p.updated_at desc limit ${LIMITS.products}`),
      q(sql`select '/authors/' || slug as path, updated_at from authors where status = 'published' and book_count > 0 order by book_count desc limit ${LIMITS.authors}`),
      q(sql`select '/publishers/' || slug as path, updated_at from publishers where status = 'published' order by updated_at desc limit ${LIMITS.other}`),
      q(sql`select '/stores/' || s.slug as path, s.updated_at from seller_stores s join sellers se on se.id = s.seller_id where se.status = 'active' order by s.updated_at desc limit ${LIMITS.other}`),
      q(sql`select '/categories/' || path as path, updated_at from categories where is_active order by path limit ${LIMITS.other}`),
      q(sql`select '/pages/' || slug as path, updated_at from cms_pages where status = 'published' limit ${LIMITS.other}`),
      q(sql`select (case when kind = 'help' then '/help/' else '/blog/' end) || slug as path, updated_at from articles where status = 'published' and published_at <= now() order by published_at desc limit ${LIMITS.other}`),
      q(sql`select '/clubs/' || slug as path, updated_at from book_clubs where status = 'published' and type <> 'private' order by updated_at desc limit ${LIMITS.other}`),
      q(sql`select '/challenges/' || slug as path, updated_at from reading_challenges where is_active order by updated_at desc limit ${LIMITS.other}`),
    ]);
    return groups.flat().map((r) => ({ path: r.path, updatedAt: new Date(r.updated_at).toISOString() }));
  }
}
