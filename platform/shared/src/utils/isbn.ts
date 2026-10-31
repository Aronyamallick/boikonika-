import { toEnglishDigits } from './bangla';

/** Strips spaces/hyphens, converts Bangla digits and upper-cases the ISBN-10 check digit "x". */
export function normalizeIsbn(input: string): string {
  return toEnglishDigits(input).replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIsbn10(input: string): boolean {
  const isbn = normalizeIsbn(input);
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = isbn[i] as string;
    const value = ch === 'X' ? 10 : Number(ch);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(input: string): boolean {
  const isbn = normalizeIsbn(input);
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

export const isValidIsbn = (input: string): boolean => isValidIsbn10(input) || isValidIsbn13(input);

/** Canonical ISBN-13 for storage/deduplication (ISBN-10 is converted with the 978 prefix). */
export function toIsbn13(input: string): string | null {
  const isbn = normalizeIsbn(input);
  if (isValidIsbn13(isbn)) return isbn;
  if (!isValidIsbn10(isbn)) return null;
  const core = `978${isbn.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  return `${core}${(10 - (sum % 10)) % 10}`;
}
