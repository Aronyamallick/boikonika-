import { Inject, Injectable, Logger } from '@nestjs/common';
import { createPublicKey, verify as verifySignature, type JsonWebKey, type KeyObject } from 'node:crypto';
import { AppException } from '../../common/errors/app-exception';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_SECONDS = 60;

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  locale: string | null;
}

/**
 * Verifies Google Sign-In ID tokens (web, Android and iOS clients) against Google's published keys:
 * RS256 signature, issuer, audience (one of GOOGLE_CLIENT_IDS) and expiry. Keys are cached according
 * to Google's Cache-Control header.
 */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly logger = new Logger('GoogleAuth');
  private keys = new Map<string, KeyObject>();
  private keysExpireAt = 0;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get enabled(): boolean {
    return this.config.GOOGLE_CLIENT_IDS.length > 0;
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    if (!this.enabled) throw new AppException('SERVICE_UNAVAILABLE', 'api.auth.googleNotConfigured');
    const parts = idToken.split('.');
    if (parts.length !== 3) throw this.invalid();
    let header: { alg?: string; kid?: string };
    let payload: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
    } catch {
      throw this.invalid();
    }
    if (header.alg !== 'RS256' || !header.kid) throw this.invalid();
    const key = await this.key(header.kid);
    const valid = verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2]!, 'base64url'));
    if (!valid) throw this.invalid();

    const now = Math.floor(Date.now() / 1000);
    const aud = payload.aud as string | undefined;
    if (!ISSUERS.has(String(payload.iss)) || !aud || !this.config.GOOGLE_CLIENT_IDS.includes(aud)) throw this.invalid();
    if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < now) throw this.invalid();
    if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW_SECONDS > now) throw this.invalid();
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw this.invalid();
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!emailVerified) throw new AppException('BAD_REQUEST', 'api.auth.googleEmailUnverified');
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified,
      name: typeof payload.name === 'string' ? payload.name : null,
      picture: typeof payload.picture === 'string' ? payload.picture : null,
      locale: typeof payload.locale === 'string' ? payload.locale : null,
    };
  }

  private async key(kid: string): Promise<KeyObject> {
    if (Date.now() >= this.keysExpireAt || !this.keys.has(kid)) await this.refreshKeys();
    const key = this.keys.get(kid);
    if (!key) throw this.invalid();
    return key;
  }

  private async refreshKeys(): Promise<void> {
    try {
      const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { keys: Array<JsonWebKey & { kid: string }> };
      this.keys = new Map(body.keys.map((jwk) => [jwk.kid, createPublicKey({ key: jwk, format: 'jwk' })]));
      const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1];
      this.keysExpireAt = Date.now() + (maxAge ? Number(maxAge) * 1000 : 3600_000);
    } catch (error) {
      this.logger.error(`Could not load Google signing keys: ${(error as Error).message}`);
      throw new AppException('SERVICE_UNAVAILABLE', 'api.auth.googleNotConfigured');
    }
  }

  /** Test hook: install keys directly (used by the e2e suite with a locally generated key pair). */
  setKeysForTesting(keys: Map<string, KeyObject>): void {
    this.keys = keys;
    this.keysExpireAt = Date.now() + 3600_000;
  }

  private invalid(): AppException {
    return new AppException('UNAUTHORIZED', 'api.auth.googleInvalid');
  }
}
