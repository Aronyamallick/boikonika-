import { createECDH, randomBytes } from 'node:crypto';
import { outboundMessages, pushSubscriptions } from '@boikonika/database';
import { and, eq, sql } from 'drizzle-orm';
import webpush from 'web-push';
import { APP_CONFIG, type AppConfig } from '../src/config/config.module';
import { PushService } from '../src/infra/messaging/push.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });

describe('Notifications (e2e)', () => {
  let ctx: TestContext;
  let notifier: NotificationsService;

  beforeAll(async () => {
    ctx = await createTestApp();
    notifier = ctx.app.get(NotificationsService);
  });
  beforeEach(async () => {
    await resetState(ctx);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const ping = (u: RegisteredUser, n: number, type: 'follower' | 'order' = 'follower') =>
    notifier.notify(u.id, { type, titleKey: 'api.orders.placedTitle', bodyKey: 'api.orders.placedBody', params: { number: `BK-${n}`, total: '100.00' }, link: `/account/orders/BK-${n}` });

  it('keeps an inbox with cursor pages, unread counts and read state that only its owner can change', async () => {
    const reader = await registerUser(ctx);
    const other = await registerUser(ctx);
    for (let i = 1; i <= 5; i++) await ping(reader, i);
    expect((await ctx.http.get(`${API}/me/notifications/unread-count`).set(as(reader)).expect(200)).body.data).toEqual({ unread: 5 });

    const first = await ctx.http.get(`${API}/me/notifications?limit=3`).set(as(reader)).expect(200);
    expect(first.body.data).toHaveLength(3);
    expect(first.body.data[0]).toMatchObject({ type: 'follower', read: false, link: '/account/orders/BK-5' });
    const second = await ctx.http.get(`${API}/me/notifications?limit=3&cursor=${first.body.meta.nextCursor}`).set(as(reader)).expect(200);
    expect(second.body.data.map((n: { link: string }) => n.link)).toEqual(['/account/orders/BK-2', '/account/orders/BK-1']);
    expect(second.body.meta.nextCursor).toBeNull();

    const id = first.body.data[0].id;
    await ctx.http.post(`${API}/me/notifications/${id}/read`).set(as(other)).expect(404);
    expect((await ctx.http.post(`${API}/me/notifications/${id}/read`).set(as(reader)).expect(200)).body.data).toEqual({ unread: 4 });
    expect((await ctx.http.get(`${API}/me/notifications?unread=1`).set(as(reader)).expect(200)).body.data).toHaveLength(4);
    await ctx.http.delete(`${API}/me/notifications/${id}`).set(as(other)).expect(404);
    await ctx.http.delete(`${API}/me/notifications/${id}`).set(as(reader)).expect(200);
    expect((await ctx.http.post(`${API}/me/notifications/read-all`).set(as(reader)).expect(200)).body.data).toEqual({ unread: 0 });
    expect((await ctx.http.get(`${API}/me/notifications`).set(as(reader)).expect(200)).body.data).toHaveLength(4);
  });

  it('respects each reader’s channel choices, except for security notices', async () => {
    const reader = await registerUser(ctx);
    const prefs = await ctx.http.get(`${API}/me/notification-preferences`).set(as(reader)).expect(200);
    const security = prefs.body.data.types.find((p: { type: string }) => p.type === 'security');
    expect(security).toMatchObject({ mandatory: true });
    const follower = prefs.body.data.types.find((p: { type: string }) => p.type === 'follower');
    expect(follower.channels).toEqual([
      { channel: 'in_app', enabled: true },
      { channel: 'push', enabled: false },
      { channel: 'email', enabled: false },
    ]);

    await ctx.http.put(`${API}/me/notification-preferences`).set(as(reader)).send({ preferences: [{ type: 'security', channel: 'in_app', enabled: false }] }).expect(400);
    await ctx.http.put(`${API}/me/notification-preferences`).set(as(reader)).send({ preferences: [{ type: 'follower', channel: 'sms', enabled: true }] }).expect(400);
    const saved = await ctx.http.put(`${API}/me/notification-preferences`).set(as(reader)).send({ preferences: [{ type: 'follower', channel: 'in_app', enabled: false }] }).expect(200);
    expect(saved.body.data.types.find((p: { type: string }) => p.type === 'follower').channels[0]).toEqual({ channel: 'in_app', enabled: false });
    await ping(reader, 1);
    expect((await ctx.http.get(`${API}/me/notifications`).set(as(reader)).expect(200)).body.data).toEqual([]);
  });

  it('registers devices and pushes through the outbox to the mobile app', async () => {
    const reader = await registerUser(ctx);
    expect((await ctx.http.get(`${API}/push/config`).expect(200)).body.data).toEqual({ publicKey: null });
    // No VAPID keys in this environment: browsers can't subscribe, the app can.
    await ctx.http.post(`${API}/me/push-subscriptions`).set(as(reader)).send({ kind: 'web', endpoint: 'https://push.example.com/abc', keys: { p256dh: 'x'.repeat(40), auth: 'y'.repeat(16) } }).expect(400);
    await ctx.http.post(`${API}/me/push-subscriptions`).set(as(reader)).send({ kind: 'expo', endpoint: 'not-a-token' }).expect(400);
    const token = 'ExponentPushToken[abcdefghijklmnop1234]';
    await ctx.http.post(`${API}/me/push-subscriptions`).set(as(reader)).send({ kind: 'expo', endpoint: token }).expect(201);

    const realFetch = global.fetch;
    const sent: unknown[] = [];
    global.fetch = (async (url: string, init?: RequestInit) => {
      if (String(url).startsWith('https://exp.host/')) {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ data: [{ status: sent.length === 1 ? 'ok' : 'error', details: { error: 'DeviceNotRegistered' } }] }), { status: 200 });
      }
      return realFetch(url, init);
    }) as typeof fetch;
    try {
      // Orders push by default; the push waits in the outbox until delivered.
      await ping(reader, 7, 'order');
      const [queued] = await ctx.db.select().from(outboundMessages).where(and(eq(outboundMessages.channel, 'push'), eq(outboundMessages.recipient, reader.id)));
      expect(queued).toMatchObject({ status: 'sent' });
      expect(sent[0]).toEqual([expect.objectContaining({ to: token, title: expect.stringContaining('BK-7'), data: { url: expect.stringMatching(/\/account\/orders\/BK-7$/) } })]);
      // The push service reports the app was uninstalled: the token is dropped.
      await ping(reader, 8, 'order');
      expect(await ctx.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, reader.id))).toEqual([]);
    } finally {
      global.fetch = realFetch;
    }
  });

  it('sends Web Push with the VAPID keys and forgets browsers whose subscription is gone', async () => {
    const reader = await registerUser(ctx);
    const vapid = webpush.generateVAPIDKeys();
    const config = { ...ctx.app.get<AppConfig>(APP_CONFIG), VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey };
    const push = new PushService(ctx.db, config);
    expect(push.publicKey).toBe(vapid.publicKey);
    const keys = { p256dh: createECDH('prime256v1').generateKeys().toString('base64url'), auth: randomBytes(16).toString('base64url') };
    await ctx.db.insert(pushSubscriptions).values([
      { userId: reader.id, kind: 'web', endpoint: 'https://push.example.com/live', keys },
      { userId: reader.id, kind: 'web', endpoint: 'https://push.example.com/gone', keys },
      { userId: reader.id, kind: 'web', endpoint: 'https://push.example.com/flaky', keys },
    ]);
    const calls: Array<{ endpoint: string; payload: unknown }> = [];
    const spy = jest.spyOn(webpush, 'sendNotification').mockImplementation(async (sub, payload) => {
      calls.push({ endpoint: sub.endpoint, payload: JSON.parse(String(payload)) });
      if (sub.endpoint.endsWith('/gone')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
      if (sub.endpoint.endsWith('/flaky')) throw Object.assign(new Error('Service unavailable'), { statusCode: 503 });
      return { statusCode: 201, body: '', headers: {} };
    });
    try {
      const result = await push.sendToUser(reader.id, { title: 'Hello', body: 'World', url: 'https://boikonika.test/' });
      expect(result).toEqual({ delivered: 1, removed: 1 });
      expect(calls.find((c) => c.endpoint.endsWith('/live'))?.payload).toEqual({ title: 'Hello', body: 'World', url: 'https://boikonika.test/' });
      const left = await ctx.db.select({ endpoint: pushSubscriptions.endpoint, failures: pushSubscriptions.failureCount }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, reader.id));
      expect(left).toEqual(expect.arrayContaining([{ endpoint: 'https://push.example.com/live', failures: 0 }, { endpoint: 'https://push.example.com/flaky', failures: 1 }]));
      expect(left).toHaveLength(2);
      // When every device fails for a temporary reason the outbox retries later.
      await ctx.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, 'https://push.example.com/live'));
      await expect(push.sendToUser(reader.id, { title: 'Again', body: 'Retry' })).rejects.toThrow(/every device/);
    } finally {
      spy.mockRestore();
    }
  });

  it('sends staff announcements in each reader’s language to the chosen group, a few per hour', async () => {
    const admin = await registerUser(ctx, { name: 'Admin' });
    await grantRole(ctx, admin.id, 'super_admin');
    const student = await registerUser(ctx);
    await grantRole(ctx, student.id, 'student');
    const englishStudent = await registerUser(ctx);
    await grantRole(ctx, englishStudent.id, 'student');
    await ctx.db.execute(sql`update users set locale = 'en' where id = ${englishStudent.id}`);
    const quietStudent = await registerUser(ctx);
    await grantRole(ctx, quietStudent.id, 'student');
    await ctx.http.put(`${API}/me/notification-preferences`).set(as(quietStudent)).send({ preferences: [{ type: 'announcement', channel: 'in_app', enabled: false }] }).expect(200);
    const outsider = await registerUser(ctx);

    const body = { title: { bn: 'বইমেলা শুরু', en: 'The book fair begins' }, body: { bn: 'ফেব্রুয়ারি জুড়ে বিশেষ ছাড়।', en: 'Special discounts all February.' }, link: '/books', audience: 'students' };
    await ctx.http.post(`${API}/admin/notifications/broadcast`).set(as(student)).send(body).expect(403);
    await ctx.http.post(`${API}/admin/notifications/broadcast`).set(as(admin)).send({ ...body, link: 'https://evil.example' }).expect(400);
    const res = await ctx.http.post(`${API}/admin/notifications/broadcast`).set(as(admin)).send(body).expect(200);
    expect(res.body.data).toMatchObject({ recipients: 2 });
    expect((await ctx.http.get(`${API}/me/notifications`).set(as(student)).expect(200)).body.data[0]).toMatchObject({ type: 'announcement', title: 'বইমেলা শুরু', link: '/books' });
    expect((await ctx.http.get(`${API}/me/notifications`).set(as(englishStudent)).expect(200)).body.data[0]).toMatchObject({ title: 'The book fair begins' });
    expect((await ctx.http.get(`${API}/me/notifications`).set(as(quietStudent)).expect(200)).body.data).toEqual([]);
    expect((await ctx.http.get(`${API}/me/notifications`).set(as(outsider)).expect(200)).body.data).toEqual([]);
    expect((await ctx.db.execute(sql`select 1 from audit_logs where action = 'notification.broadcast'`)).rows).toHaveLength(1);

    await ctx.http.post(`${API}/admin/notifications/broadcast`).set(as(admin)).send(body).expect(200);
    await ctx.http.post(`${API}/admin/notifications/broadcast`).set(as(admin)).send(body).expect(200);
    await ctx.http.post(`${API}/admin/notifications/broadcast`).set(as(admin)).send(body).expect(429);
  });
});
