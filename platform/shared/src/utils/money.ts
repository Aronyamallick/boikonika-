import { toBanglaDigits } from './bangla';

/**
 * Money handling without floating point.
 * - Database: NUMERIC(14,2) + explicit currency column.
 * - API/JSON: decimal strings, e.g. "1250.00".
 * - Arithmetic: integer minor units (poisha), safe up to ±90 trillion BDT.
 */
export const DEFAULT_CURRENCY = 'BDT' as const;
export type CurrencyCode = 'BDT';

const DECIMAL_RE = /^-?\d+(\.\d{1,2})?$/;

export function isMoneyString(value: string): boolean {
  return DECIMAL_RE.test(value);
}

/** "12.5" → 1250 */
export function toMinor(value: string | number): number {
  const text = typeof value === 'number' ? value.toFixed(2) : value.trim();
  if (!DECIMAL_RE.test(text)) throw new Error(`Invalid money amount: ${value}`);
  const negative = text.startsWith('-');
  const [whole = '0', frac = ''] = text.replace('-', '').split('.');
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) throw new Error(`Money amount out of range: ${value}`);
  return negative ? -minor : minor;
}

/** 1250 → "12.50" */
export function fromMinor(minor: number): string {
  if (!Number.isInteger(minor)) throw new Error(`Minor units must be an integer: ${minor}`);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

export const addMoney = (...values: Array<string | number>): string => fromMinor(values.reduce<number>((sum, v) => sum + toMinor(v), 0));
export const subtractMoney = (a: string | number, b: string | number): string => fromMinor(toMinor(a) - toMinor(b));
export const multiplyMoney = (amount: string | number, quantity: number): string => {
  if (!Number.isInteger(quantity)) throw new Error('Quantity must be an integer');
  return fromMinor(toMinor(amount) * quantity);
};
/** Percentage of an amount, rounded half-up to the poisha, e.g. commission. */
export const percentOf = (amount: string | number, percent: number): string =>
  fromMinor(Math.round((toMinor(amount) * Math.round(percent * 100)) / 10000));
export const compareMoney = (a: string | number, b: string | number): number => Math.sign(toMinor(a) - toMinor(b));
export const maxMoney = (a: string | number, b: string | number): string => (compareMoney(a, b) >= 0 ? fromMinor(toMinor(a)) : fromMinor(toMinor(b)));
export const minMoney = (a: string | number, b: string | number): string => (compareMoney(a, b) <= 0 ? fromMinor(toMinor(a)) : fromMinor(toMinor(b)));

/** Bangladeshi digit grouping: 1234567.5 → "12,34,567.50" (lakh/crore style). */
export function groupBd(value: string): string {
  const [whole = '0', frac = '00'] = value.replace('-', '').split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${value.startsWith('-') ? '-' : ''}${grouped}.${frac}`;
}

/** formatMoney("1250", "bn") → "৳১,২৫০.০০"; formatMoney("1250", "en") → "৳1,250.00" */
export function formatMoney(value: string | number, locale = 'bn', options: { hideZeroDecimals?: boolean } = {}): string {
  let text = groupBd(fromMinor(toMinor(value)));
  if (options.hideZeroDecimals && text.endsWith('.00')) text = text.slice(0, -3);
  return `৳${locale.startsWith('bn') ? toBanglaDigits(text) : text}`;
}

/** Discount percentage shown on cards, e.g. compareAt 500, price 400 → 20 */
export function discountPercent(price: string, compareAt?: string | null): number {
  if (!compareAt) return 0;
  const p = toMinor(price);
  const c = toMinor(compareAt);
  if (c <= 0 || p >= c) return 0;
  return Math.round(((c - p) / c) * 100);
}
