/**
 * URL slug that keeps Bangla letters (Unicode Bengali block) so Bangla titles stay readable:
 * "আমার বই: প্রথম খণ্ড" → "আমার-বই-প্রথম-খণ্ড", "Harry Potter & the Stone" → "harry-potter-the-stone".
 */
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Script=Bengali}\p{Letter}\p{Number}\s-]/gu, ' ')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLength)
    .replace(/^-|-$/g, '');
  return slug || 'item';
}

/** Short random suffix to make slugs unique without exposing database ids. */
export function slugSuffix(length = 6): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
