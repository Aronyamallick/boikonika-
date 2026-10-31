import type { HomepageSectionConfig } from '../../schema/cms';

type SectionType =
  | 'hero'
  | 'book_list'
  | 'author_list'
  | 'category_grid'
  | 'banner'
  | 'student_zone'
  | 'book_clubs'
  | 'reading_challenges'
  | 'featured_sellers'
  | 'articles'
  | 'testimonials'
  | 'why_choose_us';

export interface SeedSection {
  key: string;
  type: SectionType;
  title: { bn: string; en: string };
  subtitle?: { bn: string; en: string };
  config?: HomepageSectionConfig;
  enabled?: boolean;
}

/** Default homepage order. Admins reorder, retitle, configure or disable these in the homepage builder. */
export const SECTIONS: SeedSection[] = [
  { key: 'hero', type: 'hero', title: { bn: 'পড়ুন, শিখুন, এগিয়ে যান', en: 'Read, learn and grow' }, subtitle: { bn: 'নতুন ও পুরোনো বই, পাঠক কমিউনিটি আর শেখার সব আয়োজন এক জায়গায়।', en: 'New and used books, a reading community and everything for learning in one place.' } },
  { key: 'categories', type: 'category_grid', title: { bn: 'বিষয় অনুযায়ী খুঁজুন', en: 'Browse by category' }, config: { limit: 12 } },
  { key: 'trending', type: 'book_list', title: { bn: 'এখন জনপ্রিয়', en: 'Trending now' }, config: { source: 'trending', limit: 12 } },
  { key: 'best-sellers', type: 'book_list', title: { bn: 'বেস্টসেলার', en: 'Best sellers' }, config: { source: 'best_sellers', limit: 12 } },
  { key: 'new-releases', type: 'book_list', title: { bn: 'নতুন প্রকাশিত', en: 'New releases' }, config: { source: 'new_releases', limit: 12 } },
  { key: 'editors-picks', type: 'book_list', title: { bn: 'সম্পাদকের পছন্দ', en: "Editor's picks" }, config: { source: 'editors_picks', limit: 12 } },
  { key: 'popular-authors', type: 'author_list', title: { bn: 'জনপ্রিয় লেখক', en: 'Popular authors' }, config: { limit: 10 } },
  { key: 'student-zone', type: 'student_zone', title: { bn: 'স্টুডেন্ট জোন', en: 'Student Zone' }, subtitle: { bn: 'পাঠ্যবই, নোট, কুইজ আর পড়ার দল।', en: 'Textbooks, notes, quizzes and study groups.' } },
  { key: 'student-picks', type: 'book_list', title: { bn: 'শিক্ষার্থীদের প্রিয়', en: 'Student favourites' }, config: { source: 'student_picks', limit: 12 } },
  { key: 'teacher-picks', type: 'book_list', title: { bn: 'শিক্ষকদের সুপারিশ', en: 'Teacher recommended' }, config: { source: 'teacher_picks', limit: 12 } },
  { key: 'book-clubs', type: 'book_clubs', title: { bn: 'বুক ক্লাব', en: 'Book clubs' }, subtitle: { bn: 'একসঙ্গে পড়ুন, আলোচনা করুন।', en: 'Read together and talk about it.' }, config: { limit: 6 } },
  { key: 'reading-challenges', type: 'reading_challenges', title: { bn: 'পাঠ চ্যালেঞ্জ', en: 'Reading challenges' }, config: { limit: 4 } },
  { key: 'discounted', type: 'book_list', title: { bn: 'ছাড়ে পাওয়া বই', en: 'On discount' }, config: { source: 'discounted', limit: 12 } },
  { key: 'used-books', type: 'book_list', title: { bn: 'পুরোনো বই', en: 'Used books' }, config: { source: 'used', limit: 12 } },
  { key: 'free-books', type: 'book_list', title: { bn: 'ফ্রি বই', en: 'Free books' }, config: { source: 'free', limit: 12 } },
  { key: 'hidden-gems', type: 'book_list', title: { bn: 'আড়ালের রত্ন', en: 'Hidden gems' }, config: { source: 'hidden_gems', limit: 12 } },
  { key: 'featured-sellers', type: 'featured_sellers', title: { bn: 'বিশেষ বিক্রেতা', en: 'Featured sellers' }, config: { limit: 8 } },
  { key: 'articles', type: 'articles', title: { bn: 'শেখার লেখা', en: 'Learning articles' }, config: { limit: 4 } },
  { key: 'why-us', type: 'why_choose_us', title: { bn: 'কেন বইকণিকা', en: 'Why Boikonika' } },
  { key: 'testimonials', type: 'testimonials', title: { bn: 'পাঠকেরা যা বলছেন', en: 'What readers say' }, enabled: false },
];
