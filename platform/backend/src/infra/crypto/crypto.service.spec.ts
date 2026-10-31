import type { AppConfig } from '../../config/config.module';
import { CryptoService } from './crypto.service';

const crypto = new CryptoService({ DATA_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=' } as AppConfig);

describe('CryptoService', () => {
  it('encrypts with a fresh IV each time and decrypts', () => {
    const a = crypto.encrypt('1990123456789');
    const b = crypto.encrypt('1990123456789');
    expect(a).not.toBe(b);
    expect(a.startsWith('v1.')).toBe(true);
    expect(crypto.decrypt(a)).toBe('1990123456789');
  });

  it('detects tampering', () => {
    const [v, iv, data, tag] = crypto.encrypt('secret').split('.');
    const flipped = Buffer.from(data!, 'base64url');
    flipped[0] = flipped[0]! ^ 1;
    expect(() => crypto.decrypt([v, iv, flipped.toString('base64url'), tag].join('.'))).toThrow();
  });

  it('refuses keys that are not 32 bytes', () => {
    expect(() => new CryptoService({ DATA_ENCRYPTION_KEY: Buffer.from('short').toString('base64') } as AppConfig)).toThrow(/32 bytes/);
  });

  it('produces keyed hashes and uniform numeric codes', () => {
    expect(crypto.hmac('123456')).toMatch(/^[0-9a-f]{64}$/);
    expect(crypto.hmac('123456')).not.toBe(crypto.sha256('123456'));
    const codes = Array.from({ length: 200 }, () => crypto.numericCode(6));
    expect(codes.every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(190);
  });
});
