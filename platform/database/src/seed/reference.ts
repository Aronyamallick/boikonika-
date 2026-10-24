import { DEFAULT_ROLE_PERMISSIONS, INTEREST_KEYS, messages, PERMISSIONS, ROLES, STAFF_ROLES, type Role } from '@boikonika/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { badges, categories, genres, permissions, readingChallenges, rolePermissions, roles, shippingMethods, systemSettings } from '../schema';

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: 'Full control, including permissions and system settings',
  admin: 'Runs the marketplace and community day to day',
  moderator: 'Reviews reports, reviews and community content',
  customer: 'Buys books and products',
  student: 'Student Zone member',
  teacher: 'Teacher — can create quizzes and recommend books',
  author: 'Verified author with an author dashboard',
  publisher: 'Verified publisher managing books, authors and editions',
  book_seller: 'Verified book seller',
  general_seller: 'Verified seller of non-book products',
  institution: 'School, college or university',
  delivery_staff: 'Updates shipment status on deliveries',
};

export async function seedRbac(db: Database): Promise<void> {
  await db
    .insert(roles)
    .values(ROLES.map((key) => ({ key, name: messages.en.roles[key], description: ROLE_DESCRIPTIONS[key], isStaff: STAFF_ROLES.includes(key) })))
    .onConflictDoUpdate({ target: roles.key, set: { name: sql`excluded.name`, description: sql`excluded.description`, isStaff: sql`excluded.is_staff` } });
  await db
    .insert(permissions)
    .values(Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })))
    .onConflictDoUpdate({ target: permissions.key, set: { description: sql`excluded.description` } });
  // Defaults are only inserted, never removed, so changes made later in the admin panel survive re-seeding.
  const rows = Object.entries(DEFAULT_ROLE_PERMISSIONS).flatMap(([role, perms]) => (perms ?? []).map((permission) => ({ role: role as Role, permission })));
  if (rows.length) await db.insert(rolePermissions).values(rows).onConflictDoNothing();
}

type Node = { slug: string; bn: string; en: string; icon?: string; children?: Node[] };

const BOOK_TREE: Node[] = [
  { slug: 'fiction', bn: 'কথাসাহিত্য', en: 'Fiction', icon: 'book-open', children: [
    { slug: 'novels', bn: 'উপন্যাস', en: 'Novels' },
    { slug: 'short-stories', bn: 'ছোটগল্প', en: 'Short stories' },
    { slug: 'thriller', bn: 'থ্রিলার ও রহস্য', en: 'Thriller & mystery' },
    { slug: 'science-fiction', bn: 'বৈজ্ঞানিক কল্পকাহিনি', en: 'Science fiction' },
    { slug: 'translated', bn: 'অনূদিত সাহিত্য', en: 'Translated literature' },
  ] },
  { slug: 'poetry', bn: 'কবিতা', en: 'Poetry', icon: 'feather' },
  { slug: 'bangla-literature', bn: 'বাংলা সাহিত্য', en: 'Bangla literature', icon: 'library', children: [
    { slug: 'classics', bn: 'চিরায়ত সাহিত্য', en: 'Classics' },
    { slug: 'essays', bn: 'প্রবন্ধ', en: 'Essays' },
  ] },
  { slug: 'non-fiction', bn: 'নন-ফিকশন', en: 'Non-fiction', icon: 'lightbulb', children: [
    { slug: 'biography', bn: 'জীবনী ও স্মৃতিকথা', en: 'Biography & memoir' },
    { slug: 'history', bn: 'ইতিহাস', en: 'History' },
    { slug: 'self-development', bn: 'আত্মউন্নয়ন', en: 'Self-development' },
    { slug: 'business', bn: 'ব্যবসা ও অর্থনীতি', en: 'Business & economics' },
    { slug: 'science', bn: 'বিজ্ঞান', en: 'Science' },
    { slug: 'technology', bn: 'প্রযুক্তি', en: 'Technology' },
    { slug: 'programming', bn: 'প্রোগ্রামিং', en: 'Programming' },
  ] },
  { slug: 'academic', bn: 'একাডেমিক', en: 'Academic', icon: 'graduation-cap', children: [
    { slug: 'primary', bn: 'প্রাথমিক', en: 'Primary' },
    { slug: 'ssc', bn: 'এসএসসি', en: 'SSC' },
    { slug: 'hsc', bn: 'এইচএসসি', en: 'HSC' },
    { slug: 'admission', bn: 'ভর্তি প্রস্তুতি', en: 'Admission preparation' },
    { slug: 'university', bn: 'বিশ্ববিদ্যালয়', en: 'University' },
    { slug: 'job-preparation', bn: 'চাকরির প্রস্তুতি', en: 'Job preparation' },
  ] },
  { slug: 'children', bn: 'শিশু-কিশোর', en: 'Children & teens', icon: 'baby', children: [
    { slug: 'picture-books', bn: 'ছবির বই', en: 'Picture books' },
    { slug: 'comics', bn: 'কমিকস', en: 'Comics' },
  ] },
  { slug: 'religion', bn: 'ধর্ম ও দর্শন', en: 'Religion & philosophy', icon: 'sun', children: [{ slug: 'islamic', bn: 'ইসলামি বই', en: 'Islamic books' }] },
  { slug: 'research', bn: 'গবেষণা', en: 'Research', icon: 'microscope' },
];

const GENERAL_TREE: Node[] = [
  { slug: 'stationery', bn: 'স্টেশনারি', en: 'Stationery', icon: 'pen-tool', children: [
    { slug: 'pens', bn: 'কলম', en: 'Pens' },
    { slug: 'notebooks', bn: 'খাতা ও নোটবুক', en: 'Notebooks' },
    { slug: 'paper', bn: 'কাগজ', en: 'Paper' },
  ] },
  { slug: 'school-supplies', bn: 'স্কুল সামগ্রী', en: 'School supplies', icon: 'backpack', children: [
    { slug: 'geometry-boxes', bn: 'জ্যামিতি বক্স', en: 'Geometry boxes' },
    { slug: 'calculators', bn: 'ক্যালকুলেটর', en: 'Calculators' },
  ] },
  { slug: 'art-supplies', bn: 'আর্ট সামগ্রী', en: 'Art supplies', icon: 'palette' },
  { slug: 'bags', bn: 'ব্যাগ', en: 'Bags', icon: 'briefcase' },
  { slug: 'office-products', bn: 'অফিস সামগ্রী', en: 'Office products', icon: 'printer' },
  { slug: 'study-accessories', bn: 'পড়ার সহায়ক', en: 'Study accessories', icon: 'lamp-desk', children: [
    { slug: 'book-stands', bn: 'বুক স্ট্যান্ড', en: 'Book stands' },
    { slug: 'reading-lamps', bn: 'রিডিং ল্যাম্প', en: 'Reading lamps' },
  ] },
  { slug: 'electronics', bn: 'ইলেকট্রনিক্স', en: 'Electronics', icon: 'tablet', children: [{ slug: 'e-readers', bn: 'ই-রিডার', en: 'E-readers' }] },
  { slug: 'educational-tools', bn: 'শিক্ষা উপকরণ', en: 'Educational tools', icon: 'globe' },
];

async function upsertTree(db: Database, nodes: Node[], appliesTo: 'book' | 'general', root: string, parentId: string | null, parentPath: string, depth: number) {
  for (const [i, node] of nodes.entries()) {
    const path = `${parentPath}/${node.slug}`;
    const [row] = await db
      .insert(categories)
      .values({ slug: node.slug, path, depth, parentId, name: { bn: node.bn, en: node.en }, icon: node.icon, appliesTo, position: i })
      .onConflictDoUpdate({ target: categories.path, set: { name: { bn: node.bn, en: node.en }, icon: node.icon ?? null } })
      .returning({ id: categories.id });
    if (node.children && row) await upsertTree(db, node.children, appliesTo, root, row.id, path, depth + 1);
  }
}

export async function seedCategories(db: Database): Promise<void> {
  const roots = [
    { slug: 'books', bn: 'বই', en: 'Books', appliesTo: 'book' as const, tree: BOOK_TREE, icon: 'book' },
    { slug: 'products', bn: 'অন্যান্য পণ্য', en: 'Other products', appliesTo: 'general' as const, tree: GENERAL_TREE, icon: 'shopping-bag' },
  ];
  for (const [i, root] of roots.entries()) {
    const [row] = await db
      .insert(categories)
      .values({ slug: root.slug, path: root.slug, depth: 0, name: { bn: root.bn, en: root.en }, icon: root.icon, appliesTo: root.appliesTo, position: i })
      .onConflictDoUpdate({ target: categories.path, set: { name: { bn: root.bn, en: root.en } } })
      .returning({ id: categories.id });
    await upsertTree(db, root.tree, root.appliesTo, root.slug, row!.id, root.slug, 1);
  }
}

export async function seedGenres(db: Database): Promise<void> {
  await db
    .insert(genres)
    .values(INTEREST_KEYS.map((key, position) => ({ key, position, name: { bn: messages.bn.interests[key], en: messages.en.interests[key] } })))
    .onConflictDoUpdate({ target: genres.key, set: { name: sql`excluded.name`, position: sql`excluded.position` } });
}

const BADGES: Array<typeof badges.$inferInsert> = [
  { key: 'first_book', icon: 'book-check', xpReward: 50, criteria: { booksCompleted: 1 }, name: { bn: 'প্রথম বই', en: 'First Book' }, description: { bn: 'প্রথম বইটি পড়া শেষ করেছেন', en: 'Finished your first book' } },
  { key: 'reading_explorer', icon: 'compass', xpReward: 100, criteria: { distinctGenresCompleted: 5 }, name: { bn: 'পাঠ অভিযাত্রী', en: 'Reading Explorer' }, description: { bn: '৫টি ভিন্ন জনরার বই পড়েছেন', en: 'Finished books from 5 different genres' } },
  { key: 'book_reviewer', icon: 'star', xpReward: 100, criteria: { reviewsPublished: 5 }, name: { bn: 'বই সমালোচক', en: 'Book Reviewer' }, description: { bn: '৫টি রিভিউ প্রকাশিত হয়েছে', en: 'Published 5 helpful reviews' } },
  { key: 'knowledge_sharer', icon: 'share-2', xpReward: 120, criteria: { educationalPostsWithLikes: 10 }, name: { bn: 'জ্ঞান বিতরণকারী', en: 'Knowledge Sharer' }, description: { bn: '১০টি শিক্ষামূলক পোস্ট যা অন্যরা উপকারী মনে করেছেন', en: '10 educational posts others found useful' } },
  { key: 'top_contributor', icon: 'award', xpReward: 200, criteria: { communityXp: 1000 }, name: { bn: 'শীর্ষ অবদানকারী', en: 'Top Contributor' }, description: { bn: 'কমিউনিটিতে ১০০০ XP অর্জন', en: 'Earned 1000 XP from community contributions' } },
  { key: 'thirty_day_reader', icon: 'calendar-check', xpReward: 150, criteria: { readingStreakDays: 30 }, name: { bn: '৩০ দিনের পাঠক', en: '30-Day Reader' }, description: { bn: 'টানা ৩০ দিন পড়েছেন', en: 'Read on 30 consecutive days' } },
  { key: 'young_author', icon: 'pen-line', xpReward: 100, criteria: { creativePostsPublished: 3 }, name: { bn: 'তরুণ লেখক', en: 'Young Author' }, description: { bn: '৩টি গল্প বা কবিতা প্রকাশ করেছেন', en: 'Published 3 stories or poems' } },
  { key: 'quiz_master', icon: 'brain', xpReward: 120, criteria: { quizzesPassed: 10 }, name: { bn: 'কুইজ মাস্টার', en: 'Quiz Master' }, description: { bn: '১০টি কুইজে উত্তীর্ণ', en: 'Passed 10 quizzes' } },
  { key: 'book_club_member', icon: 'users', xpReward: 30, criteria: { clubsJoined: 1 }, name: { bn: 'বুক ক্লাব সদস্য', en: 'Book Club Member' }, description: { bn: 'একটি বুক ক্লাবে যোগ দিয়েছেন', en: 'Joined a book club' } },
  { key: 'ten_books', icon: 'library', xpReward: 200, criteria: { booksCompleted: 10 }, name: { bn: '১০টি বই', en: 'Ten Books' }, description: { bn: '১০টি বই পড়া শেষ করেছেন', en: 'Finished 10 books' } },
];

export async function seedGamification(db: Database): Promise<void> {
  await db
    .insert(badges)
    .values(BADGES)
    .onConflictDoUpdate({ target: badges.key, set: { name: sql`excluded.name`, description: sql`excluded.description`, criteria: sql`excluded.criteria`, xpReward: sql`excluded.xp_reward` } });
  const badgeIds = Object.fromEntries((await db.select({ id: badges.id, key: badges.key }).from(badges)).map((b) => [b.key, b.id]));
  const challenges = [
    { slug: '7-day-reading', type: 'days' as const, target: 7, durationDays: 7, xpReward: 70, badge: null, title: { bn: '৭ দিনের পাঠ চ্যালেঞ্জ', en: '7-Day Reading Challenge' }, description: { bn: 'টানা ৭ দিন অন্তত ১০ মিনিট করে পড়ুন।', en: 'Read at least 10 minutes a day for 7 days in a row.' } },
    { slug: '30-day-reading', type: 'days' as const, target: 30, durationDays: 30, xpReward: 300, badge: 'thirty_day_reader', title: { bn: '৩০ দিনের পাঠ চ্যালেঞ্জ', en: '30-Day Reading Challenge' }, description: { bn: '৩০ দিন প্রতিদিন পড়ার অভ্যাস গড়ুন।', en: 'Build a daily reading habit for 30 days.' } },
    { slug: '100-page', type: 'pages' as const, target: 100, durationDays: 14, xpReward: 60, badge: null, title: { bn: '১০০ পৃষ্ঠার চ্যালেঞ্জ', en: '100 Page Challenge' }, description: { bn: '১৪ দিনে ১০০ পৃষ্ঠা পড়ুন।', en: 'Read 100 pages in 14 days.' } },
    { slug: 'monthly-book', type: 'books' as const, target: 1, durationDays: 30, xpReward: 80, badge: null, title: { bn: 'মাসে একটি বই', en: 'Monthly Book Challenge' }, description: { bn: 'এই মাসে একটি বই পড়া শেষ করুন।', en: 'Finish one book this month.' } },
    { slug: 'bangla-literature', type: 'books' as const, target: 3, durationDays: 60, xpReward: 150, badge: null, genreKey: 'bangla_literature', title: { bn: 'বাংলা সাহিত্য চ্যালেঞ্জ', en: 'Bangla Literature Challenge' }, description: { bn: '৬০ দিনে বাংলা সাহিত্যের ৩টি বই পড়ুন।', en: 'Read 3 Bangla literature books in 60 days.' } },
    { slug: 'science-reading', type: 'books' as const, target: 2, durationDays: 60, xpReward: 120, badge: null, genreKey: 'science', title: { bn: 'বিজ্ঞান পাঠ চ্যালেঞ্জ', en: 'Science Reading Challenge' }, description: { bn: '৬০ দিনে বিজ্ঞানের ২টি বই পড়ুন।', en: 'Read 2 science books in 60 days.' } },
    { slug: 'history-reading', type: 'books' as const, target: 2, durationDays: 60, xpReward: 120, badge: null, genreKey: 'history', title: { bn: 'ইতিহাস পাঠ চ্যালেঞ্জ', en: 'History Reading Challenge' }, description: { bn: '৬০ দিনে ইতিহাসের ২টি বই পড়ুন।', en: 'Read 2 history books in 60 days.' } },
  ];
  for (const c of challenges) {
    const { badge, ...values } = c;
    await db
      .insert(readingChallenges)
      .values({ ...values, badgeId: badge ? badgeIds[badge] : null })
      .onConflictDoUpdate({ target: readingChallenges.slug, set: { title: values.title, description: values.description, target: values.target, xpReward: values.xpReward } });
  }
}

export const DEFAULT_SETTINGS: Array<{ key: string; value: unknown; description: string; isPublic?: boolean }> = [
  { key: 'commission.defaultPercent', value: 10, description: 'Platform commission on seller sales (percent)' },
  { key: 'orders.paymentWindowMinutes', value: 30, description: 'Unpaid online orders are cancelled after this many minutes' },
  { key: 'orders.returnWindowDays', value: 7, description: 'Days after delivery a customer may request a return', isPublic: true },
  { key: 'payouts.holdDays', value: 7, description: 'Days after delivery before a sub-order becomes payable' },
  { key: 'payouts.minimumAmount', value: '500.00', description: 'Minimum payout amount (BDT)' },
  { key: 'preview.defaultPercent', value: 10, description: 'Default share of a digital book shown in previews' },
  { key: 'preview.maxPercent', value: 20, description: 'Maximum preview share a publisher may set' },
  { key: 'reviews.minBodyLength', value: 20, description: 'Minimum characters in a written review', isPublic: true },
  { key: 'community.newAccountDailyPostLimit', value: 5, description: 'Posts per day for accounts younger than 7 days' },
  { key: 'gamification.readingXpPer10Minutes', value: 5, description: 'XP for each 10 minutes of logged reading' },
  { key: 'gamification.dailyReadingXpCap', value: 60, description: 'Maximum reading XP per day (anti-spam)' },
  { key: 'gamification.levelXp', value: [0, 100, 300, 700, 1500, 3000, 6000, 10000], description: 'XP needed for each reading level' },
  { key: 'kyc.rejectedRetentionDays', value: 90, description: 'Days to keep documents of rejected verifications' },
  { key: 'kyc.approvedRetentionDays', value: 1825, description: 'Days to keep documents after approval (compliance)' },
  { key: 'ai.dailyRequestLimit', value: 30, description: 'AI assistant requests per user per day' },
  { key: 'search.trigramThreshold', value: 0.3, description: 'Minimum trigram similarity for typo-tolerant matches' },
  { key: 'shipping.freeShippingThreshold', value: '1500.00', description: 'Platform free-shipping threshold (BDT)', isPublic: true },
];

export async function seedSettings(db: Database): Promise<void> {
  await db
    .insert(systemSettings)
    .values(DEFAULT_SETTINGS.map((s) => ({ key: s.key, value: s.value, description: s.description, isPublic: s.isPublic ?? false })))
    .onConflictDoNothing();
}

export async function seedShipping(db: Database): Promise<void> {
  const rows = [
    { code: 'standard', name: { bn: 'সাধারণ ডেলিভারি', en: 'Standard delivery' }, insideDhakaFee: '60.00', outsideDhakaFee: '120.00', minDays: 2, maxDays: 5, freeShippingThreshold: '1500.00', position: 0 },
    { code: 'express', name: { bn: 'দ্রুত ডেলিভারি', en: 'Express delivery' }, insideDhakaFee: '100.00', outsideDhakaFee: '160.00', minDays: 1, maxDays: 2, freeShippingThreshold: null, position: 1 },
  ];
  for (const row of rows) {
    const existing = await db.select({ id: shippingMethods.id }).from(shippingMethods).where(and(isNull(shippingMethods.sellerId), eq(shippingMethods.code, row.code)));
    if (!existing.length) await db.insert(shippingMethods).values(row);
  }
}
