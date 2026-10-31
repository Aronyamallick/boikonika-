import { sql } from 'drizzle-orm';
import { pngImage } from './images';
import { createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
const BODY = '## কেন পড়ব\nবই পড়া মনকে **প্রশস্ত** করে।\n\n- নতুন ভাবনা\n- নতুন বন্ধু\n\nআরও জানতে [সহায়তা কেন্দ্র](/help) দেখুন।';
const both = (bn: string, en: string) => ({ bn, en });

describe('Content, homepage builder and contact (e2e)', () => {
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

  const home = async () => {
    await ctx.redis.del('home:v1');
    return (await ctx.http.get(`${API}/home`).expect(200)).body.data as Array<{ key: string; type: string; items: Array<{ id?: string; title?: unknown }> }>;
  };

  it('serves pages and lets staff edit, unpublish and add them', async () => {
    const about = await ctx.http.get(`${API}/pages/about`).expect(200);
    expect(about.body.data.title.bn).toBeTruthy();
    expect(about.body.data.body.en).toContain('## ');
    await ctx.http.get(`${API}/pages/no-such-page`).expect(404);
    expect((await ctx.http.get(`${API}/faqs`).expect(200)).body.data.length).toBeGreaterThan(5);

    const reader = await registerUser(ctx, { name: 'Reader' });
    await ctx.http.get(`${API}/admin/cms/pages`).set(as(reader)).expect(403);
    const pages = (await ctx.http.get(`${API}/admin/cms/pages`).set(as(admin)).expect(200)).body.data as Array<{ id: string; slug: string }>;
    const terms = pages.find((p) => p.slug === 'terms')!;
    const current = (await ctx.http.get(`${API}/admin/cms/pages/${terms.id}`).set(as(admin)).expect(200)).body.data;
    // Body keeps its line breaks (Markdown) while titles are tidied.
    await ctx.http
      .put(`${API}/admin/cms/pages/${terms.id}`)
      .set(as(admin))
      .send({ title: both('  শর্তাবলি ', 'Terms'), body: { bn: `${current.body.bn}\r\n\r\n\r\n## নতুন অংশ`, en: `${current.body.en}\n\n## New part` }, status: 'draft' })
      .expect(200);
    await ctx.http.get(`${API}/pages/terms`).expect(404);
    const saved = (await ctx.http.put(`${API}/admin/cms/pages/${terms.id}`).set(as(admin)).send({ title: both('শর্তাবলি', 'Terms'), body: { bn: `${current.body.bn}\n\n## নতুন অংশ`, en: current.body.en }, status: 'published' }).expect(200)).body.data;
    expect(saved.title.bn).toBe('শর্তাবলি');
    expect(saved.body.bn.endsWith('\n\n## নতুন অংশ')).toBe(true);
    await ctx.http.get(`${API}/pages/terms`).expect(200);

    const page = { slug: 'press', title: both('সংবাদমাধ্যম', 'Press'), body: both('সংবাদমাধ্যমের জন্য তথ্য ও যোগাযোগের ঠিকানা এখানে।', 'Information and contacts for the press are here.') };
    await ctx.http.post(`${API}/admin/cms/pages`).set(as(admin)).send({ ...page, slug: 'Press Room' }).expect(400);
    await ctx.http.post(`${API}/admin/cms/pages`).set(as(admin)).send(page).expect(201);
    await ctx.http.post(`${API}/admin/cms/pages`).set(as(admin)).send(page).expect(409);
    expect((await ctx.http.get(`${API}/pages`).expect(200)).body.data.map((p: { slug: string }) => p.slug)).toContain('press');
    const audit = await ctx.db.execute<{ action: string }>(sql`select action from audit_logs where action like 'cms.page.%' order by id`);
    expect(audit.rows.map((r) => r.action)).toEqual(['cms.page.update', 'cms.page.update', 'cms.page.create']);
  });

  it('publishes articles, keeps drafts private, counts views and searches help', async () => {
    const draft = { kind: 'blog', title: 'বইমেলার প্রস্তুতি', body: BODY, language: 'bn', tags: ['বইমেলা'] };
    await ctx.http.post(`${API}/admin/cms/articles`).set(as(admin)).send({ ...draft, body: 'খুব ছোট' }).expect(400);
    const created = (await ctx.http.post(`${API}/admin/cms/articles`).set(as(admin)).send(draft).expect(201)).body.data;
    expect(created.status).toBe('draft');
    expect(created.publishedAt).toBeNull();
    await ctx.http.get(`${API}/articles/${encodeURIComponent(created.slug)}`).expect(404);
    expect((await ctx.http.get(`${API}/articles`).expect(200)).body.meta.total).toBe(0);

    const published = (await ctx.http.put(`${API}/admin/cms/articles/${created.id}`).set(as(admin)).send({ ...draft, status: 'published' }).expect(200)).body.data;
    expect(published.publishedAt).toBeTruthy();
    await ctx.http.put(`${API}/admin/cms/articles/${created.id}/cover`).set(as(admin)).attach('file', await pngImage(1200, 800), { filename: 'c.png' }).expect(200);
    const help = (await ctx.http.post(`${API}/admin/cms/articles`).set(as(admin)).send({ kind: 'help', title: 'How to track your order', body: 'Open **My orders** and pick the order. Each parcel shows where it is, with the courier and tracking number once it ships.', language: 'en', status: 'published' }).expect(201)).body.data;

    const list = (await ctx.http.get(`${API}/articles`).expect(200)).body;
    expect(list.data.map((a: { id: string }) => a.id)).toEqual([created.id]);
    expect(list.data[0]).toMatchObject({ kind: 'blog', readMinutes: 1, coverUrl: expect.any(String), author: { name: 'Admin' } });
    expect(list.data[0].excerpt).toContain('বই পড়া মনকে প্রশস্ত করে');
    expect((await ctx.http.get(`${API}/articles?kind=help`).expect(200)).body.data.map((a: { id: string }) => a.id)).toEqual([help.id]);

    const reader = await registerUser(ctx, { name: 'Reader' });
    const path = `${API}/articles/${encodeURIComponent(created.slug)}`;
    expect((await ctx.http.post(`${API}/articles/${created.id}/view`).set(as(reader)).expect(200)).body.data.viewCount).toBe(1);
    expect((await ctx.http.post(`${API}/articles/${created.id}/view`).set(as(reader)).expect(200)).body.data.viewCount).toBe(1);
    const again = (await ctx.http.get(path).expect(200)).body.data;
    expect(again.viewCount).toBe(1);
    expect(again.body).toBe(BODY);

    const search = (await ctx.http.get(`${API}/help/search?q=track`).expect(200)).body.data;
    expect(search.articles.map((a: { id: string }) => a.id)).toEqual([help.id]);
    const faqSearch = (await ctx.http.get(`${API}/help/search?q=${encodeURIComponent('পেমেন্ট')}`).expect(200)).body.data;
    expect(faqSearch.faqs.length).toBeGreaterThan(0);

    await ctx.http.delete(`${API}/admin/cms/articles/${created.id}`).set(as(admin)).expect(200);
    await ctx.http.get(path).expect(404);
    await ctx.http.post(`${API}/articles/${created.id}/view`).expect(404);
  });

  it('builds the homepage from sections, banners and testimonials', async () => {
    const [b1, b2] = (
      await ctx.db.execute<{ id: string }>(sql`
        insert into books (title, slug, status, is_free) values ('Gitanjali', 'gitanjali-test', 'published', true), ('Sanchayita', 'sanchayita-test', 'published', true) returning id`)
    ).rows;

    // A hand-picked shelf keeps the chosen order; unknown books are dropped.
    const shelf = { type: 'book_list', title: both('সম্পাদকের তালিকা', 'Our list'), isEnabled: true, config: { source: 'manual', bookIds: [b2!.id, '6a1f2a54-1111-4111-8111-111111111111', b1!.id] } };
    await ctx.http.post(`${API}/admin/homepage/sections`).set(as(admin)).send({ ...shelf, config: { source: 'manual', bookIds: [] } }).expect(400);
    await ctx.http.post(`${API}/admin/homepage/sections`).set(as(admin)).send({ ...shelf, type: 'hero' }).expect(400);
    await ctx.http.post(`${API}/admin/homepage/sections`).set(as(admin)).send({ ...shelf, config: { source: 'category', categoryId: '6a1f2a54-1111-4111-8111-111111111111' } }).expect(400);
    let sections = (await ctx.http.post(`${API}/admin/homepage/sections`).set(as(admin)).send(shelf).expect(201)).body.data as Array<{ id: string; key: string; type: string; custom: boolean; config: { bookIds: string[] } }>;
    const mine = sections.find((s) => s.custom)!;
    expect(mine.config.bookIds).toEqual([b2!.id, b1!.id]);
    let page = await home();
    expect(page.find((s) => s.key === mine.key)!.items.map((b) => b.id)).toEqual([b2!.id, b1!.id]);

    // Banners: an image is required, links must be safe, and scheduled banners wait for their start.
    const banner = { title: both('বইমেলা চলছে', 'The book fair is on'), ctaLabel: both('দেখুন', 'Browse'), link: '/books', placement: 'home' };
    await ctx.http.post(`${API}/admin/cms/banners`).set(as(admin)).field('data', JSON.stringify(banner)).expect(400);
    await ctx.http.post(`${API}/admin/cms/banners`).set(as(admin)).field('data', JSON.stringify({ ...banner, link: 'javascript:alert(1)' })).attach('image', await pngImage(1200, 600), { filename: 'b.png' }).expect(400);
    await ctx.http.post(`${API}/admin/cms/banners`).set(as(admin)).field('data', JSON.stringify({ ...banner, startsAt: new Date(Date.now() + 86_400_000).toISOString() })).attach('image', await pngImage(1200, 600), { filename: 'b.png' }).expect(201);
    expect((await ctx.http.get(`${API}/banners`).expect(200)).body.data).toHaveLength(0);
    const banners = (await ctx.http.post(`${API}/admin/cms/banners`).set(as(admin)).field('data', JSON.stringify(banner)).attach('image', await pngImage(1200, 600), { filename: 'b.png' }).attach('mobileImage', await pngImage(600, 600), { filename: 'm.png' }).expect(201)).body.data as Array<{ id: string; live: boolean }>;
    expect(banners.map((b) => b.live).sort()).toEqual([false, true]);
    expect((await ctx.http.get(`${API}/banners`).expect(200)).body.data).toHaveLength(1);
    sections = (await ctx.http.post(`${API}/admin/homepage/sections`).set(as(admin)).send({ type: 'banner', title: both('ব্যানার', 'Banners'), isEnabled: true }).expect(201)).body.data;
    page = await home();
    expect(page.find((s) => s.type === 'banner')!.items).toHaveLength(1);

    // Testimonials need the person's consent date, and show once their section is on.
    await ctx.http.post(`${API}/admin/homepage/testimonials`).set(as(admin)).send({ name: 'Nusrat', quote: both('এখানে পুরনো বই সহজে পাই।', 'I find used books easily here.'), consentGivenAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }).expect(400);
    await ctx.http.post(`${API}/admin/homepage/testimonials`).set(as(admin)).send({ name: 'Nusrat', quote: both('এখানে পুরনো বই সহজে পাই।', 'I find used books easily here.'), consentGivenAt: '2026-09-01' }).expect(201);
    const testimonials = sections.find((s) => s.type === 'testimonials')!;
    await ctx.http.put(`${API}/admin/homepage/sections/${testimonials.id}`).set(as(admin)).send({ title: both('পাঠকেরা বলছেন', 'Readers say'), isEnabled: true }).expect(200);
    page = await home();
    expect(page.find((s) => s.type === 'testimonials')!.items).toHaveLength(1);

    // Order, switching off and deleting.
    const order = sections.map((s) => s.id).reverse();
    sections = (await ctx.http.put(`${API}/admin/homepage/sections/order`).set(as(admin)).send({ ids: order }).expect(200)).body.data;
    expect(sections.map((s) => s.id)).toEqual(order);
    await ctx.http.put(`${API}/admin/homepage/sections/${mine.id}`).set(as(admin)).send({ title: both('সম্পাদকের তালিকা', 'Our list'), isEnabled: false, config: { source: 'manual', bookIds: [b1!.id] } }).expect(200);
    expect((await home()).some((s) => s.key === mine.key)).toBe(false);
    const hero = sections.find((s) => s.type === 'hero')!;
    await ctx.http.delete(`${API}/admin/homepage/sections/${hero.id}`).set(as(admin)).expect(400);
    await ctx.http.delete(`${API}/admin/homepage/sections/${mine.id}`).set(as(admin)).expect(200);
    const live = banners.find((b) => b.live)!;
    await ctx.http.delete(`${API}/admin/cms/banners/${live.id}`).set(as(admin)).expect(200);
    expect((await home()).some((s) => s.type === 'banner')).toBe(false);
  });

  it('takes contact messages and lets support answer them', async () => {
    const message = { name: 'Rafiq', topic: 'order', message: 'My parcel shows delivered but I have not received it yet.' };
    await ctx.http.post(`${API}/contact`).send(message).expect(400);
    const guest = await ctx.http.post(`${API}/contact`).send({ ...message, email: 'Rafiq@Example.org', phone: '01712345678' }).expect(201);
    expect(guest.body.data.reference).toHaveLength(8);
    const reader = await registerUser(ctx, { name: 'Reader' });
    await ctx.http.post(`${API}/contact`).set(as(reader)).send({ ...message, topic: 'account', orderNumber: 'BK-1234' }).expect(201);

    await ctx.http.get(`${API}/admin/messages`).set(as(reader)).expect(403);
    const support = await registerUser(ctx, { name: 'Support' });
    await grantRole(ctx, support.id, 'moderator');
    const inbox = (await ctx.http.get(`${API}/admin/messages`).set(as(support)).expect(200)).body.data as Array<{ id: string; email: string | null; phone: string | null; account: unknown }>;
    expect(inbox).toHaveLength(2);
    const fromGuest = inbox.find((m) => m.email)!;
    expect(fromGuest).toMatchObject({ email: 'rafiq@example.org', phone: '+8801712345678', account: null });

    await ctx.http.post(`${API}/admin/messages/${fromGuest.id}/reply`).set(as(support)).send({ reply: 'We have asked the courier.\nThey will call you today.' }).expect(200);
    const mails = await ctx.db.execute<{ body: string }>(sql`select body from outbound_messages where recipient = 'rafiq@example.org' order by created_at`);
    expect(mails.rows).toHaveLength(2);
    expect(mails.rows[1]!.body).toContain('They will call you today.');
    const fromReader = inbox.find((m) => !m.email)!;
    await ctx.http.post(`${API}/admin/messages/${fromReader.id}/reply`).set(as(support)).send({ reply: 'Your account is fine now.', close: true }).expect(200);
    const notes = (await ctx.http.get(`${API}/me/notifications`).set(as(reader)).expect(200)).body.data as Array<{ type: string; body: string }>;
    expect(notes[0]).toMatchObject({ type: 'support', body: 'Your account is fine now.' });
    expect((await ctx.http.get(`${API}/admin/messages?status=closed`).set(as(support)).expect(200)).body.data).toHaveLength(1);
    expect((await ctx.http.get(`${API}/admin/overview`).set(as(admin)).expect(200)).body.data.queues.openMessages).toBe(0);

    for (let i = 0; i < 4; i++) await ctx.http.post(`${API}/contact`).send({ ...message, email: 'x@example.org' }).expect(201);
    await ctx.http.post(`${API}/contact`).send({ ...message, email: 'x@example.org' }).expect(429);
  });
});
