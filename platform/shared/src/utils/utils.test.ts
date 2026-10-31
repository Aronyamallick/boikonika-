import { addMoney, allocateMinor, discountPercent, formatMoney, fromMinor, multiplyMoney, percentOf, toMinor } from './money';
import { formatBdPhone, normalizeBdPhone } from './phone';
import { isValidIsbn10, isValidIsbn13, toIsbn13 } from './isbn';
import { toBanglaDigits, toEnglishDigits } from './bangla';
import { slugify } from './slug';
import { BD_DIVISIONS, BD_DISTRICT_KEYS, isDistrictInDivision } from '../constants/bangladesh';

describe('money', () => {
  it('converts without floating point drift', () => {
    expect(toMinor('0.1')).toBe(10);
    expect(addMoney('0.1', '0.2')).toBe('0.30');
    expect(fromMinor(-1205)).toBe('-12.05');
    expect(multiplyMoney('19.99', 3)).toBe('59.97');
  });
  it('rejects malformed amounts', () => {
    expect(() => toMinor('12.345')).toThrow();
    expect(() => toMinor('abc')).toThrow();
  });
  it('computes percentages rounded to the poisha', () => {
    expect(percentOf('199.99', 12.5)).toBe('25.00');
    expect(percentOf('100', 7.25)).toBe('7.25');
  });
  it('formats BDT with lakh grouping and Bangla digits', () => {
    expect(formatMoney('1234567.5', 'en')).toBe('৳12,34,567.50');
    expect(formatMoney('1250', 'bn')).toBe('৳১,২৫০.০০');
    expect(formatMoney('300', 'en', { hideZeroDecimals: true })).toBe('৳300');
  });
  it('allocates a total across weights without losing a poisha', () => {
    expect(allocateMinor(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocateMinor(5000, [30000, 10000])).toEqual([3750, 1250]);
    expect(allocateMinor(7, [0, 0])).toEqual([7, 0]);
    const parts = allocateMinor(9999, [123, 4567, 89, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(9999);
  });
  it('computes discount percentage', () => {
    expect(discountPercent('400.00', '500.00')).toBe(20);
    expect(discountPercent('500.00', '400.00')).toBe(0);
    expect(discountPercent('500.00', null)).toBe(0);
  });
});

describe('phone', () => {
  it('normalises Bangladeshi mobile numbers', () => {
    expect(normalizeBdPhone('01712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('+880 1712-345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('০১৮১২৩৪৫৬৭৮')).toBe('+8801812345678');
    expect(normalizeBdPhone('01212345678')).toBeNull();
    expect(normalizeBdPhone('0171234567')).toBeNull();
  });
  it('formats and masks', () => {
    expect(formatBdPhone('+8801712345678')).toBe('01712-345678');
    expect(formatBdPhone('+8801712345678', true)).toBe('017****5678');
  });
});

describe('isbn', () => {
  it('validates ISBN-10 and ISBN-13', () => {
    expect(isValidIsbn10('0-306-40615-2')).toBe(true);
    expect(isValidIsbn10('0306406153')).toBe(false);
    expect(isValidIsbn13('978-0-306-40615-7')).toBe(true);
    expect(isValidIsbn13('9780306406158')).toBe(false);
  });
  it('canonicalises to ISBN-13', () => {
    expect(toIsbn13('0306406152')).toBe('9780306406157');
    expect(toIsbn13('৯৭৮০৩০৬৪০৬১৫৭')).toBe('9780306406157');
    expect(toIsbn13('123')).toBeNull();
  });
});

describe('bangla + slug', () => {
  it('converts digits both ways', () => {
    expect(toBanglaDigits('2024')).toBe('২০২৪');
    expect(toEnglishDigits('২০২৪')).toBe('2024');
  });
  it('keeps Bangla letters in slugs', () => {
    expect(slugify('আমার বই: প্রথম খণ্ড')).toBe('আমার-বই-প্রথম-খণ্ড');
    expect(slugify('Harry Potter & the Stone!')).toBe('harry-potter-the-stone');
    expect(slugify('!!!')).toBe('item');
  });
});

describe('bangladesh locations', () => {
  it('has 8 divisions and 64 districts', () => {
    expect(BD_DIVISIONS).toHaveLength(8);
    expect(BD_DISTRICT_KEYS).toHaveLength(64);
    expect(new Set(BD_DISTRICT_KEYS).size).toBe(64);
  });
  it('checks district membership', () => {
    expect(isDistrictInDivision('dhaka', 'gazipur')).toBe(true);
    expect(isDistrictInDivision('sylhet', 'gazipur')).toBe(false);
  });
});
