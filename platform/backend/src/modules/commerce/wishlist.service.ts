import { Inject, Injectable } from '@nestjs/common';
import { wishlistItems, wishlists, type Database, type DbOrTx } from '@boikonika/database';
import { MAX_WISHLIST_ITEMS } from '@boikonika/shared';
import { and, eq, sql } from 'drizzle-orm';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { BOOK_CARD_COLUMNS, PRODUCT_CARD_COLUMNS } from '../catalog/catalog.sql';
import { CatalogService } from '../catalog/catalog.service';

type Row = Record<string, unknown>;
type Target = { kind: 'book' | 'product'; id: string };

/**
 * The reader's wishlist: books (any seller, any edition) and individual products. Saving a book
 * feeds its wishlist counter and the author/publisher dashboards' daily stats.
 */
@Injectable()
export class WishlistService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly catalog: CatalogService,
  ) {}

  private async defaultList(tx: DbOrTx, userId: string): Promise<string> {
    const [existing] = await tx.select({ id: wishlists.id }).from(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.isDefault, true)));
    if (existing) return existing.id;
    await tx.insert(wishlists).values({ userId, isDefault: true }).onConflictDoNothing();
    const [created] = await tx.select({ id: wishlists.id }).from(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.isDefault, true)));
    return created!.id;
  }

  async list(userId: string) {
    const [books, products] = await Promise.all([
      this.db.execute<Row>(sql`
        select ${BOOK_CARD_COLUMNS}, wi.created_at as saved_at from wishlist_items wi join wishlists w on w.id = wi.wishlist_id join books b on b.id = wi.book_id
        where w.user_id = ${userId} and b.status = 'published' and b.deleted_at is null order by wi.created_at desc limit ${MAX_WISHLIST_ITEMS}`),
      this.db.execute<Row>(sql`
        select ${PRODUCT_CARD_COLUMNS}, p.status, wi.created_at as saved_at from wishlist_items wi join wishlists w on w.id = wi.wishlist_id
        join products p on p.id = wi.product_id left join seller_stores s on s.seller_id = p.seller_id
        where w.user_id = ${userId} and p.deleted_at is null order by wi.created_at desc limit ${MAX_WISHLIST_ITEMS}`),
    ]);
    return {
      books: books.rows.map((r) => ({ ...this.catalog.toBookCard(r), savedAt: new Date(r.saved_at as string).toISOString() })),
      products: products.rows.map((r) => ({ ...this.catalog.toProductCard(r), available: r.status === 'active', savedAt: new Date(r.saved_at as string).toISOString() })),
    };
  }

  /** Whether each of the given books/products is saved (for hearts on cards and pages). */
  async contains(userId: string, bookIds: string[], productIds: string[]) {
    const rows = await this.db.execute<{ book_id: string | null; product_id: string | null }>(sql`
      select wi.book_id, wi.product_id from wishlist_items wi join wishlists w on w.id = wi.wishlist_id
      where w.user_id = ${userId} and (
        ${bookIds.length ? sql`wi.book_id in (${sql.join(bookIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql`false`}
        or ${productIds.length ? sql`wi.product_id in (${sql.join(productIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql`false`})`);
    return { books: rows.rows.filter((r) => r.book_id).map((r) => r.book_id!), products: rows.rows.filter((r) => r.product_id).map((r) => r.product_id!) };
  }

  async add(userId: string, target: Target) {
    await this.db.transaction(async (tx) => {
      const exists =
        target.kind === 'book'
          ? await tx.execute(sql`select 1 from books where id = ${target.id} and status = 'published' and deleted_at is null`)
          : await tx.execute(sql`select 1 from products where id = ${target.id} and status = 'active' and deleted_at is null`);
      if (!exists.rows.length) throw AppException.notFound(target.kind === 'book' ? 'Book' : 'Product');
      const listId = await this.defaultList(tx, userId);
      await tx.execute(sql`select id from wishlists where id = ${listId} for update`);
      const [{ n } = { n: 0 }] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from wishlist_items where wishlist_id = ${listId}`).then((r) => r.rows);
      if (n >= MAX_WISHLIST_ITEMS) throw new AppException('BAD_REQUEST', 'api.wishlist.full').withParams({ count: MAX_WISHLIST_ITEMS });
      const inserted = await tx
        .insert(wishlistItems)
        .values({ wishlistId: listId, bookId: target.kind === 'book' ? target.id : null, productId: target.kind === 'product' ? target.id : null })
        .onConflictDoNothing()
        .returning({ id: wishlistItems.id });
      if (inserted.length && target.kind === 'book') await this.count(tx, target.id, 1);
    });
    return { saved: true };
  }

  async remove(userId: string, target: Target) {
    await this.db.transaction(async (tx) => {
      const removed = await tx.execute<{ id: string }>(sql`
        delete from wishlist_items wi using wishlists w where w.id = wi.wishlist_id and w.user_id = ${userId}
          and ${target.kind === 'book' ? sql`wi.book_id = ${target.id}` : sql`wi.product_id = ${target.id}`}
        returning wi.id`);
      if (removed.rows.length && target.kind === 'book') await this.count(tx, target.id, -1);
    });
    return { saved: false };
  }

  private async count(tx: DbOrTx, bookId: string, delta: 1 | -1) {
    await tx.execute(sql`update books set wishlist_count = greatest(wishlist_count + ${delta}, 0) where id = ${bookId}`);
    if (delta > 0) {
      await tx.execute(sql`
        insert into book_daily_stats (book_id, day, wishlists) values (${bookId}, date_trunc('day', now()), 1)
        on conflict (book_id, day) do update set wishlists = book_daily_stats.wishlists + 1`);
    }
  }
}
