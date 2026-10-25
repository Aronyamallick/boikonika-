import { sql } from 'drizzle-orm';
import { photoWithExif } from './images';
import { approvedSeller, categoryId, createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
const LONG = 'বইটি পড়ে মনে হলো গ্রামবাংলার জীবন আর মানুষের সম্পর্কের এত সুন্দর বর্ণনা খুব কম পাওয়া যায়। সবাইকে পড়ার অনুরোধ রইল।';

describe('Community (e2e)', () => {
  let ctx: TestContext;
  let admin: RegisteredUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    admin = await registerUser(ctx, { name: 'Admin' });
    await grantRole(ctx, admin.id, 'super_admin');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const username = async (u: RegisteredUser) => (await ctx.db.execute<{ username: string }>(sql`select username from users where id = ${u.id}`)).rows[0]!.username;
  /** Accounts younger than a day are scored more strictly by the spam heuristics. */
  const age = (u: RegisteredUser) => ctx.db.execute(sql`update users set created_at = now() - interval '30 days' where id = ${u.id}`);
  const post = (u: RegisteredUser, data: Record<string, unknown>, images: Buffer[] = []) => {
    let req = ctx.http.post(`${API}/posts`).set(as(u)).field('data', JSON.stringify(data));
    for (const [i, img] of images.entries()) req = req.attach('images', img, { filename: `img${i}.jpg` });
    return req;
  };
  const stats = async (u: RegisteredUser) => (await ctx.db.execute<{ xp_total: number; posts_published: number }>(sql`select xp_total, posts_published from user_stats where user_id = ${u.id}`)).rows[0];
  const ids = (res: { body: { data: Array<{ id: string }> } }) => res.body.data.map((p) => p.id);

  it('publishes posts and shows each viewer only what they may see', async () => {
    const [alice, bob, carol] = [await registerUser(ctx, { name: 'Alice' }), await registerUser(ctx, { name: 'Bob' }), await registerUser(ctx, { name: 'Carol' })];
    await Promise.all([alice, bob, carol].map(age));
    const pub = await post(alice, { type: 'discussion', title: 'পদ্মা নদীর মাঝি', body: LONG }).expect(201);
    expect(pub.body.data).toMatchObject({ status: 'published', mine: true, author: { name: 'Alice' }, likeCount: 0 });
    expect(await stats(alice)).toMatchObject({ xp_total: 5, posts_published: 1 });
    const followers = await post(alice, { type: 'poem', body: 'নদীর ধারে বসে থাকি\nসন্ধ্যা নামে ধীরে', visibility: 'followers' }).expect(201);
    const secret = await post(alice, { type: 'discussion', body: 'Only for me', visibility: 'private' }).expect(201);
    // Short posts count but earn no XP.
    expect(await stats(alice)).toMatchObject({ xp_total: 5, posts_published: 3 });

    const anon = await ctx.http.get(`${API}/feed?tab=latest`).expect(200);
    expect(ids(anon)).toEqual([pub.body.data.id]);
    expect(ids(await ctx.http.get(`${API}/feed?tab=latest`).set(as(bob)).expect(200))).toEqual([pub.body.data.id]);
    expect(ids(await ctx.http.get(`${API}/feed?tab=following`).set(as(bob)).expect(200))).toEqual([]);
    await ctx.http.post(`${API}/users/${await username(alice)}/follow`).set(as(bob)).expect(200);
    expect(ids(await ctx.http.get(`${API}/feed?tab=following`).set(as(bob)).expect(200))).toEqual([followers.body.data.id, pub.body.data.id]);
    expect(ids(await ctx.http.get(`${API}/feed?tab=latest`).set(as(alice)).expect(200))).toEqual([secret.body.data.id, followers.body.data.id, pub.body.data.id]);
    await ctx.http.get(`${API}/posts/${secret.body.data.id}`).set(as(bob)).expect(404);
    const ranked = await ctx.http.get(`${API}/feed`).set(as(bob)).expect(200);
    expect(ids(ranked).sort()).toEqual([followers.body.data.id, pub.body.data.id].sort());

    // Blocking hides the other person's posts both ways.
    await ctx.http.post(`${API}/users/${await username(alice)}/block`).set(as(carol)).expect(200);
    expect(ids(await ctx.http.get(`${API}/feed?tab=latest`).set(as(carol)).expect(200))).toEqual([]);
    await ctx.http.get(`${API}/posts/${pub.body.data.id}`).set(as(carol)).expect(404);

    // Profile pages list a user's posts with cursor pagination.
    const first = await ctx.http.get(`${API}/users/${await username(alice)}/posts?limit=1`).set(as(bob)).expect(200);
    expect(ids(first)).toEqual([followers.body.data.id]);
    const second = await ctx.http.get(`${API}/users/${await username(alice)}/posts?limit=1&cursor=${first.body.meta.nextCursor}`).set(as(bob)).expect(200);
    expect(ids(second)).toEqual([pub.body.data.id]);
    expect(second.body.meta.nextCursor).toBeNull();

    // Edits keep the post live and mark it edited; only the author can edit or delete.
    await ctx.http.patch(`${API}/posts/${pub.body.data.id}`).set(as(bob)).send({ body: 'hijack' }).expect(404);
    const edited = await ctx.http.patch(`${API}/posts/${pub.body.data.id}`).set(as(alice)).send({ title: 'পদ্মা নদীর মাঝি — মানিক বন্দ্যোপাধ্যায়' }).expect(200);
    expect(edited.body.data.editedAt).toBeTruthy();
    await ctx.http.delete(`${API}/posts/${followers.body.data.id}`).set(as(alice)).expect(200);
    expect(ids(await ctx.http.get(`${API}/feed?tab=following`).set(as(bob)).expect(200))).toEqual([pub.body.data.id]);
  });

  it('validates quotes, reading progress and artwork, and holds risky Student Zone posts', async () => {
    const alice = await registerUser(ctx, { name: 'Alice' });
    await age(alice);
    const longQuote = await post(alice, { type: 'quote', body: 'ক'.repeat(601), quoteSource: 'গীতাঞ্জলি' }).expect(400);
    expect(longQuote.body.errors[0]).toMatchObject({ field: 'body' });
    expect((await post(alice, { type: 'quote', body: 'যেথা শির উচ্চ যেথা চিত্ত ভয়শূন্য' }).expect(400)).body.errors[0].field).toBe('quoteSource');
    expect((await post(alice, { type: 'reading_progress', body: 'Half way!', readingPercent: 50 }).expect(400)).body.errors[0].field).toBe('bookId');
    expect((await post(alice, { type: 'artwork', body: 'My drawing', originalWork: true }).expect(400)).body.errors[0].field).toBe('images');
    expect((await post(alice, { type: 'artwork', body: 'My drawing' }, [await photoWithExif()]).expect(400)).body.errors[0].field).toBe('originalWork');
    const art = await post(alice, { type: 'artwork', body: 'রবীন্দ্রনাথের প্রতিকৃতি, জলরঙে আঁকা', originalWork: true }, [await photoWithExif()]).expect(201);
    expect(art.body.data.media).toHaveLength(1);
    expect(art.body.data.media[0].url).toMatch(/\.webp$/);

    // Student Zone posts need a subject, and links or phone numbers wait for a moderator.
    expect((await post(alice, { type: 'study_tip', body: 'Use flashcards', studentZone: true }).expect(400)).body.errors[0].field).toBe('subject');
    const held = await post(alice, { type: 'study_tip', body: 'Free notes at www.example-notes.xyz', studentZone: true, subject: 'physics' }).expect(201);
    expect(held.body.data.status).toBe('pending_review');
    const ok = await post(alice, { type: 'study_tip', body: 'সূত্রগুলো নিজের হাতে লিখে মুখস্থ করুন, তারপর প্রতিদিন পাঁচটি অঙ্ক কষুন।', studentZone: true, subject: 'physics' }).expect(201);
    const student = await ctx.http.get(`${API}/feed?tab=latest&studentZone=true&subject=physics`).expect(200);
    expect(ids(student)).toEqual([ok.body.data.id]);
  });

  it('counts likes, saves and threaded comments, notifying people and paying XP once', async () => {
    const [alice, bob, carol] = [await registerUser(ctx, { name: 'Alice' }), await registerUser(ctx, { name: 'Bob' }), await registerUser(ctx, { name: 'Carol' })];
    await Promise.all([alice, bob, carol].map(age));
    const { id } = (await post(alice, { type: 'educational', body: LONG }).expect(201)).body.data;

    await ctx.http.put(`${API}/posts/${id}/like`).set(as(bob)).expect(200);
    const again = await ctx.http.put(`${API}/posts/${id}/like`).set(as(bob)).expect(200);
    expect(again.body.data).toEqual({ liked: true, likeCount: 1 });
    expect((await stats(alice))!.xp_total).toBe(6);
    expect((await ctx.http.delete(`${API}/posts/${id}/like`).set(as(bob)).expect(200)).body.data.likeCount).toBe(0);
    await ctx.http.put(`${API}/posts/${id}/like`).set(as(bob)).expect(200);
    expect((await stats(alice))!.xp_total).toBe(6);
    await ctx.http.put(`${API}/posts/${id}/like`).set(as(alice)).expect(200);
    expect((await stats(alice))!.xp_total).toBe(6);
    const viewed = await ctx.http.get(`${API}/posts/${id}`).set(as(bob)).expect(200);
    expect(viewed.body.data).toMatchObject({ liked: true, likeCount: 2 });

    await ctx.http.put(`${API}/posts/${id}/bookmark`).set(as(bob)).expect(200);
    expect(ids(await ctx.http.get(`${API}/me/bookmarks`).set(as(bob)).expect(200))).toEqual([id]);

    const c1 = await ctx.http.post(`${API}/posts/${id}/comments`).set(as(bob)).send({ body: 'চমৎকার লেখা, আরও লিখবেন।' }).expect(201);
    const reply = await ctx.http.post(`${API}/posts/${id}/comments`).set(as(carol)).send({ body: 'একমত!', parentId: c1.body.data.id }).expect(201);
    // Answering a reply attaches to the top-level comment.
    await ctx.http.post(`${API}/posts/${id}/comments`).set(as(alice)).send({ body: 'ধন্যবাদ সবাইকে', parentId: reply.body.data.id }).expect(201);
    const thread = await ctx.http.get(`${API}/posts/${id}/comments`).expect(200);
    expect(thread.body.data).toHaveLength(1);
    expect(thread.body.data[0]).toMatchObject({ body: 'চমৎকার লেখা, আরও লিখবেন।', replyCount: 2 });
    expect(thread.body.data[0].replies.map((r: { body: string }) => r.body)).toEqual(['একমত!', 'ধন্যবাদ সবাইকে']);
    expect((await ctx.http.get(`${API}/posts/${id}`).expect(200)).body.data.commentCount).toBe(3);

    const notes = await ctx.db.execute<{ user_id: string; type: string }>(sql`select user_id, type from notifications where type = 'comment' order by created_at`);
    expect(notes.rows.map((r) => r.user_id)).toEqual([alice.id, bob.id, alice.id, carol.id]);

    // The post's author may remove a comment; its replies stay under a tombstone.
    await ctx.http.delete(`${API}/comments/${c1.body.data.id}`).set(as(carol)).expect(404);
    await ctx.http.delete(`${API}/comments/${c1.body.data.id}`).set(as(alice)).expect(200);
    const after = await ctx.http.get(`${API}/posts/${id}/comments`).expect(200);
    expect(after.body.data[0]).toMatchObject({ deleted: true, body: null });
    expect(after.body.data[0].replies).toHaveLength(2);

    await ctx.http.put(`${API}/comments/${reply.body.data.id}/like`).set(as(bob)).expect(200);
    expect((await ctx.http.get(`${API}/posts/${id}/comments`).set(as(bob)).expect(200)).body.data[0].replies[0]).toMatchObject({ liked: true, likeCount: 1 });
  });

  it('takes reports, hides heavily reported posts and honours posting restrictions', async () => {
    const alice = await registerUser(ctx, { name: 'Alice' });
    await age(alice);
    const { id } = (await post(alice, { type: 'discussion', body: LONG }).expect(201)).body.data;
    await ctx.http.post(`${API}/reports`).set(as(alice)).send({ targetType: 'post', targetId: id, reason: 'spam' }).expect(400);
    const reporters = [];
    for (let i = 0; i < 5; i++) reporters.push(await registerUser(ctx, { ip: `203.0.113.${i + 1}` }));
    const first = await ctx.http.post(`${API}/reports`).set(as(reporters[0]!)).send({ targetType: 'post', targetId: id, reason: 'scam', details: 'Asks for bKash payment' }).expect(201);
    const dup = await ctx.http.post(`${API}/reports`).set(as(reporters[0]!)).send({ targetType: 'post', targetId: id, reason: 'spam' }).expect(201);
    expect(dup.body.data.id).toBe(first.body.data.id);
    expect((await ctx.db.execute<{ priority: string }>(sql`select priority from reports where id = ${first.body.data.id}`)).rows[0]!.priority).toBe('high');
    for (const r of reporters.slice(1)) await ctx.http.post(`${API}/reports`).set(as(r)).send({ targetType: 'post', targetId: id, reason: 'spam' }).expect(201);
    await ctx.http.get(`${API}/posts/${id}`).expect(404);
    expect((await ctx.http.get(`${API}/posts/${id}`).set(as(alice)).expect(200)).body.data.status).toBe('pending_review');

    await ctx.http.post(`${API}/reports`).set(as(alice)).send({ targetType: 'user', targetId: reporters[0]!.id, reason: 'harassment' }).expect(201);
    await ctx.http.post(`${API}/reports`).set(as(alice)).send({ targetType: 'post', targetId: '00000000-0000-4000-8000-000000000000', reason: 'spam' }).expect(404);

    await ctx.db.execute(sql`insert into user_restrictions (user_id, scope, reason, until) values (${alice.id}, 'post', 'spam', now() + interval '1 day')`);
    await post(alice, { type: 'discussion', body: 'Another one' }).expect(403);
    await ctx.http.post(`${API}/posts/${id}/comments`).set(as(alice)).send({ body: 'still can comment?' }).expect(404);
  });

  it('lists discussions about a book', async () => {
    const seller = await approvedSeller(ctx, admin, 'book_seller', 'Book Talk');
    const poetry = await categoryId(ctx, 'books/poetry');
    const created = await ctx.http
      .post(`${API}/seller/books`)
      .set(as(seller))
      .send({ isbn: '9789840000012', book: { title: 'সঞ্চয়িতা', language: 'bn', categoryId: poetry, authorNames: ['রবীন্দ্রনাথ ঠাকুর'] }, format: { format: 'hardcover', pages: 900 }, condition: 'new', price: '650', stock: 5, declaration: { capacity: 'reseller_physical', accepted: true } })
      .expect(201);
    const product = await ctx.http.get(`${API}/products/${encodeURIComponent(created.body.data.slug)}`).expect(200);
    const bookSlug = product.body.data.bookSlug as string;
    const bookId = (await ctx.db.execute<{ id: string }>(sql`select id from books where slug = ${bookSlug}`)).rows[0]!.id;
    const reader = await registerUser(ctx);
    await age(reader);
    const progress = await post(reader, { type: 'reading_progress', body: 'অর্ধেক পড়া হলো', bookId, readingPercent: 50 }).expect(201);
    expect(progress.body.data.book).toMatchObject({ slug: bookSlug, title: 'সঞ্চয়িতা', authors: ['রবীন্দ্রনাথ ঠাকুর'] });
    expect(progress.body.data.readingPercent).toBe(50);
    expect(ids(await ctx.http.get(`${API}/books/${encodeURIComponent(bookSlug)}/posts`).expect(200))).toEqual([progress.body.data.id]);
  });
});
