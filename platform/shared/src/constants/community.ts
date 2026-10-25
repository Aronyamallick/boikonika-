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

export const CLUB_PURPOSES = ['reading', 'study'] as const;
export type ClubPurpose = (typeof CLUB_PURPOSES)[number];
export const JOIN_POLICIES = ['open', 'request', 'invite'] as const;
export type JoinPolicy = (typeof JOIN_POLICIES)[number];
export const MEMBER_ACTIONS = ['approve', 'reject', 'remove', 'ban', 'promote', 'demote'] as const;
export type MemberAction = (typeof MEMBER_ACTIONS)[number];
/** Club types tied to an institution (they name it). */
export const INSTITUTION_CLUB_TYPES = ['school', 'college', 'university'] as const;
export const MAX_POLL_OPTIONS = 8;
