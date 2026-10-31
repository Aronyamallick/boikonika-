/**
 * Heuristic risk score (0–100) for community posts and comments. At or above the threshold the
 * content waits for a moderator instead of going live. The Student Zone holds links and phone
 * numbers from everyone, because it is used by minors.
 */
export const HOLD_THRESHOLD = 60;

export function contentRisk(input: { text: string; accountAgeHours: number; recentCount: number; studentZone?: boolean; hasImages?: boolean }): number {
  const text = input.text;
  let score = 0;
  const links = text.match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|xyz|top|bd|io|me|info)\b/gi)?.length ?? 0;
  const phones = /(?:\+?88)?01[3-9]\d{8}\b/.test(text.replace(/[\s-]/g, '')) || /[০-৯]{11}/.test(text.replace(/[\s-]/g, ''));
  if (links) score += input.studentZone ? 60 : 20 + Math.min(30, (links - 1) * 15);
  if (phones) score += input.studentZone ? 60 : 35;
  if (/(.)\1{7,}/u.test(text)) score += 15;
  const latin = text.replace(/[^A-Za-z]/g, '');
  if (latin.length > 30 && latin === latin.toUpperCase()) score += 10;
  // A phone number next to a payment or messaging app is the classic off-platform scam.
  if (phones && /whats\s?app|telegram|imo|bkash|nagad|rocket|হোয়াটসঅ্যাপ|টেলিগ্রাম|ইমো|বিকাশ|নগদ|রকেট/i.test(text)) score += 30;
  if (input.accountAgeHours < 24) score += 20;
  if (input.recentCount >= 5) score += 20;
  if (input.studentZone && input.hasImages && input.accountAgeHours < 72) score += 30;
  return Math.min(100, score);
}
