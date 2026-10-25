import type { PostType } from './statuses';

/** Post types people write themselves (reviews live on book pages; announcements come from author tools). */
export const COMPOSER_POST_TYPES = [
  'discussion',
  'recommendation',
  'quote',
  'reading_progress',
  'question',
  'poem',
  'story',
  'essay',
  'study_tip',
  'educational',
  'artwork',
] as const satisfies readonly PostType[];
export type ComposerPostType = (typeof COMPOSER_POST_TYPES)[number];

/** Quotes stay short: a passage for discussion, never a reproduction of the book (copyright). */
export const MAX_QUOTE_LENGTH = 600;
export const MAX_POST_LENGTH = 10_000;
export const MAX_COMMENT_LENGTH = 2_000;
export const MAX_POST_IMAGES = 4;

export const FEED_TABS = ['for_you', 'following', 'latest'] as const;
export type FeedTab = (typeof FEED_TABS)[number];

/** Student Zone subjects (labels in i18n under `subjects.*`). */
export const STUDY_SUBJECTS = [
  'bangla',
  'english',
  'mathematics',
  'physics',
  'chemistry',
  'biology',
  'ict',
  'accounting',
  'economics',
  'history',
  'geography',
  'religion',
  'general_knowledge',
  'admission',
  'job_preparation',
  'other',
] as const;
export type StudySubject = (typeof STUDY_SUBJECTS)[number];

/** Things a user can report from the UI (the API validates the target exists). */
export const REPORT_TARGET_TYPES = ['post', 'comment', 'review', 'product', 'book', 'user', 'club', 'club_post', 'store'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];
