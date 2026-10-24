import { Inject, Injectable, Logger } from '@nestjs/common';
import { sessions, type Database, type DbOrTx } from '@boikonika/database';
import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import type { CookieOptions, Response } from 'express';
import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/errors/app-exception';
import { requestContext } from '../../common/context/request-context';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';

export const REFRESH_COOKIE = 'bk_refresh';
/** Non-secret companion cookie readable by scripts: tells the web app a session exists, so it only tries a silent refresh when it can succeed. */
export const SESSION_HINT_COOKIE = 'bk_session';
/** Concurrent refreshes (two tabs) within this window are told to retry instead of being treated as theft. */
const ROTATION_GRACE_MS = 30_000;
/** A session can be refreshed for at most this long after sign-in, even when used every day. */
const ABSOLUTE_LIFETIME_DAYS = 90;
/** Sessions that are not "remembered" end after this long. */
const SHORT_SESSION_HOURS = 12;

export interface DeviceInfo {
  deviceName?: string;
  deviceId?: string;
  client: 'web' | 'android' | 'ios';
  rememberDevice: boolean;
}

export type SessionRow = typeof sessions.$inferSelect;

/**
 * Refresh-token sessions, one per signed-in device. The refresh token is random (256 bit), stored only
 * as SHA-256, and rotated on every use; presenting an already-rotated token outside the grace window
 * means it was stolen, so the session is revoked. Revocations are mirrored to Redis so the auth guard
 * can reject access tokens of revoked sessions immediately.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger('Sessions');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly crypto: CryptoService,
  ) {}

  async create(userId: string, device: DeviceInfo, twoFactorVerified: boolean, tx: DbOrTx = this.db): Promise<{ session: SessionRow; refreshToken: string }> {
    const ctx = requestContext.get();
    const refreshToken = this.crypto.randomToken(32);
    const id = randomUUID();
    const [session] = await tx
      .insert(sessions)
      .values({
        id,
        userId,
        familyId: id,
        refreshTokenHash: this.crypto.sha256(refreshToken),
        deviceName: device.deviceName?.slice(0, 160) || describeUserAgent(ctx?.userAgent),
        platform: device.client,
        userAgent: ctx?.userAgent ?? null,
        ip: ctx?.ip ?? null,
        deviceFingerprint: device.deviceId ? this.crypto.sha256(`device:${device.deviceId}`) : null,
        twoFactorVerified,
        persistent: device.rememberDevice,
        expiresAt: this.expiryFor(device.rememberDevice),
      })
      .returning();
    return { session: session!, refreshToken };
  }

  /** Exchanges a refresh token for a new one (rotation). */
  async rotate(refreshToken: string): Promise<{ session: SessionRow; refreshToken: string }> {
    const hash = this.crypto.sha256(refreshToken);
    const [current] = await this.db.select().from(sessions).where(eq(sessions.refreshTokenHash, hash)).limit(1);
    if (current) {
      this.assertUsable(current);
      const next = this.crypto.randomToken(32);
      const absoluteEnd = current.createdAt.getTime() + ABSOLUTE_LIFETIME_DAYS * 86_400_000;
      const slidingEnd = this.expiryFor(current.persistent).getTime();
      const [rotated] = await this.db
        .update(sessions)
        .set({
          previousTokenHash: hash,
          refreshTokenHash: this.crypto.sha256(next),
          lastUsedAt: new Date(),
          expiresAt: new Date(Math.min(absoluteEnd, slidingEnd)),
          ip: requestContext.get()?.ip ?? current.ip,
        })
        .where(and(eq(sessions.id, current.id), eq(sessions.refreshTokenHash, hash), isNull(sessions.revokedAt)))
        .returning();
      if (rotated) return { session: rotated, refreshToken: next };
      // Lost a race with a concurrent refresh of the same token.
      throw new AppException('CONFLICT', 'api.auth.refreshInProgress');
    }

    const [previous] = await this.db.select().from(sessions).where(eq(sessions.previousTokenHash, hash)).limit(1);
    if (previous && !previous.revokedAt) {
      if (Date.now() - previous.lastUsedAt.getTime() < ROTATION_GRACE_MS) throw new AppException('CONFLICT', 'api.auth.refreshInProgress');
      this.logger.warn(`Refresh token reuse detected for session ${previous.id} (user ${previous.userId}) — revoking`);
      await this.revoke(previous.id, 'token_reuse');
    }
    throw new AppException('UNAUTHORIZED', 'api.auth.sessionExpired');
  }

  async findByRefreshToken(refreshToken: string): Promise<SessionRow | undefined> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.refreshTokenHash, this.crypto.sha256(refreshToken))).limit(1);
    return row;
  }

  async get(sessionId: string): Promise<SessionRow | undefined> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    return row;
  }

  async listActive(userId: string): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, sql`now()`)))
      .orderBy(desc(sessions.lastUsedAt));
  }

  /** Whether an access token's session is still valid (Redis first, PostgreSQL as the source of truth). */
  async isActive(sessionId: string): Promise<boolean> {
    try {
      const cached = await this.redis.get(`sess:${sessionId}`);
      if (cached) return cached === 'active';
    } catch {
      // Redis down: fall through to the database.
    }
    const [row] = await this.db.select({ revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    const active = !!row && !row.revokedAt && row.expiresAt.getTime() > Date.now();
    await this.redis.set(`sess:${sessionId}`, active ? 'active' : 'revoked', 'EX', active ? 60 : this.config.JWT_ACCESS_TTL_SECONDS + 60).catch(() => undefined);
    return active;
  }

  async revoke(sessionId: string, reason: string, tx: DbOrTx = this.db): Promise<boolean> {
    const rows = await tx
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    await this.markRevoked([sessionId]);
    return rows.length > 0;
  }

  /** Signs the user out everywhere (optionally keeping one session, e.g. the current device). */
  async revokeAll(userId: string, reason: string, exceptSessionId?: string, tx: DbOrTx = this.db): Promise<number> {
    const rows = await tx
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined))
      .returning({ id: sessions.id });
    await this.markRevoked(rows.map((r) => r.id));
    return rows.length;
  }

  /** Seen this device (fingerprint) or network before in a successful sign-in? */
  async knownDevice(userId: string, fingerprint: string | null): Promise<boolean> {
    if (!fingerprint) return false;
    const [row] = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.deviceFingerprint, fingerprint)))
      .limit(1);
    return !!row;
  }

  /** Persistent sessions get a dated cookie; others a browser-session cookie that ends with the browser. */
  setRefreshCookie(res: Response, token: string, session: SessionRow): void {
    const lifetime = session.persistent ? { expires: session.expiresAt } : {};
    res.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions(), ...lifetime });
    res.cookie(SESSION_HINT_COOKIE, '1', { ...this.hintCookieOptions(), ...lifetime });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    res.clearCookie(SESSION_HINT_COOKIE, this.hintCookieOptions());
  }

  private hintCookieOptions(): CookieOptions {
    return { httpOnly: false, secure: this.config.COOKIE_SECURE, sameSite: 'lax', path: '/', domain: this.config.COOKIE_DOMAIN || undefined };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/api/v1/auth',
      domain: this.config.COOKIE_DOMAIN || undefined,
    };
  }

  private expiryFor(remember: boolean): Date {
    return new Date(Date.now() + (remember ? this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000 : SHORT_SESSION_HOURS * 3600_000));
  }

  private assertUsable(session: SessionRow): void {
    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw new AppException('UNAUTHORIZED', 'api.auth.sessionExpired');
  }

  private async markRevoked(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const pipeline = this.redis.pipeline();
    for (const id of ids) pipeline.set(`sess:${id}`, 'revoked', 'EX', this.config.JWT_ACCESS_TTL_SECONDS + 60);
    await pipeline.exec().catch(() => undefined);
  }
}

/** "Chrome on Windows", "Safari on iPhone" — a readable default device name from the User-Agent. */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /okhttp|Expo|Boikonika/i.test(ua) ? 'Boikonika app' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}
