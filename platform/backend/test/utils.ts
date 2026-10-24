import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { userRoles, users, type Database } from '@boikonika/database';
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
  await ctx.db.execute(sql`truncate users, otp_codes, outbound_messages, login_events, audit_logs, notifications restart identity cascade`);
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
