import { sql } from 'drizzle-orm';
import type { DbOrTx } from './client';

/**
 * Recomputes the listing aggregates that discovery queries read (lowest price, number of offers,
 * total stock, store product counts). Call after products, variants or stock change.
 */
/** Untracked variants (made to order, print on demand) count as this many available units. */
export const UNTRACKED_STOCK = 9999;

const uuidList = (ids: string[]) => sql`array[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::uuid[]`;

/**
 * Copies the cheapest active variant's price onto the product and recomputes available stock
 * (on hand minus reserved, summed over active variants).
 */
export async function refreshProductStock(db: DbOrTx, productIds: string[]): Promise<void> {
  if (!productIds.length) return;
  await db.execute(sql`
    with ids as (select unnest(${uuidList(productIds)}) as id),
    stock as (
      select v.product_id,
             sum(case when i.variant_id is null then 0
                      when not i.track_inventory then ${UNTRACKED_STOCK}
                      else greatest(i.quantity_on_hand - i.quantity_reserved, 0) end)::int as stock
      from product_variants v
      left join inventory i on i.variant_id = v.id
      where v.is_active and v.product_id in (select id from ids)
      group by v.product_id
    ),
    cheapest as (
      select distinct on (v.product_id) v.product_id, v.price, v.compare_at_price
      from product_variants v
      where v.is_active and v.product_id in (select id from ids)
      order by v.product_id, v.price asc, v.position asc
    )
    update products p set
      total_stock = coalesce(stock.stock, 0),
      price = coalesce(cheapest.price, p.price),
      compare_at_price = case when cheapest.product_id is null then p.compare_at_price else cheapest.compare_at_price end
    from ids
    left join stock on stock.product_id = ids.id
    left join cheapest on cheapest.product_id = ids.id
    where p.id = ids.id`);
}

export async function refreshBookOffers(db: DbOrTx, bookIds: string[]): Promise<void> {
  if (!bookIds.length) return;
  await db.execute(sql`
    update books b set
      min_price = o.min_price,
      offer_count = coalesce(o.offers, 0)
    from (
      select b2.id as book_id,
             min(p.price) as min_price,
             count(p.id)::int as offers
      from books b2
      left join products p on p.book_id = b2.id and p.status = 'active' and p.deleted_at is null
      where b2.id = any(${uuidList(bookIds)})
      group by b2.id
    ) o
    where b.id = o.book_id`);
}

export async function refreshAuthorBookCounts(db: DbOrTx, authorIds: string[]): Promise<void> {
  if (!authorIds.length) return;
  await db.execute(sql`
    update authors a set book_count = (
      select count(distinct ba.book_id)::int from book_authors ba join books b on b.id = ba.book_id
      where ba.author_id = a.id and b.status = 'published' and b.deleted_at is null
    )
    where a.id = any(${uuidList(authorIds)})`);
}

export async function refreshStoreProductCounts(db: DbOrTx, sellerIds: string[]): Promise<void> {
  if (!sellerIds.length) return;
  await db.execute(sql`
    update seller_stores s set product_count = (
      select count(*)::int from products p where p.seller_id = s.seller_id and p.status = 'active' and p.deleted_at is null
    )
    where s.seller_id = any(${uuidList(sellerIds)})`);
}

/** Recomputes star averages and counts from published reviews (books, products, seller stores). */
export async function refreshRatings(db: DbOrTx, target: { bookIds?: string[]; productIds?: string[]; sellerIds?: string[] }): Promise<void> {
  const { bookIds = [], productIds = [], sellerIds = [] } = target;
  if (bookIds.length) {
    await db.execute(sql`
      update books b set rating_avg = coalesce(r.avg, 0), rating_count = coalesce(r.n, 0)
      from (select b2.id, round(avg(rv.rating)::numeric, 2) as avg, count(rv.id)::int as n
            from books b2 left join reviews rv on rv.book_id = b2.id and rv.status = 'published'
            where b2.id = any(${uuidList(bookIds)}) group by b2.id) r
      where b.id = r.id`);
  }
  if (productIds.length) {
    await db.execute(sql`
      update products p set rating_avg = coalesce(r.avg, 0), rating_count = coalesce(r.n, 0)
      from (select p2.id, round(avg(rv.rating)::numeric, 2) as avg, count(rv.id)::int as n
            from products p2 left join reviews rv on rv.product_id = p2.id and rv.book_id is null and rv.status = 'published'
            where p2.id = any(${uuidList(productIds)}) group by p2.id) r
      where p.id = r.id`);
  }
  if (sellerIds.length) {
    await db.execute(sql`
      update seller_stores s set rating_avg = coalesce(r.avg, 0), rating_count = coalesce(r.n, 0)
      from (select se.id, round(avg(rv.rating)::numeric, 2) as avg, count(rv.id)::int as n
            from sellers se left join reviews rv on rv.seller_id = se.id and rv.status = 'published' and rv.is_verified_purchase
            where se.id = any(${uuidList(sellerIds)}) group by se.id) r
      where s.seller_id = r.id`);
  }
}
