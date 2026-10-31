import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L or U: easy to read out on the phone to support or a courier. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** e.g. "BK261025K7M2QX": prefix, date in Bangladesh time, 6 random characters. */
export function newOrderNumber(now = new Date()): string {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: '2-digit', month: '2-digit', day: '2-digit' }).format(now).replace(/-/g, '');
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `BK${date}${suffix}`;
}
