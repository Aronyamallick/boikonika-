import { sql } from 'drizzle-orm';
import { approvedSeller, categoryId, createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
let n = 0;
function isbn(): string {
  n += 1;
  const digits = `978984${String(700000 + n).padStart(6, '0')}`;
  const check = (10 - (digits.split('').reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10;
  return `${digits}${check}`;
}
const key = () => `chk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

describe('Reviews and creator dashboards (e2e)', () => {
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

  async function listBook(seller: RegisteredUser, title: string, extra: Record<string, unknown> = {}, bookExtra: Record<string, unknown> = {}) {
    const created = await ctx.http
      .post(`${API}/seller/books`)
      .set(as(seller))
      .send({ isbn: isbn(), book: { title, language: 'bn', categoryId: poetry, authorNames: ['হুমায়ূন আহমেদ'], ...bookExtra }, format: { format: 'paperback', pages: 200 }, condition: 'new', price: '300', stock: 10, declaration: { capacity: 'reseller_physical', accepted: true }, ...extra })
      .expect(201);
    const listing = await ctx.http.get(`${API}/seller/products/${created.body.data.id}`).set(as(seller)).expect(200);
    const product = await ctx.http.get(`${API}/products/${encodeURIComponent(created.body.data.slug)}`).expect(200);
    return { productId: created.body.data.id as string, variantId: listing.body.data.variants[0].id as string, bookSlug: product.body.data.bookSlug as string };
  }

  async function buyAndDeliver(buyer: RegisteredUser, seller: RegisteredUser, variantId: string) {
    const address = await ctx.http.post(`${API}/me/addresses`).set(as(buyer)).send({ recipientName: 'Buyer Person', phone: '01712345678', division: 'dhaka', district: 'dhaka', upazila: 'Mirpur', area: 'Section 10', addressLine: 'House 1' }).expect(201);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId }).expect(200);
    await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId: address.body.data.id, paymentMethod: 'cod', idempotencyKey: key() }).expect(201);
    const [so] = (await ctx.http.get(`${API}/seller/orders`).set(as(seller)).expect(200)).body.data;
    for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) await ctx.http.post(`${API}/seller/orders/${so.id}/status`).set(as(seller)).send({ status }).expect(200);
  }

  it('takes reader and verified-buyer reviews, with votes, seller replies and spam holds', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Review Books');
    const other = await approvedSeller(ctx, admin, 'book_seller', 'Other Books');
    const book = await listBook(seller, 'জোছনা ও জননীর গল্প');
    const bookId = (await ctx.db.execute<{ id: string }>(sql`select id from books where slug = ${book.bookSlug}`)).rows[0]!.id;

    // A reader who has not bought it can still review a book (no verified badge).
    const reader = await registerUser(ctx);
    // Accounts younger than a day are scored more strictly; age this one.
    await ctx.db.execute(sql`update users set created_at = now() - interval '30 days' where id = ${reader.id}`);
    const eligibility = await ctx.http.get(`${API}/reviews/eligibility?bookId=${bookId}`).set(as(reader)).expect(200);
    expect(eligibility.body.data).toEqual({ canReview: true, verified: false, reviewId: null });
    const short = await ctx.http.post(`${API}/reviews`).set(as(reader)).send({ bookId, rating: 4, body: 'Nice.' }).expect(400);
    expect(short.body.errors[0].field).toBe('body');
    await ctx.http.post(`${API}/reviews`).set(as(reader)).send({ bookId, rating: 4, title: 'ভালো লেগেছে', body: 'মুক্তিযুদ্ধের সময়ের মানুষের গল্প, খুব যত্ন নিয়ে লেখা।' }).expect(201);
    await ctx.http.post(`${API}/reviews`).set(as(reader)).send({ bookId, rating: 5 }).expect(409);

    // A buyer's review is verified and counts towards the seller's rating.
    const buyer = await registerUser(ctx);
    await ctx.db.execute(sql`update users set created_at = now() - interval '30 days' where id = ${buyer.id}`);
    await buyAndDeliver(buyer, seller, book.variantId);
    const verified = await ctx.http.post(`${API}/reviews`).set(as(buyer)).send({ bookId, rating: 2, body: 'বাঁধাই দুর্বল ছিল, কয়েকটা পাতা খুলে গেছে।' }).expect(201);
    const reviewId = verified.body.data.id as string;
    const detail = await ctx.http.get(`${API}/books/${encodeURIComponent(book.bookSlug)}`).expect(200);
    expect(detail.body.data.rating).toMatchObject({ average: 3, count: 2, breakdown: { 4: 1, 2: 1 } });
    const store = await ctx.db.execute<{ rating_avg: string; rating_count: number }>(sql`select rating_avg, rating_count from seller_stores where name = 'Review Books'`);
    expect(store.rows[0]).toEqual({ rating_avg: '2.00', rating_count: 1 });

    // Votes toggle; you cannot vote on your own review.
    await ctx.http.post(`${API}/reviews/${reviewId}/vote`).set(as(buyer)).send({ helpful: true }).expect(400);
    const up = await ctx.http.post(`${API}/reviews/${reviewId}/vote`).set(as(reader)).send({ helpful: true }).expect(200);
    expect(up.body.data).toMatchObject({ helpfulCount: 1, myVote: true });
    const again = await ctx.http.post(`${API}/reviews/${reviewId}/vote`).set(as(reader)).send({ helpful: true }).expect(200);
    expect(again.body.data).toMatchObject({ helpfulCount: 0, myVote: null });

    // Only the seller who fulfilled the purchase can answer.
    await ctx.http.post(`${API}/reviews/${reviewId}/reply`).set(as(other)).send({ body: 'Not ours' }).expect(404);
    await ctx.http.post(`${API}/reviews/${reviewId}/reply`).set(as(seller)).send({ body: 'দুঃখিত! আমরা বদলে দিচ্ছি।' }).expect(200);
    const list = await ctx.http.get(`${API}/books/${encodeURIComponent(book.bookSlug)}/reviews?sort=lowest`).expect(200);
    expect(list.body.data[0]).toMatchObject({ rating: 2, verified: true, sellerReply: { body: 'দুঃখিত! আমরা বদলে দিচ্ছি।', store: 'Review Books' } });
    const sellerNotes = await ctx.db.execute(sql`select count(*)::int as n from notifications n join sellers s on s.user_id = n.user_id where n.type = 'review'`);
    expect(sellerNotes.rows[0]).toEqual({ n: 1 });

    // A brand-new account posting a link is held for moderation and hidden from others.
    const spammer = await registerUser(ctx);
    const held = await ctx.http.post(`${API}/reviews`).set(as(spammer)).send({ bookId, rating: 5, body: 'Buy cheap copies at www.example-scam.com now!!!!!!' }).expect(201);
    expect(held.body.data.status).toBe('pending_review');
    const publicList = await ctx.http.get(`${API}/books/${encodeURIComponent(book.bookSlug)}/reviews`).expect(200);
    expect(publicList.body.meta.total).toBe(2);
    const ownView = await ctx.http.get(`${API}/books/${encodeURIComponent(book.bookSlug)}/reviews`).set(as(spammer)).expect(200);
    expect(ownView.body.data.find((r: { mine: boolean }) => r.mine)).toMatchObject({ pending: true });
  });

  it('requires a delivered purchase to review a general product', async () => {
    const shop = await approvedSeller(ctx, admin, 'general_seller', 'Pen Shop');
    const pens = await categoryId(ctx, 'products/stationery/pens');
    const created = await ctx.http.post(`${API}/seller/products`).set(as(shop)).send({ title: 'ফাউন্টেন পেন', categoryId: pens, variants: [{ name: 'Black', price: '450', stock: 5 }] }).expect(201);
    const buyer = await registerUser(ctx);
    await ctx.http.post(`${API}/reviews`).set(as(buyer)).send({ productId: created.body.data.id, rating: 5, body: 'Lovely pen that writes smoothly every day.' }).expect(403);
    const listing = await ctx.http.get(`${API}/seller/products/${created.body.data.id}`).set(as(shop)).expect(200);
    await buyAndDeliver(buyer, shop, listing.body.data.variants[0].id);
    await ctx.http.post(`${API}/reviews`).set(as(buyer)).send({ productId: created.body.data.id, rating: 5, body: 'Lovely pen that writes smoothly every day.' }).expect(201);
    const product = await ctx.http.get(`${API}/products/${encodeURIComponent(created.body.data.slug)}`).expect(200);
    expect(product.body.data.rating).toMatchObject({ average: 5, count: 1 });
  });

  it('shows the seller dashboard with period sales, to-dos and stock alerts', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Dashboard Books');
    const book = await listBook(seller, 'হিমু', { stock: 2 });
    const buyer = await registerUser(ctx);
    await buyAndDeliver(buyer, seller, book.variantId);
    const dash = await ctx.http.get(`${API}/seller/dashboard?days=7`).set(as(seller)).expect(200);
    expect(dash.body.data.kpis).toMatchObject({ revenue: { value: '360.00' }, orders: { value: 1 }, units: { value: 1 }, earnings: { value: '270.00' } });
    expect(dash.body.data.series).toHaveLength(7);
    expect(dash.body.data.series.at(-1)).toMatchObject({ revenue: '360.00', orders: 1 });
    expect(dash.body.data.lowStock[0]).toMatchObject({ title: 'হিমু', available: 1 });
    expect(dash.body.data.topProducts[0]).toMatchObject({ title: 'হিমু', units: 1 });
    await ctx.http.get(`${API}/seller/dashboard?days=12`).set(as(seller)).expect(400);
    const stranger = await registerUser(ctx);
    await ctx.http.get(`${API}/seller/dashboard`).set(as(stranger)).expect(403);
  });

  it('lets a verified author manage their page, post to followers and claim an existing page', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Claim Books');
    const book = await listBook(seller, 'নন্দিত নরকে');
    const author = await approvedSeller(ctx, admin, 'author');
    const fresh = await ctx.http.get(`${API}/author/dashboard`).set(as(author)).expect(200);
    expect(fresh.body.data.stats.books).toBe(0);
    await ctx.http.patch(`${API}/author/profile`).set(as(author)).send({ bio: 'বাংলা কথাসাহিত্যের লেখক।', website: 'https://example.org' }).expect(200);

    // Claim the page sellers created for "হুমায়ূন আহমেদ".
    const found = await ctx.http.get(`${API}/author/claimable?q=${encodeURIComponent('হুমায়ূন')}`).set(as(author)).expect(200);
    const target = found.body.data[0];
    expect(target).toMatchObject({ name: 'হুমায়ূন আহমেদ', bookCount: 1 });
    const fan = await registerUser(ctx);
    await ctx.http.post(`${API}/authors/${encodeURIComponent(target.slug)}/follow`).set(as(fan)).expect(200);
    await ctx.http.post(`${API}/author/claims`).set(as(author)).send({ authorId: target.id, message: 'I wrote these books; my publisher can confirm.' }).expect(201);
    await ctx.http.post(`${API}/author/claims`).set(as(author)).send({ authorId: target.id, message: 'Second attempt for the same page here.' }).expect(409);
    const queue = await ctx.http.get(`${API}/admin/author-claims`).set(as(admin)).expect(200);
    expect(queue.body.data[0]).toMatchObject({ author: { name: 'হুমায়ূন আহমেদ' }, claimant: { legalName: 'Seller Person' } });
    await ctx.http.post(`${API}/admin/author-claims/${queue.body.data[0].id}/approve`).set(as(admin)).send({}).expect(200);

    const dash = await ctx.http.get(`${API}/author/dashboard`).set(as(author)).expect(200);
    expect(dash.body.data.profile).toMatchObject({ slug: target.slug, verified: true, bio: 'বাংলা কথাসাহিত্যের লেখক।' });
    expect(dash.body.data.books.map((b: { slug: string }) => b.slug)).toEqual([book.bookSlug]);
    expect(dash.body.data.stats).toMatchObject({ books: 1, followers: 1 });
    const page = await ctx.http.get(`${API}/authors/${encodeURIComponent(target.slug)}`).expect(200);
    expect(page.body.data).toMatchObject({ verified: true, claimed: true });

    // Announcements reach followers (a few per day).
    const sent = await ctx.http.post(`${API}/author/announcements`).set(as(author)).send({ title: 'নতুন বই আসছে', body: 'বইমেলায় আমার নতুন উপন্যাস প্রকাশিত হবে।' }).expect(201);
    expect(sent.body.data.notified).toBe(1);
    const inbox = await ctx.db.execute(sql`select count(*)::int as n from notifications where user_id = ${fan.id} and type = 'author_update'`);
    expect(inbox.rows[0]).toEqual({ n: 1 });
    for (let i = 0; i < 2; i++) await ctx.http.post(`${API}/author/announcements`).set(as(author)).send({ title: `Update ${i}`, body: 'A short note for my readers today.' }).expect(201);
    await ctx.http.post(`${API}/author/announcements`).set(as(author)).send({ title: 'One more', body: 'This should be over the daily limit.' }).expect(429);
    await ctx.http.get(`${API}/author/dashboard`).set(as(seller)).expect(403);
  });

  it('shows a publisher their catalogue across sellers', async () => {
    const publisher = await approvedSeller(ctx, admin, 'publisher', 'অন্যপ্রকাশ টেস্ট');
    const [own] = (await ctx.db.execute<{ id: string }>(sql`select id from publishers where name = 'অন্যপ্রকাশ টেস্ট'`)).rows;
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Reseller');
    const book = await listBook(seller, 'মধ্যাহ্ন', {}, { publisherId: own!.id });
    await listBook(seller, 'অন্য বই', {}, { publisherName: 'অন্য প্রকাশনী' });
    const dash = await ctx.http.get(`${API}/publisher/dashboard`).set(as(publisher)).expect(200);
    expect(dash.body.data.books.map((b: { slug: string }) => b.slug)).toEqual([book.bookSlug]);
    expect(dash.body.data.authors[0]).toMatchObject({ name: 'হুমায়ূন আহমেদ', books: 1 });
    expect(dash.body.data.series).toHaveLength(30);
    await ctx.http.patch(`${API}/publisher/profile`).set(as(publisher)).send({ foundedYear: 1989, website: 'not a url' }).expect(400);
    const saved = await ctx.http.patch(`${API}/publisher/profile`).set(as(publisher)).send({ foundedYear: 1989, description: 'সৃজনশীল বইয়ের প্রকাশক।' }).expect(200);
    expect(saved.body.data).toMatchObject({ foundedYear: 1989, verified: true });
    await ctx.http.get(`${API}/publisher/dashboard`).set(as(seller)).expect(403);
  });
});
