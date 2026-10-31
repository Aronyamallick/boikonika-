import { Inject, Injectable } from '@nestjs/common';
import { users, type Database } from '@boikonika/database';
import { eq, sql, type SQL } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { SettingsService } from '../settings/settings.service';
import { CatalogService } from './catalog.service';
import { BOOK_CARD_COLUMNS } from './catalog.sql';
import type { BookCard } from './catalog.types';

type Row = Record<string, unknown>;
/** Why a book is suggested; `label` is an author's name or a genre/category name in both languages. */
export type Reason = { kind: 'author' | 'readers' | 'genre' | 'category' | 'search' | 'popular'; label?: string | Record<string, string> };
export type Recommended = BookCard & { reason: Reason };

const SEARCH_HISTORY = (userId: string) => `search:history:${userId}`;
const SEARCH_HISTORY_SIZE = 20;
const SEARCH_HISTORY_DAYS = 90;
const ALSO_LIKED_TTL = 3600;

/** Books a reader can buy or read, which they don't already have. */
const AVAILABLE = sql`b.status = 'published' and b.deleted_at is null and (b.offer_count > 0 or b.is_free)`;
/** Readers whose shelves may inform others' recommendations (they kept personalisation on). */
const SHARING = sql`exists (select 1 from users su where su.id = h.user_id and su.personalization_enabled and su.deleted_at is null)`;

/**
 * Recommendations from signals the reader gave us on purpose: chosen interests, books on their
 * shelves, purchases, wishlist, ratings, followed authors and recent searches. "Readers like you"
 * counts only readers who kept personalisation on, and never fewer than a minimum number of them,
 * so no one's shelf can be inferred. Everything stops when personalisation is switched off.
 */
@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly catalog: CatalogService,
    private readonly settings: SettingsService,
  ) {}

  private async minSupport(): Promise<number> {
    return Math.max(2, await this.settings.number('recommendations.minSupport', 2));
  }

  private async personalised(userId: string): Promise<boolean> {
    const [user] = await this.db.select({ on: users.personalizationEnabled }).from(users).where(eq(users.id, userId));
    return user?.on === true;
  }

  // ------------------------------------------------------------------ search history

  /** Remembers a signed-in reader's search (only with personalisation on), newest first. */
  async rememberSearch(userId: string, query: string): Promise<void> {
    const q = query.normalize('NFC').trim().slice(0, 100);
    if (q.length < 2 || !(await this.personalised(userId))) return;
    const key = SEARCH_HISTORY(userId);
    await this.redis
      .multi()
      .lrem(key, 0, q)
      .lpush(key, q)
      .ltrim(key, 0, SEARCH_HISTORY_SIZE - 1)
      .expire(key, SEARCH_HISTORY_DAYS * 86_400)
      .exec()
      .catch(() => undefined);
  }

  async searchHistory(userId: string): Promise<string[]> {
    return this.redis.lrange(SEARCH_HISTORY(userId), 0, SEARCH_HISTORY_SIZE - 1).catch(() => []);
  }

  async clearSearchHistory(userId: string): Promise<void> {
    await this.redis.del(SEARCH_HISTORY(userId)).catch(() => undefined);
  }

  // ------------------------------------------------------------------ for you

  /** Personal picks with the main reason for each; popular books when there's nothing to go on. */
  async forUser(userId: string, limit = 24): Promise<{ personalized: boolean; items: Recommended[]; basedOn: { title: string; slug: string } | null; becauseYouRead: BookCard[] }> {
    if (!(await this.personalised(userId))) return { personalized: false, items: await this.popular(limit), basedOn: null, becauseYouRead: [] };
    const searches = (await this.searchHistory(userId)).slice(0, 5);
    const searchMatch = (alias: string): SQL =>
      searches.length ? sql.join(searches.map((q) => sql`(${sql.raw(alias)}.title % ${q} or ${q} <% ${sql.raw(alias)}.search_text or ${sql.raw(alias)}.search_vector @@ websearch_to_tsquery('simple', ${q}))`), sql` or `) : sql`false`;
    const searchScore = searches.length ? sql.join(searches.map((q) => sql`(case when b.title % ${q} or ${q} <% b.search_text or b.search_vector @@ websearch_to_tsquery('simple', ${q}) then 1 else 0 end)`), sql` + `) : sql`0`;
    const min = await this.minSupport();

    const rows = await this.catalog.searching((tx) =>
      tx.execute<Row>(sql`
        with seeds as (
          select book_id, 3::float as w from user_library where user_id = ${userId}
          union all select oi.book_id, 3 from order_items oi join orders o on o.id = oi.order_id
            where o.user_id = ${userId} and o.payment_status in ('paid', 'partially_refunded') and oi.book_id is not null
          union all select wi.book_id, 2 from wishlist_items wi join wishlists w on w.id = wi.wishlist_id where w.user_id = ${userId} and wi.book_id is not null
          union all select book_id, case when rating >= 4 then 3 when rating <= 2 then -3 else 0 end from reviews where user_id = ${userId} and book_id is not null
        ),
        seed as (select book_id, sum(w) as w from seeds group by book_id),
        mine as (select book_id from seed union select book_id from user_library where user_id = ${userId}),
        gw as (
          select g.key, s.w from seed s join book_genres bg on bg.book_id = s.book_id join genres g on g.id = bg.genre_id
          union all select interest, 4 from user_interests where user_id = ${userId}
        ),
        genre_w as (select key, sum(w) as w from gw group by key having sum(w) > 0),
        cat_w as (select bc.category_id, sum(s.w) as w from seed s join book_categories bc on bc.book_id = s.book_id group by bc.category_id having sum(s.w) > 0),
        aw as (
          select ba.author_id, s.w from seed s join book_authors ba on ba.book_id = s.book_id where ba.role = 'author'
          union all select target_id, 6 from follows where follower_id = ${userId} and target_type = 'author'
        ),
        author_w as (select author_id, sum(w) as w from aw group by author_id having sum(w) > 0),
        co as (
          select l2.book_id, count(distinct l2.user_id)::float as w
          from user_library l1 join user_library l2 on l2.user_id = l1.user_id and l2.book_id <> l1.book_id
          join users h on h.id = l1.user_id
          where l1.book_id in (select book_id from seed where w > 0) and l1.user_id <> ${userId} and h.personalization_enabled and h.deleted_at is null
          group by l2.book_id having count(distinct l2.user_id) >= ${min}
        ),
        pool as (
          select bg.book_id from book_genres bg join genres g on g.id = bg.genre_id where g.key in (select key from genre_w)
          union select bc.book_id from book_categories bc where bc.category_id in (select category_id from cat_w)
          union select ba.book_id from book_authors ba where ba.author_id in (select author_id from author_w)
          union select book_id from co
          union select sb.id from books sb where ${searchMatch('sb')}
        ),
        scored as (
          select b.id,
            coalesce((select sum(x.w) from book_genres bg join genres g on g.id = bg.genre_id join genre_w x on x.key = g.key where bg.book_id = b.id), 0) as s_genre,
            coalesce((select sum(x.w) from book_categories bc join cat_w x on x.category_id = bc.category_id where bc.book_id = b.id), 0) as s_cat,
            coalesce((select sum(x.w) from book_authors ba join author_w x on x.author_id = ba.author_id where ba.book_id = b.id), 0) as s_author,
            coalesce((select co.w from co where co.book_id = b.id), 0) as s_co,
            ${searchScore} as s_search
          from books b where b.id in (select book_id from pool) and ${AVAILABLE} and b.id not in (select book_id from mine)
        )
        select ${BOOK_CARD_COLUMNS}, s.s_genre, s.s_cat, s.s_author, s.s_co, s.s_search,
          (select g.name from book_genres bg join genres g on g.id = bg.genre_id join genre_w x on x.key = g.key where bg.book_id = b.id order by x.w desc limit 1) as top_genre,
          (select a.name from book_authors ba join authors a on a.id = ba.author_id join author_w x on x.author_id = ba.author_id where ba.book_id = b.id order by x.w desc limit 1) as top_author,
          (select c.name from book_categories bc join categories c on c.id = bc.category_id join cat_w x on x.category_id = bc.category_id where bc.book_id = b.id order by x.w desc limit 1) as top_category
        from scored s join books b on b.id = s.id
        order by (1.0 * s.s_genre + 0.6 * s.s_cat + 1.5 * s.s_author + 2.0 * s.s_co + 3.0 * s.s_search) desc, b.rating_avg desc, b.sales_count desc
        limit ${limit}`),
    );

    const items = rows.rows.map((r) => ({ ...this.catalog.toBookCard(r), reason: this.reasonOf(r) }));
    // Top up with popular books the reader doesn't have yet.
    if (items.length < limit) {
      const have = new Set(items.map((i) => i.id));
      const owned = (await this.db.execute<{ book_id: string }>(sql`select book_id from user_library where user_id = ${userId}`)).rows.map((r) => r.book_id);
      for (const p of await this.popular(limit + owned.length)) if (!have.has(p.id) && !owned.includes(p.id) && items.length < limit) items.push(p);
    }

    // "Because you read …": the latest book they shelved or bought, and what its readers also read.
    const [anchor] = await this.db
      .execute<{ id: string; title: string; slug: string }>(sql`
        select b.id, b.title, b.slug from user_library l join books b on b.id = l.book_id
        where l.user_id = ${userId} and b.deleted_at is null order by l.updated_at desc limit 1`)
      .then((r) => r.rows);
    const becauseYouRead = anchor ? await this.alsoLiked(anchor.id, 12) : [];
    return { personalized: true, items, basedOn: becauseYouRead.length && anchor ? { title: anchor.title, slug: anchor.slug } : null, becauseYouRead };
  }

  private reasonOf(r: Row): Reason {
    const parts: Array<[Reason['kind'], number, Reason['label']]> = [
      ['search', Number(r.s_search) * 3, undefined],
      ['readers', Number(r.s_co) * 2, undefined],
      ['author', Number(r.s_author) * 1.5, (r.top_author as string | null) ?? undefined],
      ['genre', Number(r.s_genre), (r.top_genre as Record<string, string> | null) ?? undefined],
      ['category', Number(r.s_cat) * 0.6, (r.top_category as Record<string, string> | null) ?? undefined],
    ];
    const [kind, , label] = parts.sort((a, b) => b[1] - a[1])[0]!;
    return label ? { kind, label } : { kind };
  }

  /** Popular, well-rated books (the fallback when there's nothing personal to go on). */
  async popular(limit: number): Promise<Recommended[]> {
    const books = await this.catalog.bookCards([], sql`b.sales_count desc, b.rating_avg desc, b.view_count desc`, limit);
    return books.map((b) => ({ ...b, reason: { kind: 'popular' as const } }));
  }

  // ------------------------------------------------------------------ readers also liked

  /**
   * Books most often found alongside this one on readers' shelves and in their orders, counting only
   * readers who share their reading for recommendations and only books at least `minSupport` of them share.
   */
  async alsoLiked(bookId: string, limit = 12): Promise<BookCard[]> {
    const key = `also-liked:${bookId}:${limit}`;
    const cached = await this.redis.get(key).catch(() => null);
    if (cached) return JSON.parse(cached) as BookCard[];
    const min = await this.minSupport();
    const rows = await this.db.execute<Row>(sql`
      with holders as (
        select h.user_id from user_library h where h.book_id = ${bookId} and ${SHARING}
        union select h.user_id from (select o.user_id from order_items oi join orders o on o.id = oi.order_id
          where oi.book_id = ${bookId} and o.payment_status in ('paid', 'partially_refunded')) h where ${SHARING}
      ),
      together as (
        select l.book_id, l.user_id from user_library l where l.user_id in (select user_id from holders) and l.book_id <> ${bookId}
        union select oi.book_id, o.user_id from order_items oi join orders o on o.id = oi.order_id
          where o.user_id in (select user_id from holders) and oi.book_id is not null and oi.book_id <> ${bookId} and o.payment_status in ('paid', 'partially_refunded')
      ),
      ranked as (select book_id, count(distinct user_id) as n from together group by book_id having count(distinct user_id) >= ${min})
      select ${BOOK_CARD_COLUMNS} from ranked r join books b on b.id = r.book_id
      where ${AVAILABLE} order by r.n desc, b.rating_avg desc limit ${limit}`);
    const books = rows.rows.map((r) => this.catalog.toBookCard(r));
    await this.redis.set(key, JSON.stringify(books), 'EX', ALSO_LIKED_TTL).catch(() => undefined);
    return books;
  }
}
