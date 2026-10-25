import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  CUSTOM_SECTION_PREFIX,
  LIST_SECTION_TYPES,
  SINGLE_SECTION_TYPES,
  slugSuffix,
  type adminArticleQuerySchema,
  type articleSchema,
  type bannerSchema,
  type cmsPageCreateSchema,
  type cmsPageSchema,
  type faqSchema,
  type sectionCreateSchema,
  type sectionUpdateSchema,
  type testimonialSchema,
} from '@boikonika/shared';
import { articles, banners, cmsPages, faqs, homepageSections, testimonials, users, type Database, type HomepageSectionConfig } from '@boikonika/database';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { AuditService } from '../audit/audit.service';
import { HomeService } from '../catalog/home.service';
import { uniqueSlug } from '../marketplace/sellers.service';
import { CmsService } from './cms.service';

type Row = Record<string, unknown>;
const IMAGE = ['image/jpeg', 'image/png', 'image/webp'] as const;
const like = (q: string) => `%${q.replace(/[%_\\]/g, '')}%`;
/** Banners are cropped to fixed shapes so the homepage never jumps: 3:1 on wide screens, 4:3 on phones. */
const BANNER_IMAGE = { maxWidth: 1920, maxHeight: 640, format: 'webp' as const, crop: true };
const BANNER_MOBILE_IMAGE = { maxWidth: 960, maxHeight: 720, format: 'webp' as const, crop: true };
const COVER_IMAGE = { maxWidth: 1600, maxHeight: 900, format: 'webp' as const, crop: true };

/** Staff editing of pages, articles, FAQs, banners, the homepage and testimonials. Every change is audited. */
@Injectable()
export class CmsAdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly home: HomeService,
    private readonly cms: CmsService,
  ) {}

  // ------------------------------------------------------------------ pages

  async pages() {
    const rows = await this.db
      .select({ id: cmsPages.id, slug: cmsPages.slug, title: cmsPages.title, status: cmsPages.status, updatedAt: cmsPages.updatedAt, editor: users.displayName })
      .from(cmsPages)
      .leftJoin(users, eq(users.id, cmsPages.updatedBy))
      .orderBy(asc(cmsPages.slug));
    return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
  }

  async page(id: string) {
    const [p] = await this.db.select().from(cmsPages).where(eq(cmsPages.id, id));
    if (!p) throw AppException.notFound('Page');
    return { id: p.id, slug: p.slug, title: p.title, body: p.body, status: p.status, seoDescription: p.seo?.description ?? '', updatedAt: p.updatedAt.toISOString() };
  }

  async createPage(actorId: string, input: z.output<typeof cmsPageCreateSchema>) {
    const [taken] = await this.db.select({ id: cmsPages.id }).from(cmsPages).where(eq(cmsPages.slug, input.slug));
    if (taken) throw AppException.conflict('api.cms.slugTaken', 'slug');
    const [p] = await this.db
      .insert(cmsPages)
      .values({ slug: input.slug, title: input.title, body: input.body, status: input.status, seo: input.seoDescription ? { description: input.seoDescription } : null, updatedBy: actorId })
      .returning();
    await this.audit.record({ action: 'cms.page.create', entityType: 'cms_page', entityId: p!.id, actorId, after: { slug: p!.slug, status: p!.status } });
    return this.page(p!.id);
  }

  async updatePage(actorId: string, id: string, input: z.output<typeof cmsPageSchema>) {
    const before = await this.page(id);
    await this.db
      .update(cmsPages)
      .set({ title: input.title, body: input.body, status: input.status, seo: input.seoDescription ? { description: input.seoDescription } : null, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(cmsPages.id, id));
    await this.audit.record({
      action: 'cms.page.update',
      entityType: 'cms_page',
      entityId: id,
      actorId,
      before: { title: before.title, status: before.status, length: (before.body.bn ?? '').length + (before.body.en ?? '').length },
      after: { title: input.title, status: input.status, length: input.body.bn.length + input.body.en.length },
    });
    return this.page(id);
  }

  // ------------------------------------------------------------------ articles

  async articles(q: z.output<typeof adminArticleQuerySchema>) {
    const where = [sql`true`];
    if (q.kind) where.push(sql`a.kind = ${q.kind}`);
    if (q.status) where.push(sql`a.status = ${q.status}`);
    if (q.q) where.push(sql`(a.title ilike ${like(q.q)} or a.slug ilike ${like(q.q)})`);
    const condition = sql.join(where, sql` and `);
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select a.*, u.display_name, u.username, null as avatar_key from articles a left join users u on u.id = a.author_id
        where ${condition} order by a.updated_at desc limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from articles a where ${condition}`),
    ]);
    return {
      items: rows.rows.map((r) => ({ ...this.cms.card(r), status: r.status as string, viewCount: Number(r.view_count ?? 0), updatedAt: new Date(r.updated_at as string).toISOString() })),
      meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  async article(id: string) {
    const [a] = await this.db.select().from(articles).where(eq(articles.id, id));
    if (!a) throw AppException.notFound('Article');
    return {
      id: a.id,
      slug: a.slug,
      kind: a.kind,
      title: a.title,
      excerpt: a.excerpt ?? '',
      body: a.body,
      language: a.language,
      audience: a.audience,
      tags: a.tags ?? [],
      status: a.status,
      coverUrl: this.storage.publicUrl(a.coverKey),
      viewCount: a.viewCount,
      publishedAt: a.publishedAt?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  async createArticle(actorId: string, input: z.output<typeof articleSchema>) {
    const id = await this.db.transaction(async (tx) => {
      const slug = await uniqueSlug(tx, 'articles', input.title);
      const [a] = await tx
        .insert(articles)
        .values({ ...input, excerpt: input.excerpt || null, slug, authorId: actorId, publishedAt: input.status === 'published' ? new Date() : null })
        .returning({ id: articles.id });
      await this.audit.record({ action: 'cms.article.create', entityType: 'article', entityId: a!.id, actorId, after: { title: input.title, kind: input.kind, status: input.status } }, tx);
      return a!.id;
    });
    await this.home.invalidate();
    return this.article(id);
  }

  async updateArticle(actorId: string, id: string, input: z.output<typeof articleSchema>) {
    const before = await this.article(id);
    await this.db
      .update(articles)
      .set({
        ...input,
        excerpt: input.excerpt || null,
        // The first time it goes live is its publication date; later edits keep it.
        publishedAt: input.status === 'published' ? (before.publishedAt ? new Date(before.publishedAt) : new Date()) : before.publishedAt ? new Date(before.publishedAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id));
    await this.audit.record({ action: 'cms.article.update', entityType: 'article', entityId: id, actorId, before: { title: before.title, status: before.status }, after: { title: input.title, status: input.status } });
    await this.home.invalidate();
    return this.article(id);
  }

  async setArticleCover(actorId: string, id: string, file: Buffer) {
    const before = await this.article(id);
    const processed = await processUpload(file, { allowed: IMAGE, maxBytes: 5 * 1024 * 1024, image: COVER_IMAGE });
    const key = `articles/${id}/${randomUUID()}.${processed.extension}`;
    await this.storage.put('public', key, processed.body, processed.contentType);
    const [old] = await this.db.select({ key: articles.coverKey }).from(articles).where(eq(articles.id, id));
    await this.db.update(articles).set({ coverKey: key, updatedAt: new Date() }).where(eq(articles.id, id));
    if (old?.key) await this.storage.delete('public', old.key).catch(() => undefined);
    await this.audit.record({ action: 'cms.article.cover', entityType: 'article', entityId: id, actorId, after: { title: before.title } });
    await this.home.invalidate();
    return { coverUrl: this.storage.publicUrl(key) };
  }

  async deleteArticle(actorId: string, id: string) {
    const before = await this.article(id);
    const [old] = await this.db.delete(articles).where(eq(articles.id, id)).returning({ key: articles.coverKey });
    if (old?.key) await this.storage.delete('public', old.key).catch(() => undefined);
    await this.audit.record({ action: 'cms.article.delete', entityType: 'article', entityId: id, actorId, before: { title: before.title, slug: before.slug, status: before.status } });
    await this.home.invalidate();
    return { deleted: true };
  }

  // ------------------------------------------------------------------ FAQs

  async faqList() {
    const rows = await this.db.select().from(faqs).orderBy(asc(faqs.category), asc(faqs.position), asc(faqs.createdAt));
    return rows.map((f) => ({ id: f.id, category: f.category, question: f.question, answer: f.answer, isPublished: f.isPublished, position: f.position }));
  }

  async createFaq(actorId: string, input: z.output<typeof faqSchema>) {
    const [{ next } = { next: 0 }] = await this.db.execute<{ next: number }>(sql`select coalesce(max(position) + 1, 0)::int as next from faqs where category = ${input.category}`).then((r) => r.rows);
    const [f] = await this.db.insert(faqs).values({ ...input, position: next }).returning({ id: faqs.id });
    await this.audit.record({ action: 'cms.faq.create', entityType: 'faq', entityId: f!.id, actorId, after: { question: input.question.en, category: input.category } });
    return this.faqList();
  }

  async updateFaq(actorId: string, id: string, input: z.output<typeof faqSchema>) {
    const [f] = await this.db.update(faqs).set({ ...input, updatedAt: new Date() }).where(eq(faqs.id, id)).returning({ id: faqs.id });
    if (!f) throw AppException.notFound('FAQ');
    await this.audit.record({ action: 'cms.faq.update', entityType: 'faq', entityId: id, actorId, after: { question: input.question.en, isPublished: input.isPublished } });
    return this.faqList();
  }

  async deleteFaq(actorId: string, id: string) {
    const [f] = await this.db.delete(faqs).where(eq(faqs.id, id)).returning({ question: faqs.question });
    if (!f) throw AppException.notFound('FAQ');
    await this.audit.record({ action: 'cms.faq.delete', entityType: 'faq', entityId: id, actorId, before: { question: f.question?.en } });
    return this.faqList();
  }

  async reorderFaqs(actorId: string, ids: string[]) {
    await this.reorder('faqs', ids);
    await this.audit.record({ action: 'cms.faq.reorder', entityType: 'faq', actorId, after: { count: ids.length } });
    return this.faqList();
  }

  // ------------------------------------------------------------------ banners

  async bannerList() {
    const rows = await this.db.select().from(banners).orderBy(asc(banners.placement), asc(banners.position), asc(banners.createdAt));
    const now = Date.now();
    return rows.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? null,
      ctaLabel: b.ctaLabel ?? null,
      link: b.link ?? null,
      placement: b.placement,
      position: b.position,
      startsAt: b.startsAt?.toISOString() ?? null,
      endsAt: b.endsAt?.toISOString() ?? null,
      isActive: b.isActive,
      /** Whether visitors see it right now (switched on and inside its dates). */
      live: b.isActive && (!b.startsAt || b.startsAt.getTime() <= now) && (!b.endsAt || b.endsAt.getTime() > now),
      imageUrl: this.storage.publicUrl(b.imageKey),
      mobileImageUrl: this.storage.publicUrl(b.mobileImageKey),
    }));
  }

  private async bannerImage(file: Buffer, mobile: boolean) {
    const processed = await processUpload(file, { allowed: IMAGE, maxBytes: 8 * 1024 * 1024, image: mobile ? BANNER_MOBILE_IMAGE : BANNER_IMAGE });
    const key = `banners/${randomUUID()}.${processed.extension}`;
    await this.storage.put('public', key, processed.body, processed.contentType);
    return key;
  }

  async createBanner(actorId: string, input: z.output<typeof bannerSchema>, image?: Buffer, mobileImage?: Buffer) {
    if (!image) throw AppException.validation([{ field: 'image', code: 'required', message: 'validation.required' }]);
    const imageKey = await this.bannerImage(image, false);
    const mobileImageKey = mobileImage ? await this.bannerImage(mobileImage, true) : null;
    const [{ next } = { next: 0 }] = await this.db.execute<{ next: number }>(sql`select coalesce(max(position) + 1, 0)::int as next from banners where placement = ${input.placement}`).then((r) => r.rows);
    const [b] = await this.db
      .insert(banners)
      .values({ ...this.bannerValues(input), imageKey, mobileImageKey, position: next, createdBy: actorId })
      .returning({ id: banners.id });
    await this.audit.record({ action: 'cms.banner.create', entityType: 'banner', entityId: b!.id, actorId, after: { title: input.title.en, placement: input.placement, link: input.link ?? null } });
    await this.home.invalidate();
    return this.bannerList();
  }

  async updateBanner(actorId: string, id: string, input: z.output<typeof bannerSchema>, image?: Buffer, mobileImage?: Buffer, removeMobile = false) {
    const [old] = await this.db.select().from(banners).where(eq(banners.id, id));
    if (!old) throw AppException.notFound('Banner');
    const imageKey = image ? await this.bannerImage(image, false) : old.imageKey;
    const mobileImageKey = mobileImage ? await this.bannerImage(mobileImage, true) : removeMobile ? null : old.mobileImageKey;
    await this.db.update(banners).set({ ...this.bannerValues(input), imageKey, mobileImageKey, updatedAt: new Date() }).where(eq(banners.id, id));
    if (imageKey !== old.imageKey) await this.storage.delete('public', old.imageKey).catch(() => undefined);
    if (old.mobileImageKey && mobileImageKey !== old.mobileImageKey) await this.storage.delete('public', old.mobileImageKey).catch(() => undefined);
    await this.audit.record({ action: 'cms.banner.update', entityType: 'banner', entityId: id, actorId, before: { title: old.title.en, isActive: old.isActive }, after: { title: input.title.en, isActive: input.isActive, link: input.link ?? null } });
    await this.home.invalidate();
    return this.bannerList();
  }

  private bannerValues(input: z.output<typeof bannerSchema>) {
    return {
      title: input.title,
      subtitle: input.subtitle ?? null,
      ctaLabel: input.ctaLabel ?? null,
      link: input.link || null,
      placement: input.placement,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive,
    };
  }

  async deleteBanner(actorId: string, id: string) {
    const [old] = await this.db.delete(banners).where(eq(banners.id, id)).returning();
    if (!old) throw AppException.notFound('Banner');
    await Promise.all([old.imageKey, old.mobileImageKey].filter((k): k is string => !!k).map((k) => this.storage.delete('public', k).catch(() => undefined)));
    // Sections that picked this banner by hand no longer point at it.
    await this.db.execute(sql`
      update homepage_sections set config = jsonb_set(config, '{bannerIds}', coalesce((select jsonb_agg(v) from jsonb_array_elements(config->'bannerIds') v where v <> to_jsonb(${id}::text)), '[]'::jsonb))
      where config ? 'bannerIds'`);
    await this.audit.record({ action: 'cms.banner.delete', entityType: 'banner', entityId: id, actorId, before: { title: old.title.en } });
    await this.home.invalidate();
    return this.bannerList();
  }

  async reorderBanners(actorId: string, ids: string[]) {
    await this.reorder('banners', ids);
    await this.audit.record({ action: 'cms.banner.reorder', entityType: 'banner', actorId, after: { count: ids.length } });
    await this.home.invalidate();
    return this.bannerList();
  }

  // ------------------------------------------------------------------ homepage sections

  async sections() {
    const rows = await this.db.select().from(homepageSections).orderBy(asc(homepageSections.position), asc(homepageSections.createdAt));
    const bookIds = [...new Set(rows.flatMap((r) => r.config?.bookIds ?? []))];
    const categoryIds = [...new Set(rows.map((r) => r.config?.categoryId).filter((v): v is string => !!v))];
    const [bookRows, categoryRows] = await Promise.all([
      bookIds.length ? this.db.execute<{ id: string; title: string; slug: string; cover_key: string | null }>(sql`select id, title, slug, cover_key from books where id in (${sql.join(bookIds.map((id) => sql`${id}::uuid`), sql`, `)})`) : null,
      categoryIds.length ? this.db.execute<{ id: string; name: unknown; path: string }>(sql`select id, name, path from categories where id in (${sql.join(categoryIds.map((id) => sql`${id}::uuid`), sql`, `)})`) : null,
    ]);
    return rows.map((s) => ({
      id: s.id,
      key: s.key,
      type: s.type,
      title: s.title,
      subtitle: s.subtitle ?? null,
      isEnabled: s.isEnabled,
      position: s.position,
      custom: s.key.startsWith(CUSTOM_SECTION_PREFIX),
      config: { limit: s.config?.limit, source: s.config?.source, bookIds: s.config?.bookIds ?? [], categoryId: s.config?.categoryId, bannerIds: s.config?.bannerIds ?? [] },
      books: (s.config?.bookIds ?? [])
        .map((id) => bookRows?.rows.find((b) => b.id === id))
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map((b) => ({ id: b.id, title: b.title, slug: b.slug, coverUrl: this.storage.publicUrl(b.cover_key) })),
      category: s.config?.categoryId ? (categoryRows?.rows.find((c) => c.id === s.config?.categoryId) ?? null) : null,
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  /** Keeps only the settings that mean something for the section's type, and checks what they point at. */
  private async sectionConfig(type: string, config: z.output<typeof sectionUpdateSchema>['config'], existing: HomepageSectionConfig = {}): Promise<HomepageSectionConfig> {
    if ((SINGLE_SECTION_TYPES as readonly string[]).includes(type)) return { content: existing.content };
    const out: HomepageSectionConfig = {};
    if ((LIST_SECTION_TYPES as readonly string[]).includes(type)) out.limit = config.limit ?? existing.limit ?? (type === 'book_list' ? 12 : 8);
    if (type === 'book_list') {
      if (!config.source) throw AppException.validation([{ field: 'config.source', code: 'required', message: 'validation.required' }]);
      out.source = config.source;
      if (config.source === 'manual') {
        const found = await this.db.execute<{ id: string }>(sql`select id from books where id in (${sql.join(config.bookIds!.map((id) => sql`${id}::uuid`), sql`, `)})`);
        const ids = config.bookIds!.filter((id, i, all) => all.indexOf(id) === i && found.rows.some((r) => r.id === id));
        if (!ids.length) throw AppException.validation([{ field: 'config.bookIds', code: 'invalid', message: 'validation.pickBooks' }]);
        out.bookIds = ids;
      }
      if (config.source === 'category') {
        const [c] = await this.db.execute<{ id: string }>(sql`select id from categories where id = ${config.categoryId!}::uuid and is_active`).then((r) => r.rows);
        if (!c) throw AppException.validation([{ field: 'config.categoryId', code: 'invalid', message: 'validation.invalidChoice' }]);
        out.categoryId = c.id;
      }
    }
    if (type === 'banner' && config.bannerIds?.length) {
      const found = await this.db.select({ id: banners.id }).from(banners).where(inArray(banners.id, config.bannerIds));
      out.bannerIds = config.bannerIds.filter((id) => found.some((b) => b.id === id));
    }
    return out;
  }

  async createSection(actorId: string, input: z.output<typeof sectionCreateSchema>) {
    const config = await this.sectionConfig(input.type, input.config);
    const [{ next } = { next: 0 }] = await this.db.execute<{ next: number }>(sql`select coalesce(max(position) + 1, 0)::int as next from homepage_sections`).then((r) => r.rows);
    const [s] = await this.db
      .insert(homepageSections)
      .values({ key: `${CUSTOM_SECTION_PREFIX}${slugSuffix(8)}`, type: input.type as never, title: input.title, subtitle: input.subtitle ?? null, config, position: next, isEnabled: input.isEnabled, updatedBy: actorId })
      .returning({ id: homepageSections.id });
    await this.audit.record({ action: 'cms.section.create', entityType: 'homepage_section', entityId: s!.id, actorId, after: { type: input.type, title: input.title.en, config } });
    await this.home.invalidate();
    return this.sections();
  }

  async updateSection(actorId: string, id: string, input: z.output<typeof sectionUpdateSchema>) {
    const [old] = await this.db.select().from(homepageSections).where(eq(homepageSections.id, id));
    if (!old) throw AppException.notFound('Section');
    const config = await this.sectionConfig(old.type, input.config, old.config ?? {});
    await this.db
      .update(homepageSections)
      .set({ title: input.title, subtitle: input.subtitle ?? null, isEnabled: input.isEnabled, config, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(homepageSections.id, id));
    await this.audit.record({
      action: 'cms.section.update',
      entityType: 'homepage_section',
      entityId: id,
      actorId,
      before: { title: old.title.en, isEnabled: old.isEnabled, config: old.config },
      after: { title: input.title.en, isEnabled: input.isEnabled, config },
    });
    await this.home.invalidate();
    return this.sections();
  }

  async deleteSection(actorId: string, id: string) {
    const [old] = await this.db.select().from(homepageSections).where(eq(homepageSections.id, id));
    if (!old) throw AppException.notFound('Section');
    // Built-in sections come back with every deploy's seed, so they are switched off instead.
    if (!old.key.startsWith(CUSTOM_SECTION_PREFIX)) throw AppException.badRequest('api.cms.builtInSection');
    await this.db.delete(homepageSections).where(eq(homepageSections.id, id));
    await this.audit.record({ action: 'cms.section.delete', entityType: 'homepage_section', entityId: id, actorId, before: { type: old.type, title: old.title.en } });
    await this.home.invalidate();
    return this.sections();
  }

  async reorderSections(actorId: string, ids: string[]) {
    await this.reorder('homepage_sections', ids);
    await this.audit.record({ action: 'cms.section.reorder', entityType: 'homepage_section', actorId, after: { order: ids } });
    await this.home.invalidate();
    return this.sections();
  }

  // ------------------------------------------------------------------ testimonials

  async testimonialList() {
    const rows = await this.db.select().from(testimonials).orderBy(asc(testimonials.position), desc(testimonials.createdAt));
    return rows.map((r) => ({ id: r.id, name: r.name, role: r.role ?? null, quote: r.quote, consentGivenAt: r.consentGivenAt.toISOString(), isPublished: r.isPublished, position: r.position }));
  }

  async createTestimonial(actorId: string, input: z.output<typeof testimonialSchema>) {
    const [{ next } = { next: 0 }] = await this.db.execute<{ next: number }>(sql`select coalesce(max(position) + 1, 0)::int as next from testimonials`).then((r) => r.rows);
    const [r] = await this.db.insert(testimonials).values({ ...input, role: input.role ?? null, position: next }).returning({ id: testimonials.id });
    await this.audit.record({ action: 'cms.testimonial.create', entityType: 'testimonial', entityId: r!.id, actorId, after: { name: input.name, consentGivenAt: input.consentGivenAt.toISOString() } });
    await this.home.invalidate();
    return this.testimonialList();
  }

  async updateTestimonial(actorId: string, id: string, input: z.output<typeof testimonialSchema>) {
    const [r] = await this.db.update(testimonials).set({ ...input, role: input.role ?? null, updatedAt: new Date() }).where(eq(testimonials.id, id)).returning({ id: testimonials.id });
    if (!r) throw AppException.notFound('Testimonial');
    await this.audit.record({ action: 'cms.testimonial.update', entityType: 'testimonial', entityId: id, actorId, after: { name: input.name, isPublished: input.isPublished } });
    await this.home.invalidate();
    return this.testimonialList();
  }

  async deleteTestimonial(actorId: string, id: string) {
    const [r] = await this.db.delete(testimonials).where(eq(testimonials.id, id)).returning({ name: testimonials.name });
    if (!r) throw AppException.notFound('Testimonial');
    await this.audit.record({ action: 'cms.testimonial.delete', entityType: 'testimonial', entityId: id, actorId, before: { name: r.name } });
    await this.home.invalidate();
    return this.testimonialList();
  }

  async reorderTestimonials(actorId: string, ids: string[]) {
    await this.reorder('testimonials', ids);
    await this.audit.record({ action: 'cms.testimonial.reorder', entityType: 'testimonial', actorId, after: { count: ids.length } });
    await this.home.invalidate();
    return this.testimonialList();
  }

  /** Sets position = index for the given ids; ids not in the table are ignored. */
  private async reorder(table: 'faqs' | 'banners' | 'homepage_sections' | 'testimonials', ids: string[]) {
    const unique = ids.filter((id, i) => ids.indexOf(id) === i);
    await this.db.execute(sql`
      update ${sql.identifier(table)} t set position = o.position - 1, updated_at = now()
      from unnest(array[${sql.join(unique.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[]) with ordinality as o(id, position) where t.id = o.id`);
  }
}
