import { contentRisk, HOLD_THRESHOLD } from './content-risk';

const base = { accountAgeHours: 24 * 30, recentCount: 0 };

describe('contentRisk', () => {
  it('lets ordinary Bangla and English posts through', () => {
    expect(contentRisk({ ...base, text: 'পথের পাঁচালী পড়ে অপুর জন্য মন খারাপ হলো। Highly recommended!' })).toBeLessThan(HOLD_THRESHOLD);
    expect(contentRisk({ ...base, text: 'Read chapter 3 before Friday.', studentZone: true })).toBe(0);
  });

  it('holds phone numbers and payment handles, and any link in the Student Zone', () => {
    expect(contentRisk({ ...base, text: 'বিকাশ করুন 01712345678 নম্বরে' })).toBeGreaterThanOrEqual(HOLD_THRESHOLD);
    expect(contentRisk({ ...base, text: 'whatsapp number 01812-345678' })).toBeGreaterThanOrEqual(HOLD_THRESHOLD);
    expect(contentRisk({ ...base, text: 'নোট পাবেন www.example.xyz এ', studentZone: true })).toBeGreaterThanOrEqual(HOLD_THRESHOLD);
    expect(contentRisk({ ...base, text: 'ফোন: ০১৭১২৩৪৫৬৭৮' })).toBeGreaterThanOrEqual(HOLD_THRESHOLD - 25);
  });

  it('is stricter with brand-new, fast-posting accounts that post links', () => {
    const link = 'Great deals at https://shop.example.com';
    expect(contentRisk({ ...base, text: link })).toBeLessThan(HOLD_THRESHOLD);
    expect(contentRisk({ text: link, accountAgeHours: 2, recentCount: 6 })).toBeGreaterThanOrEqual(HOLD_THRESHOLD);
  });
});
