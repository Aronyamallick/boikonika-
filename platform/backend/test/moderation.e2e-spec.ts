import { sql } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { APP_CONFIG, type AppConfig } from '../src/config/config.module';
import { approvedSeller, categoryId, createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
const LONG = 'বইমেলায় আজ নতুন বইয়ের গন্ধে মন ভরে গেল। '.repeat(3);

describe('Moderation, admin and copyright (e2e)', () => {
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

  const age = (u: RegisteredUser) => ctx.db.execute(sql`update users set created_at = now() - interval '30 days' where id = ${u.id}`);
  const post = (u: RegisteredUser, data: Record<string, unknown>) => ctx.http.post(`${API}/posts`).set(as(u)).field('data', JSON.stringify(data));
  const inbox = async (u: RegisteredUser) => (await ctx.http.get(`${API}/me/notifications`).set(as(u)).expect(200)).body.data as Array<{ type: string; title: string; body: string }>;

  it('decides grouped reports: removes content, tells both sides, and can be reverted', async () => {
    const author = await registerUser(ctx, { name: 'Author' });
    await age(author);
    const id = (await post(author, { type: 'discussion', title: 'বিক্রির বিজ্ঞাপন', body: LONG }).expect(201)).body.data.id;
    const [r1, r2] = [await registerUser(ctx), await registerUser(ctx)];
    await ctx.http.post(`${API}/reports`).set(as(r1)).send({ targetType: 'post', targetId: id, reason: 'spam' }).expect(201);
    await ctx.http.post(`${API}/reports`).set(as(r2)).send({ targetType: 'post', targetId: id, reason: 'scam', details: 'Asks for payment outside the site' }).expect(201);

    await ctx.http.get(`${API}/admin/moderation/queue`).set(as(r1)).expect(403);
    const queue = await ctx.http.get(`${API}/admin/moderation/queue`).set(as(admin)).expect(200);
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.data[0]).toMatchObject({ reports: 2, reporters: 2, urgent: true, target: { type: 'post', id, owner: { name: 'Author' }, status: 'published' } });
    expect(queue.body.data[0].reasons.sort()).toEqual(['scam', 'spam']);

    await ctx.http.post(`${API}/admin/moderation/targets/post/${id}/review`).set(as(admin)).expect(200);
    await ctx.http.post(`${API}/admin/moderation/targets/post/${id}/decision`).set(as(admin)).send({ action: 'suspension', reason: 'Too short' }).expect(400);
    const decided = await ctx.http.post(`${API}/admin/moderation/targets/post/${id}/decision`).set(as(admin)).send({ action: 'content_removal', reason: 'Selling outside the platform' }).expect(200);
    await ctx.http.get(`${API}/posts/${id}`).set(as(r1)).expect(404);
    expect((await ctx.http.get(`${API}/admin/moderation/queue`).set(as(admin)).expect(200)).body.data).toEqual([]);
    expect((await inbox(author))[0]).toMatchObject({ type: 'moderation', body: expect.stringContaining('Selling outside the platform') });
    expect((await inbox(r2))[0]).toMatchObject({ type: 'moderation' });
    const standing = await ctx.http.get(`${API}/me/standing`).set(as(author)).expect(200);
    expect(standing.body.data.actions[0]).toMatchObject({ action: 'content_removal', reason: 'Selling outside the platform' });
    expect(standing.body.data.actions[0].actor).toBeUndefined();

    await ctx.http.post(`${API}/admin/moderation/actions/${decided.body.data.actionId}/revert`).set(as(admin)).send({ reason: 'Removed by mistake' }).expect(200);
    await ctx.http.get(`${API}/posts/${id}`).set(as(r1)).expect(200);
    await ctx.http.post(`${API}/admin/moderation/actions/${decided.body.data.actionId}/revert`).set(as(admin)).send({ reason: 'Again, by mistake' }).expect(409);
    expect((await ctx.db.execute(sql`select action from audit_logs where action like 'moderation.%' order by id`)).rows.map((r) => r.action)).toEqual(['moderation.content_removal', 'moderation.revert']);
  });

  it('restricts, suspends and bans accounts, and lifts them again', async () => {
    const troll = await registerUser(ctx, { name: 'Troll' });
    await age(troll);
    const reporter = await registerUser(ctx);
    await ctx.http.post(`${API}/reports`).set(as(reporter)).send({ targetType: 'user', targetId: troll.id, reason: 'harassment' }).expect(201);
    const restricted = await ctx.http
      .post(`${API}/admin/moderation/targets/user/${troll.id}/decision`)
      .set(as(admin))
      .send({ action: 'temporary_restriction', reason: 'Harassing comments', durationDays: 3, scope: 'comment' })
      .expect(200);
    expect(restricted.body.data.until).toBeTruthy();
    const pid = (await post(reporter, { type: 'discussion', title: 'আলোচনা', body: LONG }).expect(201)).body.data.id;
    await ctx.http.post(`${API}/posts/${pid}/comments`).set(as(troll)).send({ body: 'আবার মন্তব্য করছি' }).expect(403);
    // Only commenting is paused.
    await post(troll, { type: 'discussion', title: 'নিজের কথা', body: LONG }).expect(201);
    await ctx.http.post(`${API}/admin/moderation/actions/${restricted.body.data.actionId}/revert`).set(as(admin)).send({ reason: 'Apologised' }).expect(200);
    await ctx.http.post(`${API}/posts/${pid}/comments`).set(as(troll)).send({ body: 'দুঃখিত, আর হবে না' }).expect(201);

    // Suspension from the user's admin page signs them out everywhere and blocks sign-in until lifted.
    await ctx.http.put(`${API}/admin/users/${troll.id}/status`).set(as(reporter)).send({ status: 'banned', reason: 'Not allowed' }).expect(403);
    await ctx.http.put(`${API}/admin/users/${troll.id}/status`).set(as(admin)).send({ status: 'suspended', reason: 'Repeated harassment' }).expect(400);
    await ctx.http.put(`${API}/admin/users/${admin.id}/status`).set(as(admin)).send({ status: 'banned', reason: 'Testing myself' }).expect(400);
    await ctx.http.put(`${API}/admin/users/${troll.id}/status`).set(as(admin)).send({ status: 'suspended', reason: 'Repeated harassment', days: 7 }).expect(200);
    await ctx.http.get(`${API}/me/notifications`).set(as(troll)).expect(401);
    await ctx.http.post(`${API}/auth/login`).send({ identifier: troll.phone, password: troll.password }).expect(403);
    const detail = await ctx.http.get(`${API}/admin/users/${troll.id}`).set(as(admin)).expect(200);
    expect(detail.body.data).toMatchObject({ status: 'suspended', stats: { posts: 1, reportsAgainst: 1 } });
    expect(detail.body.data.moderation.actions.map((a: { action: string }) => a.action)).toEqual(['suspension', 'temporary_restriction']);
    await ctx.http.put(`${API}/admin/users/${troll.id}/status`).set(as(admin)).send({ status: 'active', reason: 'Appeal accepted' }).expect(200);
    await ctx.http.post(`${API}/auth/login`).send({ identifier: troll.phone, password: troll.password }).expect(200);

    const users = await ctx.http.get(`${API}/admin/users?q=Troll`).set(as(admin)).expect(200);
    expect(users.body.data).toEqual([expect.objectContaining({ id: troll.id, status: 'active' })]);
    expect((await ctx.db.execute(sql`select 1 from audit_logs where action = 'user.view' and entity_id = ${troll.id}`)).rows).toHaveLength(1);
  });

  it('reviews held posts', async () => {
    const newcomer = await registerUser(ctx, { name: 'New' });
    const held = await post(newcomer, { type: 'discussion', title: 'বই বিক্রি', body: `${LONG} বিকাশ করুন 01712345678 নম্বরে` }).expect(201);
    expect(held.body.data.status).toBe('pending_review');
    const list = await ctx.http.get(`${API}/admin/moderation/held?type=post`).set(as(admin)).expect(200);
    expect(list.body.data).toEqual([expect.objectContaining({ id: held.body.data.id, status: 'pending_review' })]);
    await ctx.http.post(`${API}/admin/moderation/held/post/${held.body.data.id}/approve`).set(as(admin)).expect(200);
    expect((await ctx.http.get(`${API}/posts/${held.body.data.id}`).expect(200)).body.data.status).toBe('published');
  });

  it('shows the overview, the audit trail and editable settings', async () => {
    const overview = await ctx.http.get(`${API}/admin/overview?days=7`).set(as(admin)).expect(200);
    expect(overview.body.data.kpis.users).toBeGreaterThanOrEqual(1);
    expect(overview.body.data.kpis.dau).toBeGreaterThanOrEqual(1);
    expect(overview.body.data.series).toHaveLength(7);
    expect(overview.body.data.queues).toMatchObject({ openReports: 0, copyrightClaims: 0 });

    await ctx.http.put(`${API}/admin/settings`).set(as(admin)).send({ values: { 'digital.downloadsPerDay': 500 } }).expect(400);
    await ctx.http.put(`${API}/admin/settings`).set(as(admin)).send({ values: { 'made.up': 1 } }).expect(400);
    await ctx.http.put(`${API}/admin/settings`).set(as(admin)).send({ values: { 'marketplace.requireListingReview': 'yes' } }).expect(400);
    const saved = await ctx.http.put(`${API}/admin/settings`).set(as(admin)).send({ values: { 'digital.downloadsPerDay': 3, 'marketplace.requireListingReview': true } }).expect(200);
    expect(saved.body.data.find((s: { key: string }) => s.key === 'digital.downloadsPerDay')).toMatchObject({ value: 3, default: 10 });
    const logs = await ctx.http.get(`${API}/admin/audit-logs?action=settings`).set(as(admin)).expect(200);
    expect(logs.body.data[0]).toMatchObject({ action: 'settings.update', actor: { name: 'Admin' }, after: { 'digital.downloadsPerDay': 3 } });
    // An ordinary admin can't change settings (super admins only).
    const staff = await registerUser(ctx, { name: 'Staff' });
    await grantRole(ctx, staff.id, 'admin');
    await ctx.http.get(`${API}/admin/settings`).set(as(staff)).expect(403);
    await ctx.http.get(`${API}/admin/overview`).set(as(staff)).expect(200);
  });

  it('runs a copyright complaint through takedown, counter-notice and restoration', async () => {
    const publisher = await approvedSeller(ctx, admin, 'publisher', 'Prokash');
    const [own] = (await ctx.db.execute<{ id: string }>(sql`select id from publishers where owner_id = ${publisher.id}`)).rows;
    const listed = await ctx.http
      .post(`${API}/seller/books`)
      .set(as(publisher))
      .send({ book: { title: 'Stolen Words', language: 'en', categoryId: await categoryId(ctx, 'books/poetry'), authorNames: ['Someone'], publisherId: own!.id }, format: { format: 'paperback' }, price: '200', stock: 3, declaration: { capacity: 'publisher', accepted: true } })
      .expect(201);
    const [book] = (await ctx.db.execute<{ id: string; slug: string }>(sql`select b.id, b.slug from products p join books b on b.id = p.book_id where p.id = ${listed.body.data.id}`)).rows;
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 400]);
    pdf.addPage([300, 400]);
    await ctx.http.post(`${API}/studio/digital/${book!.id}/file`).set(as(publisher)).field('data', JSON.stringify({ capacity: 'publisher', accepted: true })).attach('file', Buffer.from(await pdf.save()), { filename: 'b.pdf' }).expect(201);
    await ctx.http.put(`${API}/studio/digital/${book!.id}/offer`).set(as(publisher)).send({ free: true }).expect(200);

    const site = ctx.app.get<AppConfig>(APP_CONFIG).APP_URL;
    const claim = {
      claimantName: 'Real Author',
      claimantEmail: 'author@example.org',
      rightsHolder: 'Real Author',
      workDescription: 'My novel "Words", published in 2019; this e-book is a copy of it.',
      contentUrl: `${site}/en/books/${book!.slug}`,
      goodFaithStatement: true,
      accuracyStatement: true,
      signature: 'Real Author',
    };
    await ctx.http.post(`${API}/copyright/claims`).send({ ...claim, contentUrl: 'https://elsewhere.example/books/x' }).expect(400);
    await ctx.http.post(`${API}/copyright/claims`).send({ ...claim, accuracyStatement: false }).expect(400);
    const filed = await ctx.http.post(`${API}/copyright/claims`).send(claim).expect(201);
    expect(filed.body.data.reference).toHaveLength(8);
    expect((await ctx.db.execute(sql`select 1 from outbound_messages where recipient = 'author@example.org'`)).rows).toHaveLength(1);

    const queue = await ctx.http.get(`${API}/admin/copyright`).set(as(admin)).expect(200);
    expect(queue.body.data[0]).toMatchObject({ status: 'submitted', target: { type: 'digital_asset', title: 'Stolen Words' }, respondent: { id: publisher.id } });
    await ctx.http.post(`${API}/admin/copyright/${filed.body.data.id}/decision`).set(as(admin)).send({ decision: 'restore', note: 'Not possible yet' }).expect(409);
    await ctx.http.post(`${API}/admin/copyright/${filed.body.data.id}/decision`).set(as(admin)).send({ decision: 'uphold', note: 'Matches the registered work' }).expect(200);
    const reader = await registerUser(ctx);
    await ctx.http.post(`${API}/me/library/${book!.id}/free`).set(as(reader)).expect(400);
    expect((await ctx.http.get(`${API}/books/${book!.slug}`).expect(200)).body.data.digital).toBeNull();

    const standing = await ctx.http.get(`${API}/me/standing`).set(as(publisher)).expect(200);
    expect(standing.body.data.copyright[0]).toMatchObject({ status: 'content_removed', canCounter: true, rightsHolder: 'Real Author' });
    expect(JSON.stringify(standing.body.data.copyright)).not.toContain('author@example.org');
    await ctx.http.post(`${API}/me/copyright-claims/${filed.body.data.id}/counter`).set(as(reader)).send({ statement: 'x'.repeat(60), signature: 'Someone Else', consent: true }).expect(404);
    await ctx.http
      .post(`${API}/me/copyright-claims/${filed.body.data.id}/counter`)
      .set(as(publisher))
      .send({ statement: 'We hold a written licence from the author dated 2020 for the e-book edition; a copy is attached to our records.', signature: 'Prokash', consent: true })
      .expect(200);
    await ctx.http.post(`${API}/admin/copyright/${filed.body.data.id}/decision`).set(as(admin)).send({ decision: 'restore', note: 'Licence verified' }).expect(200);
    // Restored files come back withdrawn: the publisher offers them again.
    await ctx.http.put(`${API}/studio/digital/${book!.id}/offer`).set(as(publisher)).send({ free: true }).expect(200);
    await ctx.http.post(`${API}/me/library/${book!.id}/free`).set(as(reader)).expect(200);
    expect((await ctx.db.execute(sql`select 1 from outbound_messages where recipient = 'author@example.org'`)).rows).toHaveLength(4);
  });
});
