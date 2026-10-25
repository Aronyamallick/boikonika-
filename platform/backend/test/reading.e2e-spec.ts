import { sql } from 'drizzle-orm';
import { approvedSeller, categoryId, createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
let n = 0;
function isbn(): string {
  n += 1;
  const digits = `978984${String(800000 + n).padStart(6, '0')}`;
  const check = (10 - (digits.split('').reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10;
  return `${digits}${check}`;
}
const key = () => `chk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

describe('Library, reading tracker and challenges (e2e)', () => {
  let ctx: TestContext;
  let admin: RegisteredUser;
  let seller: RegisteredUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    admin = await registerUser(ctx, { name: 'Admin' });
    await grantRole(ctx, admin.id, 'super_admin');
    seller = await approvedSeller(ctx, admin, 'book_seller', 'Reading Books');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  async function listBook(title: string, pages = 100, category = 'books/poetry') {
    const created = await ctx.http
      .post(`${API}/seller/books`)
      .set(as(seller))
      .send({ isbn: isbn(), book: { title, language: 'bn', categoryId: await categoryId(ctx, category), authorNames: ['শরৎচন্দ্র চট্টোপাধ্যায়'] }, format: { format: 'paperback', pages }, condition: 'new', price: '250', stock: 10, declaration: { capacity: 'reseller_physical', accepted: true } })
      .expect(201);
    const listing = await ctx.http.get(`${API}/seller/products/${created.body.data.id}`).set(as(seller)).expect(200);
    const product = await ctx.http.get(`${API}/products/${encodeURIComponent(created.body.data.slug)}`).expect(200);
    const bookId = (await ctx.db.execute<{ id: string }>(sql`select id from books where slug = ${product.body.data.bookSlug}`)).rows[0]!.id;
    return { bookId, variantId: listing.body.data.variants[0].id as string };
  }
  const stats = async (u: RegisteredUser) => (await ctx.db.execute<Record<string, number>>(sql`select * from user_stats where user_id = ${u.id}`)).rows[0]!;

  it('keeps shelves, tracks progress and completes a book once', async () => {
    const reader = await registerUser(ctx);
    const { bookId } = await listBook('দেবদাস', 120);
    await ctx.http.put(`${API}/me/library/${bookId}`).set(as(reader)).send({ shelf: 'want_to_read' }).expect(200);
    await ctx.http.put(`${API}/me/library/${bookId}`).set(as(reader)).send({ shelf: 'purchased' }).expect(400);
    let lib = await ctx.http.get(`${API}/me/library`).set(as(reader)).expect(200);
    expect(lib.body.data).toMatchObject({ shelves: { want_to_read: 1 }, total: 1 });
    expect(lib.body.data.items[0]).toMatchObject({ shelf: 'want_to_read', book: { title: 'দেবদাস', authors: ['শরৎচন্দ্র চট্টোপাধ্যায়'] }, progress: { totalPages: 120 } });

    // Moving the position starts the book; pages come from the format.
    const half = await ctx.http.put(`${API}/me/reading/${bookId}/progress`).set(as(reader)).send({ currentPage: 60 }).expect(200);
    expect(half.body.data).toEqual({ shelf: 'currently_reading', percent: 50, currentPage: 60 });
    await ctx.http.put(`${API}/me/reading/${bookId}/progress`).set(as(reader)).send({ currentPage: 500 }).expect(400);
    const done = await ctx.http.put(`${API}/me/reading/${bookId}/progress`).set(as(reader)).send({ currentPage: 120 }).expect(200);
    expect(done.body.data).toMatchObject({ shelf: 'completed', percent: 100 });
    // 25 XP for the book plus the First Book badge (50).
    expect(await stats(reader)).toMatchObject({ books_completed: 1, xp_total: 75 });
    await ctx.http.put(`${API}/me/library/${bookId}`).set(as(reader)).send({ shelf: 'completed' }).expect(200);
    expect(await stats(reader)).toMatchObject({ books_completed: 1, xp_total: 75 });
    const achievements = await ctx.http.get(`${API}/me/achievements`).set(as(reader)).expect(200);
    expect(achievements.body.data.badges.find((b: { key: string }) => b.key === 'first_book')).toMatchObject({ current: 1, target: 1 });
    expect(achievements.body.data.badges.find((b: { key: string }) => b.key === 'ten_books')).toMatchObject({ current: 1, target: 10, earnedAt: null });
    expect(achievements.body.data.level).toBe(1);

    await ctx.http.delete(`${API}/me/library/${bookId}`).set(as(reader)).expect(200);
    lib = await ctx.http.get(`${API}/me/library`).set(as(reader)).expect(200);
    expect(lib.body.data.total).toBe(0);
  });

  it('puts delivered books on the Purchased shelf and keeps them', async () => {
    const buyer = await registerUser(ctx);
    const { bookId, variantId } = await listBook('পথের দাবী');
    const address = await ctx.http.post(`${API}/me/addresses`).set(as(buyer)).send({ recipientName: 'Buyer', phone: '01712345678', division: 'dhaka', district: 'dhaka', upazila: 'Mirpur', area: 'Section 10', addressLine: 'House 1' }).expect(201);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId }).expect(200);
    await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId: address.body.data.id, paymentMethod: 'cod', idempotencyKey: key() }).expect(201);
    const [so] = (await ctx.http.get(`${API}/seller/orders`).set(as(seller)).expect(200)).body.data;
    for (const status of ['confirmed', 'processing', 'shipped']) await ctx.http.post(`${API}/seller/orders/${so.id}/status`).set(as(seller)).send({ status }).expect(200);
    expect((await ctx.http.get(`${API}/me/library`).set(as(buyer)).expect(200)).body.data.total).toBe(0);
    await ctx.http.post(`${API}/seller/orders/${so.id}/status`).set(as(seller)).send({ status: 'delivered' }).expect(200);
    const lib = await ctx.http.get(`${API}/me/library?shelf=purchased`).set(as(buyer)).expect(200);
    expect(lib.body.data.items[0]).toMatchObject({ shelf: 'purchased', source: 'purchase', book: { id: bookId } });
    await ctx.http.delete(`${API}/me/library/${bookId}`).set(as(buyer)).expect(400);
    await ctx.http.put(`${API}/me/library/${bookId}`).set(as(buyer)).send({ shelf: 'currently_reading' }).expect(200);
  });

  it('logs sessions into streaks, goals, stats and daily XP', async () => {
    const reader = await registerUser(ctx);
    const { bookId } = await listBook('শ্রীকান্ত', 300);
    const yesterday = new Date(Date.now() - 24 * 3_600_000).toISOString();
    await ctx.http.post(`${API}/me/reading/sessions`).set(as(reader)).send({ bookId, minutes: 20, currentPage: 25, startedAt: yesterday }).expect(201);
    const today = await ctx.http.post(`${API}/me/reading/sessions`).set(as(reader)).send({ bookId, minutes: 15, currentPage: 55, source: 'timer' }).expect(201);
    expect(today.body.data).toMatchObject({ minutes: 15, pages: 30 });
    await ctx.http.post(`${API}/me/reading/sessions`).set(as(reader)).send({ minutes: 5, pages: 4 }).expect(201);
    await ctx.http.post(`${API}/me/reading/sessions`).set(as(reader)).send({ minutes: 601 }).expect(400);
    await ctx.http.post(`${API}/me/reading/sessions`).set(as(reader)).send({ minutes: 10, startedAt: new Date(Date.now() - 10 * 86_400_000).toISOString() }).expect(400);
    for (let i = 0; i < 2; i++) await ctx.http.post(`${API}/me/reading/sessions`).set(as(reader)).send({ minutes: 450 }).expect(201);
    await ctx.http.post(`${API}/me/reading/sessions`).set(as(reader)).send({ minutes: 100 }).expect(400);

    const s = await stats(reader);
    expect(s).toMatchObject({ current_streak: 2, longest_streak: 2, minutes_read: 940, pages_read: 59 });
    // Two reading days of at least ten minutes: 2 XP each.
    expect(s.xp_total).toBe(4);

    await ctx.http.put(`${API}/me/reading/goals`).set(as(reader)).send({ dailyMinutes: 30, weeklyMinutes: 200, yearlyBooks: 24, breakReminderMinutes: 45, monthlySummaryEmail: false }).expect(200);
    const res = await ctx.http.get(`${API}/me/reading/stats?days=7`).set(as(reader)).expect(200);
    expect(res.body.data).toMatchObject({ today: { minutes: 920, goal: 30 }, week: { minutes: 940, goal: 200 }, year: { books: 0, goal: 24 }, streak: { current: 2, longest: 2 } });
    expect(res.body.data.series).toHaveLength(7);
    expect(res.body.data.series.at(-1).minutes).toBe(920);
    expect(res.body.data.recentSessions[0].book).toBeNull();

    const shelf = await ctx.http.get(`${API}/me/library/${bookId}`).set(as(reader)).expect(200);
    expect(shelf.body.data).toEqual({ shelf: 'currently_reading', percent: 18, currentPage: 55 });

    const toDelete = res.body.data.recentSessions[0].id;
    await ctx.http.delete(`${API}/me/reading/sessions/${toDelete}`).set(as(reader)).expect(200);
    expect((await stats(reader)).minutes_read).toBe(935);
  });

  it('runs challenges from real reading and rewards them once', async () => {
    const reader = await registerUser(ctx);
    const { bookId } = await listBook('গৃহদাহ', 400);
    const list = await ctx.http.get(`${API}/challenges`).set(as(reader)).expect(200);
    expect(list.body.data.map((c: { slug: string }) => c.slug)).toContain('100-page');
    await ctx.http.post(`${API}/challenges/100-page/join`).set(as(reader)).expect(200);
    await ctx.http.post(`${API}/challenges/100-page/join`).set(as(reader)).expect(409);
    await ctx.http.post(`${API}/challenges/monthly-book/join`).set(as(reader)).expect(200);
    await ctx.http.post(`${API}/me/reading/sessions`).set(as(reader)).send({ bookId, minutes: 40, currentPage: 60 }).expect(201);
    let detail = await ctx.http.get(`${API}/challenges/100-page`).set(as(reader)).expect(200);
    expect(detail.body.data.mine).toMatchObject({ status: 'active', progress: 60 });
    const finished = await ctx.http.post(`${API}/me/reading/sessions`).set(as(reader)).send({ bookId, minutes: 50, currentPage: 400 }).expect(201);
    expect(finished.body.data.finishedBook).toBe(true);
    expect(finished.body.data.completedChallenges.sort()).toEqual(['100-page', 'monthly-book']);
    detail = await ctx.http.get(`${API}/challenges/100-page`).set(as(reader)).expect(200);
    expect(detail.body.data).toMatchObject({ mine: { status: 'completed', progress: 400 }, completedCount: 1, participantCount: 1 });
    await ctx.http.post(`${API}/challenges/100-page/join`).set(as(reader)).expect(409);
    const xp = (await ctx.db.execute<{ source: string; xp: number }>(sql`select source, xp from xp_events where user_id = ${reader.id} and source in ('challenge', 'book_completed') order by xp`)).rows;
    expect(xp).toEqual([
      { source: 'book_completed', xp: 25 },
      { source: 'challenge', xp: 60 },
      { source: 'challenge', xp: 80 },
    ]);
    const notes = await ctx.db.execute<{ link: string }>(sql`select link from notifications where user_id = ${reader.id} and type = 'reading_challenge' and link like '/challenges/%' order by link`);
    expect(notes.rows.map((r) => r.link)).toEqual(['/challenges/100-page', '/challenges/monthly-book']);

    // Day challenges count days in a row with at least ten minutes of reading.
    await ctx.http.post(`${API}/challenges/7-day-reading/join`).set(as(reader)).expect(200);
    expect((await ctx.http.get(`${API}/challenges/7-day-reading`).set(as(reader)).expect(200)).body.data.mine.progress).toBe(0);
    const extra = await registerUser(ctx);
    await ctx.http.post(`${API}/challenges/7-day-reading/join`).set(as(extra)).expect(200);
    await ctx.http.post(`${API}/me/reading/sessions`).set(as(extra)).send({ minutes: 5 }).expect(201);
    expect((await ctx.http.get(`${API}/challenges/7-day-reading`).set(as(extra)).expect(200)).body.data.mine.progress).toBe(0);
    await ctx.http.post(`${API}/me/reading/sessions`).set(as(extra)).send({ minutes: 6 }).expect(201);
    expect((await ctx.http.get(`${API}/challenges/7-day-reading`).set(as(extra)).expect(200)).body.data.mine.progress).toBe(1);

    // Leaving an active challenge, and anonymous browsing.
    await ctx.http.delete(`${API}/challenges/7-day-reading/join`).set(as(reader)).expect(200);
    const anon = await ctx.http.get(`${API}/challenges/7-day-reading`).expect(200);
    expect(anon.body.data.mine).toBeNull();
  });
});
