import { Inject, Injectable } from '@nestjs/common';
import { createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';

const ISSUER = 'boikonika';
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export interface AccessClaims {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
}

export interface ChallengeClaims {
  sub: string;
  jti: string;
  exp: number;
  /** Sign-in method that passed the first factor (password, otp, google). */
  method: string;
  device: { deviceName?: string; deviceId?: string; client: string; rememberDevice: boolean };
}

type Verified<T> = { ok: true; claims: T } | { ok: false; reason: 'invalid' | 'expired' };

/**
 * Compact HS256 JWTs. Access tokens and 2FA challenge tokens use different keys derived from
 * JWT_ACCESS_SECRET and different audiences, so one can never be used as the other. Only HS256 is
 * accepted (no algorithm negotiation).
 */
@Injectable()
export class TokenService {
  private readonly accessKey: Buffer;
  private readonly challengeKey: Buffer;
  readonly accessTtlSeconds: number;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const secret = Buffer.from(config.JWT_ACCESS_SECRET);
    this.accessKey = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), Buffer.from('boikonika:jwt:access'), 32));
    this.challengeKey = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), Buffer.from('boikonika:jwt:2fa'), 32));
    this.accessTtlSeconds = config.JWT_ACCESS_TTL_SECONDS;
  }

  signAccess(userId: string, sessionId: string): { token: string; expiresIn: number } {
    const now = Math.floor(Date.now() / 1000);
    const token = this.sign({ iss: ISSUER, aud: 'boikonika:api', sub: userId, sid: sessionId, iat: now, exp: now + this.accessTtlSeconds }, this.accessKey);
    return { token, expiresIn: this.accessTtlSeconds };
  }

  verifyAccess(token: string): Verified<AccessClaims> {
    return this.verify<AccessClaims>(token, this.accessKey, 'boikonika:api');
  }

  signChallenge(claims: Omit<ChallengeClaims, 'jti' | 'exp'>, ttlSeconds = 300): { token: string; jti: string; expiresIn: number } {
    const now = Math.floor(Date.now() / 1000);
    const jti = randomUUID();
    const token = this.sign({ iss: ISSUER, aud: 'boikonika:2fa', ...claims, jti, iat: now, exp: now + ttlSeconds }, this.challengeKey);
    return { token, jti, expiresIn: ttlSeconds };
  }

  verifyChallenge(token: string): Verified<ChallengeClaims> {
    return this.verify<ChallengeClaims>(token, this.challengeKey, 'boikonika:2fa');
  }

  private sign(payload: Record<string, unknown>, key: Buffer): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', key).update(`${HEADER}.${body}`).digest('base64url');
    return `${HEADER}.${body}.${signature}`;
  }

  private verify<T extends { exp: number }>(token: string, key: Buffer, audience: string): Verified<T> {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== HEADER) return { ok: false, reason: 'invalid' };
    const expected = createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest();
    const given = Buffer.from(parts[2]!, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'invalid' };
    let claims: T & { iss?: string; aud?: string };
    try {
      claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
    } catch {
      return { ok: false, reason: 'invalid' };
    }
    if (claims.iss !== ISSUER || claims.aud !== audience || typeof claims.exp !== 'number') return { ok: false, reason: 'invalid' };
    if (claims.exp <= Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
    return { ok: true, claims };
  }
}
