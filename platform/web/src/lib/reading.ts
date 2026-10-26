export type { LibraryItem, LibraryPage, ReadingGoals, ReadingStats, BadgeProgress, Challenge } from '@boikonika/shared';

/** Text in the visitor's language, falling back to Bangla. */
export const localized = (value: Record<string, string> | null | undefined, locale: string) => value?.[locale] ?? value?.bn ?? value?.en ?? '';

/** Asia/Dhaka calendar day (YYYY-MM-DD) for a moment. */
export const dhakaDay = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(at);
