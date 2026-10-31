import { sql, type SQL } from 'drizzle-orm';

/** Active, non-deleted marketplace listing (products alias p). */
export const ACTIVE_OFFER = sql`p.status = 'active' and p.deleted_at is null`;

/** Columns for a BookCard from books alias b. */
export const BOOK_CARD_COLUMNS = sql`
  b.id, b.slug, b.title, b.language, b.cover_key, b.rating_avg::float as rating_avg, b.rating_count, b.min_price, b.offer_count, b.is_free,
  coalesce((
    select json_agg(json_build_object('name', a.name, 'slug', a.slug) order by ba.position)
    from book_authors ba join authors a on a.id = ba.author_id
    where ba.book_id = b.id and ba.role = 'author'
  ), '[]'::json) as authors,
  (select p.compare_at_price from products p where p.book_id = b.id and ${ACTIVE_OFFER} order by p.price asc limit 1) as compare_at_price,
  exists(select 1 from products p where p.book_id = b.id and ${ACTIVE_OFFER} and p.total_stock > 0) as in_stock,
  exists(select 1 from products p where p.book_id = b.id and ${ACTIVE_OFFER} and p.condition <> 'new') as has_used`;

/** Columns for a ProductCard from products alias p. */
export const PRODUCT_CARD_COLUMNS = sql`
  p.id, p.slug, p.title, p.price, p.compare_at_price, p.total_stock, p.rating_avg::float as rating_avg, p.rating_count,
  (select i.storage_key from product_images i where i.product_id = p.id order by i.position limit 1) as image_key,
  s.name as store_name, s.slug as store_slug`;

/** Search relevance and match condition for books (alias b) against a websearch query. */
export function bookSearch(q: string): { where: SQL; score: SQL } {
  const isbn = q.replace(/[\s-]/g, '');
  const isbnMatch = /^(97[89])?\d{9}[\dXx]$/.test(isbn)
    ? sql` or exists(select 1 from book_formats f where f.book_id = b.id and (f.isbn13 = ${isbn} or f.isbn10 = upper(${isbn})))`
    : sql``;
  return {
    where: sql`(b.search_vector @@ websearch_to_tsquery('simple', ${q}) or b.title % ${q} or ${q} <% b.search_text or ${q} <% b.title${isbnMatch})`,
    score: sql`(ts_rank(b.search_vector, websearch_to_tsquery('simple', ${q})) * 2 + greatest(similarity(b.title, ${q}), word_similarity(${q}, b.title), word_similarity(${q}, b.search_text) * 0.8))`,
  };
}

export function productSearch(q: string): { where: SQL; score: SQL } {
  return {
    where: sql`(p.search_vector @@ websearch_to_tsquery('simple', ${q}) or p.title % ${q} or ${q} <% p.search_text or ${q} <% p.title)`,
    score: sql`(ts_rank(p.search_vector, websearch_to_tsquery('simple', ${q})) * 2 + greatest(similarity(p.title, ${q}), word_similarity(${q}, p.title)))`,
  };
}

/** Category filter by materialised path, including descendants (alias column passed in). */
export function inCategory(column: SQL, path: string): SQL {
  return sql`${column} in (select c.id from categories c where c.path = ${path} or c.path like ${`${path.replace(/[%_]/g, '')}/%`})`;
}
