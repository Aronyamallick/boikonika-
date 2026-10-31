import { base32Decode, base32Encode, generateTotpSecret, otpauthUrl, totpAt, verifyTotp } from './totp';

// RFC 6238 Appendix B, SHA-1 key "12345678901234567890" (8-digit values truncated to our 6 digits).
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ])('time %i → %s', (seconds, expected) => {
    expect(totpAt(RFC_SECRET, Math.floor(seconds / 30))).toBe(expected);
  });

  it('round-trips base32', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(RFC_SECRET).toString()).toBe('12345678901234567890');
  });

  it('accepts one step of clock drift and returns the matched step', () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step), now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 2), now)).toBeNull();
  });

  it('generates 160-bit secrets and a standard key URI', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUrl(secret, 'reader@example.com')).toBe(`otpauth://totp/Boikonika:reader%40example.com?secret=${secret}&issuer=Boikonika&algorithm=SHA1&digits=6&period=30`);
  });
});
