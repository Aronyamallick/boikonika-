/** Content management: articles, help, banners, the homepage builder and contact messages. */

export const ARTICLE_KINDS = ['blog', 'educational', 'announcement', 'study_resource', 'help'] as const;
export type ArticleKind = (typeof ARTICLE_KINDS)[number];
/** Kinds listed on the blog; help articles live in the help centre. */
export const BLOG_KINDS = ['blog', 'educational', 'announcement', 'study_resource'] as const satisfies readonly ArticleKind[];

export const ARTICLE_AUDIENCES = ['all', 'student', 'teacher', 'parent', 'seller', 'author'] as const;
export type ArticleAudience = (typeof ARTICLE_AUDIENCES)[number];

export const FAQ_CATEGORIES = ['general', 'orders', 'payments', 'sellers', 'authors', 'account'] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

/** Where banners are shown: the homepage (through banner sections) and the top of the Student Zone. */
export const BANNER_PLACEMENTS = ['home', 'student_zone'] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

export const HOMEPAGE_SECTION_TYPES = [
  'hero',
  'book_list',
  'author_list',
  'category_grid',
  'banner',
  'student_zone',
  'book_clubs',
  'reading_challenges',
  'featured_sellers',
  'articles',
  'testimonials',
  'why_choose_us',
] as const;
export type HomepageSectionType = (typeof HOMEPAGE_SECTION_TYPES)[number];
/** Built-in blocks that appear once; they can be turned off and retitled but not added again. */
export const SINGLE_SECTION_TYPES = ['hero', 'student_zone', 'why_choose_us'] as const satisfies readonly HomepageSectionType[];
/** Section types whose list length staff can set. */
export const LIST_SECTION_TYPES = ['book_list', 'author_list', 'category_grid', 'book_clubs', 'reading_challenges', 'featured_sellers', 'articles', 'testimonials'] as const satisfies readonly HomepageSectionType[];

export const BOOK_SOURCES = ['manual', 'trending', 'best_sellers', 'new_releases', 'editors_picks', 'student_picks', 'teacher_picks', 'discounted', 'used', 'free', 'hidden_gems', 'category'] as const;
export type BookSource = (typeof BOOK_SOURCES)[number];
/** Sections staff add themselves get keys with this prefix and can be deleted (built-in ones are only turned off). */
export const CUSTOM_SECTION_PREFIX = 'custom-';
export const MAX_SECTION_ITEMS = 24;
export const MAX_MANUAL_BOOKS = 24;

export const CONTACT_TOPICS = ['order', 'payment', 'account', 'selling', 'author', 'copyright', 'feedback', 'other'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];
export const CONTACT_STATUSES = ['open', 'answered', 'closed'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_PAGE_BODY = 60_000;
export const MAX_ARTICLE_BODY = 60_000;
