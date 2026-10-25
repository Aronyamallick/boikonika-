import { type DbOrTx } from '@boikonika/database';
import { sql } from 'drizzle-orm';

export interface DeliveredItem {
  id: string;
  productId: string | null;
  bookId: string | null;
  quantity: number;
  isDigital: boolean;
}

/**
 * Bookkeeping for delivered items: sales counters (they count delivered copies only), the book's
 * daily stats, and the buyer's library — books land on "Purchased" (a shelf they already chose is
 * kept), e-books with access to the file.
 */
export async function recordDelivery(tx: DbOrTx, buyerId: string, items: DeliveredItem[]): Promise<void> {
  for (const i of items) {
    if (i.productId) await tx.execute(sql`update products set sales_count = sales_count + ${i.quantity} where id = ${i.productId}`);
    if (!i.bookId) continue;
    await tx.execute(sql`update books set sales_count = sales_count + ${i.quantity} where id = ${i.bookId}`);
    await tx.execute(sql`
      insert into book_daily_stats (book_id, day, sales) values (${i.bookId}, date_trunc('day', now()), ${i.quantity})
      on conflict (book_id, day) do update set sales = book_daily_stats.sales + excluded.sales`);
    await tx.execute(sql`
      insert into user_library (user_id, book_id, shelf, source, order_item_id, has_digital_access) values (${buyerId}, ${i.bookId}, 'purchased', 'purchase', ${i.id}, ${i.isDigital})
      on conflict (user_id, book_id) do update set
        order_item_id = case when ${i.isDigital} then excluded.order_item_id else coalesce(user_library.order_item_id, excluded.order_item_id) end,
        source = 'purchase', has_digital_access = user_library.has_digital_access or excluded.has_digital_access, updated_at = now()`);
  }
}

/** Takes e-book access back when the purchase behind it is cancelled or refunded. */
export async function revokeDigitalAccess(tx: DbOrTx, orderItemIds: string[]): Promise<void> {
  if (!orderItemIds.length) return;
  await tx.execute(sql`
    update user_library set has_digital_access = false, updated_at = now()
    where source = 'purchase' and order_item_id in (${sql.join(orderItemIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
}
