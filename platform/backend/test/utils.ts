import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { seedReference, userRoles, users, type Database } from '@boikonika/database';
import type { Role } from '@boikonika/shared';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { APP_CONFIG, type AppConfig } from '../src/config/config.module';
import { DB } from '../src/infra/database/database.module';
import { CapturedMessages } from '../src/infra/messaging/drivers';
import { REDIS } from '../src/infra/redis/redis.module';

export interface TestContext {
  app: NestExpressApplication;
  http: ReturnType<typeof request>;
  db: Database;
  redis: Redis;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  return { app, http: request(app.getHttpServer()), db: app.get(DB), redis: app.get(REDIS) };
}

/** Removes users (cascading to sessions, codes, roles…), message history and Redis state between suites. */
export async function resetState(ctx: TestContext): Promise<void> {
  // Writes the previous test started in the background (login events, notifications) can still be
  // finishing; TRUNCATE then loses a lock race with them, so it is retried instead of failing the test.
  for (let attempt = 1; ; attempt++) {
    try {
      await ctx.db.execute(sql`truncate users, otp_codes, outbound_messages, login_events, audit_logs, notifications, books, authors, publishers, search_queries restart identity cascade`);
      break;
    } catch (error) {
      const code = (error as { cause?: { code?: string } }).cause?.code;
      if (code !== '40P01' || attempt === 3) throw error;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  // TRUNCATE … CASCADE also empties reference tables that point at users (settings, homepage
  // sections, challenges…), so the idempotent reference seed is applied again.
  await seedReference(ctx.db);
  await ctx.redis.flushdb();
  CapturedMessages.clear();
}

/** The newest 6-digit code sent to a phone number or email address. */
export function lastCode(to: string): string {
  const message = CapturedMessages.list(to)[0];
  const code = message?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`No code was sent to ${to}: ${JSON.stringify(CapturedMessages.list(to))}`);
  return code;
}

let counter = 0;
/** A unique, valid Bangladeshi mobile number per call. */
export function uniquePhone(): string {
  counter += 1;
  return `+88017${String(Date.now() % 1_000_000).padStart(6, '0').slice(0, 4)}${String(counter).padStart(4, '0')}`;
}

export interface RegisteredUser {
  id: string;
  phone: string;
  password: string;
  accessToken: string;
  cookie: string;
}

/** Registers through the real API (OTP → register) and returns the session. */
export async function registerUser(ctx: TestContext, overrides: { phone?: string; password?: string; name?: string; ip?: string } = {}): Promise<RegisteredUser> {
  const phone = overrides.phone ?? uniquePhone();
  const password = overrides.password ?? 'boi-test-2026';
  const ip = overrides.ip ?? '198.51.100.10';
  await ctx.http.post('/api/v1/auth/otp/request').set('X-Forwarded-For', ip).send({ target: phone, purpose: 'register' }).expect(200);
  const res = await ctx.http
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', ip)
    .send({ name: overrides.name ?? 'Test Reader', target: phone, code: lastCode(phone), password, acceptTerms: true, deviceId: 'test-device-000001' })
    .expect(201);
  return { id: res.body.data.user.id, phone, password, accessToken: res.body.data.tokens.accessToken, cookie: refreshCookie(res) };
}

export function refreshCookie(res: request.Response): string {
  const header = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = header.find((c) => c.startsWith('bk_refresh=') && !c.startsWith('bk_refresh=;'));
  if (!cookie) throw new Error('No refresh cookie set');
  return cookie.split(';')[0]!;
}

export async function grantRole(ctx: TestContext, userId: string, role: Role): Promise<void> {
  await ctx.db.insert(userRoles).values({ userId, role }).onConflictDoNothing();
  await ctx.redis.del(`rbac:perm:${userId}`);
}

export async function setStatus(ctx: TestContext, userId: string, status: 'active' | 'suspended' | 'banned', suspendedUntil?: Date): Promise<void> {
  await ctx.db.update(users).set({ status, suspendedUntil: suspendedUntil ?? null }).where(sql`${users.id} = ${userId}`);
}

/** A user who went through the real verification flow and was approved for `role`. */
export async function approvedSeller(
  ctx: TestContext,
  admin: RegisteredUser,
  role: 'book_seller' | 'general_seller' | 'publisher' | 'author',
  businessName = 'টেস্ট বুক হাউস',
): Promise<RegisteredUser> {
  const { photoWithExif } = await import('./images');
  const user = await registerUser(ctx, { name: 'Seller Person' });
  const purpose = role === 'book_seller' || role === 'general_seller' ? 'seller' : role;
  const documents = role === 'publisher' ? [{ type: 'nid', side: 'front', number: '1990123456789' }, { type: 'trade_license', side: 'single', number: 'TRAD-12345' }] : [{ type: 'nid', side: 'front', number: '1990123456789' }];
  let req = ctx.http
    .post('/api/v1/kyc/verifications')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .field('data', JSON.stringify({ purpose, requestedRole: role, legalName: 'Seller Person', businessName, documents, declarations: { accurate: true, authorised: true } }));
  for (let i = 0; i < documents.length; i++) req = req.attach('documents', await photoWithExif(), { filename: `doc${i}.jpg` });
  const submitted = await req;
  if (submitted.status !== 201) throw new Error(`KYC submit failed: ${JSON.stringify(submitted.body)}`);
  await ctx.http.post(`/api/v1/admin/kyc/${submitted.body.data.id}/approve`).set('Authorization', `Bearer ${admin.accessToken}`).send({}).expect(200);
  await ctx.redis.del(`rbac:perm:${user.id}`);
  return user;
}

export async function categoryId(ctx: TestContext, path: string): Promise<string> {
  const rows = await ctx.db.execute<{ id: string }>(sql`select id from categories where path = ${path}`);
  if (!rows.rows[0]) throw new Error(`No category ${path} — is the reference seed loaded?`);
  return rows.rows[0].id;
}
