import { sql } from 'drizzle-orm';
import { approvedSeller, categoryId, createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
let isbnCounter = 0;
function isbn(): string {
  isbnCounter += 1;
  const digits = `978984${String(700000 + isbnCounter).padStart(6, '0')}`;
  const check = (10 - (digits.split('').reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10;
  return `${digits}${check}`;
}

describe('Recommendations (e2e)', () => {
  let ctx: TestContext;
  let seller: RegisteredUser;
  const books: Record<string, { id: string; slug: string }> = {};

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    const admin = await registerUser(ctx, { name: 'Admin' });
    await grantRole(ctx, admin.id, 'super_admin');
    seller = await approvedSeller(ctx, admin, 'book_seller', 'Rec Books');
    const list = async (key: string, title: string, category: string, genres: string[], author: string) => {
      const res = await ctx.http
        .post(`${API}/seller/books`)
        .set(as(seller))
        .send({ isbn: isbn(), book: { title, language: 'bn', categoryId: await categoryId(ctx, category), genres, authorNames: [author] }, format: { format: 'paperback', pages: 120 }, price: '200', stock: 20, declaration: { capacity: 'reseller_physical', accepted: true } })
        .expect(201);
      const [row] = (await ctx.db.execute<{ id: string; slug: string }>(sql`select b.id, b.slug from products p join books b on b.id = p.book_id where p.id = ${res.body.data.id}`)).rows;
      books[key] = row!;
    };
    await list('poems1', 'সঞ্চয়িতা', 'books/poetry', ['poetry'], 'রবীন্দ্রনাথ ঠাকুর');
    await list('poems2', 'অগ্নিবীণা', 'books/poetry', ['poetry'], 'কাজী নজরুল ইসলাম');
    await list('poems3', 'বনলতা সেন', 'books/poetry', ['poetry'], 'জীবনানন্দ দাশ');
    await list('scifi', 'আকাশের ওপারে', 'books/fiction/science-fiction', ['science_fiction'], 'নতুন লেখক');
    await list('history', 'বাংলার ইতিহাস', 'books/non-fiction/history', ['history'], 'ইতিহাসবিদ');
    await list('gora', 'গোরা', 'books/fiction/novels', ['fiction'], 'রবীন্দ্রনাথ ঠাকুর');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const shelve = (u: RegisteredUser, key: string, shelf = 'want_to_read') => ctx.http.put(`${API}/me/library/${books[key]!.id}`).set(as(u)).send({ shelf }).expect(200);

  it('suggests from interests, shelves and followed authors, with a reason, and never what I already have', async () => {
    const reader = await registerUser(ctx);
    await ctx.http.put(`${API}/me/interests`).set(as(reader)).send({ interests: ['history', 'poetry', 'biography'] }).expect(200);
    await shelve(reader, 'poems1', 'completed');
    const res = await ctx.http.get(`${API}/me/recommendations?limit=6`).set(as(reader)).expect(200);
    const ids = res.body.data.items.map((b: { id: string }) => b.id);
    expect(res.body.data.personalized).toBe(true);
    expect(ids).not.toContain(books.poems1!.id);
    // Poetry (chosen and finished) leads; the same author's novel and the chosen history follow.
    expect(res.body.data.items[0].reason).toMatchObject({ kind: 'genre', label: expect.objectContaining({ en: 'Poetry' }) });
    expect(ids.slice(0, 4)).toEqual(expect.arrayContaining([books.poems2!.id, books.poems3!.id, books.gora!.id, books.history!.id]));
    expect(res.body.data.items.find((b: { id: string }) => b.id === books.gora!.id).reason).toEqual({ kind: 'author', label: 'রবীন্দ্রনাথ ঠাকুর' });
    // Following an author lifts their books further.
    const [jibanananda] = (await ctx.db.execute<{ slug: string }>(sql`select a.slug from authors a where a.name = 'জীবনানন্দ দাশ'`)).rows;
    await ctx.http.post(`${API}/authors/${jibanananda!.slug}/follow`).set(as(reader)).expect(200);
    const after = await ctx.http.get(`${API}/me/recommendations?limit=6`).set(as(reader)).expect(200);
    expect(after.body.data.items[0]).toMatchObject({ id: books.poems3!.id });
  });

  it('remembers searches only with personalisation on, and forgets them on request', async () => {
    const reader = await registerUser(ctx);
    await ctx.http.get(`${API}/search?q=${encodeURIComponent('আকাশের ওপারে')}`).set(as(reader)).expect(200);
    await new Promise((r) => setTimeout(r, 50));
    expect((await ctx.http.get(`${API}/me/search-history`).set(as(reader)).expect(200)).body.data).toEqual(['আকাশের ওপারে']);
    // The web app reports searches made on its server-rendered pages.
    await ctx.http.post(`${API}/me/search-history`).set(as(reader)).send({ q: 'ইতিহাস' }).expect(204);
    expect((await ctx.http.get(`${API}/me/search-history`).set(as(reader)).expect(200)).body.data).toEqual(['ইতিহাস', 'আকাশের ওপারে']);
    const recs = await ctx.http.get(`${API}/me/recommendations`).set(as(reader)).expect(200);
    expect(recs.body.data.items.slice(0, 2).map((b: { id: string }) => b.id)).toEqual(expect.arrayContaining([books.scifi!.id, books.history!.id]));
    expect(recs.body.data.items[0].reason).toEqual({ kind: 'search' });
    await ctx.http.delete(`${API}/me/search-history`).set(as(reader)).expect(200);
    expect((await ctx.http.get(`${API}/me/search-history`).set(as(reader)).expect(200)).body.data).toEqual([]);

    // Personalisation off: nothing is remembered and picks are just popular books.
    await ctx.http.get(`${API}/search?q=history`).set(as(reader)).expect(200);
    await ctx.http.patch(`${API}/me/profile`).set(as(reader)).send({ personalizationEnabled: false }).expect(200);
    expect((await ctx.http.get(`${API}/me/search-history`).set(as(reader)).expect(200)).body.data).toEqual([]);
    await ctx.http.get(`${API}/search?q=poetry`).set(as(reader)).expect(200);
    await new Promise((r) => setTimeout(r, 50));
    expect((await ctx.http.get(`${API}/me/search-history`).set(as(reader)).expect(200)).body.data).toEqual([]);
    const off = await ctx.http.get(`${API}/me/recommendations`).set(as(reader)).expect(200);
    expect(off.body.data.personalized).toBe(false);
    expect(off.body.data.items.every((b: { reason: { kind: string } }) => b.reason.kind === 'popular')).toBe(true);
  });

  it('shows what readers of a book also read, only when enough readers share it', async () => {
    const [a, b, c] = [await registerUser(ctx), await registerUser(ctx), await registerUser(ctx)];
    await shelve(a, 'scifi');
    await shelve(a, 'history');
    // One reader alone never reveals their shelf.
    expect((await ctx.http.get(`${API}/books/${books.scifi!.slug}/also-liked`).expect(200)).body.data).toEqual([]);
    await ctx.redis.flushdb();
    await shelve(b, 'scifi');
    await shelve(b, 'history');
    const also = await ctx.http.get(`${API}/books/${books.scifi!.slug}/also-liked`).expect(200);
    expect(also.body.data.map((x: { id: string }) => x.id)).toEqual([books.history!.id]);

    // Readers who opted out don't count.
    await ctx.http.patch(`${API}/me/profile`).set(as(b)).send({ personalizationEnabled: false }).expect(200);
    await ctx.redis.flushdb();
    expect((await ctx.http.get(`${API}/books/${books.scifi!.slug}/also-liked`).expect(200)).body.data).toEqual([]);

    // "Readers like you" and "because you read …" for someone with the same taste.
    await ctx.http.patch(`${API}/me/profile`).set(as(b)).send({ personalizationEnabled: true }).expect(200);
    await ctx.redis.flushdb();
    await shelve(c, 'scifi', 'currently_reading');
    const recs = await ctx.http.get(`${API}/me/recommendations`).set(as(c)).expect(200);
    expect(recs.body.data.basedOn).toMatchObject({ slug: books.scifi!.slug });
    expect(recs.body.data.becauseYouRead.map((x: { id: string }) => x.id)).toEqual([books.history!.id]);
    expect(recs.body.data.items.find((x: { id: string }) => x.id === books.history!.id).reason).toEqual({ kind: 'readers' });
  });
});
