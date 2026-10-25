import { sql } from 'drizzle-orm';
import { OrdersService } from '../src/modules/commerce/orders.service';
import { RefundsService } from '../src/modules/commerce/refunds.service';
import { approvedSeller, categoryId, createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
let isbnCounter = 0;
/** A fresh valid ISBN-13 for each listing. */
function isbn(): string {
  isbnCounter += 1;
  const digits = `978984${String(500000 + isbnCounter).padStart(6, '0')}`;
  const check = (10 - (digits.split('').reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10;
  return `${digits}${check}`;
}
const key = () => `chk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

describe('Cart, checkout, orders, payments, refunds and payouts (e2e)', () => {
  let ctx: TestContext;
  let admin: RegisteredUser;
  let poetry: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    admin = await registerUser(ctx, { name: 'Admin' });
    await grantRole(ctx, admin.id, 'super_admin');
    poetry = await categoryId(ctx, 'books/poetry');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  /** Lists a book and returns its variant id. */
  async function listBook(seller: RegisteredUser, title: string, price: string, stock: number, extra: Record<string, unknown> = {}) {
    const body = {
      isbn: isbn(),
      book: { title, language: 'bn', categoryId: poetry, authorNames: ['রবীন্দ্রনাথ ঠাকুর'] },
      format: { format: 'paperback', pages: 120 },
      condition: 'new',
      price,
      stock,
      declaration: { capacity: 'reseller_physical', accepted: true },
      ...extra,
    };
    const created = await ctx.http.post(`${API}/seller/books`).set(as(seller)).send(body).expect(201);
    const listing = await ctx.http.get(`${API}/seller/products/${created.body.data.id}`).set(as(seller)).expect(200);
    return { productId: created.body.data.id as string, variantId: listing.body.data.variants[0].id as string };
  }

  async function address(user: RegisteredUser, district = 'dhaka', division = 'dhaka') {
    const res = await ctx.http
      .post(`${API}/me/addresses`)
      .set(as(user))
      .send({ recipientName: 'Nadia Rahman', phone: '01712345678', division, district, upazila: 'Dhanmondi', area: 'Road 27', addressLine: 'House 5, Flat 3B' })
      .expect(201);
    return res.body.data.id as string;
  }

  const stock = async (variantId: string) =>
    (await ctx.db.execute<{ on_hand: number; reserved: number }>(sql`select quantity_on_hand as on_hand, quantity_reserved as reserved from inventory where variant_id = ${variantId}`)).rows[0]!;

  it('keeps a guest cart and merges it into the account after sign-in', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Guest Books');
    const { variantId } = await listBook(seller, 'গীতাঞ্জলি', '200', 5);
    const added = await ctx.http.post(`${API}/cart/items`).send({ variantId, quantity: 2 }).expect(200);
    const token = added.body.data.guestToken as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    const view = await ctx.http.get(`${API}/cart`).set('X-Cart-Token', token).expect(200);
    expect(view.body.data.summary).toMatchObject({ itemCount: 2, subtotal: '400.00' });
    // Asking for more than is in stock is refused with the real availability.
    const tooMany = await ctx.http.post(`${API}/cart/items`).set('X-Cart-Token', token).send({ variantId, quantity: 4 }).expect(409);
    expect(tooMany.body.message).toMatch(/5/);
    // The seller cannot buy their own listing.
    await ctx.http.post(`${API}/cart/items`).set(as(seller)).send({ variantId }).expect(400);

    const buyer = await registerUser(ctx);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId, quantity: 1 }).expect(200);
    const merged = await ctx.http.post(`${API}/cart/merge`).set(as(buyer)).send({ guestToken: token }).expect(200);
    expect(merged.body.data.summary.itemCount).toBe(3);
    // The guest cart is gone.
    const empty = await ctx.http.get(`${API}/cart`).set('X-Cart-Token', token).expect(200);
    expect(empty.body.data.groups).toHaveLength(0);
  });

  it('validates addresses against the official divisions and districts', async () => {
    const buyer = await registerUser(ctx);
    const bad = await ctx.http.post(`${API}/me/addresses`).set(as(buyer)).send({ recipientName: 'A B', phone: '01712345678', division: 'dhaka', district: 'sylhet', upazila: 'Mirpur', area: 'Y Z', addressLine: 'House 1' }).expect(400);
    expect(bad.body.errors[0].field).toBe('district');
    const first = await address(buyer);
    const second = await address(buyer, 'chattogram', 'chattogram');
    const list = await ctx.http.get(`${API}/me/addresses`).set(as(buyer)).expect(200);
    expect(list.body.data.find((a: { id: string }) => a.id === first).isDefault).toBe(true);
    expect(list.body.data.find((a: { id: string }) => a.id === second).isDefault).toBe(false);
    await ctx.http.delete(`${API}/me/addresses/${first}`).set(as(buyer)).expect(200);
    const after = await ctx.http.get(`${API}/me/addresses`).set(as(buyer)).expect(200);
    expect(after.body.data).toEqual([expect.objectContaining({ id: second, isDefault: true })]);
    const other = await registerUser(ctx);
    await ctx.http.delete(`${API}/me/addresses/${second}`).set(as(other)).expect(404);
  });

  it('prices per seller with zone shipping, free-shipping thresholds and coupons split exactly', async () => {
    const a = await approvedSeller(ctx, admin, 'book_seller', 'Seller A');
    const b = await approvedSeller(ctx, admin, 'book_seller', 'Seller B');
    const bookA = await listBook(a, 'বই এ', '1000', 10);
    const bookB = await listBook(b, 'বই বি', '300', 10);
    const buyer = await registerUser(ctx);
    const dhaka = await address(buyer);
    const sylhet = await address(buyer, 'sylhet', 'sylhet');
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: bookA.variantId, quantity: 2 }).expect(200);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: bookB.variantId, quantity: 1 }).expect(200);

    const inside = await ctx.http.post(`${API}/checkout/quote`).set(as(buyer)).send({ addressId: dhaka }).expect(200);
    // Seller A's 2000 is above the 1500 free-shipping threshold; seller B pays the inside-Dhaka fee.
    expect(inside.body.data.groups.map((g: { shippingFee: string }) => g.shippingFee)).toEqual(['0.00', '60.00']);
    expect(inside.body.data.totals).toMatchObject({ itemsSubtotal: '2300.00', shippingTotal: '60.00', grandTotal: '2360.00', shippingPending: false });
    const outside = await ctx.http.post(`${API}/checkout/quote`).set(as(buyer)).send({ addressId: sylhet }).expect(200);
    expect(outside.body.data.totals.shippingTotal).toBe('120.00');

    await ctx.http.post(`${API}/admin/coupons`).set(as(admin)).send({ code: 'boi10', type: 'percent', value: '10', maxDiscountAmount: '200', minOrderAmount: '500' }).expect(201);
    const coupon = await ctx.http.post(`${API}/checkout/quote`).set(as(buyer)).send({ addressId: dhaka, couponCode: 'BOI10' }).expect(200);
    // 10% of 2300 = 230, capped at 200, split 2000:300 between the sellers.
    expect(coupon.body.data.coupon).toMatchObject({ code: 'BOI10', applied: true, discount: '200.00' });
    expect(coupon.body.data.groups.map((g: { itemDiscount: string }) => g.itemDiscount)).toEqual(['173.91', '26.09']);
    expect(coupon.body.data.totals.grandTotal).toBe('2160.00');
    const wrong = await ctx.http.post(`${API}/checkout/quote`).set(as(buyer)).send({ addressId: dhaka, couponCode: 'NOPE' }).expect(200);
    expect(wrong.body.data.coupon).toMatchObject({ applied: false });
    expect(wrong.body.data.coupon.message).toBeTruthy();
  });

  it('places a cash-on-delivery order idempotently, reserving stock and splitting it per seller', async () => {
    const a = await approvedSeller(ctx, admin, 'book_seller', 'Seller A');
    const b = await approvedSeller(ctx, admin, 'book_seller', 'Seller B');
    const bookA = await listBook(a, 'বই এ', '250', 3);
    const bookB = await listBook(b, 'বই বি', '300', 2);
    const buyer = await registerUser(ctx);
    const addressId = await address(buyer);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: bookA.variantId, quantity: 2 }).expect(200);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: bookB.variantId, quantity: 1 }).expect(200);

    const quote = await ctx.http.post(`${API}/checkout/quote`).set(as(buyer)).send({ addressId }).expect(200);
    const stale = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'cod', idempotencyKey: key(), expectedTotal: '1.00' }).expect(409);
    expect(stale.body.message).toMatch(quote.body.data.totals.grandTotal.replace('.00', ''));

    const idem = key();
    const placed = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'cod', idempotencyKey: idem, expectedTotal: quote.body.data.totals.grandTotal }).expect(201);
    const number = placed.body.data.order.number as string;
    expect(number).toMatch(/^BK\d{6}[2-9A-Z]{6}$/);
    expect(placed.body.data.payment).toMatchObject({ method: 'cod', status: 'pending', redirectUrl: null });
    const again = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'cod', idempotencyKey: idem }).expect(201);
    expect(again.body.data.order.number).toBe(number);
    expect((await ctx.db.execute(sql`select count(*)::int as n from orders`)).rows[0]).toEqual({ n: 1 });

    expect(await stock(bookA.variantId)).toEqual({ on_hand: 3, reserved: 2 });
    expect(await stock(bookB.variantId)).toEqual({ on_hand: 2, reserved: 1 });
    const cart = await ctx.http.get(`${API}/cart`).set(as(buyer)).expect(200);
    expect(cart.body.data.groups).toHaveLength(0);

    const detail = await ctx.http.get(`${API}/orders/${number}`).set(as(buyer)).expect(200);
    expect(detail.body.data.sellerOrders).toHaveLength(2);
    expect(detail.body.data.totals).toMatchObject({ itemsSubtotal: '800.00', shippingTotal: '120.00', grandTotal: '920.00' });
    expect(detail.body.data.canCancel).toBe(true);
    const stranger = await registerUser(ctx);
    await ctx.http.get(`${API}/orders/${number}`).set(as(stranger)).expect(404);

    // Each seller sees only their own part, with 10% commission taken from their earning.
    const sellerA = await ctx.http.get(`${API}/seller/orders`).set(as(a)).expect(200);
    expect(sellerA.body.data).toHaveLength(1);
    expect(sellerA.body.data[0]).toMatchObject({ total: '560.00', earning: '450.00', itemCount: 2 });
    const soA = sellerA.body.data[0].id as string;
    await ctx.http.get(`${API}/seller/orders/${soA}`).set(as(b)).expect(404);

    // The buyer cancels before anything ships: stock comes back.
    await ctx.http.post(`${API}/orders/${number}/cancel`).set(as(buyer)).send({ reason: 'Ordered by mistake' }).expect(200);
    expect(await stock(bookA.variantId)).toEqual({ on_hand: 3, reserved: 0 });
    const cancelled = await ctx.http.get(`${API}/orders/${number}`).set(as(buyer)).expect(200);
    expect(cancelled.body.data).toMatchObject({ status: 'cancelled', canCancel: false });
  });

  it('runs the seller lifecycle: confirm, pack, ship (stock leaves), deliver (COD collected)', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Lifecycle');
    const book = await listBook(seller, 'জীবনচক্র', '400', 5);
    const buyer = await registerUser(ctx);
    const addressId = await address(buyer);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: book.variantId, quantity: 2 }).expect(200);
    const placed = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'cod', idempotencyKey: key() }).expect(201);
    const number = placed.body.data.order.number as string;
    const [{ id: so }] = (await ctx.http.get(`${API}/seller/orders`).set(as(seller)).expect(200)).body.data;

    const skip = await ctx.http.post(`${API}/seller/orders/${so}/status`).set(as(seller)).send({ status: 'delivered' }).expect(409);
    expect(skip.body.code).toBe('CONFLICT');
    await ctx.http.post(`${API}/seller/orders/${so}/status`).set(as(seller)).send({ status: 'cancelled' }).expect(400);
    await ctx.http.post(`${API}/seller/orders/${so}/status`).set(as(seller)).send({ status: 'confirmed' }).expect(200);
    await ctx.http.post(`${API}/seller/orders/${so}/status`).set(as(seller)).send({ status: 'processing' }).expect(200);
    const shipped = await ctx.http.post(`${API}/seller/orders/${so}/status`).set(as(seller)).send({ status: 'shipped', courier: 'pathao', trackingNumber: 'PTH-12345' }).expect(200);
    expect(shipped.body.data.shipment).toMatchObject({ courier: 'pathao', trackingNumber: 'PTH-12345', status: 'handed_to_courier' });
    expect(await stock(book.variantId)).toEqual({ on_hand: 3, reserved: 0 });
    const buyerView = await ctx.http.get(`${API}/orders/${number}`).set(as(buyer)).expect(200);
    expect(buyerView.body.data).toMatchObject({ status: 'shipped', canCancel: false });
    await ctx.http.post(`${API}/orders/${number}/cancel`).set(as(buyer)).send({ reason: 'Too late' }).expect(409);
    await ctx.http.post(`${API}/seller/orders/${so}/status`).set(as(seller)).send({ status: 'delivered' }).expect(200);
    const delivered = await ctx.http.get(`${API}/orders/${number}`).set(as(buyer)).expect(200);
    expect(delivered.body.data).toMatchObject({ status: 'delivered', paymentStatus: 'paid' });
    expect(delivered.body.data.sellerOrders[0].shipment.events.map((e: { status: string }) => e.status)).toEqual(['packed', 'handed_to_courier', 'delivered']);
    const sales = await ctx.db.execute<{ n: number }>(sql`select sales_count as n from products where id = ${book.productId}`);
    expect(sales.rows[0]!.n).toBe(2);
  });

  it('takes online payments through the gateway flow and expires unpaid orders', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Online');
    const book = await listBook(seller, 'অনলাইন', '500', 4);
    const buyer = await registerUser(ctx);
    const addressId = await address(buyer);
    const options = await ctx.http.get(`${API}/checkout/options`).expect(200);
    // Only methods with a working gateway are offered (no bKash/SSLCOMMERZ credentials in tests).
    expect(options.body.data.paymentMethods.map((m: { method: string }) => m.method)).toEqual(['cod', 'sandbox']);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: book.variantId, quantity: 1 }).expect(200);
    const nope = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'bkash', idempotencyKey: key() }).expect(400);
    expect(nope.body.errors[0].field).toBe('paymentMethod');

    const placed = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'sandbox', idempotencyKey: key() }).expect(201);
    const { number } = placed.body.data.order;
    const payment = placed.body.data.payment;
    expect(payment.redirectUrl).toMatch(/\/payments\/sandbox\//);
    // Unpaid online orders are invisible to the seller.
    expect((await ctx.http.get(`${API}/seller/orders`).set(as(seller)).expect(200)).body.data).toHaveLength(0);
    const stranger = await registerUser(ctx);
    await ctx.http.get(`${API}/payments/sandbox/${payment.id}`).set(as(stranger)).expect(404);

    const paid = await ctx.http.post(`${API}/payments/sandbox/${payment.id}/complete`).set(as(buyer)).send({ outcome: 'success' }).expect(200);
    expect(paid.body.data.status).toBe('paid');
    await ctx.http.post(`${API}/payments/sandbox/${payment.id}/complete`).set(as(buyer)).send({ outcome: 'failure' }).expect(409);
    const order = await ctx.http.get(`${API}/orders/${number}`).set(as(buyer)).expect(200);
    expect(order.body.data).toMatchObject({ paymentStatus: 'paid', canPay: false });
    expect((await ctx.http.get(`${API}/seller/orders`).set(as(seller)).expect(200)).body.data).toHaveLength(1);

    // A second order that is never paid expires and releases its stock.
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: book.variantId, quantity: 2 }).expect(200);
    const unpaid = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'sandbox', idempotencyKey: key() }).expect(201);
    expect(await stock(book.variantId)).toEqual({ on_hand: 4, reserved: 3 });
    await ctx.http.post(`${API}/payments/sandbox/${unpaid.body.data.payment.id}/complete`).set(as(buyer)).send({ outcome: 'failure' }).expect(200);
    const retry = await ctx.http.post(`${API}/orders/${unpaid.body.data.order.number}/pay`).set(as(buyer)).send({ paymentMethod: 'sandbox', idempotencyKey: key() }).expect(200);
    expect(retry.body.data.redirectUrl).toMatch(/sandbox/);
    await ctx.db.execute(sql`update orders set payment_due_at = now() - interval '1 minute' where number = ${unpaid.body.data.order.number}`);
    expect(await ctx.app.get(OrdersService).expireNow()).toBe(1);
    expect(await stock(book.variantId)).toEqual({ on_hand: 4, reserved: 1 });
    const expired = await ctx.http.get(`${API}/orders/${unpaid.body.data.order.number}`).set(as(buyer)).expect(200);
    expect(expired.body.data.status).toBe('cancelled');
  });

  it('refunds a cancelled paid order through the gateway and records it', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Refunds');
    const book = await listBook(seller, 'ফেরত', '700', 2);
    const buyer = await registerUser(ctx);
    const addressId = await address(buyer, 'khulna', 'khulna');
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: book.variantId, quantity: 1 }).expect(200);
    const placed = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'sandbox', idempotencyKey: key() }).expect(201);
    await ctx.http.post(`${API}/payments/sandbox/${placed.body.data.payment.id}/complete`).set(as(buyer)).send({ outcome: 'success' }).expect(200);
    const { number } = placed.body.data.order;
    await ctx.http.post(`${API}/orders/${number}/cancel`).set(as(buyer)).send({ reason: 'Found it elsewhere' }).expect(200);
    const pending = await ctx.http.get(`${API}/orders/${number}`).set(as(buyer)).expect(200);
    expect(pending.body.data.refunds).toEqual([expect.objectContaining({ amount: '820.00', status: 'approved' })]);

    await ctx.app.get(RefundsService).processApproved();
    const done = await ctx.http.get(`${API}/orders/${number}`).set(as(buyer)).expect(200);
    expect(done.body.data).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', totals: { refundedTotal: '820.00' } });
    expect(done.body.data.refunds[0].status).toBe('completed');
    const refunds = await ctx.http.get(`${API}/admin/refunds`).set(as(admin)).expect(200);
    expect(refunds.body.data[0]).toMatchObject({ orderNumber: number, status: 'completed', provider: 'sandbox' });
  });

  it('handles a return after delivery and pays the seller after the hold period', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Returns & Payouts');
    const book = await listBook(seller, 'ফেরতযোগ্য', '600', 5);
    const buyer = await registerUser(ctx);
    const addressId = await address(buyer);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: book.variantId, quantity: 2 }).expect(200);
    const placed = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'cod', idempotencyKey: key() }).expect(201);
    const { number } = placed.body.data.order;
    const [{ id: so }] = (await ctx.http.get(`${API}/seller/orders`).set(as(seller)).expect(200)).body.data;
    for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) await ctx.http.post(`${API}/seller/orders/${so}/status`).set(as(seller)).send({ status }).expect(200);

    const order = (await ctx.http.get(`${API}/orders/${number}`).set(as(buyer)).expect(200)).body.data;
    const item = order.sellerOrders[0].items[0];
    expect(order.sellerOrders[0].returnableUntil).toBeTruthy();
    // Book items link to the shared book page, where they are reviewed.
    expect(item.path).toMatch(/^\/books\//);
    await ctx.http.post(`${API}/orders/${number}/returns`).set(as(buyer)).send({ sellerOrderId: so, reason: 'damaged', items: [{ orderItemId: item.id, quantity: 3 }] }).expect(400);
    const requested = await ctx.http.post(`${API}/orders/${number}/returns`).set(as(buyer)).send({ sellerOrderId: so, reason: 'damaged', details: 'Cover torn', items: [{ orderItemId: item.id, quantity: 1 }] }).expect(201);
    await ctx.http.post(`${API}/orders/${number}/returns`).set(as(buyer)).send({ sellerOrderId: so, reason: 'damaged', items: [{ orderItemId: item.id, quantity: 1 }] }).expect(409);
    const returnId = requested.body.data.id as string;
    expect((await ctx.http.get(`${API}/seller/orders-summary`).set(as(seller)).expect(200)).body.data.returns).toBe(1);
    expect((await ctx.http.get(`${API}/seller/orders?returns=requested`).set(as(seller)).expect(200)).body.data.map((r: { id: string }) => r.id)).toEqual([so]);
    await ctx.http.post(`${API}/seller/returns/${returnId}/received`).set(as(seller)).send({ restock: true }).expect(409);
    await ctx.http.post(`${API}/seller/returns/${returnId}/decision`).set(as(seller)).send({ approve: true }).expect(200);
    await ctx.http.post(`${API}/seller/returns/${returnId}/received`).set(as(seller)).send({ restock: true }).expect(200);
    expect(await stock(book.variantId)).toEqual({ on_hand: 4, reserved: 0 });

    // Cash-on-delivery money goes back by bKash/bank: staff record the transfer.
    await ctx.app.get(RefundsService).processApproved();
    const refunds = await ctx.http.get(`${API}/admin/refunds?status=processing`).set(as(admin)).expect(200);
    expect(refunds.body.data[0]).toMatchObject({ amount: '600.00', orderNumber: number });
    await ctx.http.post(`${API}/admin/refunds/${refunds.body.data[0].id}/complete`).set(as(admin)).send({ reference: 'BKASH-TRX-9988' }).expect(200);
    const afterRefund = (await ctx.http.get(`${API}/orders/${number}`).set(as(buyer)).expect(200)).body.data;
    expect(afterRefund).toMatchObject({ paymentStatus: 'partially_refunded', totals: { refundedTotal: '600.00' } });
    expect(afterRefund.returns[0].status).toBe('refunded');

    // Payout: earning 1200 − 10% = 1080, less the refunded sale (600 − 60 commission back) = 540.
    await ctx.db.execute(sql`update seller_orders set delivered_at = now() - interval '10 days' where id = ${so}`);
    const before = await ctx.http.get(`${API}/seller/payouts`).set(as(seller)).expect(200);
    expect(before.body.data).toMatchObject({ available: '540.00' });
    const noAccount = await ctx.http.post(`${API}/admin/payouts`).set(as(admin)).send({ sellerId: (await ctx.db.execute<{ id: string }>(sql`select seller_id as id from seller_orders where id = ${so}`)).rows[0]!.id }).expect(409);
    expect(noAccount.body.code).toBe('CONFLICT');
    const accounts = await ctx.http.post(`${API}/seller/payout-accounts`).set(as(seller)).send({ method: 'bkash', accountName: 'Seller Person', accountNumber: '01812345678' }).expect(201);
    expect(accounts.body.data[0]).toMatchObject({ method: 'bkash', last4: '5678' });
    expect(JSON.stringify(accounts.body.data)).not.toContain('01812345678');
    const eligible = await ctx.http.get(`${API}/admin/payouts/eligible`).set(as(admin)).expect(200);
    expect(eligible.body.data[0]).toMatchObject({ amount: '540.00', meetsMinimum: true });
    const payout = await ctx.http.post(`${API}/admin/payouts`).set(as(admin)).send({ sellerId: eligible.body.data[0].sellerId }).expect(201);
    const reveal = await ctx.http.get(`${API}/admin/payouts/${payout.body.data.id}/account`).set(as(admin)).expect(200);
    expect(reveal.body.data.accountNumber).toBe('01812345678');
    await ctx.http.post(`${API}/admin/payouts`).set(as(admin)).send({ sellerId: eligible.body.data[0].sellerId }).expect(409);
    await ctx.http.post(`${API}/admin/payouts/${payout.body.data.id}/paid`).set(as(admin)).send({ reference: 'BKASH-PAYOUT-1' }).expect(200);
    const after = await ctx.http.get(`${API}/seller/payouts`).set(as(seller)).expect(200);
    expect(after.body.data).toMatchObject({ available: '0.00', paid: '540.00' });
    const audit = await ctx.db.execute(sql`select action from audit_logs where action like 'payout%' order by created_at`);
    expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining(['payout_account.add', 'payout.create', 'payout_account.view', 'payout.paid']));
  });

  it('never sells the last copy twice', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Last Copy');
    const book = await listBook(seller, 'শেষ কপি', '350', 1);
    const [x, y] = [await registerUser(ctx), await registerUser(ctx)];
    const [ax, ay] = [await address(x), await address(y)];
    await ctx.http.post(`${API}/cart/items`).set(as(x)).send({ variantId: book.variantId }).expect(200);
    await ctx.http.post(`${API}/cart/items`).set(as(y)).send({ variantId: book.variantId }).expect(200);
    const results = await Promise.all([
      ctx.http.post(`${API}/checkout`).set(as(x)).send({ addressId: ax, paymentMethod: 'cod', idempotencyKey: key() }),
      ctx.http.post(`${API}/checkout`).set(as(y)).send({ addressId: ay, paymentMethod: 'cod', idempotencyKey: key() }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stock(book.variantId)).toEqual({ on_hand: 1, reserved: 1 });
  });
});
