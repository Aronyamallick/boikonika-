import { negotiateLocale, translate } from '../i18n';
import { loginSchema, registerSchema, twoFactorLoginSchema } from './auth';
import { parseIdentifier } from '../validation/fields';
import { contactSchema, emailSchema, identifierSchema, otpCodeSchema, passwordSchema, usernameSchema } from './common';

describe('identifier parsing', () => {
  it.each([
    ['Reader@Example.COM ', { kind: 'email', value: 'reader@example.com' }],
    ['01712-345678', { kind: 'phone', value: '+8801712345678' }],
    ['+880 1912 345678', { kind: 'phone', value: '+8801912345678' }],
    ['০১৭১২৩৪৫৬৭৮', { kind: 'phone', value: '+8801712345678' }],
    ['Rahim.Reads', { kind: 'username', value: 'rahim.reads' }],
  ])('%s', (input, expected) => {
    expect(parseIdentifier(input)).toEqual(expected);
  });

  it.each(['', '01212345678', 'a@b', 'x', 'has space'])('rejects %p', (input) => {
    expect(parseIdentifier(input)).toBeNull();
  });

  it('contact excludes usernames and reports an i18n key', () => {
    const result = contactSchema.safeParse('rahim.reads');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.identifier');
    expect(identifierSchema.parse('rahim.reads')).toEqual({ kind: 'username', value: 'rahim.reads' });
  });
});

describe('field schemas', () => {
  it('normalises email', () => expect(emailSchema.parse('  A@B.Co ')).toBe('a@b.co'));
  it('accepts Bangla digits in OTP codes', () => expect(otpCodeSchema.parse('১২৩ ৪৫৬')).toBe('123456'));
  it('rejects short OTP codes', () => expect(otpCodeSchema.safeParse('12345').success).toBe(false));
  it.each(['password', '12345678', 'short1'])('rejects weak password %p', (pw) => expect(passwordSchema.safeParse(pw).success).toBe(false));
  it.each(['boi2026pass', 'বইপড়া১২৩৪৫'])('accepts password %p', (pw) => expect(passwordSchema.safeParse(pw).success).toBe(true));
  it.each(['.dot', 'trailing_', 'double..dot', 'ab', '0171234'])('rejects username %p', (u) => expect(usernameSchema.safeParse(u).success).toBe(false));
});

describe('auth schemas', () => {
  it('requires accepting the terms', () => {
    const result = registerSchema.safeParse({ name: 'Rahim', target: '01712345678', code: '123456', password: 'boi2026pass', acceptTerms: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain('validation.acceptTerms');
  });

  it('applies device defaults', () => {
    const parsed = loginSchema.parse({ identifier: 'reader@example.com', password: 'x' });
    expect(parsed).toMatchObject({ client: 'web', rememberDevice: true });
  });

  it('needs exactly one of code / recovery code for 2FA', () => {
    expect(twoFactorLoginSchema.safeParse({ challengeToken: 'x'.repeat(30) }).success).toBe(false);
    expect(twoFactorLoginSchema.safeParse({ challengeToken: 'x'.repeat(30), code: '123456', recoveryCode: 'ABCD-1234' }).success).toBe(false);
    expect(twoFactorLoginSchema.safeParse({ challengeToken: 'x'.repeat(30), recoveryCode: 'abcd1234' }).success).toBe(true);
  });
});

describe('server-side i18n', () => {
  it('translates keys with params and passes unknown text through', () => {
    expect(translate('en', 'api.auth.otpCooldown', { seconds: 42 })).toBe('Please wait 42 seconds before requesting another code.');
    expect(translate('bn', 'api.auth.otpInvalid')).toBe('কোডটি সঠিক নয়।');
    expect(translate('en', 'Plain sentence')).toBe('Plain sentence');
  });

  it.each([
    ['en-US,en;q=0.9', 'en'],
    ['bn-BD,bn;q=0.9,en;q=0.8', 'bn'],
    ['fr-FR,en;q=0.5', 'en'],
    ['fr', 'bn'],
    [undefined, 'bn'],
  ])('negotiates %p → %s', (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });
});
