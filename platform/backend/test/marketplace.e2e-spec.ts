import { notifications, sellerStores, sellers, systemSettings } from '@boikonika/database';
import { eq, sql } from 'drizzle-orm';
import { pngImage } from './images';
import { approvedSeller, categoryId, createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
// Valid ISBN-13s (checksums correct) that exist only in this test.
const ISBN_A = '9789849000013';
const ISBN_B = '9789849000020';

describe('Catalogue and marketplace (e2e)', () => {
  let ctx: TestContext;
  let admin: RegisteredUser;
  let poetry: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    admin = await registerUser(ctx, { name: 'Admin' });
    await grantRole(ctx, admin.id, 'admin');
    poetry = await categoryId(ctx, 'books/poetry');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const newBook = (overrides: Record<string, unknown> = {}) => ({
    isbn: ISBN_A,
    book: { title: 'শেষের কবিতা', description: 'অমিত ও লাবণ্যের গল্প।', language: 'bn', categoryId: poetry, genres: ['poetry', 'bangla_literature'], authorNames: ['রবীন্দ্রনাথ ঠাকুর'], publisherName: 'টেস্ট প্রকাশনী' },
    format: { format: 'paperback', pages: 160, publicationYear: 2025 },
    condition: 'new',
    price: '220',
    compareAtPrice: '250.00',
    stock: 10,
    declaration: { capacity: 'reseller_physical', accepted: true },
    ...overrides,
  });

  it('provisions a seller account and store when the verification is approved', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'রহিম বুক হাউস');
    const me = await ctx.http.get(`${API}/seller/me`).set(as(seller)).expect(200);
    expect(me.body.data).toMatchObject({ type: 'book_seller', status: 'active', store: { name: 'রহিম বুক হাউস', slug: 'রহিম-বুক-হাউস' } });
    // Districts come from the official list and must sit inside the division.
    const wrong = await ctx.http.patch(`${API}/seller/store`).set(as(seller)).send({ division: 'dhaka', district: 'sylhet' }).expect(400);
    expect(wrong.body.errors[0].field).toBe('district');
    await ctx.http.patch(`${API}/seller/store`).set(as(seller)).send({ division: 'atlantis' }).expect(400);
    const saved = await ctx.http.patch(`${API}/seller/store`).set(as(seller)).send({ division: 'sylhet', district: 'sylhet', tagline: 'পুরোনো বইয়ের ঠিকানা' }).expect(200);
    expect(saved.body.data.store).toMatchObject({ division: 'sylhet', district: 'sylhet', tagline: 'পুরোনো বইয়ের ঠিকানা' });
    await ctx.http.patch(`${API}/seller/store`).set(as(seller)).send({ district: 'gazipur' }).expect(400);
    const page = await ctx.http.get(`${API}/stores/${encodeURIComponent('রহিম-বুক-হাউস')}`).expect(200);
    expect(page.body.data).toMatchObject({ district: 'sylhet', name: 'রহিম বুক হাউস' });
    const stranger = await registerUser(ctx);
    const denied = await ctx.http.get(`${API}/seller/products`).set(as(stranger)).expect(403);
    expect(denied.body.message).toMatch(/seller|বিক্রেতা/);
  });

  it('lists a new book, shows it in browse, detail and search (Bangla, typo, ISBN)', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller');
    const created = await ctx.http.post(`${API}/seller/books`).set(as(seller)).send(newBook()).expect(201);
    expect(created.body.data.status).toBe('active');

    const list = await ctx.http.get(`${API}/books?category=books/poetry`).expect(200);
    expect(list.body.meta.total).toBe(1);
    const card = list.body.data[0];
    expect(card).toMatchObject({ title: 'শেষের কবিতা', minPrice: '220.00', compareAtPrice: '250.00', inStock: true, offerCount: 1, authors: [{ name: 'রবীন্দ্রনাথ ঠাকুর' }] });

    const detail = await ctx.http.get(`${API}/books/${encodeURIComponent(card.slug)}`).expect(200);
    expect(detail.body.data.offers).toHaveLength(1);
    expect(detail.body.data.formats[0]).toMatchObject({ isbn13: ISBN_A, pages: 160, publisher: { name: 'টেস্ট প্রকাশনী' } });

    for (const q of ['শেষের কবিতা', 'শেষের কবিত', 'রবীন্দ্রনাথ', ISBN_A, '978-984-900-001-3']) {
      const res = await ctx.http.get(`${API}/search`).query({ q }).expect(200);
      expect(res.body.data.books.map((b: { title: string }) => b.title)).toContain('শেষের কবিতা');
    }
    const suggest = await ctx.http.get(`${API}/search/suggest`).query({ q: 'রবীন্দ্র' }).expect(200);
    expect(suggest.body.data.items.map((i: { kind: string }) => i.kind)).toContain('author');
  });

  it('attaches other sellers to the same edition and blocks duplicate offers', async () => {
    const first = await approvedSeller(ctx, admin, 'book_seller', 'Store One');
    const second = await approvedSeller(ctx, admin, 'book_seller', 'Store Two');
    await ctx.http.post(`${API}/seller/books`).set(as(first)).send(newBook()).expect(201);
    const lookup = await ctx.http.get(`${API}/seller/books/lookup`).query({ isbn: ISBN_A }).set(as(second)).expect(200);
    expect(lookup.body.data).toMatchObject({ title: 'শেষের কবিতা', alreadyListedConditions: [] });
    await ctx.http.post(`${API}/seller/books`).set(as(second)).send({ isbn: ISBN_A, format: { format: 'paperback' }, condition: 'used_good', conditionNote: 'Name on first page', price: '120', stock: 1, declaration: { capacity: 'reseller_physical', accepted: true } }).expect(201);
    await ctx.http.post(`${API}/seller/books`).set(as(second)).send({ isbn: ISBN_A, format: { format: 'paperback' }, condition: 'used_good', price: '110', stock: 1, declaration: { capacity: 'reseller_physical', accepted: true } }).expect(409);
    const books = await ctx.http.get(`${API}/books`).expect(200);
    expect(books.body.meta.total).toBe(1);
    expect(books.body.data[0]).toMatchObject({ offerCount: 2, minPrice: '120.00', hasUsed: true });
    const used = await ctx.http.get(`${API}/books?condition=used_good`).expect(200);
    expect(used.body.meta.total).toBe(1);
    // Unknown ISBN without book details is explained.
    const unknown = await ctx.http.post(`${API}/seller/books`).set(as(first)).send({ isbn: ISBN_B, format: { format: 'paperback' }, price: '100', stock: 1, declaration: { capacity: 'reseller_physical', accepted: true } }).expect(400);
    expect(unknown.body.errors[0].field).toBe('isbn');
  });

  it('keeps sellers inside their own listings', async () => {
    const owner = await approvedSeller(ctx, admin, 'book_seller', 'Owner Store');
    const other = await approvedSeller(ctx, admin, 'book_seller', 'Other Store');
    const created = await ctx.http.post(`${API}/seller/books`).set(as(owner)).send(newBook()).expect(201);
    const id = created.body.data.id as string;
    await ctx.http.get(`${API}/seller/products/${id}`).set(as(other)).expect(404);
    await ctx.http.patch(`${API}/seller/products/${id}`).set(as(other)).send({ status: 'archived' }).expect(404);
    await ctx.http.delete(`${API}/seller/products/${id}`).set(as(other)).expect(404);
    const listing = await ctx.http.get(`${API}/seller/products/${id}`).set(as(owner)).expect(200);
    await ctx.http.post(`${API}/seller/inventory/adjust`).set(as(other)).send({ variantId: listing.body.data.variants[0].id, delta: -5, reason: 'adjustment' }).expect(404);
  });

  it('manages general products with variants, stock ledger and reserved units', async () => {
    const books = await approvedSeller(ctx, admin, 'book_seller', 'Book Only');
    const stationery = await approvedSeller(ctx, admin, 'general_seller', 'Stationery Shop');
    const pens = await categoryId(ctx, 'products/stationery/pens');
    const body = { title: 'জেল পেন সেট', categoryId: pens, brand: 'TestBrand', attributes: { tip: '0.5 mm' }, variants: [{ name: 'Blue', options: { color: 'blue' }, price: '180', stock: 20 }, { name: 'Black', options: { color: 'black' }, price: '170', compareAtPrice: '200', stock: 0 }] };
    await ctx.http.post(`${API}/seller/products`).set(as(books)).send(body).expect(403);
    const bad = await ctx.http.post(`${API}/seller/products`).set(as(stationery)).send({ ...body, categoryId: poetry }).expect(400);
    expect(bad.body.errors[0].field).toBe('categoryId');
    const created = await ctx.http.post(`${API}/seller/products`).set(as(stationery)).send(body).expect(201);
    const detail = await ctx.http.get(`${API}/products/${encodeURIComponent(created.body.data.slug)}`).expect(200);
    expect(detail.body.data).toMatchObject({ type: 'general', price: '170.00', compareAtPrice: '200.00' });
    expect(detail.body.data.variants.map((v: { name: string; available: number }) => [v.name, v.available])).toEqual([['Blue', 20], ['Black', 0]]);

    const mine = await ctx.http.get(`${API}/seller/products/${created.body.data.id}`).set(as(stationery)).expect(200);
    const black = mine.body.data.variants.find((v: { name: string }) => v.name === 'Black');
    await ctx.http.post(`${API}/seller/inventory/adjust`).set(as(stationery)).send({ variantId: black.id, delta: 7, reason: 'restock', note: 'New box' }).expect(200);
    // Units reserved for open orders cannot be removed.
    await ctx.db.execute(sql`update inventory set quantity_reserved = 5 where variant_id = ${black.id}`);
    const below = await ctx.http.post(`${API}/seller/inventory/adjust`).set(as(stationery)).send({ variantId: black.id, delta: -3, reason: 'damaged' }).expect(409);
    expect(below.body.errors[0].field).toBe('delta');
    await ctx.http.post(`${API}/seller/inventory/adjust`).set(as(stationery)).send({ variantId: black.id, delta: -2, reason: 'damaged' }).expect(200);
    const ledger = await ctx.http.get(`${API}/seller/inventory/${black.id}/movements`).set(as(stationery)).expect(200);
    expect(ledger.body.data.map((m: { reason: string; onHandDelta: number }) => [m.reason, m.onHandDelta])).toEqual([['damaged', -2], ['restock', 7]]);
    const card = await ctx.http.get(`${API}/products`).expect(200);
    expect(card.body.data[0]).toMatchObject({ title: 'জেল পেন সেট', inStock: true, store: { name: 'Stationery Shop' } });
  });

  it('holds listings for review when required and lets staff approve, suspend and restore', async () => {
    await ctx.db.insert(systemSettings).values({ key: 'marketplace.requireListingReview', value: true, description: 'test' });
    await ctx.redis.del('setting:marketplace.requireListingReview');
    const seller = await approvedSeller(ctx, admin, 'book_seller');
    const created = await ctx.http.post(`${API}/seller/books`).set(as(seller)).send(newBook()).expect(201);
    expect(created.body.data.status).toBe('pending_review');
    expect((await ctx.http.get(`${API}/books`).expect(200)).body.meta.total).toBe(0);

    await ctx.http.get(`${API}/admin/products?status=pending_review`).set(as(seller)).expect(403);
    const queue = await ctx.http.get(`${API}/admin/products?status=pending_review`).set(as(admin)).expect(200);
    expect(queue.body.data).toHaveLength(1);
    await ctx.http.post(`${API}/admin/products/${created.body.data.id}/approve`).set(as(admin)).send({}).expect(200);
    expect((await ctx.http.get(`${API}/books`).expect(200)).body.meta.total).toBe(1);

    await ctx.http.post(`${API}/admin/products/${created.body.data.id}/suspend`).set(as(admin)).send({}).expect(400);
    await ctx.http.post(`${API}/admin/products/${created.body.data.id}/suspend`).set(as(admin)).send({ reason: 'Counterfeit copy reported' }).expect(200);
    expect((await ctx.http.get(`${API}/books`).expect(200)).body.meta.total).toBe(0);
    await ctx.http.patch(`${API}/seller/products/${created.body.data.id}`).set(as(seller)).send({ status: 'active' }).expect(403);
    await ctx.http.post(`${API}/admin/products/${created.body.data.id}/restore`).set(as(admin)).send({}).expect(200);
    const notes = await ctx.db.select().from(notifications).where(eq(notifications.type, 'listing'));
    expect(notes.map((n) => n.title)).toEqual(expect.arrayContaining(['আপনার তালিকা এখন সবার জন্য দৃশ্যমান', 'আপনার তালিকা লুকানো হয়েছে']));
  });

  it('uses the first listing photo as the book cover and serves stores, authors and the homepage', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Cover Store');
    const created = await ctx.http.post(`${API}/seller/books`).set(as(seller)).send(newBook()).expect(201);
    const withImages = await ctx.http.post(`${API}/seller/products/${created.body.data.id}/images`).set(as(seller)).attach('images', await pngImage(800, 1200), { filename: 'cover.png' }).expect(200);
    expect(withImages.body.data.images).toHaveLength(1);
    const card = (await ctx.http.get(`${API}/books`).expect(200)).body.data[0];
    expect(card.coverUrl).toBe(withImages.body.data.images[0].url);

    const [store] = await ctx.db.select({ slug: sellerStores.slug }).from(sellerStores).innerJoin(sellers, eq(sellers.id, sellerStores.sellerId)).where(eq(sellers.userId, seller.id));
    const storePage = await ctx.http.get(`${API}/stores/${encodeURIComponent(store!.slug)}`).expect(200);
    expect(storePage.body.data.books).toHaveLength(1);
    const author = await ctx.http.get(`${API}/authors/${encodeURIComponent(card.authors[0].slug)}`).expect(200);
    expect(author.body.data).toMatchObject({ name: 'রবীন্দ্রনাথ ঠাকুর', bookCount: 1, following: false });
    await ctx.http.post(`${API}/authors/${encodeURIComponent(card.authors[0].slug)}/follow`).set(as(admin)).expect(200);
    const followed = await ctx.http.get(`${API}/authors/${encodeURIComponent(card.authors[0].slug)}`).set(as(admin)).expect(200);
    expect(followed.body.data).toMatchObject({ following: true, followerCount: 1 });
    const state = await ctx.http.get(`${API}/authors/${encodeURIComponent(card.authors[0].slug)}/follow`).set(as(admin)).expect(200);
    expect(state.body.data).toEqual({ following: true, followerCount: 1 });
    await ctx.http.get(`${API}/authors/${encodeURIComponent(card.authors[0].slug)}/follow`).expect(401);

    await ctx.redis.del('home:v1');
    const home = await ctx.http.get(`${API}/home`).expect(200);
    const keys = home.body.data.map((s: { key: string }) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['hero', 'categories', 'trending', 'best-sellers', 'reading-challenges']));
    expect(keys).not.toContain('used-books');
  });
});
