import { Inject, Injectable } from '@nestjs/common';
import { categories, homepageSections, readingChallenges, type Database, type HomepageSectionConfig } from '@boikonika/database';
import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { CatalogService } from './catalog.service';

const CACHE_KEY = 'home:v1';
const CACHE_SECONDS = 60;

/** Resolves the admin-configured homepage sections into data (cached briefly; same for every visitor). */
@Injectable()
export class HomeService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly catalog: CatalogService,
  ) {}

  async sections() {
    const cached = await this.redis.get(CACHE_KEY).catch(() => null);
    if (cached) return JSON.parse(cached) as Awaited<ReturnType<HomeService['build']>>;
    const built = await this.build();
    await this.redis.set(CACHE_KEY, JSON.stringify(built), 'EX', CACHE_SECONDS).catch(() => undefined);
    return built;
  }

  async invalidate(): Promise<void> {
    await this.redis.del(CACHE_KEY).catch(() => undefined);
  }

  private async build() {
    const rows = await this.db.select().from(homepageSections).where(eq(homepageSections.isEnabled, true)).orderBy(asc(homepageSections.position));
    const resolved = await Promise.all(
      rows.map(async (s) => {
        const config = (s.config ?? {}) as HomepageSectionConfig;
        const limit = Math.min(config.limit ?? 12, 24);
        let items: unknown[] = [];
        switch (s.type) {
          case 'book_list':
            items = await this.books(config, limit);
            break;
          case 'category_grid':
            items = await this.db
              .select({ slug: categories.slug, path: categories.path, name: categories.name, icon: categories.icon })
              .from(categories)
              .where(and(eq(categories.depth, 1), eq(categories.isActive, true), sql`${categories.path} like 'books/%'`))
              .orderBy(asc(categories.position))
              .limit(limit);
            break;
          case 'author_list':
            items = await this.catalog.authorList(undefined, 1, limit);
            break;
          case 'featured_sellers':
            items = await this.catalog.featuredStores(limit);
            break;
          case 'reading_challenges':
            items = await this.db
              .select({ slug: readingChallenges.slug, title: readingChallenges.title, description: readingChallenges.description, type: readingChallenges.type, target: readingChallenges.target, durationDays: readingChallenges.durationDays, xpReward: readingChallenges.xpReward, participantCount: readingChallenges.participantCount })
              .from(readingChallenges)
              .where(and(eq(readingChallenges.isActive, true), isNull(readingChallenges.endsAt)))
              .orderBy(asc(readingChallenges.durationDays))
              .limit(limit);
            break;
          default:
            items = [];
        }
        return { key: s.key, type: s.type, title: s.title, subtitle: s.subtitle, config: { source: config.source, content: config.content }, items };
      }),
    );
    // Data-driven shelves with nothing to show are left out; static blocks (hero, why us…) always stay.
    const dataTypes = new Set(['book_list', 'category_grid', 'author_list', 'featured_sellers', 'reading_challenges', 'book_clubs', 'articles', 'testimonials']);
    return resolved.filter((s) => !dataTypes.has(s.type) || s.items.length > 0);
  }

  private books(config: HomepageSectionConfig, limit: number) {
    const where: SQL[] = [];
    let order: SQL = sql`b.sales_count desc, b.rating_avg desc`;
    switch (config.source) {
      case 'manual':
        if (!config.bookIds?.length) return Promise.resolve([]);
        where.push(sql`b.id in (${sql.join(config.bookIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
        order = sql`array_position(array[${sql.join(config.bookIds.map((id) => sql`${id}::uuid`), sql`, `)}], b.id)`;
        break;
      case 'trending':
        order = sql`coalesce((select sum(d.views + d.sales * 10) from book_daily_stats d where d.book_id = b.id and d.day > now() - interval '7 days'), 0) desc, b.view_count desc, b.sales_count desc`;
        break;
      case 'new_releases':
        order = sql`coalesce(b.first_published_year, 0) >= extract(year from now())::int - 1 desc, b.published_at desc`;
        break;
      case 'editors_picks':
        where.push(sql`b.editors_pick`);
        break;
      case 'student_picks':
        where.push(sql`b.student_pick`);
        break;
      case 'teacher_picks':
        where.push(sql`b.teacher_pick`);
        break;
      case 'discounted':
        where.push(sql`exists(select 1 from products p where p.book_id = b.id and p.status = 'active' and p.deleted_at is null and p.compare_at_price > p.price)`);
        order = sql`(select max((p.compare_at_price - p.price) / nullif(p.compare_at_price, 0)) from products p where p.book_id = b.id and p.status = 'active' and p.deleted_at is null) desc nulls last`;
        break;
      case 'used':
        where.push(sql`exists(select 1 from products p where p.book_id = b.id and p.status = 'active' and p.deleted_at is null and p.condition <> 'new')`);
        order = sql`b.min_price asc`;
        break;
      case 'free':
        where.push(sql`b.is_free`);
        break;
      case 'hidden_gems':
        where.push(sql`b.rating_avg >= 4 and b.rating_count >= 3`);
        order = sql`b.sales_count asc, b.rating_avg desc`;
        break;
      case 'category':
        if (config.categoryId) where.push(sql`exists(select 1 from book_categories bc where bc.book_id = b.id and bc.category_id = ${config.categoryId}::uuid)`);
        break;
      default:
        break;
    }
    return this.catalog.bookCards(where, sql`${order}, b.id`, limit);
  }
}
