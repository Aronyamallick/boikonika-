import { inventory, inventoryMovements, type DbOrTx } from '@boikonika/database';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { AppException } from '../../common/errors/app-exception';

export interface StockLine {
  variantId: string;
  quantity: number;
}

interface Reference {
  type: 'order' | 'seller_order' | 'return';
  id: string;
  actorId?: string | null;
}

/** Sums quantities per variant and sorts by id so concurrent orders lock rows in the same order. */
function normalize(lines: StockLine[]): StockLine[] {
  const totals = new Map<string, number>();
  for (const l of lines) totals.set(l.variantId, (totals.get(l.variantId) ?? 0) + l.quantity);
  return [...totals.entries()].map(([variantId, quantity]) => ({ variantId, quantity })).sort((a, b) => a.variantId.localeCompare(b.variantId));
}

async function lockRows(tx: DbOrTx, lines: StockLine[]) {
  if (!lines.length) return new Map<string, typeof inventory.$inferSelect>();
  const rows = await tx
    .select()
    .from(inventory)
    .where(inArray(inventory.variantId, lines.map((l) => l.variantId)))
    .orderBy(asc(inventory.variantId))
    .for('update');
  return new Map(rows.map((r) => [r.variantId, r]));
}

/**
 * Holds stock for an order. Fails (nothing reserved) if any line no longer has enough available
 * units; untracked variants (made to order) are not limited.
 */
export async function reserveStock(tx: DbOrTx, input: StockLine[], ref: Reference): Promise<void> {
  const lines = normalize(input);
  const rows = await lockRows(tx, lines);
  const short: string[] = [];
  for (const line of lines) {
    const row = rows.get(line.variantId);
    if (!row) short.push(line.variantId);
    else if (row.trackInventory && row.quantityOnHand - row.quantityReserved < line.quantity) short.push(line.variantId);
  }
  if (short.length) {
    throw new AppException('OUT_OF_STOCK', 'api.commerce.outOfStock', short.map((variantId) => ({ field: 'items', code: 'out_of_stock', message: 'api.commerce.outOfStock', meta: { variantId } })));
  }
  for (const line of lines) {
    if (!rows.get(line.variantId)!.trackInventory) continue;
    await tx.update(inventory).set({ quantityReserved: sql`${inventory.quantityReserved} + ${line.quantity}`, updatedAt: new Date() }).where(eq(inventory.variantId, line.variantId));
    await tx.insert(inventoryMovements).values({ variantId: line.variantId, reason: 'order_reserved', reservedDelta: line.quantity, referenceType: ref.type, referenceId: ref.id, actorId: ref.actorId ?? null });
  }
}

/** Gives reserved units back (order cancelled or expired before shipping). */
export async function releaseStock(tx: DbOrTx, input: StockLine[], ref: Reference): Promise<void> {
  const lines = normalize(input);
  const rows = await lockRows(tx, lines);
  for (const line of lines) {
    const row = rows.get(line.variantId);
    if (!row?.trackInventory) continue;
    const release = Math.min(line.quantity, row.quantityReserved);
    if (release <= 0) continue;
    await tx.update(inventory).set({ quantityReserved: sql`${inventory.quantityReserved} - ${release}`, updatedAt: new Date() }).where(eq(inventory.variantId, line.variantId));
    await tx.insert(inventoryMovements).values({ variantId: line.variantId, reason: 'order_released', reservedDelta: -release, referenceType: ref.type, referenceId: ref.id, actorId: ref.actorId ?? null });
  }
}

/** The parcel left the seller: reserved units leave the shelf for good. */
export async function fulfilStock(tx: DbOrTx, input: StockLine[], ref: Reference): Promise<void> {
  const lines = normalize(input);
  const rows = await lockRows(tx, lines);
  for (const line of lines) {
    const row = rows.get(line.variantId);
    if (!row?.trackInventory) continue;
    const reserved = Math.min(line.quantity, row.quantityReserved);
    const onHand = Math.min(line.quantity, row.quantityOnHand);
    await tx
      .update(inventory)
      .set({ quantityOnHand: sql`${inventory.quantityOnHand} - ${onHand}`, quantityReserved: sql`${inventory.quantityReserved} - ${reserved}`, updatedAt: new Date() })
      .where(and(eq(inventory.variantId, line.variantId)));
    await tx.insert(inventoryMovements).values({ variantId: line.variantId, reason: 'order_fulfilled', onHandDelta: -onHand, reservedDelta: -reserved, referenceType: ref.type, referenceId: ref.id, actorId: ref.actorId ?? null });
  }
}

/** Returned items the seller can sell again. */
export async function restockReturned(tx: DbOrTx, input: StockLine[], ref: Reference): Promise<void> {
  const lines = normalize(input);
  const rows = await lockRows(tx, lines);
  for (const line of lines) {
    const row = rows.get(line.variantId);
    if (!row?.trackInventory) continue;
    await tx.update(inventory).set({ quantityOnHand: sql`${inventory.quantityOnHand} + ${line.quantity}`, updatedAt: new Date() }).where(eq(inventory.variantId, line.variantId));
    await tx.insert(inventoryMovements).values({ variantId: line.variantId, reason: 'return', onHandDelta: line.quantity, referenceType: ref.type, referenceId: ref.id, actorId: ref.actorId ?? null });
  }
}
