import { sql } from 'drizzle-orm';
import { photoWithExif } from './images';
import { approvedSeller, categoryId, createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });

describe('Book clubs (e2e)', () => {
  let ctx: TestContext;
  let owner: RegisteredUser;
  let alice: RegisteredUser;
  let bob: RegisteredUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    [owner, alice, bob] = [await registerUser(ctx, { name: 'Owner' }), await registerUser(ctx, { name: 'Alice' }), await registerUser(ctx, { name: 'Bob' })];
    await ctx.db.execute(sql`update users set created_at = now() - interval '30 days'`);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const username = async (u: RegisteredUser) => (await ctx.db.execute<{ username: string }>(sql`select username from users where id = ${u.id}`)).rows[0]!.username;
  const create = (body: Record<string, unknown>) => ctx.http.post(`${API}/clubs`).set(as(owner)).send(body);

  it('lists public clubs in the sitemap and keeps private ones out', async () => {
    const open = await create({ name: 'Open reading circle' }).expect(201);
    const secret = await create({ name: 'Family readers', type: 'private', joinPolicy: 'invite' }).expect(201);
    const paths = (await ctx.http.get(`${API}/sitemap`).expect(200)).body.data.map((e: { path: string }) => e.path);
    expect(paths).toContain(`/clubs/${open.body.data.slug}`);
    expect(paths).not.toContain(`/clubs/${secret.body.data.slug}`);
    expect(paths.some((p: string) => p.startsWith('/u/'))).toBe(false);
  });

  it('creates clubs with valid settings and lists them', async () => {
    expect((await create({ name: 'Study', purpose: 'study' }).expect(400)).body.errors[0].field).toBe('subject');
    expect((await create({ name: 'School club', type: 'school' }).expect(400)).body.errors[0].field).toBe('institutionName');
    expect((await create({ name: 'Secret', type: 'private', joinPolicy: 'open' }).expect(400)).body.errors[0].field).toBe('joinPolicy');
    const club = await create({ name: 'ঢাকা পাঠচক্র', description: 'প্রতি মাসে একটি বাংলা উপন্যাস।', rules: 'স্পয়লার নয়।' }).expect(201);
    expect(club.body.data).toMatchObject({ name: 'ঢাকা পাঠচক্র', memberCount: 1, isOwner: true, canModerate: true, membership: { role: 'owner', status: 'active' } });
    const study = await create({ name: 'HSC Physics Group', purpose: 'study', subject: 'physics', type: 'college', institutionName: 'Notre Dame College' }).expect(201);
    await create({ name: 'Third club' }).expect(201);
    await create({ name: 'Fourth club' }).expect(429);

    const all = await ctx.http.get(`${API}/clubs`).expect(200);
    expect(all.body.meta.total).toBe(3);
    const studyGroups = await ctx.http.get(`${API}/clubs?purpose=study&subject=physics`).expect(200);
    expect(studyGroups.body.data.map((c: { slug: string }) => c.slug)).toEqual([study.body.data.slug]);
    expect((await ctx.http.get(`${API}/clubs?q=Notre`).expect(200)).body.data[0].slug).toBe(study.body.data.slug);
    expect((await ctx.http.get(`${API}/clubs?mine=true`).set(as(alice)).expect(200)).body.data).toEqual([]);

    const cover = await ctx.http.put(`${API}/clubs/${club.body.data.slug}/cover`).set(as(owner)).attach('file', await photoWithExif(), { filename: 'c.jpg' }).expect(200);
    expect(cover.body.data.url).toMatch(/\.webp$/);
    await ctx.http.put(`${API}/clubs/${club.body.data.slug}/cover`).set(as(alice)).attach('file', await photoWithExif(), { filename: 'c.jpg' }).expect(403);
  });

  it('joins by policy: open, on request with approval, and by invitation', async () => {
    const open = (await create({ name: 'Open Readers' }).expect(201)).body.data.slug;
    const joined = await ctx.http.post(`${API}/clubs/${open}/join`).set(as(alice)).expect(200);
    expect(joined.body.data.status).toBe('active');
    await ctx.http.post(`${API}/clubs/${open}/join`).set(as(alice)).expect(409);
    expect((await ctx.http.get(`${API}/clubs/${open}`).expect(200)).body.data.memberCount).toBe(2);
    // Joining a club earns the Book Club Member badge.
    expect((await ctx.db.execute(sql`select 1 from user_badges ub join badges b on b.id = ub.badge_id where ub.user_id = ${alice.id} and b.key = 'book_club_member'`)).rows).toHaveLength(1);
    await ctx.http.delete(`${API}/clubs/${open}/membership`).set(as(owner)).expect(400);
    await ctx.http.delete(`${API}/clubs/${open}/membership`).set(as(alice)).expect(200);
    expect((await ctx.http.get(`${API}/clubs/${open}`).expect(200)).body.data.memberCount).toBe(1);

    const priv = (await create({ name: 'Private Circle', type: 'private', joinPolicy: 'request' }).expect(201)).body.data.slug;
    expect((await ctx.http.post(`${API}/clubs/${priv}/join`).set(as(bob)).expect(200)).body.data.status).toBe('pending');
    const note = await ctx.db.execute<{ user_id: string }>(sql`select user_id from notifications where type = 'book_club' order by created_at desc limit 1`);
    expect(note.rows[0]!.user_id).toBe(owner.id);
    // Private clubs hide content from non-members.
    expect((await ctx.http.get(`${API}/clubs/${priv}`).set(as(bob)).expect(200)).body.data.readable).toBe(false);
    await ctx.http.get(`${API}/clubs/${priv}/posts`).set(as(bob)).expect(403);
    const pending = await ctx.http.get(`${API}/clubs/${priv}/members?status=pending`).set(as(owner)).expect(200);
    expect(pending.body.data.map((m: { id: string }) => m.id)).toEqual([bob.id]);
    await ctx.http.get(`${API}/clubs/${priv}/members?status=pending`).set(as(bob)).expect(403);
    await ctx.http.post(`${API}/clubs/${priv}/members/${bob.id}`).set(as(owner)).send({ action: 'approve' }).expect(200);
    expect((await ctx.http.get(`${API}/clubs/${priv}`).set(as(bob)).expect(200)).body.data).toMatchObject({ readable: true, memberCount: 2, membership: { status: 'active' } });

    const invite = (await create({ name: 'By Invitation', type: 'private', joinPolicy: 'invite' }).expect(201)).body.data.slug;
    await ctx.http.post(`${API}/clubs/${invite}/join`).set(as(alice)).expect(403);
    await ctx.http.post(`${API}/clubs/${invite}/invites`).set(as(owner)).send({ username: await username(alice) }).expect(201);
    await ctx.http.post(`${API}/clubs/${invite}/invites`).set(as(owner)).send({ username: 'nobody-here' }).expect(400);
    expect((await ctx.http.post(`${API}/clubs/${invite}/join`).set(as(alice)).expect(200)).body.data.status).toBe('active');

    // Moderation: only the owner promotes; a moderator can remove members but not other moderators.
    await ctx.http.post(`${API}/clubs/${priv}/join`).set(as(alice)).expect(200);
    await ctx.http.post(`${API}/clubs/${priv}/members/${alice.id}`).set(as(owner)).send({ action: 'approve' }).expect(200);
    await ctx.http.post(`${API}/clubs/${priv}/members/${bob.id}`).set(as(owner)).send({ action: 'promote' }).expect(200);
    await ctx.http.post(`${API}/clubs/${priv}/members/${alice.id}`).set(as(bob)).send({ action: 'promote' }).expect(403);
    await ctx.http.post(`${API}/clubs/${priv}/members/${owner.id}`).set(as(bob)).send({ action: 'remove' }).expect(403);
    await ctx.http.post(`${API}/clubs/${priv}/members/${alice.id}`).set(as(bob)).send({ action: 'ban' }).expect(200);
    await ctx.http.post(`${API}/clubs/${priv}/join`).set(as(alice)).expect(403);
    expect((await ctx.http.get(`${API}/clubs/${priv}`).expect(200)).body.data.memberCount).toBe(2);
  });

  it('runs discussions, announcements, events, the book of the month and polls', async () => {
    const slug = (await create({ name: 'Monthly Novel Club' }).expect(201)).body.data.slug;
    await ctx.http.post(`${API}/clubs/${slug}/join`).set(as(alice)).expect(200);
    await ctx.http.post(`${API}/clubs/${slug}/posts`).set(as(bob)).send({ body: 'Hello' }).expect(403);
    const thread = await ctx.http.post(`${API}/clubs/${slug}/posts`).set(as(alice)).send({ title: 'প্রথম অধ্যায়', body: 'চরিত্রগুলো কেমন লাগল?' }).expect(201);
    await ctx.http.post(`${API}/clubs/${slug}/posts`).set(as(alice)).send({ body: 'Big news', kind: 'announcement' }).expect(403);
    await ctx.http.post(`${API}/clubs/${slug}/posts`).set(as(owner)).send({ parentId: thread.body.data.id, body: 'দারুণ শুরু!' }).expect(201);
    await ctx.http.post(`${API}/clubs/${slug}/posts`).set(as(owner)).send({ title: 'এ মাসের বই', body: 'এ মাসে আমরা পড়ছি পদ্মা নদীর মাঝি।', kind: 'announcement' }).expect(201);
    expect((await ctx.db.execute(sql`select 1 from notifications where user_id = ${alice.id} and type = 'book_club'`)).rows.length).toBe(2);
    const announcement = (await ctx.http.get(`${API}/clubs/${slug}/posts`).expect(200)).body.data.find((p: { kind: string }) => p.kind === 'announcement');
    await ctx.http.put(`${API}/clubs/${slug}/posts/${announcement.id}/pin`).set(as(owner)).send({ pinned: true }).expect(200);
    await ctx.http.put(`${API}/clubs/${slug}/posts/${announcement.id}/pin`).set(as(alice)).send({ pinned: false }).expect(403);
    const posts = await ctx.http.get(`${API}/clubs/${slug}/posts`).set(as(alice)).expect(200);
    expect(posts.body.data.map((p: { kind: string; pinned: boolean }) => [p.kind, p.pinned])).toEqual([
      ['announcement', true],
      ['discussion', false],
    ]);
    expect(posts.body.data[1]).toMatchObject({ replyCount: 1, mine: true, canDelete: true });
    expect(posts.body.data[1].replies[0]).toMatchObject({ body: 'দারুণ শুরু!', canDelete: false });
    await ctx.http.delete(`${API}/clubs/${slug}/posts/${thread.body.data.id}`).set(as(owner)).expect(200);

    await ctx.http.post(`${API}/clubs/${slug}/events`).set(as(alice)).send({ title: 'Meetup', startsAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(403);
    await ctx.http.post(`${API}/clubs/${slug}/events`).set(as(owner)).send({ title: 'Past', startsAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }).expect(400);
    await ctx.http
      .post(`${API}/clubs/${slug}/events`)
      .set(as(owner))
      .send({ title: 'অনলাইন আলোচনা', startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), onlineUrl: 'https://meet.example.org/novel', location: 'Online' })
      .expect(201);

    const seller = await registerUser(ctx, { name: 'Admin' });
    await grantRole(ctx, seller.id, 'super_admin');
    const books = await approvedSeller(ctx, seller, 'book_seller', 'Club Books');
    const created = await ctx.http
      .post(`${API}/seller/books`)
      .set(as(books))
      .send({ isbn: '9789840000029', book: { title: 'পদ্মা নদীর মাঝি', language: 'bn', categoryId: await categoryId(ctx, 'books/fiction'), authorNames: ['মানিক বন্দ্যোপাধ্যায়'] }, format: { format: 'paperback', pages: 160 }, condition: 'new', price: '220', stock: 5, declaration: { capacity: 'reseller_physical', accepted: true } })
      .expect(201);
    const bookSlug = (await ctx.http.get(`${API}/products/${encodeURIComponent(created.body.data.slug)}`).expect(200)).body.data.bookSlug;
    const bookId = (await ctx.db.execute<{ id: string }>(sql`select id from books where slug = ${bookSlug}`)).rows[0]!.id;
    const month = new Date().toISOString().slice(0, 7);
    const set = await ctx.http.put(`${API}/clubs/${slug}/books`).set(as(owner)).send({ bookId, month }).expect(200);
    await ctx.http.post(`${API}/clubs/${slug}/books/${set.body.data.id}/schedule`).set(as(owner)).send({ title: 'অধ্যায় ১–৩', fromPage: 1, toPage: 45, dueOn: `${month}-20` }).expect(201);
    await ctx.http.post(`${API}/clubs/${slug}/books/${set.body.data.id}/schedule`).set(as(owner)).send({ title: 'Bad', fromPage: 50, toPage: 10, dueOn: `${month}-25` }).expect(400);

    const poll = await ctx.http.post(`${API}/clubs/${slug}/polls`).set(as(owner)).send({ question: 'পরের মাসে কোন বই?', options: [{ label: 'দেবদাস' }, { label: 'গৃহদাহ' }, { label: 'শেষের কবিতা' }] }).expect(201);
    const detail = await ctx.http.get(`${API}/clubs/${slug}`).set(as(alice)).expect(200);
    expect(detail.body.data.books[0]).toMatchObject({ status: 'current', month, book: { title: 'পদ্মা নদীর মাঝি', authors: ['মানিক বন্দ্যোপাধ্যায়'] } });
    expect(detail.body.data.books[0].schedule).toEqual([expect.objectContaining({ title: 'অধ্যায় ১–৩', fromPage: 1, toPage: 45 })]);
    expect(detail.body.data.events[0]).toMatchObject({ title: 'অনলাইন আলোচনা', onlineUrl: 'https://meet.example.org/novel' });
    // Meeting links are for members only.
    expect((await ctx.http.get(`${API}/clubs/${slug}`).expect(200)).body.data.events[0].onlineUrl).toBeNull();
    const [first, second] = detail.body.data.polls[0].options;
    await ctx.http.post(`${API}/clubs/${slug}/polls/${poll.body.data.id}/vote`).set(as(alice)).send({ optionIds: [first.id, second.id] }).expect(400);
    await ctx.http.post(`${API}/clubs/${slug}/polls/${poll.body.data.id}/vote`).set(as(alice)).send({ optionIds: [first.id] }).expect(200);
    const changed = await ctx.http.post(`${API}/clubs/${slug}/polls/${poll.body.data.id}/vote`).set(as(alice)).send({ optionIds: [second.id] }).expect(200);
    expect(changed.body.data.options.map((o: { votes: number; mine: boolean }) => [o.votes, o.mine])).toEqual([
      [0, false],
      [1, true],
      [0, false],
    ]);
    await ctx.http.post(`${API}/clubs/${slug}/polls/${poll.body.data.id}/vote`).set(as(bob)).send({ optionIds: [first.id] }).expect(403);
  });
});
