import { loginEvents, notifications, sessions, userRoles, users } from '@boikonika/database';
import { messages } from '@boikonika/shared';
import { and, eq, sql } from 'drizzle-orm';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { CapturedMessages } from '../src/infra/messaging/drivers';
import { GoogleIdTokenVerifier } from '../src/modules/auth/google.verifier';
import { currentStep, totpAt } from '../src/modules/auth/totp';
import { createTestApp, grantRole, lastCode, refreshCookie, registerUser, resetState, setStatus, uniquePhone, type TestContext } from './utils';

const API = '/api/v1';
const CSRF = { 'X-Requested-With': 'boikonika' };

describe('Authentication (e2e)', () => {
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

  describe('registration', () => {
    it('registers with a phone code, sets an HTTP-only refresh cookie and returns the user', async () => {
      const phone = uniquePhone();
      const otp = await ctx.http.post(`${API}/auth/otp/request`).send({ target: '0' + phone.slice(4), purpose: 'register' }).expect(200);
      expect(otp.body.data).toMatchObject({ sentTo: expect.stringMatching(/^01\d\*{4}\d{4}$/), expiresIn: 300, resendIn: 60 });

      const res = await ctx.http
        .post(`${API}/auth/register`)
        .send({ name: 'রহিম উদ্দিন', target: phone, code: lastCode(phone), password: 'boi-test-2026', acceptTerms: true, isStudent: true })
        .expect(201);
      expect(res.body.data.user).toMatchObject({ displayName: 'রহিম উদ্দিন', phone, phoneVerified: true, emailVerified: false, roles: ['customer', 'student'], hasPassword: true, twoFactorEnabled: false });
      expect(res.body.data.user.username).toMatch(/^reader\d{4}$/);
      expect(res.body.data.tokens.refreshToken).toBeUndefined();
      const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('bk_refresh='))!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

      const me = await ctx.http.get(`${API}/auth/me`).set('Authorization', `Bearer ${res.body.data.tokens.accessToken}`).expect(200);
      expect(me.body.data.id).toBe(res.body.data.user.id);
    });

    it('does not reveal that a contact is registered: same response, a notice instead of a code', async () => {
      const existing = await registerUser(ctx);
      CapturedMessages.clear();
      await ctx.redis.del(`otp:cd:register:${existing.phone}`); // as if the resend cooldown had passed
      const res = await ctx.http.post(`${API}/auth/otp/request`).send({ target: existing.phone, purpose: 'register' }).expect(200);
      expect(res.body.data).toMatchObject({ expiresIn: 300, resendIn: 60 });
      const [notice] = CapturedMessages.list(existing.phone);
      expect(notice!.text).not.toMatch(/\b\d{6}\b/);
      const register = await ctx.http.post(`${API}/auth/register`).send({ name: 'Copy Cat', target: existing.phone, code: '123456', password: 'boi-test-2026', acceptTerms: true });
      expect(register.status).toBe(400);
      expect(register.body.errors[0]).toMatchObject({ field: 'code', code: 'otp_invalid' });
    });

    it('rejects a taken username without consuming the code', async () => {
      const first = await registerUser(ctx);
      const [{ username }] = await ctx.db.select({ username: users.username }).from(users).where(eq(users.id, first.id));
      const phone = uniquePhone();
      await ctx.http.post(`${API}/auth/otp/request`).send({ target: phone, purpose: 'register' }).expect(200);
      const code = lastCode(phone);
      const clash = await ctx.http.post(`${API}/auth/register`).send({ name: 'Second', target: phone, code, password: 'boi-test-2026', acceptTerms: true, username });
      expect(clash.status).toBe(409);
      expect(clash.body.errors[0].field).toBe('username');
      await ctx.http.post(`${API}/auth/register`).send({ name: 'Second', target: phone, code, password: 'boi-test-2026', acceptTerms: true, username: 'second.reader' }).expect(201);
    });

    it('validates input with translated, field-level errors', async () => {
      const res = await ctx.http.post(`${API}/auth/register`).set('Accept-Language', 'bn').send({ name: 'R', target: '01212345678', code: '12', password: 'short', acceptTerms: false });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      const fields = res.body.errors.map((e: { field: string }) => e.field);
      expect(fields).toEqual(expect.arrayContaining(['name', 'target', 'code', 'password', 'acceptTerms']));
      expect(res.body.message).toBe(messages.bn.errors.validation);
      expect(res.body.errors.find((e: { field: string }) => e.field === 'target').message).toMatch(/মোবাইল/);
    });
  });

  describe('one-time codes', () => {
    it('enforces the resend cooldown with the remaining seconds', async () => {
      const phone = uniquePhone();
      await ctx.http.post(`${API}/auth/otp/request`).send({ target: phone, purpose: 'register' }).expect(200);
      const again = await ctx.http.post(`${API}/auth/otp/request`).set('Accept-Language', 'en').send({ target: phone, purpose: 'register' }).expect(429);
      expect(again.body.code).toBe('RATE_LIMITED');
      expect(again.body.message).toMatch(/\d+ seconds/);
    });

    it('locks a code after five wrong attempts, even before the right one', async () => {
      const phone = uniquePhone();
      await ctx.http.post(`${API}/auth/otp/request`).send({ target: phone, purpose: 'register' }).expect(200);
      const code = lastCode(phone);
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++) {
        await ctx.http.post(`${API}/auth/register`).send({ name: 'Guesser', target: phone, code: wrong, password: 'boi-test-2026', acceptTerms: true }).expect(400);
      }
      const res = await ctx.http.post(`${API}/auth/register`).send({ name: 'Guesser', target: phone, code, password: 'boi-test-2026', acceptTerms: true }).expect(400);
      expect(res.body.errors[0].code).toBe('otp_attempts');
    });

    it('stores codes only as hashes and redacts delivered messages', async () => {
      const phone = uniquePhone();
      await ctx.http.post(`${API}/auth/otp/request`).send({ target: phone, purpose: 'register' }).expect(200);
      const code = lastCode(phone);
      const stored = await ctx.db.execute<{ code_hash: string; body: string }>(sql`select o.code_hash, m.body from otp_codes o, outbound_messages m where o.target = ${phone} and m.recipient = ${phone}`);
      expect(stored.rows[0]!.code_hash).not.toContain(code);
      expect(stored.rows[0]!.body).toBe('[redacted]');
    });
  });

  describe('sign-in', () => {
    it('accepts phone (any format), username and email identifiers', async () => {
      const user = await registerUser(ctx);
      const [{ username }] = await ctx.db.select({ username: users.username }).from(users).where(eq(users.id, user.id));
      for (const identifier of [user.phone, toBangla(user.phone.slice(3)), username.toUpperCase()]) {
        const res = await ctx.http.post(`${API}/auth/login`).send({ identifier, password: user.password });
        expect(res.status).toBe(200);
        expect(res.body.data.user.id).toBe(user.id);
      }
    });

    it('gives the same answer for an unknown account and a wrong password', async () => {
      const user = await registerUser(ctx);
      const wrong = await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: 'not-the-password1' }).expect(401);
      const unknown = await ctx.http.post(`${API}/auth/login`).send({ identifier: uniquePhone(), password: 'not-the-password1' }).expect(401);
      expect(wrong.body.message).toBe(unknown.body.message);
      expect(wrong.body.code).toBe(unknown.body.code);
    });

    it('locks the account after five failures', async () => {
      const user = await registerUser(ctx);
      for (let i = 0; i < 5; i++) await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: 'wrong-password-9' }).expect(401);
      const locked = await ctx.http.post(`${API}/auth/login`).set('Accept-Language', 'en').send({ identifier: user.phone, password: user.password }).expect(429);
      expect(locked.body.message).toMatch(/15 minutes/);
      const events = await ctx.db.select().from(loginEvents).where(eq(loginEvents.userId, user.id));
      expect(events.filter((e) => e.result === 'failed_password')).toHaveLength(5);
      expect(events.some((e) => e.result === 'locked')).toBe(true);
    });

    it('only reveals a ban to someone who knows the password', async () => {
      const user = await registerUser(ctx);
      await setStatus(ctx, user.id, 'banned');
      await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: 'wrong-password-9' }).expect(401);
      const banned = await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: user.password }).expect(403);
      expect(banned.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('lifts an expired suspension automatically', async () => {
      const user = await registerUser(ctx);
      await setStatus(ctx, user.id, 'suspended', new Date(Date.now() - 1000));
      await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: user.password }).expect(200);
    });

    it('signs in without a password using a login code', async () => {
      const user = await registerUser(ctx);
      await ctx.http.post(`${API}/auth/otp/request`).send({ target: user.phone, purpose: 'login' }).expect(200);
      const res = await ctx.http.post(`${API}/auth/login/otp`).send({ target: user.phone, code: lastCode(user.phone) }).expect(200);
      expect(res.body.data.user.id).toBe(user.id);
    });

    it('returns the refresh token in the body for mobile clients', async () => {
      const user = await registerUser(ctx);
      const res = await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: user.password, client: 'android', deviceName: 'Pixel 8' }).expect(200);
      expect(res.headers['set-cookie']).toBeUndefined();
      const refreshed = await ctx.http.post(`${API}/auth/refresh`).send({ refreshToken: res.body.data.tokens.refreshToken }).expect(200);
      expect(refreshed.body.data.tokens.refreshToken).toBeDefined();
      expect(refreshed.body.data.tokens.refreshToken).not.toBe(res.body.data.tokens.refreshToken);
    });

    it('alerts the user about a sign-in from a new device on a new network', async () => {
      const user = await registerUser(ctx, { ip: '198.51.100.10' });
      await ctx.http.post(`${API}/auth/login`).set('X-Forwarded-For', '198.51.100.77').send({ identifier: user.phone, password: user.password, deviceId: 'test-device-000001' }).expect(200);
      expect(await ctx.db.select().from(notifications).where(eq(notifications.userId, user.id))).toHaveLength(0);
      await ctx.http.post(`${API}/auth/login`).set('X-Forwarded-For', '203.0.113.5').send({ identifier: user.phone, password: user.password, deviceId: 'brand-new-device-01' }).expect(200);
      const alerts = await ctx.db.select().from(notifications).where(eq(notifications.userId, user.id));
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ type: 'security' });
      const [event] = await ctx.db.select().from(loginEvents).where(and(eq(loginEvents.userId, user.id), eq(loginEvents.suspicious, true)));
      expect(event!.suspiciousReasons).toEqual(['new_device', 'new_network']);
    });
  });

  describe('sessions', () => {
    it('rotates the refresh cookie and rejects requests without the CSRF header', async () => {
      const user = await registerUser(ctx);
      await ctx.http.post(`${API}/auth/refresh`).set('Cookie', user.cookie).expect(403);
      const res = await ctx.http.post(`${API}/auth/refresh`).set('Cookie', user.cookie).set(CSRF).expect(200);
      expect(refreshCookie(res)).not.toBe(user.cookie);
      await ctx.http.post(`${API}/auth/refresh`).set('Cookie', user.cookie).set(CSRF).set('Origin', 'https://evil.example').expect(403);
    });

    it('treats a replayed refresh token as theft and ends the session', async () => {
      const user = await registerUser(ctx);
      const rotated = await ctx.http.post(`${API}/auth/refresh`).set('Cookie', user.cookie).set(CSRF).expect(200);
      // Within the grace window a parallel tab is told to retry…
      await ctx.http.post(`${API}/auth/refresh`).set('Cookie', user.cookie).set(CSRF).expect(409);
      // …after it, the old token is a stolen one.
      await ctx.db.update(sessions).set({ lastUsedAt: sql`now() - interval '5 minutes'` }).where(eq(sessions.userId, user.id));
      await ctx.http.post(`${API}/auth/refresh`).set('Cookie', user.cookie).set(CSRF).expect(401);
      await ctx.http.post(`${API}/auth/refresh`).set('Cookie', refreshCookie(rotated)).set(CSRF).expect(401);
      await ctx.http.get(`${API}/auth/me`).set('Authorization', `Bearer ${user.accessToken}`).expect(401);
      const [session] = await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id));
      expect(session!.revokedReason).toBe('token_reuse');
    });

    it('logs out this device immediately, including the access token', async () => {
      const user = await registerUser(ctx);
      await ctx.http.post(`${API}/auth/logout`).set('Authorization', `Bearer ${user.accessToken}`).set('Cookie', user.cookie).set(CSRF).expect(200);
      await ctx.http.get(`${API}/auth/me`).set('Authorization', `Bearer ${user.accessToken}`).expect(401);
      await ctx.http.post(`${API}/auth/refresh`).set('Cookie', user.cookie).set(CSRF).expect(401);
    });

    it('lists devices and signs out all others', async () => {
      const user = await registerUser(ctx);
      const other = await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: user.password, client: 'ios', deviceName: 'iPhone' }).expect(200);
      const list = await ctx.http.get(`${API}/account/security/sessions`).set('Authorization', `Bearer ${user.accessToken}`).expect(200);
      expect(list.body.data).toHaveLength(2);
      expect(list.body.data.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
      expect(list.body.data.every((s: { ip: string }) => s.ip.endsWith('.x'))).toBe(true);
      const res = await ctx.http.post(`${API}/account/security/logout-all`).set('Authorization', `Bearer ${user.accessToken}`).send({ keepCurrent: true }).expect(200);
      expect(res.body.data.revoked).toBe(1);
      await ctx.http.get(`${API}/auth/me`).set('Authorization', `Bearer ${other.body.data.tokens.accessToken}`).expect(401);
      await ctx.http.get(`${API}/auth/me`).set('Authorization', `Bearer ${user.accessToken}`).expect(200);
    });

    it('rejects tampered and foreign tokens', async () => {
      const user = await registerUser(ctx);
      const [h, p, s] = user.accessToken.split('.');
      const payload = JSON.parse(Buffer.from(p!, 'base64url').toString());
      const forged = `${h}.${Buffer.from(JSON.stringify({ ...payload, sub: '00000000-0000-0000-0000-000000000000' })).toString('base64url')}.${s}`;
      await ctx.http.get(`${API}/auth/me`).set('Authorization', `Bearer ${forged}`).expect(401);
      const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${p}.`;
      await ctx.http.get(`${API}/auth/me`).set('Authorization', `Bearer ${none}`).expect(401);
    });
  });

  describe('passwords', () => {
    it('resets the password with a code and signs out every device', async () => {
      const user = await registerUser(ctx);
      const forgot = await ctx.http.post(`${API}/auth/password/forgot`).send({ target: user.phone }).expect(200);
      const unknown = await ctx.http.post(`${API}/auth/password/forgot`).send({ target: uniquePhone() }).expect(200);
      expect(Object.keys(forgot.body.data)).toEqual(Object.keys(unknown.body.data));
      await ctx.http.post(`${API}/auth/password/reset`).send({ target: user.phone, code: lastCode(user.phone), password: 'brand-new-pass-7' }).expect(200);
      await ctx.http.get(`${API}/auth/me`).set('Authorization', `Bearer ${user.accessToken}`).expect(401);
      await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: user.password }).expect(401);
      await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: 'brand-new-pass-7' }).expect(200);
    });

    it('changes the password only with the current one', async () => {
      const user = await registerUser(ctx);
      const auth = { Authorization: `Bearer ${user.accessToken}` };
      const wrong = await ctx.http.post(`${API}/account/security/password`).set(auth).send({ currentPassword: 'nope-nope-1', newPassword: 'another-pass-8' }).expect(400);
      expect(wrong.body.errors[0].field).toBe('currentPassword');
      await ctx.http.post(`${API}/account/security/password`).set(auth).send({ currentPassword: user.password, newPassword: user.password }).expect(400);
      await ctx.http.post(`${API}/account/security/password`).set(auth).send({ currentPassword: user.password, newPassword: 'another-pass-8' }).expect(200);
      await ctx.http.get(`${API}/auth/me`).set(auth).expect(200);
    });
  });

  describe('two-step verification', () => {
    it('requires an authenticator code after the password and blocks code replay', async () => {
      const user = await registerUser(ctx);
      const auth = { Authorization: `Bearer ${user.accessToken}` };
      const setup = await ctx.http.post(`${API}/account/security/2fa/setup`).set(auth).expect(200);
      expect(setup.body.data.qrSvg).toMatch(/^<svg/);
      expect(setup.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Boikonika:%2B8801\d{9}\?secret=[A-Z2-7]{32}&issuer=Boikonika&/);
      const secret = setup.body.data.secret as string;
      const enable = await ctx.http.post(`${API}/account/security/2fa/enable`).set(auth).send({ code: totpAt(secret, currentStep()) }).expect(200);
      const recoveryCodes = enable.body.data.recoveryCodes as string[];
      expect(recoveryCodes).toHaveLength(10);
      expect(recoveryCodes[0]).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

      const login = await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: user.password }).expect(200);
      expect(login.body.data).toMatchObject({ twoFactorRequired: true });
      expect(login.body.data.tokens).toBeUndefined();
      const challengeToken = login.body.data.challengeToken as string;
      await ctx.http.post(`${API}/auth/login/2fa`).send({ challengeToken, code: '000000' }).expect(400);
      // The code used to enable 2FA cannot be replayed.
      await ctx.http.post(`${API}/auth/login/2fa`).send({ challengeToken, code: totpAt(secret, currentStep()) }).expect(400);
      const ok = await ctx.http.post(`${API}/auth/login/2fa`).send({ challengeToken, code: totpAt(secret, currentStep() + 1) }).expect(200);
      expect(ok.body.data.user.twoFactorEnabled).toBe(true);
      // A challenge token works once.
      await ctx.http.post(`${API}/auth/login/2fa`).send({ challengeToken, code: totpAt(secret, currentStep() - 1) }).expect(401);

      const second = await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: user.password }).expect(200);
      await ctx.http.post(`${API}/auth/login/2fa`).send({ challengeToken: second.body.data.challengeToken, recoveryCode: recoveryCodes[0]!.toLowerCase() }).expect(200);
      const third = await ctx.http.post(`${API}/auth/login`).send({ identifier: user.phone, password: user.password }).expect(200);
      await ctx.http.post(`${API}/auth/login/2fa`).send({ challengeToken: third.body.data.challengeToken, recoveryCode: recoveryCodes[0] }).expect(400);
    });
  });

  describe('Google sign-in', () => {
    it('creates an account from a verified Google token and links it on the next sign-in', async () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      ctx.app.get(GoogleIdTokenVerifier).setKeysForTesting(new Map([['test-kid', publicKey]]));
      const now = Math.floor(Date.now() / 1000);
      const token = (claims: Record<string, unknown>) => {
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'test-google-client-id.apps.googleusercontent.com', sub: 'g-123', email: 'Reader@Example.com', email_verified: true, name: 'Google Reader', iat: now, exp: now + 3600, ...claims })).toString('base64url');
        const signature = createSign('RSA-SHA256').update(`${header}.${body}`).sign(privateKey).toString('base64url');
        return `${header}.${body}.${signature}`;
      };
      const first = await ctx.http.post(`${API}/auth/google`).send({ idToken: token({}) }).expect(200);
      expect(first.body.data.user).toMatchObject({ email: 'reader@example.com', emailVerified: true, hasPassword: false, displayName: 'Google Reader' });
      const again = await ctx.http.post(`${API}/auth/google`).send({ idToken: token({}) }).expect(200);
      expect(again.body.data.user.id).toBe(first.body.data.user.id);
      await ctx.http.post(`${API}/auth/google`).send({ idToken: token({ aud: 'someone-else' }) }).expect(401);
      await ctx.http.post(`${API}/auth/google`).send({ idToken: token({ exp: now - 3600 }) }).expect(401);
      await ctx.http.post(`${API}/auth/google`).send({ idToken: token({ email_verified: false }) }).expect(400);
    });
  });

  describe('roles and permissions', () => {
    it('protects admin endpoints and prevents privilege escalation', async () => {
      const superAdmin = await registerUser(ctx);
      const admin = await registerUser(ctx);
      const member = await registerUser(ctx);
      await grantRole(ctx, superAdmin.id, 'super_admin');
      await grantRole(ctx, admin.id, 'admin');
      const as = (u: { accessToken: string }) => ({ Authorization: `Bearer ${u.accessToken}` });

      await ctx.http.get(`${API}/admin/roles`).set(as(member)).expect(403);
      const roles = await ctx.http.get(`${API}/admin/roles`).set(as(admin)).expect(200);
      expect(roles.body.data.find((r: { key: string }) => r.key === 'super_admin').permissions).toContain('settings.manage');

      // Admins cannot create admins, change their own roles or edit role permissions.
      await ctx.http.post(`${API}/admin/users/${member.id}/roles`).set(as(admin)).send({ role: 'admin' }).expect(403);
      await ctx.http.post(`${API}/admin/users/${admin.id}/roles`).set(as(admin)).send({ role: 'moderator' }).expect(403);
      await ctx.http.put(`${API}/admin/roles/moderator/permissions`).set(as(admin)).send({ permissions: ['users.view'] }).expect(403);
      // Seller roles need an approved identity verification.
      const kyc = await ctx.http.post(`${API}/admin/users/${member.id}/roles`).set(as(admin)).send({ role: 'book_seller' }).expect(403);
      expect(kyc.body.code).toBe('KYC_REQUIRED');

      await ctx.http.post(`${API}/admin/users/${member.id}/roles`).set(as(admin)).send({ role: 'moderator' }).expect(200);
      const memberRoles = await ctx.db.select().from(userRoles).where(eq(userRoles.userId, member.id));
      expect(memberRoles.map((r) => r.role).sort()).toEqual(['customer', 'moderator']);
      const me = await ctx.http.get(`${API}/auth/me`).set(as(member)).expect(200);
      expect(me.body.data.permissions).toContain('reports.resolve');
      expect(me.body.data.permissions).not.toContain('users.ban');

      // A per-user deny wins over the role grant, immediately.
      await ctx.http.put(`${API}/admin/users/${member.id}/permissions`).set(as(superAdmin)).send({ permission: 'reports.resolve', granted: false }).expect(200);
      const after = await ctx.http.get(`${API}/auth/me`).set(as(member)).expect(200);
      expect(after.body.data.permissions).not.toContain('reports.resolve');

      // The last super admin stays.
      const last = await ctx.http.delete(`${API}/admin/users/${superAdmin.id}/roles/super_admin`).set(as(superAdmin)).expect(403);
      expect(last.body.code).toBe('FORBIDDEN');
      await grantRole(ctx, admin.id, 'super_admin');
      await ctx.http.delete(`${API}/admin/users/${superAdmin.id}/roles/super_admin`).set(as(admin)).expect(200);
      const audit = await ctx.db.execute<{ action: string }>(sql`select action from audit_logs where entity_id = ${superAdmin.id} order by id`);
      expect(audit.rows.map((r) => r.action)).toContain('user.role.revoke');
    });
  });

  it('answers in Bangla when asked', async () => {
    const res = await ctx.http.post(`${API}/auth/login`).set('Accept-Language', 'bn-BD,bn;q=0.9').send({ identifier: uniquePhone(), password: 'whatever-1' }).expect(401);
    expect(res.body.message).toBe('ইমেইল, মোবাইল নম্বর, ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।');
    expect(res.headers['content-language']).toBe('bn');
  });
});

function toBangla(digits: string): string {
  return digits.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);
}
