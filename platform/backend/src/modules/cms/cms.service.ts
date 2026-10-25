import { Inject, Injectable } from '@nestjs/common';
import { BLOG_KINDS, markdownToText, type ArticleKind, type articleListQuerySchema } from '@boikonika/shared';
import { banners, cmsPages, faqs, testimonials, type Database } from '@boikonika/database';
import { and, asc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { StorageService } from '../../infra/storage/storage.service';

type Row = Record<string, unknown>;
const WORDS_PER_MINUTE = 200;
const like = (q: string) => `%${q.replace(/[%_\\]/g, '')}%`;

/** Reading time from the number of words (Bangla and English words are both space-separated). */
export const readMinutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE));

/** Public content: pages, help, articles, banners and testimonials. Drafts never leave this service. */
@Injectable()
export class CmsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly storage: StorageService,
  ) {}

  async page(slug: string) {
    const [p] = await this.db.select().from(cmsPages).where(and(eq(cmsPages.slug, slug), eq(cmsPages.status, 'published')));
    if (!p) throw AppException.notFound('Page');
    return { slug: p.slug, title: p.title, body: p.body, seoDescription: p.seo?.description ?? null, updatedAt: p.updatedAt.toISOString() };
  }

  /** Published page slugs and titles (for the sitemap and policy links). */
  async pages() {
    const rows = await this.db.select({ slug: cmsPages.slug, title: cmsPages.title, updatedAt: cmsPages.updatedAt }).from(cmsPages).where(eq(cmsPages.status, 'published')).orderBy(asc(cmsPages.slug));
    return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
  }

  async faqs() {
    const rows = await this.db.select().from(faqs).where(eq(faqs.isPublished, true)).orderBy(asc(faqs.category), asc(faqs.position), asc(faqs.createdAt));
    return rows.map((f) => ({ id: f.id, category: f.category, question: f.question, answer: f.answer }));
  }

  async articles(q: z.output<typeof articleListQuerySchema>) {
    const where = [sql`a.status = 'published'`, q.kind ? sql`a.kind = ${q.kind}` : sql`a.kind in (${sql.join(BLOG_KINDS.map((k) => sql`${k}`), sql`, `)})`];
    if (q.audience) where.push(sql`a.audience in (${q.audience}, 'all')`);
    if (q.q) where.push(sql`(a.title % ${q.q} or a.title ilike ${like(q.q)} or a.excerpt ilike ${like(q.q)} or ${q.q} = any(a.tags))`);
    const condition = sql.join(where, sql` and `);
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select a.*, u.display_name, u.username, p.avatar_key from articles a
        left join users u on u.id = a.author_id left join user_profiles p on p.user_id = a.author_id
        where ${condition}
        order by ${q.q ? sql`similarity(a.title, ${q.q}) desc,` : sql``} a.published_at desc nulls last
        limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from articles a where ${condition}`),
    ]);
    return { items: rows.rows.map((r) => this.card(r)), meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.n ?? 0 } };
  }

  /** The latest published articles of the given kinds (homepage). */
  async latest(kinds: readonly ArticleKind[], limit: number) {
    const rows = await this.db.execute<Row>(sql`
      select a.*, u.display_name, u.username, p.avatar_key from articles a
      left join users u on u.id = a.author_id left join user_profiles p on p.user_id = a.author_id
      where a.status = 'published' and a.kind in (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})
      order by a.published_at desc nulls last limit ${limit}`);
    return rows.rows.map((r) => this.card(r));
  }

  async article(slug: string, viewer: string | undefined) {
    const [r] = await this.db
      .execute<Row>(sql`
        select a.*, u.display_name, u.username, p.avatar_key from articles a
        left join users u on u.id = a.author_id left join user_profiles p on p.user_id = a.author_id
        where a.slug = ${slug} and a.status = 'published'`)
      .then((x) => x.rows);
    if (!r) throw AppException.notFound('Article');
    // One view per reader (or address) per article per day.
    if (viewer) {
      const fresh = await this.redis.set(`view:a:${r.id as string}:${viewer}`, '1', 'EX', 86_400, 'NX').catch(() => null);
      if (fresh) await this.db.execute(sql`update articles set view_count = view_count + 1 where id = ${r.id as string}`);
    }
    const related = await this.db.execute<Row>(sql`
      select a.*, u.display_name, u.username, p.avatar_key from articles a
      left join users u on u.id = a.author_id left join user_profiles p on p.user_id = a.author_id
      where a.status = 'published' and a.kind = ${r.kind as string} and a.id <> ${r.id as string}
      order by (a.tags && array[${sql.join(((r.tags as string[] | null) ?? []).map((tag) => sql`${tag}`), sql`, `)}]::text[]) desc, a.published_at desc nulls last limit 3`);
    return { ...this.card(r), body: r.body as string, viewCount: Number(r.view_count ?? 0), updatedAt: new Date(r.updated_at as string).toISOString(), related: related.rows.map((x) => this.card(x)) };
  }

  /** Help centre search over FAQs (both languages) and help articles. */
  async helpSearch(q: string) {
    const pattern = like(q);
    const [faqRows, articleRows] = await Promise.all([
      this.db.execute<Row>(sql`
        select id, category, question, answer from faqs where is_published
          and (question->>'bn' ilike ${pattern} or question->>'en' ilike ${pattern} or answer->>'bn' ilike ${pattern} or answer->>'en' ilike ${pattern})
        order by position limit 20`),
      this.db.execute<Row>(sql`
        select a.*, null as display_name, null as username, null as avatar_key from articles a
        where a.status = 'published' and a.kind = 'help' and (a.title % ${q} or a.title ilike ${pattern} or a.body ilike ${pattern})
        order by similarity(a.title, ${q}) desc limit 10`),
    ]);
    return {
      faqs: faqRows.rows.map((f) => ({ id: f.id as string, category: f.category as string, question: f.question, answer: f.answer })),
      articles: articleRows.rows.map((r) => this.card(r)),
    };
  }

  /** Banners that are switched on and inside their schedule. */
  async banners(placement: string, ids?: string[]) {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(banners)
      .where(
        and(
          eq(banners.isActive, true),
          ids?.length ? sql`${banners.id} in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})` : eq(banners.placement, placement),
          or(isNull(banners.startsAt), lte(banners.startsAt, now)),
          or(isNull(banners.endsAt), gt(banners.endsAt, now)),
        ),
      )
      .orderBy(asc(banners.position), asc(banners.createdAt));
    const ordered = ids?.length ? ids.map((id) => rows.find((b) => b.id === id)).filter((b): b is (typeof rows)[number] => !!b) : rows;
    return ordered.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? null,
      ctaLabel: b.ctaLabel ?? null,
      link: b.link ?? null,
      imageUrl: this.storage.publicUrl(b.imageKey),
      mobileImageUrl: this.storage.publicUrl(b.mobileImageKey),
    }));
  }

  async testimonials(limit: number) {
    const rows = await this.db.select().from(testimonials).where(eq(testimonials.isPublished, true)).orderBy(asc(testimonials.position), asc(testimonials.createdAt)).limit(limit);
    return rows.map((r) => ({ id: r.id, name: r.name, role: r.role ?? null, quote: r.quote, avatarUrl: this.storage.publicUrl(r.avatarKey) }));
  }

  card(r: Row) {
    const body = (r.body as string) ?? '';
    return {
      id: r.id as string,
      slug: r.slug as string,
      kind: r.kind as ArticleKind,
      title: r.title as string,
      excerpt: (r.excerpt as string | null) || markdownToText(body, 220),
      coverUrl: this.storage.publicUrl(r.cover_key as string | null),
      language: r.language as string,
      audience: r.audience as string,
      tags: (r.tags as string[] | null) ?? [],
      readMinutes: readMinutes(body),
      author: r.display_name ? { name: r.display_name as string, username: (r.username as string | null) ?? null, avatarUrl: this.storage.publicUrl(r.avatar_key as string | null) } : null,
      publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
    };
  }
}
