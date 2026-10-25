import { Inject, Injectable } from '@nestjs/common';
import { cartItems, carts, UNTRACKED_STOCK, type Database, type DbOrTx } from '@boikonika/database';
import { MAX_CART_LINES, MAX_CART_QUANTITY, multiplyMoney, addMoney } from '@boikonika/shared';
import { and, eq, sql } from 'drizzle-orm';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { StorageService } from '../../infra/storage/storage.service';

/** Who the cart belongs to: a signed-in user, or a browser holding a guest token. */
export interface CartOwner {
  userId?: string;
  guestToken?: string;
}

export interface CartLine {
  variantId: string;
  productId: string;
  productSlug: string;
  type: 'book' | 'general';
  bookId: string | null;
  bookSlug: string | null;
  title: string;
  variantName: string;
  condition: string | null;
  sku: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  unitPrice: string;
  compareAtPrice: string | null;
  quantity: number;
  savedForLater: boolean;
  /** Units that can be bought right now. */
  available: number;
  /** 'ok' | 'unavailable' (removed, paused or seller inactive) | 'insufficient' (fewer units left). */
  state: 'ok' | 'unavailable' | 'insufficient';
  lineTotal: string;
  weightGrams: number | null;
  seller: { id: string; name: string; slug: string; district: string | null; commissionPercent: string | null };
}

type Row = Record<string, unknown>;

@Injectable()
export class CartService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
  ) {}

  /** Finds the owner's cart; creates it (and a guest token for anonymous visitors) when `create` is set. */
  async resolve(owner: CartOwner, create: boolean, tx: DbOrTx = this.db): Promise<{ id: string; guestToken: string | null; couponCode: string | null } | null> {
    if (owner.userId) {
      const [cart] = await tx.select().from(carts).where(eq(carts.userId, owner.userId));
      if (cart) return { id: cart.id, guestToken: null, couponCode: cart.couponCode };
      if (!create) return null;
      const [created] = await tx.insert(carts).values({ userId: owner.userId }).onConflictDoNothing().returning();
      if (created) return { id: created.id, guestToken: null, couponCode: null };
      const [again] = await tx.select().from(carts).where(eq(carts.userId, owner.userId));
      return { id: again!.id, guestToken: null, couponCode: again!.couponCode };
    }
    if (owner.guestToken) {
      const [cart] = await tx.select().from(carts).where(and(eq(carts.guestToken, owner.guestToken), sql`${carts.userId} is null`));
      if (cart) return { id: cart.id, guestToken: owner.guestToken, couponCode: cart.couponCode };
    }
    if (!create) return null;
    const guestToken = this.crypto.randomToken(32);
    const [created] = await tx.insert(carts).values({ guestToken }).returning();
    return { id: created!.id, guestToken, couponCode: null };
  }

  /** Every line with live price, stock and listing state (prices are never taken from the client). */
  async lines(cartId: string, tx: DbOrTx = this.db): Promise<CartLine[]> {
    const rows = await tx.execute<Row>(sql`
      select ci.variant_id, ci.quantity, ci.saved_for_later,
        v.product_id, v.name as variant_name, v.price, v.compare_at_price, v.sku, v.is_active, v.weight_grams as variant_weight,
        p.slug, p.type, p.title, p.book_id, p.condition, p.status, p.deleted_at, p.weight_grams as product_weight,
        b.slug as book_slug, b.cover_key,
        (select pi.storage_key from product_images pi where pi.product_id = p.id order by pi.position limit 1) as image_key,
        se.id as seller_id, se.status as seller_status, se.commission_percent, st.name as store_name, st.slug as store_slug, st.district,
        i.quantity_on_hand, i.quantity_reserved, i.track_inventory
      from cart_items ci
      join product_variants v on v.id = ci.variant_id
      join products p on p.id = v.product_id
      join sellers se on se.id = p.seller_id
      left join seller_stores st on st.seller_id = se.id
      left join books b on b.id = p.book_id
      left join inventory i on i.variant_id = v.id
      where ci.cart_id = ${cartId}
      order by ci.created_at, ci.variant_id`);
    return rows.rows.map((r) => {
      const listed = r.status === 'active' && !r.deleted_at && r.is_active === true && r.seller_status === 'active';
      const available = !listed || r.quantity_on_hand === null ? 0 : r.track_inventory ? Math.max(0, Number(r.quantity_on_hand) - Number(r.quantity_reserved)) : UNTRACKED_STOCK;
      const quantity = Number(r.quantity);
      const imageKey = (r.image_key as string | null) ?? (r.cover_key as string | null);
      return {
        variantId: r.variant_id as string,
        productId: r.product_id as string,
        productSlug: r.slug as string,
        type: r.type as 'book' | 'general',
        bookId: r.book_id as string | null,
        bookSlug: r.book_slug as string | null,
        title: r.title as string,
        variantName: r.variant_name as string,
        condition: r.condition as string | null,
        sku: r.sku as string | null,
        imageKey,
        imageUrl: this.storage.publicUrl(imageKey),
        unitPrice: r.price as string,
        compareAtPrice: r.compare_at_price as string | null,
        quantity,
        savedForLater: r.saved_for_later === true,
        available,
        state: !listed || available === 0 ? 'unavailable' : available < quantity ? 'insufficient' : 'ok',
        lineTotal: multiplyMoney(r.price as string, quantity),
        weightGrams: (r.variant_weight as number | null) ?? (r.product_weight as number | null),
        seller: { id: r.seller_id as string, name: (r.store_name as string | null) ?? '', slug: (r.store_slug as string | null) ?? '', district: r.district as string | null, commissionPercent: r.commission_percent as string | null },
      };
    });
  }

  /** Cart for display: active lines grouped by seller, saved-for-later lines apart. */
  async view(owner: CartOwner) {
    const cart = await this.resolve(owner, false);
    if (!cart) return { guestToken: owner.userId ? null : (owner.guestToken ?? null), couponCode: null, groups: [], saved: [], summary: { itemCount: 0, subtotal: '0.00', hasProblems: false } };
    const lines = await this.lines(cart.id);
    const active = lines.filter((l) => !l.savedForLater);
    const groups = new Map<string, { seller: CartLine['seller']; items: CartLine[]; subtotal: string }>();
    for (const line of active) {
      const g = groups.get(line.seller.id) ?? { seller: line.seller, items: [], subtotal: '0.00' };
      g.items.push(line);
      if (line.state === 'ok') g.subtotal = addMoney(g.subtotal, line.lineTotal);
      groups.set(line.seller.id, g);
    }
    const ok = active.filter((l) => l.state === 'ok');
    return {
      guestToken: cart.guestToken,
      couponCode: cart.couponCode,
      groups: [...groups.values()].map((g) => ({ ...g, seller: { id: g.seller.id, name: g.seller.name, slug: g.seller.slug, district: g.seller.district }, items: g.items.map(publicLine) })),
      saved: lines.filter((l) => l.savedForLater).map(publicLine),
      summary: { itemCount: ok.reduce((n, l) => n + l.quantity, 0), subtotal: addMoney('0', ...ok.map((l) => l.lineTotal)), hasProblems: active.some((l) => l.state !== 'ok') },
    };
  }

  async add(owner: CartOwner, variantId: string, quantity: number) {
    return this.db.transaction(async (tx) => {
      const cart = (await this.resolve(owner, true, tx))!;
      const [variant] = await tx.execute<Row>(sql`
        select v.id, i.quantity_on_hand, i.quantity_reserved, i.track_inventory, p.seller_id
        from product_variants v join products p on p.id = v.product_id join sellers se on se.id = p.seller_id left join inventory i on i.variant_id = v.id
        where v.id = ${variantId} and v.is_active and p.status = 'active' and p.deleted_at is null and se.status = 'active'`).then((r) => r.rows);
      if (!variant) throw new AppException('NOT_FOUND', 'api.commerce.itemUnavailable');
      if (owner.userId) {
        const [own] = await tx.execute(sql`select 1 from sellers where id = ${variant.seller_id as string} and user_id = ${owner.userId}`).then((r) => r.rows);
        if (own) throw new AppException('BAD_REQUEST', 'api.commerce.ownListing');
      }
      const available = variant.track_inventory === false ? UNTRACKED_STOCK : Math.max(0, Number(variant.quantity_on_hand ?? 0) - Number(variant.quantity_reserved ?? 0));
      const [existing] = await tx.select().from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
      const wanted = Math.min(MAX_CART_QUANTITY, (existing && !existing.savedForLater ? existing.quantity : 0) + quantity);
      if (available <= 0) throw new AppException('OUT_OF_STOCK', 'api.commerce.outOfStock');
      if (wanted > available) throw new AppException('OUT_OF_STOCK', 'api.commerce.onlyAvailable').withParams({ count: available });
      if (!existing) {
        const [{ lines } = { lines: 0 }] = await tx.execute<{ lines: number }>(sql`select count(*)::int as lines from cart_items where cart_id = ${cart.id}`).then((r) => r.rows);
        if (lines >= MAX_CART_LINES) throw new AppException('BAD_REQUEST', 'api.commerce.cartFull').withParams({ count: MAX_CART_LINES });
        await tx.insert(cartItems).values({ cartId: cart.id, variantId, quantity: wanted });
      } else {
        await tx.update(cartItems).set({ quantity: wanted, savedForLater: false, updatedAt: new Date() }).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
      }
      await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));
      return { guestToken: cart.guestToken };
    });
  }

  async update(owner: CartOwner, variantId: string, input: { quantity?: number; savedForLater?: boolean }) {
    const cart = await this.resolve(owner, false);
    if (!cart) throw AppException.notFound('Cart item');
    if (input.quantity !== undefined) {
      const [line] = (await this.lines(cart.id)).filter((l) => l.variantId === variantId);
      if (!line) throw AppException.notFound('Cart item');
      if (input.quantity > line.available && input.quantity > line.quantity) throw new AppException('OUT_OF_STOCK', 'api.commerce.onlyAvailable').withParams({ count: line.available });
    }
    const updated = await this.db
      .update(cartItems)
      .set({ ...(input.quantity !== undefined ? { quantity: input.quantity } : {}), ...(input.savedForLater !== undefined ? { savedForLater: input.savedForLater } : {}), updatedAt: new Date() })
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)))
      .returning({ variantId: cartItems.variantId });
    if (!updated.length) throw AppException.notFound('Cart item');
  }

  async remove(owner: CartOwner, variantId: string): Promise<void> {
    const cart = await this.resolve(owner, false);
    if (!cart) return;
    await this.db.delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
  }

  async setCoupon(owner: CartOwner, code: string | null): Promise<void> {
    const cart = await this.resolve(owner, code !== null);
    if (!cart) return;
    await this.db.update(carts).set({ couponCode: code, updatedAt: new Date() }).where(eq(carts.id, cart.id));
  }

  /** After sign-in: moves a guest cart into the user's cart (quantities add up, capped at the maximum). */
  async merge(userId: string, guestToken: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [guest] = await tx.select().from(carts).where(and(eq(carts.guestToken, guestToken), sql`${carts.userId} is null`)).for('update');
      if (!guest) return;
      const cart = (await this.resolve({ userId }, true, tx))!;
      await tx.execute(sql`
        insert into cart_items (cart_id, variant_id, quantity, saved_for_later)
        select ${cart.id}, g.variant_id, g.quantity, g.saved_for_later from cart_items g where g.cart_id = ${guest.id}
        on conflict (cart_id, variant_id) do update set quantity = least(cart_items.quantity + excluded.quantity, ${MAX_CART_QUANTITY}), saved_for_later = false, updated_at = now()`);
      if (guest.couponCode && !cart.couponCode) await tx.update(carts).set({ couponCode: guest.couponCode }).where(eq(carts.id, cart.id));
      await tx.delete(carts).where(eq(carts.id, guest.id));
    });
  }

  /** Removes the purchased lines after an order is placed (saved-for-later lines stay). */
  async clearPurchased(tx: DbOrTx, cartId: string, variantIds: string[]): Promise<void> {
    if (!variantIds.length) return;
    await tx.execute(sql`delete from cart_items where cart_id = ${cartId} and variant_id in (${sql.join(variantIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
    await tx.update(carts).set({ couponCode: null, updatedAt: new Date() }).where(eq(carts.id, cartId));
  }
}

/** The client-facing shape (internal ids/keys and commission stay on the server). */
function publicLine(l: CartLine) {
  const { imageKey: _imageKey, weightGrams: _weight, seller, ...rest } = l;
  return { ...rest, seller: { id: seller.id, name: seller.name, slug: seller.slug } };
}
