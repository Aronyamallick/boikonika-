/** Interest/genre keys offered during onboarding. Labels live in i18n under `interests.*`. */
export const INTEREST_KEYS = [
  'fiction',
  'poetry',
  'science',
  'technology',
  'programming',
  'history',
  'literature',
  'business',
  'biography',
  'self_development',
  'academic',
  'children',
  'comics',
  'research',
  'religion',
  'islamic',
  'bangla_literature',
  'translation',
  'thriller',
  'science_fiction',
  'admission',
  'job_preparation',
] as const;
export type InterestKey = (typeof INTEREST_KEYS)[number];

/** Onboarding asks for at least this many interests. */
export const ONBOARDING_MIN_INTERESTS = 3;

export const ACADEMIC_LEVELS = ['primary', 'secondary', 'ssc', 'hsc', 'admission', 'undergraduate', 'postgraduate', 'professional', 'general'] as const;
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export const AGE_GROUPS = ['0-5', '6-9', '10-12', '13-17', '18+', 'all'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const BOOK_LANGUAGES = ['bn', 'en', 'ar', 'hi', 'ur', 'other'] as const;
export type BookLanguage = (typeof BOOK_LANGUAGES)[number];
