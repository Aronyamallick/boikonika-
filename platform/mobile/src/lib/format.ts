import { formatMoney } from '@boikonika/shared';
import { useLocale } from 'use-intl';

/** ৳ amounts with Bangla digits in Bangla, from decimal strings (money is never a float). */
export function useMoney() {
  const locale = useLocale();
  return (value: string | number, options?: { hideZeroDecimals?: boolean }) => formatMoney(value, locale, options);
}

/** A localized text object from the API ({ bn, en }) in the reader's language, falling back to the other. */
export function useLocalized() {
  const locale = useLocale();
  return (value: { bn?: string; en?: string } | string | null | undefined): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return (locale === 'en' ? value.en || value.bn : value.bn || value.en) ?? '';
  };
}
