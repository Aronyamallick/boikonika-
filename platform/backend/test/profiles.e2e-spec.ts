import { userProfiles, users } from '@boikonika/database';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { photoWithExif } from './images';
import { createTestApp, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });

describe('Profiles (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('updates profile details with validation', async () => {
    const user = await registerUser(ctx);
    const bad = await ctx.http.patch(`${API}/me/profile`).set(as(user)).send({ website: 'not a url', birthYear: 1800 }).expect(400);
    expect(bad.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['birthYear', 'website']);
    const res = await ctx.http
      .patch(`${API}/me/profile`)
      .set(as(user))
      .send({ displayName: 'নতুন নাম', bio: 'বই পড়তে ভালোবাসি', website: 'https://example.com/me', location: 'Rajshahi', theme: 'dark', profileVisibility: 'followers' })
      .expect(200);
    expect(res.body.data).toMatchObject({ displayName: 'নতুন নাম', bio: 'বই পড়তে ভালোবাসি', website: 'https://example.com/me', theme: 'dark', profileVisibility: 'followers' });
    // Empty strings clear optional fields.
    const cleared = await ctx.http.patch(`${API}/me/profile`).set(as(user)).send({ bio: '' }).expect(200);
    expect(cleared.body.data.bio).toBeNull();
  });

  it('stores avatars as square WebP without the photo metadata and serves them', async () => {
    const user = await registerUser(ctx);
    const res = await ctx.http.put(`${API}/me/avatar`).set(as(user)).attach('file', await photoWithExif(), { filename: 'me.jpg', contentType: 'image/jpeg' }).expect(200);
    const path = new URL(res.body.data.url).pathname;
    const file = await ctx.http.get(path).expect(200);
    expect(file.headers['content-type']).toBe('image/webp');
    const meta = await sharp(file.body as Buffer).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });
    expect(meta.exif).toBeUndefined();
    const me = await ctx.http.get(`${API}/auth/me`).set(as(user)).expect(200);
    expect(me.body.data.avatarUrl).toBe(res.body.data.url);
  });

  it('rejects files that are not really images', async () => {
    const user = await registerUser(ctx);
    const fake = Buffer.from('<script>alert(1)</script>'.padEnd(200, ' '));
    const res = await ctx.http.put(`${API}/me/avatar`).set(as(user)).attach('file', fake, { filename: 'evil.png', contentType: 'image/png' }).expect(415);
    expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('completes onboarding with at least three interests', async () => {
    const user = await registerUser(ctx);
    await ctx.http.put(`${API}/me/interests`).set(as(user)).send({ interests: ['poetry'] }).expect(400);
    await ctx.http.put(`${API}/me/interests`).set(as(user)).send({ interests: ['poetry', 'history', 'science', 'poetry'] }).expect(200);
    const me = await ctx.http.get(`${API}/auth/me`).set(as(user)).expect(200);
    expect(me.body.data.onboarded).toBe(true);
    const profile = await ctx.http.get(`${API}/me/profile`).set(as(user)).expect(200);
    expect(profile.body.data.interests.sort()).toEqual(['history', 'poetry', 'science']);
  });

  it('respects profile privacy, follows and blocks', async () => {
    const owner = await registerUser(ctx, { name: 'Owner' });
    const visitor = await registerUser(ctx, { name: 'Visitor' });
    await ctx.http.patch(`${API}/me/profile`).set(as(owner)).send({ bio: 'Followers only', profileVisibility: 'followers' }).expect(200);
    const [{ username }] = await ctx.db.select({ username: users.username }).from(users).where(eq(users.id, owner.id));

    const anonymous = await ctx.http.get(`${API}/users/${username}`).expect(200);
    expect(anonymous.body.data).toMatchObject({ displayName: 'Owner', bio: null, visibility: { profile: false } });

    const follow = await ctx.http.post(`${API}/users/${username}/follow`).set(as(visitor)).expect(200);
    expect(follow.body.data).toEqual({ following: true, followerCount: 1 });
    await ctx.http.post(`${API}/users/${username}/follow`).set(as(visitor)).expect(200); // idempotent
    const asFollower = await ctx.http.get(`${API}/users/${username}`).set(as(visitor)).expect(200);
    expect(asFollower.body.data).toMatchObject({ bio: 'Followers only', followerCount: 1, viewer: { following: true } });
    const followers = await ctx.http.get(`${API}/users/${username}/followers`).set(as(visitor)).expect(200);
    expect(followers.body.data).toHaveLength(1);

    // The owner blocks the visitor: the follow is removed and the profile disappears for them.
    const [{ username: visitorName }] = await ctx.db.select({ username: users.username }).from(users).where(eq(users.id, visitor.id));
    await ctx.http.post(`${API}/users/${visitorName}/block`).set(as(owner)).expect(200);
    await ctx.http.get(`${API}/users/${username}`).set(as(visitor)).expect(404);
    await ctx.http.post(`${API}/users/${username}/follow`).set(as(visitor)).expect(404);
    const [profile] = await ctx.db.select({ followerCount: userProfiles.followerCount }).from(userProfiles).where(eq(userProfiles.userId, owner.id));
    expect(profile!.followerCount).toBe(0);
  });

  it('exports personal data and deletes the account', async () => {
    const user = await registerUser(ctx);
    await ctx.http.put(`${API}/me/interests`).set(as(user)).send({ interests: ['poetry', 'history', 'science'] }).expect(200);
    const exported = await ctx.http.get(`${API}/me/export`).set(as(user)).expect(200);
    expect(exported.headers['content-disposition']).toMatch(/attachment; filename="boikonika-data-/);
    expect(Object.keys(exported.body)).toEqual(expect.arrayContaining(['account', 'profile', 'roles', 'interests', 'signIns', 'verifications']));
    expect(JSON.stringify(exported.body)).not.toMatch(/password_?hash|two_?factor_?secret/i);

    await ctx.http.post(`${API}/me/delete`).set(as(user)).send({ password: 'wrong-pass-1', confirm: 'DELETE' }).expect(400);
    await ctx.http.post(`${API}/me/delete`).set(as(user)).send({ password: user.password }).expect(400);
    await ctx.http.post(`${API}/me/delete`).set(as(user)).send({ password: user.password, confirm: 'DELETE' }).expect(200);
    await ctx.http.get(`${API}/auth/me`).set(as(user)).expect(401);
    await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: user.password }).expect(401);
    const [row] = await ctx.db.select().from(users).where(eq(users.id, user.id));
    expect(row).toMatchObject({ status: 'deleted', phone: null, passwordHash: null, displayName: 'Deleted user' });
  });
});
