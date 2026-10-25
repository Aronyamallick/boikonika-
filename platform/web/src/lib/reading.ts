import type { LibraryShelf } from '@boikonika/shared';

/** Reading & library response shapes (mirror the API). */
export interface LibraryItem {
  book: { id: string; slug: string; title: string; coverUrl: string | null; authors: string[]; rating: number };
  shelf: LibraryShelf;
  source: string;
  hasDigitalAccess: boolean;
  progress: { currentPage: number; totalPages: number | null; percent: number; finishedAt: string | null };
  addedAt: string;
  updatedAt: string;
}

export interface LibraryPage {
  items: LibraryItem[];
  shelves: Partial<Record<LibraryShelf, number>>;
  /** Books whose e-book I can download. */
  digitalCount: number;
  page: number;
  pageSize: number;
  total: number;
}

export interface ReadingGoals {
  dailyMinutes: number;
  weeklyMinutes: number;
  yearlyBooks: number;
  breakReminderMinutes: number | null;
  monthlySummaryEmail: boolean;
}

export interface ReadingStats {
  days: number;
  series: Array<{ day: string; minutes: number; pages: number }>;
  today: { minutes: number; goal: number };
  week: { minutes: number; goal: number };
  year: { books: number; goal: number };
  period: { minutes: number; pages: number };
  streak: { current: number; longest: number; lastReadOn: string | null };
  level: { level: number; xp: number; levelStartXp: number; nextLevelXp: number };
  totals: { booksCompleted: number; pagesRead: number; minutesRead: number };
  recentSessions: Array<{ id: string; minutes: number; pages: number; day: string; source: string; book: { title: string; slug: string } | null }>;
  goals: ReadingGoals;
}

export interface BadgeProgress {
  key: string;
  icon: string;
  name: Record<string, string>;
  description: Record<string, string>;
  xpReward: number;
  metric: string;
  target: number;
  current: number;
  earnedAt: string | null;
}

export interface Challenge {
  id: string;
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  type: 'days' | 'pages' | 'books' | 'minutes';
  target: number;
  durationDays: number | null;
  genreKey: string | null;
  language: string | null;
  xpReward: number;
  participantCount: number;
  endsAt: string | null;
  mine: { status: 'active' | 'completed' | 'abandoned' | 'expired'; progress: number; joinedAt: string; deadlineAt: string | null; completedAt: string | null } | null;
}

/** Text in the visitor's language, falling back to Bangla. */
export const localized = (value: Record<string, string> | null | undefined, locale: string) => value?.[locale] ?? value?.bn ?? value?.en ?? '';

/** Asia/Dhaka calendar day (YYYY-MM-DD) for a moment. */
export const dhakaDay = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(at);
