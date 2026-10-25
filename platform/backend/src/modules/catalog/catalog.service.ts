import { Inject, Injectable } from '@nestjs/common';
import { authors, categories, follows, genres, publishers, sellerStores, type Database, type DbOrTx } from '@boikonika/database';
import { bookListQuerySchema, productListQuerySchema } from '@boikonika/shared';
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import type Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { requestContext } from '../../common/context/request-context';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { StorageService } from '../../infra/storage/storage.service';
import { ACTIVE_OFFER, BOOK_CARD_COLUMNS, bookSearch, inCategory, PRODUCT_CARD_COLUMNS, productSearch } from './catalog.sql';
import type { BookCard, Page, ProductCard } from './catalog.types';

export type BookListQuery = z.output<typeof bookListQuerySchema>;
export type ProductListQuery = z.output<typeof productListQuerySchema>;

type Row = Record<string, unknown>;

/** Public catalogue reads: listings, detail pages, authors, publishers, stores. */
@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly storage: StorageService,
  ) {}

  // ------------------------------------------------------------------ shared helpers

  /** Runs a search query with typo-tolerance thresholds tuned for short Bangla/English queries. */
  async searching<T>(fn: (tx: DbOrTx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`set local pg_trgm.similarity_threshold = 0.3`);
      await tx.execute(sql`set local pg_trgm.word_similarity_threshold = 0.45`);
      return fn(tx);
    });
  }

  toBookCard(r: Row): BookCard {
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      language: r.language as string,
      coverUrl: this.storage.publicUrl(r.cover_key as string | null),
      authors: (r.authors as BookCard['authors']) ?? [],
      minPrice: (r.min_price as string | null) ?? null,
      compareAtPrice: (r.compare_at_price as string | null) ?? null,
      offerCount: Number(r.offer_count ?? 0),
      inStock: !!r.in_stock,
      hasUsed: !!r.has_used,
      isFree: !!r.is_free,
      ratingAvg: Number(r.rating_avg ?? 0),
      ratingCount: Number(r.rating_count ?? 0),
    };
  }

  toProductCard(r: Row): ProductCard {
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      imageUrl: this.storage.publicUrl(r.image_key as string | null),
      price: r.price as string,
      compareAtPrice: (r.compare_at_price as string | null) ?? null,
      inStock: Number(r.total_stock ?? 0) > 0,
      ratingAvg: Number(r.rating_avg ?? 0),
      ratingCount: Number(r.rating_count ?? 0),
      store: r.store_slug ? { name: r.store_name as string, slug: r.store_slug as string } : null,
    };
  }

  /** Books that can be bought (or read for free), with optional extra conditions, ordered and limited. */
  async bookCards(where: SQL[], order: SQL, limit: number, tx: DbOrTx = this.db): Promise<BookCard[]> {
    const rows = await tx.execute<Row>(sql`
      select ${BOOK_CARD_COLUMNS} from books b
      where b.status = 'published' and b.deleted_at is null and (b.offer_count > 0 or b.is_free)
      ${where.length ? sql` and ${sql.join(where, sql` and `)}` : sql``}
      order by ${order} limit ${limit}`);
    return rows.rows.map((r) => this.toBookCard(r));
  }

  // ------------------------------------------------------------------ books

  async listBooks(q: BookListQuery): Promise<Page<BookCard>> {
    const where: SQL[] = [];
    let score: SQL | null = null;
    if (q.q) {
      const search = bookSearch(q.q.normalize('NFC'));
      where.push(search.where);
      score = search.score;
    }
    if (q.category) where.push(sql`exists(select 1 from book_categories bc where bc.book_id = b.id and ${inCategory(sql`bc.category_id`, q.category)})`);
    if (q.genre) where.push(sql`exists(select 1 from book_genres bg join genres g on g.id = bg.genre_id where bg.book_id = b.id and g.key = ${q.genre})`);
    if (q.author) where.push(sql`exists(select 1 from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id and a.slug = ${q.author})`);
    if (q.publisher) where.push(sql`exists(select 1 from book_publishers bp join publishers pu on pu.id = bp.publisher_id where bp.book_id = b.id and pu.slug = ${q.publisher})`);
    if (q.store) where.push(sql`exists(select 1 from products p join seller_stores s on s.seller_id = p.seller_id where p.book_id = b.id and ${ACTIVE_OFFER} and s.slug = ${q.store})`);
    if (q.language?.length) where.push(sql`b.language in (${sql.join(q.language.map((l) => sql`${l}`), sql`, `)})`);
    if (q.condition?.length) where.push(sql`exists(select 1 from products p where p.book_id = b.id and ${ACTIVE_OFFER} and p.condition::text in (${sql.join(q.condition.map((c) => sql`${c}`), sql`, `)}))`);
    if (q.format?.length) where.push(sql`exists(select 1 from products p join book_formats f on f.id = p.book_format_id where p.book_id = b.id and ${ACTIVE_OFFER} and f.format::text in (${sql.join(q.format.map((f) => sql`${f}`), sql`, `)}))`);
    if (q.ageGroup) where.push(sql`b.age_group = ${q.ageGroup}`);
    if (q.academicLevel) where.push(sql`b.academic_level = ${q.academicLevel}`);
    if (q.minPrice !== undefined) where.push(sql`b.min_price >= ${q.minPrice}`);
    if (q.maxPrice !== undefined) where.push(sql`b.min_price <= ${q.maxPrice}`);
    if (q.minRating !== undefined) where.push(sql`b.rating_avg >= ${q.minRating}`);
    if (q.inStock) where.push(sql`exists(select 1 from products p where p.book_id = b.id and ${ACTIVE_OFFER} and p.total_stock > 0)`);
    if (q.discounted) where.push(sql`exists(select 1 from products p where p.book_id = b.id and ${ACTIVE_OFFER} and p.compare_at_price > p.price)`);
    if (q.free) where.push(sql`b.is_free`);
    if (q.pick) where.push(q.pick === 'editors' ? sql`b.editors_pick` : q.pick === 'students' ? sql`b.student_pick` : sql`b.teacher_pick`);

    const order = this.bookOrder(q.sort, score);
    const run = async (tx: DbOrTx) => {
      const base = sql`from books b where b.status = 'published' and b.deleted_at is null and (b.offer_count > 0 or b.is_free) ${where.length ? sql` and ${sql.join(where, sql` and `)}` : sql``}`;
      const [rows, total] = await Promise.all([
        tx.execute<Row>(sql`select ${BOOK_CARD_COLUMNS} ${base} order by ${order} limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
        tx.execute<{ total: number }>(sql`select count(*)::int as total ${base}`),
      ]);
      return { items: rows.rows.map((r) => this.toBookCard(r)), meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.total ?? 0 } };
    };
    const result = q.q ? await this.searching(run) : await run(this.db);
    if (q.q && q.page === 1) void this.recordSearch(q.q, result.meta.total);
    return result;
  }

  private bookOrder(sort: BookListQuery['sort'], score: SQL | null): SQL {
    switch (sort) {
      case 'newest':
        return sql`b.published_at desc, b.id`;
      case 'popular':
        return sql`b.sales_count desc, b.view_count desc, b.id`;
      case 'price_asc':
        return sql`b.min_price asc nulls last, b.id`;
      case 'price_desc':
        return sql`b.min_price desc nulls last, b.id`;
      case 'rating':
        return sql`b.rating_avg desc, b.rating_count desc, b.id`;
      default:
        return score ? sql`${score} desc, b.sales_count desc, b.id` : sql`b.sales_count desc, b.rating_avg desc, b.published_at desc, b.id`;
    }
  }

  async bookDetail(slug: string) {
    const [book] = await this.db.execute<Row>(sql`
      select b.*, b.rating_avg::float as rating_avg_f from books b where b.slug = ${slug} and b.status = 'published' and b.deleted_at is null`).then((r) => r.rows);
    if (!book) throw AppException.notFound('Book');
    const id = book.id as string;
    const [people, cats, genreRows, formats, offers, images, previews, ratings, related] = await Promise.all([
      this.db.execute<Row>(sql`
        select a.id, a.slug, a.name, a.name_alt, a.photo_key, a.is_verified, ba.role from book_authors ba join authors a on a.id = ba.author_id
        where ba.book_id = ${id} order by ba.role = 'author' desc, ba.position`),
      this.db.execute<Row>(sql`
        select c.id, c.slug, c.path, c.name, c.id = ${book.primary_category_id as string} as is_primary
        from book_categories bc join categories c on c.id = bc.category_id where bc.book_id = ${id} order by c.depth desc`),
      this.db.execute<Row>(sql`select g.key, g.name from book_genres bg join genres g on g.id = bg.genre_id where bg.book_id = ${id} order by g.position`),
      this.db.execute<Row>(sql`
        select f.id, f.format, f.isbn13, f.isbn10, f.edition, f.publication_year, f.pages, f.cover_key, pu.name as publisher_name, pu.slug as publisher_slug
        from book_formats f left join publishers pu on pu.id = f.publisher_id where f.book_id = ${id} order by f.publication_year desc nulls last`),
      this.db.execute<Row>(sql`
        select p.id, p.slug, p.condition, p.condition_note, p.price, p.compare_at_price, p.total_stock, p.book_format_id, p.rating_avg::float as rating_avg,
          s.name as store_name, s.slug as store_slug, s.district, s.rating_avg::float as store_rating, s.rating_count as store_rating_count,
          (select v.id from product_variants v where v.product_id = p.id and v.is_active order by v.is_default desc, v.position limit 1) as variant_id
        from products p join seller_stores s on s.seller_id = p.seller_id join sellers se on se.id = p.seller_id
        where p.book_id = ${id} and ${ACTIVE_OFFER} and se.status = 'active'
        order by (p.total_stock > 0) desc, p.price asc`),
      this.db.execute<Row>(sql`select storage_key, alt, kind from book_images where book_id = ${id} order by position`),
      this.db.execute<Row>(sql`select id, kind, title, preview_percent from book_previews where book_id = ${id} order by position`),
      this.db.execute<Row>(sql`select rating, count(*)::int as count from reviews where book_id = ${id} and status = 'published' group by rating`),
      this.bookCards(
        [
          sql`b.id <> ${id}`,
          sql`(b.primary_category_id = ${book.primary_category_id as string} or exists(select 1 from book_authors x join book_authors y on y.author_id = x.author_id where x.book_id = b.id and y.book_id = ${id}))`,
        ],
        sql`b.sales_count desc, b.rating_avg desc`,
        12,
      ),
    ]);
    void this.trackView(id);
    const breakdown = Object.fromEntries([5, 4, 3, 2, 1].map((star) => [star, ratings.rows.find((r) => Number(r.rating) === star)?.count ?? 0]));
    return {
      id,
      slug: book.slug as string,
      title: book.title as string,
      subtitle: book.subtitle as string | null,
      originalTitle: book.original_title as string | null,
      description: book.description as string | null,
      language: book.language as string,
      ageGroup: book.age_group as string | null,
      academicLevel: book.academic_level as string | null,
      seriesName: book.series_name as string | null,
      seriesNumber: book.series_number as number | null,
      firstPublishedYear: book.first_published_year as number | null,
      isFree: !!book.is_free,
      coverUrl: this.storage.publicUrl(book.cover_key as string | null),
      images: images.rows.map((i) => ({ url: this.storage.publicUrl(i.storage_key as string), alt: i.alt as string | null, kind: i.kind as string })),
      tableOfContents: book.table_of_contents ?? null,
      contributors: people.rows.map((p) => ({ id: p.id, slug: p.slug, name: p.name, nameAlt: p.name_alt, role: p.role, verified: !!p.is_verified, photoUrl: this.storage.publicUrl(p.photo_key as string | null) })),
      categories: cats.rows.map((c) => ({ slug: c.slug, path: c.path, name: c.name, primary: !!c.is_primary })),
      genres: genreRows.rows.map((g) => ({ key: g.key, name: g.name })),
      formats: formats.rows.map((f) => ({
        id: f.id,
        format: f.format,
        isbn13: f.isbn13,
        isbn10: f.isbn10,
        edition: f.edition,
        publicationYear: f.publication_year,
        pages: f.pages,
        publisher: f.publisher_slug ? { name: f.publisher_name, slug: f.publisher_slug } : null,
      })),
      offers: offers.rows.map((o) => ({
        productId: o.id,
        productSlug: o.slug,
        variantId: o.variant_id,
        formatId: o.book_format_id,
        condition: o.condition,
        conditionNote: o.condition_note,
        price: o.price,
        compareAtPrice: o.compare_at_price,
        stock: Number(o.total_stock),
        store: { name: o.store_name, slug: o.store_slug, district: o.district, ratingAvg: Number(o.store_rating ?? 0), ratingCount: Number(o.store_rating_count ?? 0) },
      })),
      previews: previews.rows.map((p) => ({ id: p.id, kind: p.kind, title: p.title })),
      rating: { average: Number(book.rating_avg_f ?? 0), count: Number(book.rating_count ?? 0), breakdown },
      picks: { editors: !!book.editors_pick, students: !!book.student_pick, teachers: !!book.teacher_pick },
      related,
    };
  }

  /** Counts a view at most once per visitor per 6 hours (no personal data stored). */
  private async trackView(bookId: string): Promise<void> {
    try {
      const ctx = requestContext.get();
      const visitor = createHash('sha256').update(`${ctx?.ip ?? ''}|${ctx?.userAgent ?? ''}`).digest('hex').slice(0, 24);
      if (!(await this.redis.set(`view:b:${bookId}:${visitor}`, '1', 'EX', 21_600, 'NX'))) return;
      await this.db.execute(sql`update books set view_count = view_count + 1 where id = ${bookId}`);
      await this.db.execute(sql`
        insert into book_daily_stats (book_id, day, views) values (${bookId}, date_trunc('day', now()), 1)
        on conflict (book_id, day) do update set views = book_daily_stats.views + 1`);
    } catch {
      // Analytics must never break a page view.
    }
  }

  // ------------------------------------------------------------------ general products

  async listProducts(q: ProductListQuery): Promise<Page<ProductCard>> {
    const where: SQL[] = [sql`p.type = 'general'`, ACTIVE_OFFER, sql`se.status = 'active'`];
    let score: SQL | null = null;
    if (q.q) {
      const search = productSearch(q.q.normalize('NFC'));
      where.push(search.where);
      score = search.score;
    }
    if (q.category) where.push(sql`(${inCategory(sql`p.category_id`, q.category)} or exists(select 1 from product_categories pc where pc.product_id = p.id and ${inCategory(sql`pc.category_id`, q.category)}))`);
    if (q.brand) where.push(sql`lower(p.brand) = lower(${q.brand})`);
    if (q.store) where.push(sql`s.slug = ${q.store}`);
    if (q.minPrice !== undefined) where.push(sql`p.price >= ${q.minPrice}`);
    if (q.maxPrice !== undefined) where.push(sql`p.price <= ${q.maxPrice}`);
    if (q.inStock) where.push(sql`p.total_stock > 0`);
    if (q.discounted) where.push(sql`p.compare_at_price > p.price`);
    const order =
      q.sort === 'newest'
        ? sql`p.published_at desc nulls last`
        : q.sort === 'popular'
          ? sql`p.sales_count desc, p.view_count desc`
          : q.sort === 'price_asc'
            ? sql`p.price asc`
            : q.sort === 'price_desc'
              ? sql`p.price desc`
              : q.sort === 'rating'
                ? sql`p.rating_avg desc, p.rating_count desc`
                : score
                  ? sql`${score} desc`
                  : sql`p.sales_count desc, p.published_at desc`;
    const run = async (tx: DbOrTx) => {
      const base = sql`from products p join sellers se on se.id = p.seller_id left join seller_stores s on s.seller_id = p.seller_id where ${sql.join(where, sql` and `)}`;
      const [rows, total] = await Promise.all([
        tx.execute<Row>(sql`select ${PRODUCT_CARD_COLUMNS} ${base} order by ${order}, p.id limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
        tx.execute<{ total: number }>(sql`select count(*)::int as total ${base}`),
      ]);
      return { items: rows.rows.map((r) => this.toProductCard(r)), meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.total ?? 0 } };
    };
    return q.q ? this.searching(run) : run(this.db);
  }

  async productDetail(slug: string) {
    const [product] = await this.db.execute<Row>(sql`
      select p.*, p.rating_avg::float as rating_avg_f, s.name as store_name, s.slug as store_slug, s.district, s.rating_avg::float as store_rating,
        c.path as category_path, c.name as category_name
      from products p join sellers se on se.id = p.seller_id left join seller_stores s on s.seller_id = p.seller_id left join categories c on c.id = p.category_id
      where p.slug = ${slug} and ${ACTIVE_OFFER} and se.status = 'active'`).then((r) => r.rows);
    if (!product) throw AppException.notFound('Product');
    // Book listings are presented on their book page.
    if (product.type === 'book') {
      const [book] = await this.db.execute<{ slug: string }>(sql`select slug from books where id = ${product.book_id as string}`).then((r) => r.rows);
      return { type: 'book' as const, bookSlug: book?.slug ?? null };
    }
    const id = product.id as string;
    const [variants, images, ratings, related] = await Promise.all([
      this.db.execute<Row>(sql`
        select v.id, v.name, v.options, v.price, v.compare_at_price, v.sku,
          case when i.variant_id is null then 0 when not i.track_inventory then 9999 else greatest(i.quantity_on_hand - i.quantity_reserved, 0) end as available
        from product_variants v left join inventory i on i.variant_id = v.id where v.product_id = ${id} and v.is_active order by v.position`),
      this.db.execute<Row>(sql`select storage_key, alt from product_images where product_id = ${id} order by position`),
      this.db.execute<Row>(sql`select rating, count(*)::int as count from reviews where product_id = ${id} and status = 'published' group by rating`),
      this.db.execute<Row>(sql`
        select ${PRODUCT_CARD_COLUMNS} from products p left join seller_stores s on s.seller_id = p.seller_id
        where p.type = 'general' and ${ACTIVE_OFFER} and p.id <> ${id} and p.category_id = ${product.category_id as string}
        order by p.sales_count desc limit 8`),
    ]);
    return {
      type: 'general' as const,
      id,
      slug: product.slug as string,
      title: product.title as string,
      description: product.description as string | null,
      brand: product.brand as string | null,
      attributes: product.attributes as Record<string, string>,
      price: product.price as string,
      compareAtPrice: product.compare_at_price as string | null,
      images: images.rows.map((i) => ({ url: this.storage.publicUrl(i.storage_key as string), alt: i.alt as string | null })),
      variants: variants.rows.map((v) => ({ id: v.id, name: v.name, options: v.options, price: v.price, compareAtPrice: v.compare_at_price, sku: v.sku, available: Number(v.available) })),
      category: product.category_path ? { path: product.category_path, name: product.category_name } : null,
      store: product.store_slug ? { name: product.store_name, slug: product.store_slug, district: product.district, ratingAvg: Number(product.store_rating ?? 0) } : null,
      rating: {
        average: Number(product.rating_avg_f ?? 0),
        count: Number(product.rating_count ?? 0),
        breakdown: Object.fromEntries([5, 4, 3, 2, 1].map((star) => [star, ratings.rows.find((r) => Number(r.rating) === star)?.count ?? 0])),
      },
      related: related.rows.map((r) => this.toProductCard(r)),
    };
  }

  // ------------------------------------------------------------------ taxonomy, people, stores

  async categoryTree(appliesTo?: 'book' | 'general') {
    const rows = await this.db
      .select({ id: categories.id, parentId: categories.parentId, slug: categories.slug, path: categories.path, name: categories.name, icon: categories.icon, appliesTo: categories.appliesTo, depth: categories.depth })
      .from(categories)
      .where(and(eq(categories.isActive, true), appliesTo ? sql`${categories.appliesTo} in (${appliesTo}, 'both')` : undefined))
      .orderBy(asc(categories.depth), asc(categories.position));
    type Node = (typeof rows)[number] & { children: Node[] };
    const byId = new Map<string, Node>(rows.map((r) => [r.id, { ...r, children: [] }]));
    const roots: Node[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async category(path: string) {
    const [category] = await this.db.select().from(categories).where(and(eq(categories.path, path), eq(categories.isActive, true)));
    if (!category) throw AppException.notFound('Category');
    const [children, ancestors] = await Promise.all([
      this.db.select({ slug: categories.slug, path: categories.path, name: categories.name, icon: categories.icon }).from(categories).where(and(eq(categories.parentId, category.id), eq(categories.isActive, true))).orderBy(asc(categories.position)),
      this.db
        .select({ path: categories.path, name: categories.name })
        .from(categories)
        .where(sql`${categories.path} in (${sql.join(path.split('/').map((_, i, parts) => sql`${parts.slice(0, i + 1).join('/')}`), sql`, `)})`)
        .orderBy(asc(categories.depth)),
    ]);
    return { slug: category.slug, path: category.path, name: category.name, description: category.description, icon: category.icon, appliesTo: category.appliesTo, children, breadcrumbs: ancestors };
  }

  async genreList() {
    return this.db.select({ key: genres.key, name: genres.name }).from(genres).orderBy(asc(genres.position));
  }

  async authorList(q: string | undefined, page: number, pageSize: number) {
    const where = q ? sql`(a.name % ${q} or a.name_alt % ${q} or a.search_vector @@ websearch_to_tsquery('simple', ${q}))` : sql`true`;
    const run = async (tx: DbOrTx) => {
      const rows = await tx.execute<Row>(sql`
        select a.slug, a.name, a.name_alt, a.photo_key, a.is_verified, a.book_count, a.follower_count from authors a
        where a.status = 'published' and a.book_count > 0 and ${where}
        order by ${q ? sql`greatest(similarity(a.name, ${q}), similarity(coalesce(a.name_alt, ''), ${q})) desc,` : sql``} a.follower_count desc, a.book_count desc, a.name
        limit ${pageSize} offset ${(page - 1) * pageSize}`);
      return rows.rows.map((a) => this.authorCard(a));
    };
    return q ? this.searching(run) : run(this.db);
  }

  authorCard(a: Row) {
    return { slug: a.slug as string, name: a.name as string, nameAlt: a.name_alt as string | null, photoUrl: this.storage.publicUrl(a.photo_key as string | null), verified: !!a.is_verified, bookCount: Number(a.book_count ?? 0), followerCount: Number(a.follower_count ?? 0) };
  }

  async author(slug: string, viewerId?: string) {
    const [author] = await this.db.select().from(authors).where(and(eq(authors.slug, slug), eq(authors.status, 'published')));
    if (!author) throw AppException.notFound('Author');
    const [books, following] = await Promise.all([
      this.bookCards([sql`exists(select 1 from book_authors ba where ba.book_id = b.id and ba.author_id = ${author.id})`], sql`b.sales_count desc, b.first_published_year desc nulls last`, 60),
      viewerId ? this.db.select({ id: follows.targetId }).from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.targetType, 'author'), eq(follows.targetId, author.id))) : Promise.resolve([]),
    ]);
    return {
      ...this.authorCard({ ...author, name_alt: author.nameAlt, photo_key: author.photoKey, is_verified: author.isVerified, book_count: author.bookCount, follower_count: author.followerCount }),
      id: author.id,
      bio: author.bio,
      birthYear: author.birthYear,
      deathYear: author.deathYear,
      website: author.website,
      claimed: !!author.userId,
      following: following.length > 0,
      books,
    };
  }

  async followState(userId: string, slug: string) {
    const [author] = await this.db.select({ id: authors.id, followerCount: authors.followerCount }).from(authors).where(and(eq(authors.slug, slug), eq(authors.status, 'published')));
    if (!author) throw AppException.notFound('Author');
    const rows = await this.db.select({ id: follows.targetId }).from(follows).where(and(eq(follows.followerId, userId), eq(follows.targetType, 'author'), eq(follows.targetId, author.id)));
    return { following: rows.length > 0, followerCount: author.followerCount };
  }

  async followAuthor(userId: string, slug: string, follow: boolean) {
    const [author] = await this.db.select({ id: authors.id }).from(authors).where(eq(authors.slug, slug));
    if (!author) throw AppException.notFound('Author');
    return this.db.transaction(async (tx) => {
      if (follow) {
        const added = await tx.insert(follows).values({ followerId: userId, targetType: 'author', targetId: author.id }).onConflictDoNothing().returning({ id: follows.targetId });
        if (added.length) await tx.update(authors).set({ followerCount: sql`${authors.followerCount} + 1` }).where(eq(authors.id, author.id));
      } else {
        const removed = await tx.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.targetType, 'author'), eq(follows.targetId, author.id))).returning({ id: follows.targetId });
        if (removed.length) await tx.update(authors).set({ followerCount: sql`greatest(${authors.followerCount} - 1, 0)` }).where(eq(authors.id, author.id));
      }
      const [row] = await tx.select({ followerCount: authors.followerCount }).from(authors).where(eq(authors.id, author.id));
      return { following: follow, followerCount: row!.followerCount };
    });
  }

  async publisher(slug: string) {
    const [publisher] = await this.db.select().from(publishers).where(and(eq(publishers.slug, slug), eq(publishers.status, 'published')));
    if (!publisher) throw AppException.notFound('Publisher');
    const books = await this.bookCards([sql`exists(select 1 from book_publishers bp where bp.book_id = b.id and bp.publisher_id = ${publisher.id})`], sql`b.published_at desc`, 60);
    return { slug: publisher.slug, name: publisher.name, nameAlt: publisher.nameAlt, description: publisher.description, website: publisher.website, foundedYear: publisher.foundedYear, verified: publisher.isVerified, logoUrl: this.storage.publicUrl(publisher.logoKey), followerCount: publisher.followerCount, books };
  }

  async store(slug: string) {
    const [store] = await this.db.execute<Row>(sql`
      select s.*, s.rating_avg::float as rating_avg_f, se.status as seller_status, se.type as seller_type, se.approved_at
      from seller_stores s join sellers se on se.id = s.seller_id where s.slug = ${slug}`).then((r) => r.rows);
    if (!store || store.seller_status !== 'active') throw AppException.notFound('Store');
    const sellerId = store.seller_id as string;
    const [books, products] = await Promise.all([
      this.bookCards([sql`exists(select 1 from products p where p.book_id = b.id and p.seller_id = ${sellerId} and ${ACTIVE_OFFER})`], sql`b.sales_count desc, b.published_at desc`, 48),
      this.db.execute<Row>(sql`
        select ${PRODUCT_CARD_COLUMNS} from products p left join seller_stores s on s.seller_id = p.seller_id
        where p.seller_id = ${sellerId} and p.type = 'general' and ${ACTIVE_OFFER} order by p.sales_count desc, p.published_at desc limit 48`),
    ]);
    return {
      slug: store.slug as string,
      name: store.name as string,
      tagline: store.tagline as string | null,
      description: store.description as string | null,
      logoUrl: this.storage.publicUrl(store.logo_key as string | null),
      bannerUrl: this.storage.publicUrl(store.banner_key as string | null),
      division: store.division as string | null,
      district: store.district as string | null,
      returnPolicy: store.return_policy as string | null,
      shippingPolicy: store.shipping_policy as string | null,
      ratingAvg: Number(store.rating_avg_f ?? 0),
      ratingCount: Number(store.rating_count ?? 0),
      followerCount: Number(store.follower_count ?? 0),
      productCount: Number(store.product_count ?? 0),
      sellerType: store.seller_type as string,
      // Raw query rows carry timestamps as strings.
      since: store.approved_at ? new Date(store.approved_at as string).toISOString() : null,
      books,
      products: products.rows.map((r) => this.toProductCard(r)),
    };
  }

  async featuredStores(limit: number) {
    const rows = await this.db
      .select({ slug: sellerStores.slug, name: sellerStores.name, tagline: sellerStores.tagline, logoKey: sellerStores.logoKey, district: sellerStores.district, ratingAvg: sellerStores.ratingAvg, productCount: sellerStores.productCount })
      .from(sellerStores)
      .where(and(eq(sellerStores.isFeatured, true), sql`exists(select 1 from sellers se where se.id = ${sellerStores.sellerId} and se.status = 'active')`))
      .orderBy(sql`${sellerStores.ratingAvg} desc`, asc(sellerStores.name))
      .limit(limit);
    return rows.map((s) => ({ ...s, logoUrl: this.storage.publicUrl(s.logoKey), ratingAvg: Number(s.ratingAvg), logoKey: undefined }));
  }

  /** Aggregated, anonymous query counts for "popular searches" and catalogue gap analysis. */
  async recordSearch(query: string, resultCount: number): Promise<void> {
    const normalized = query.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
    if (normalized.length < 2) return;
    await this.db
      .execute(sql`
        insert into search_queries (normalized, display, count, result_count, last_searched_at) values (${normalized}, ${query.trim().slice(0, 200)}, 1, ${resultCount}, now())
        on conflict (normalized) do update set count = search_queries.count + 1, result_count = excluded.result_count, last_searched_at = now()`)
      .catch(() => undefined);
  }
}
