import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';

const VERSION = 'v1';

/**
 * Encryption and hashing primitives. Sensitive columns (document numbers, payout accounts, 2FA
 * secrets) are AES-256-GCM encrypted with DATA_ENCRYPTION_KEY; one-time codes are HMAC'd with a key
 * derived from it, so a database leak alone does not reveal them.
 */
@Injectable()
export class CryptoService {
  private readonly dataKey: Buffer;
  private readonly hmacKey: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const key = Buffer.from(config.DATA_ENCRYPTION_KEY, 'base64');
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes');
    this.dataKey = key;
    this.hmacKey = Buffer.from(hkdfSync('sha256', key, Buffer.alloc(0), Buffer.from('boikonika:hmac:v1'), 32));
  }

  /** "v1.<iv>.<ciphertext>.<tag>" (base64url parts). */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.dataKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
  }

  decrypt(payload: string): string {
    const [version, iv, ciphertext, tag] = payload.split('.');
    if (version !== VERSION || !iv || ciphertext === undefined || !tag) throw new Error('Unsupported ciphertext format');
    const decipher = createDecipheriv('aes-256-gcm', this.dataKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  }

  /** Keyed hash for low-entropy secrets (OTP codes, recovery codes). Hex, 64 chars. */
  hmac(value: string): string {
    return createHmac('sha256', this.hmacKey).update(value).digest('hex');
  }

  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /** URL-safe random token with `bytes` bytes of entropy. */
  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /** Uniformly random numeric code, e.g. "042917". */
  numericCode(digits = 6): string {
    return String(randomInt(0, 10 ** digits)).padStart(digits, '0');
  }

  safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
