import { Inject, Injectable } from '@nestjs/common';
import { type Database } from '@boikonika/database';
import { toEnglishDigits } from '@boikonika/shared';
import { sql } from 'drizzle-orm';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { ACTIVE_OFFER, bookSearch, PRODUCT_CARD_COLUMNS, productSearch } from './catalog.sql';
import { CatalogService } from './catalog.service';

type Row = Record<string, unknown>;

/**
 * Unified search across books (title, authors in both scripts, publishers, ISBN), authors and
 * general products, using PostgreSQL full-text search plus trigram similarity for typos.
 */
@Injectable()
export class SearchService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly catalog: CatalogService,
    private readonly storage: StorageService,
  ) {}

  normalize(raw: string): string {
    return toEnglishDigits(raw.normalize('NFC')).replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  async search(raw: string) {
    const q = this.normalize(raw);
    if (q.length < 2) return { query: q, books: [], authors: [], products: [] };
    const result = await this.catalog.searching(async (tx) => {
      const books = bookSearch(q);
      const products = productSearch(q);
      const [bookRows, authorRows, productRows, totals] = await Promise.all([
        this.catalog.bookCards([books.where], sql`${books.score} desc, b.sales_count desc`, 12, tx),
        tx.execute<Row>(sql`
          select a.slug, a.name, a.name_alt, a.photo_key, a.is_verified, a.book_count, a.follower_count from authors a
          where a.status = 'published' and (a.name % ${q} or a.name_alt % ${q} or ${q} <% a.name or ${q} <% coalesce(a.name_alt, '') or a.search_vector @@ websearch_to_tsquery('simple', ${q}))
          order by greatest(similarity(a.name, ${q}), similarity(coalesce(a.name_alt, ''), ${q}), word_similarity(${q}, a.name), word_similarity(${q}, coalesce(a.name_alt, ''))) desc, a.follower_count desc
          limit 6`),
        tx.execute<Row>(sql`
          select ${PRODUCT_CARD_COLUMNS} from products p left join seller_stores s on s.seller_id = p.seller_id
          where p.type = 'general' and ${ACTIVE_OFFER} and ${products.where} order by ${products.score} desc limit 8`),
        tx.execute<{ books: number }>(sql`
          select count(*)::int as books from books b where b.status = 'published' and b.deleted_at is null and (b.offer_count > 0 or b.is_free) and ${books.where}`),
      ]);
      return {
        query: q,
        books: bookRows,
        bookTotal: totals.rows[0]?.books ?? 0,
        authors: authorRows.rows.map((a) => this.catalog.authorCard(a)),
        products: productRows.rows.map((r) => this.catalog.toProductCard(r)),
      };
    });
    void this.catalog.recordSearch(q, result.bookTotal + result.products.length + result.authors.length);
    return result;
  }

  /** Autocomplete: a few books, authors and products, prefix matches first. */
  async suggest(raw: string) {
    const q = this.normalize(raw);
    if (q.length < 2) return { query: q, items: await this.popular() };
    const prefix = `${q.replace(/[%_\\]/g, '')}%`;
    return this.catalog.searching(async (tx) => {
      const rows = await tx.execute<Row>(sql`
        (select 'book' as kind, b.slug, b.title as label, b.cover_key as image_key,
            (select string_agg(a.name, ', ' order by ba.position) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id and ba.role = 'author') as detail,
            (case when b.title ilike ${prefix} then 2 else 0 end + greatest(similarity(b.title, ${q}), word_similarity(${q}, b.title), word_similarity(${q}, b.search_text))) as score
          from books b where b.status = 'published' and b.deleted_at is null and (b.offer_count > 0 or b.is_free)
            and (b.title ilike ${prefix} or b.title % ${q} or ${q} <% b.title or ${q} <% b.search_text)
          order by score desc limit 5)
        union all
        (select 'author', a.slug, a.name, a.photo_key, a.name_alt,
            -- People are few and usually what a short query means, so they get a small boost.
            (0.5 + case when a.name ilike ${prefix} or a.name_alt ilike ${prefix} then 2 else 0 end
              + greatest(similarity(a.name, ${q}), similarity(coalesce(a.name_alt, ''), ${q}), word_similarity(${q}, a.name), word_similarity(${q}, coalesce(a.name_alt, '')))) as score
          from authors a where a.status = 'published' and a.book_count > 0
            and (a.name ilike ${prefix} or a.name_alt ilike ${prefix} or a.name % ${q} or a.name_alt % ${q} or ${q} <% a.name or ${q} <% coalesce(a.name_alt, ''))
          order by score desc limit 3)
        union all
        (select 'product', p.slug, p.title, (select i.storage_key from product_images i where i.product_id = p.id order by i.position limit 1), p.brand,
            (case when p.title ilike ${prefix} then 2 else 0 end + greatest(similarity(p.title, ${q}), word_similarity(${q}, p.title))) as score
          from products p where p.type = 'general' and ${ACTIVE_OFFER} and (p.title ilike ${prefix} or p.title % ${q} or ${q} <% p.title)
          order by score desc limit 3)`);
      return {
        query: q,
        items: rows.rows
          .sort((a, b) => Number(b.score) - Number(a.score))
          .map((r) => ({ kind: r.kind as 'book' | 'author' | 'product', slug: r.slug as string, label: r.label as string, detail: (r.detail as string | null) ?? null, imageUrl: this.storage.publicUrl(r.image_key as string | null) })),
      };
    });
  }

  private async popular() {
    const rows = await this.db.execute<{ display: string }>(sql`
      select display from search_queries where result_count > 0 and last_searched_at > now() - interval '30 days' order by count desc limit 8`);
    return rows.rows.map((r) => ({ kind: 'query' as const, slug: r.display, label: r.display, detail: null, imageUrl: null }));
  }
}
