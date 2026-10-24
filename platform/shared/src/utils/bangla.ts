const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** "2024" → "২০২৪" */
export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** "০১৭১২" → "01712" — used before validating phone numbers, ISBNs, OTPs and barcodes. */
export function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export function localizeDigits(input: string | number, locale: string): string {
  return locale.startsWith('bn') ? toBanglaDigits(input) : String(input);
}
