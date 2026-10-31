/**
 * Demo catalogue for development and staging (`pnpm db:seed:demo`). Every work here is in the
 * public domain in Bangladesh (author died more than 60 years ago). Stores, the publisher imprint
 * and accounts are fictional and clearly labelled "ডেমো"/"Demo". Descriptions are original text.
 */
export interface DemoAuthor {
  slug: string;
  name: string;
  nameAlt: string;
  birthYear: number;
  deathYear: number;
  bio: string;
}

export interface DemoBook {
  slug: string;
  title: string;
  author: string;
  language: 'bn' | 'en';
  category: string;
  extraCategories?: string[];
  genres: string[];
  year?: number;
  pages: number;
  weightGrams: number;
  format?: 'paperback' | 'hardcover';
  price: string;
  compareAtPrice?: string;
  stock: number;
  ageGroup?: string;
  editorsPick?: boolean;
  studentPick?: boolean;
  teacherPick?: boolean;
  description: string;
  /** Used copies offered by the second demo store. */
  used?: Array<{ condition: 'used_like_new' | 'used_good' | 'used_acceptable'; price: string; note: string }>;
}

export const DEMO_AUTHORS: DemoAuthor[] = [
  { slug: 'rabindranath-tagore', name: 'রবীন্দ্রনাথ ঠাকুর', nameAlt: 'Rabindranath Tagore', birthYear: 1861, deathYear: 1941, bio: 'কবি, ঔপন্যাসিক, নাট্যকার, সংগীতস্রষ্টা ও চিত্রশিল্পী। ১৯১৩ সালে প্রথম এশীয় হিসেবে সাহিত্যে নোবেল পুরস্কার পান। বাংলাদেশ ও ভারতের জাতীয় সংগীত তাঁর রচনা।' },
  { slug: 'bankim-chandra-chattopadhyay', name: 'বঙ্কিমচন্দ্র চট্টোপাধ্যায়', nameAlt: 'Bankim Chandra Chattopadhyay', birthYear: 1838, deathYear: 1894, bio: 'বাংলা উপন্যাসের পথিকৃৎ এবং "বঙ্গদর্শন" পত্রিকার প্রতিষ্ঠাতা সম্পাদক।' },
  { slug: 'sarat-chandra-chattopadhyay', name: 'শরৎচন্দ্র চট্টোপাধ্যায়', nameAlt: 'Sarat Chandra Chattopadhyay', birthYear: 1876, deathYear: 1938, bio: '"অপরাজেয় কথাশিল্পী" নামে পরিচিত ঔপন্যাসিক; গ্রামীণ সমাজ ও নারীর জীবনের মমতাময় চিত্রণের জন্য বিখ্যাত।' },
  { slug: 'begum-rokeya', name: 'বেগম রোকেয়া সাখাওয়াত হোসেন', nameAlt: 'Begum Rokeya Sakhawat Hossain', birthYear: 1880, deathYear: 1932, bio: 'বাঙালি মুসলমান নারী জাগরণের অগ্রদূত, লেখক ও শিক্ষাবিদ; সাখাওয়াত মেমোরিয়াল গার্লস স্কুলের প্রতিষ্ঠাতা।' },
  { slug: 'michael-madhusudan-dutt', name: 'মাইকেল মধুসূদন দত্ত', nameAlt: 'Michael Madhusudan Dutt', birthYear: 1824, deathYear: 1873, bio: 'বাংলা সাহিত্যে অমিত্রাক্ষর ছন্দ ও সনেটের প্রবর্তক কবি ও নাট্যকার।' },
  { slug: 'mir-mosharraf-hossain', name: 'মীর মশাররফ হোসেন', nameAlt: 'Mir Mosharraf Hossain', birthYear: 1847, deathYear: 1911, bio: 'কুষ্টিয়ায় জন্ম নেওয়া ঔপন্যাসিক, নাট্যকার ও প্রাবন্ধিক; "বিষাদ-সিন্ধু" তাঁর সবচেয়ে পরিচিত রচনা।' },
  { slug: 'sukumar-ray', name: 'সুকুমার রায়', nameAlt: 'Sukumar Ray', birthYear: 1887, deathYear: 1923, bio: 'শিশুসাহিত্যিক ও বাংলা ননসেন্স ছড়ার স্রষ্টা; "সন্দেশ" পত্রিকার সম্পাদক।' },
  { slug: 'upendrakishore-ray-chowdhury', name: 'উপেন্দ্রকিশোর রায়চৌধুরী', nameAlt: 'Upendrakishore Ray Chowdhury', birthYear: 1863, deathYear: 1915, bio: 'শিশুসাহিত্যিক, চিত্রকর ও মুদ্রণ-প্রযুক্তির উদ্ভাবক; "সন্দেশ" পত্রিকার প্রতিষ্ঠাতা।' },
  { slug: 'jibanananda-das', name: 'জীবনানন্দ দাশ', nameAlt: 'Jibanananda Das', birthYear: 1899, deathYear: 1954, bio: 'বরিশালে জন্ম নেওয়া আধুনিক বাংলা কবিতার অন্যতম প্রধান কবি; "রূপসী বাংলার কবি" নামে পরিচিত।' },
  { slug: 'jane-austen', name: 'Jane Austen', nameAlt: 'জেন অস্টেন', birthYear: 1775, deathYear: 1817, bio: 'English novelist known for her wit and her portraits of family life and society.' },
  { slug: 'arthur-conan-doyle', name: 'Arthur Conan Doyle', nameAlt: 'আর্থার কোনান ডয়েল', birthYear: 1859, deathYear: 1930, bio: 'Scottish writer and physician, creator of the detective Sherlock Holmes.' },
];

export const DEMO_BOOKS: DemoBook[] = [
  { slug: 'gitanjali', title: 'গীতাঞ্জলি', author: 'rabindranath-tagore', language: 'bn', category: 'books/poetry', extraCategories: ['books/bangla-literature/classics'], genres: ['poetry', 'bangla_literature', 'literature'], year: 1910, pages: 176, weightGrams: 260, price: '200.00', compareAtPrice: '250.00', stock: 40, editorsPick: true, description: 'রবীন্দ্রনাথ ঠাকুরের ১৫৭টি গীতিকবিতার সংকলন। এই সংকলনের কবিতাসহ অনূদিত ইংরেজি "Gitanjali: Song Offerings"-এর জন্য তিনি ১৯১৩ সালে সাহিত্যে নোবেল পুরস্কার পান।', used: [{ condition: 'used_good', price: '120.00', note: 'প্রথম পাতায় নাম লেখা, বাকি সব পরিষ্কার।' }] },
  { slug: 'gora', title: 'গোরা', author: 'rabindranath-tagore', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature'], year: 1910, pages: 480, weightGrams: 620, price: '450.00', stock: 18, description: 'উনিশ শতকের শেষভাগের কলকাতার পটভূমিতে লেখা রবীন্দ্রনাথের দীর্ঘতম উপন্যাস। ধর্ম, জাতীয়তা ও আত্মপরিচয়ের প্রশ্নে গোরার অন্তর্দ্বন্দ্বই এর কেন্দ্র।' },
  { slug: 'chokher-bali', title: 'চোখের বালি', author: 'rabindranath-tagore', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature'], year: 1903, pages: 256, weightGrams: 360, price: '280.00', compareAtPrice: '320.00', stock: 22, description: 'বিধবা বিনোদিনীর সঙ্গে মহেন্দ্র, আশা ও বিহারীর সম্পর্কের টানাপোড়েন নিয়ে বাংলা সাহিত্যের প্রথম দিকের মনস্তাত্ত্বিক উপন্যাস।', used: [{ condition: 'used_like_new', price: '190.00', note: 'একবার পড়া হয়েছে, কোনো দাগ নেই।' }] },
  { slug: 'shesher-kobita', title: 'শেষের কবিতা', author: 'rabindranath-tagore', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature'], year: 1929, pages: 160, weightGrams: 240, price: '220.00', stock: 35, studentPick: true, description: 'শিলংয়ের পাহাড়ি পটভূমিতে অমিত রায় ও লাবণ্যের প্রেমের কাহিনি। গদ্য আর কবিতার মিশেলে লেখা রবীন্দ্রনাথের অন্যতম জনপ্রিয় উপন্যাস।' },
  { slug: 'golpoguchchho', title: 'গল্পগুচ্ছ', author: 'rabindranath-tagore', language: 'bn', category: 'books/fiction/short-stories', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature', 'literature'], pages: 880, weightGrams: 1150, format: 'hardcover', price: '850.00', compareAtPrice: '950.00', stock: 9, editorsPick: true, teacherPick: true, description: '"পোস্টমাস্টার", "কাবুলিওয়ালা", "ছুটি", "সমাপ্তি"-সহ রবীন্দ্রনাথ ঠাকুরের ছোটগল্পের সংকলন — বাংলা ছোটগল্পের ভিত গড়ে দেওয়া রচনা।' },
  { slug: 'dakghar', title: 'ডাকঘর', author: 'rabindranath-tagore', language: 'bn', category: 'books/bangla-literature/classics', genres: ['literature', 'bangla_literature'], year: 1912, pages: 72, weightGrams: 120, price: '120.00', stock: 2, description: 'অসুস্থ বালক অমল জানালায় বসে বাইরের পৃথিবী দেখে আর রাজার চিঠির অপেক্ষা করে — মুক্তির আকাঙ্ক্ষা নিয়ে রবীন্দ্রনাথের প্রতীকী নাটক।' },
  { slug: 'anandamath', title: 'আনন্দমঠ', author: 'bankim-chandra-chattopadhyay', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature', 'history'], year: 1882, pages: 192, weightGrams: 280, price: '250.00', stock: 15, description: 'ছিয়াত্তরের মন্বন্তর ও সন্ন্যাসী বিদ্রোহের পটভূমিতে লেখা বঙ্কিমচন্দ্রের উপন্যাস। "বন্দে মাতরম" গানটি এই উপন্যাসের অন্তর্ভুক্ত।' },
  { slug: 'kapalkundala', title: 'কপালকুণ্ডলা', author: 'bankim-chandra-chattopadhyay', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature'], year: 1866, pages: 144, weightGrams: 220, price: '180.00', stock: 20, description: 'সমুদ্রতীরের অরণ্যে এক কাপালিকের কাছে বড় হওয়া কপালকুণ্ডলা আর পথ হারানো নবকুমারের কাহিনি — বঙ্কিমচন্দ্রের রোমান্টিক উপন্যাস।', used: [{ condition: 'used_acceptable', price: '80.00', note: 'মলাট কিছুটা ছেঁড়া, ভেতরে পেনসিলের দাগ; সব পৃষ্ঠা আছে।' }] },
  { slug: 'durgeshnandini', title: 'দুর্গেশনন্দিনী', author: 'bankim-chandra-chattopadhyay', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature', 'history'], year: 1865, pages: 208, weightGrams: 300, price: '220.00', stock: 12, description: 'বঙ্কিমচন্দ্রের প্রথম বাংলা উপন্যাস। ষোড়শ শতকের মোগল-পাঠান সংঘাতের পটভূমিতে জগৎসিংহ, তিলোত্তমা ও আয়েশার কাহিনি।' },
  { slug: 'devdas', title: 'দেবদাস', author: 'sarat-chandra-chattopadhyay', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature'], year: 1917, pages: 112, weightGrams: 180, price: '160.00', compareAtPrice: '200.00', stock: 50, description: 'শৈশবের সঙ্গী পার্বতীকে হারিয়ে ভেঙে পড়া দেবদাস এবং চন্দ্রমুখীর কাহিনি — শরৎচন্দ্রের বহুবার চলচ্চিত্রায়িত জনপ্রিয় উপন্যাস।', used: [{ condition: 'used_good', price: '90.00', note: 'কয়েকটি পাতার কোণ ভাঁজ করা।' }] },
  { slug: 'srikanta', title: 'শ্রীকান্ত', author: 'sarat-chandra-chattopadhyay', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature'], year: 1917, pages: 720, weightGrams: 980, format: 'hardcover', price: '650.00', stock: 7, teacherPick: true, description: 'চার পর্বে লেখা শরৎচন্দ্রের আত্মজৈবনিক ধাঁচের উপন্যাস। ভবঘুরে শ্রীকান্তের চোখে ইন্দ্রনাথ, অন্নদাদিদি ও রাজলক্ষ্মীর মতো অবিস্মরণীয় চরিত্র।' },
  { slug: 'parineeta', title: 'পরিণীতা', author: 'sarat-chandra-chattopadhyay', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature'], year: 1914, pages: 96, weightGrams: 150, price: '140.00', stock: 0, description: 'কলকাতার এক পাড়ায় শেখর ও ললিতার নীরব ভালোবাসা আর সামাজিক বাধার গল্প।' },
  { slug: 'pather-dabi', title: 'পথের দাবী', author: 'sarat-chandra-chattopadhyay', language: 'bn', category: 'books/fiction/novels', extraCategories: ['books/bangla-literature/classics'], genres: ['fiction', 'bangla_literature', 'history'], year: 1926, pages: 352, weightGrams: 470, price: '300.00', stock: 14, description: 'বিপ্লবী সব্যসাচীকে কেন্দ্র করে লেখা শরৎচন্দ্রের রাজনৈতিক উপন্যাস; প্রকাশের পর ব্রিটিশ সরকার বইটি বাজেয়াপ্ত করে।' },
  { slug: 'abarodhbasini', title: 'অবরোধবাসিনী', author: 'begum-rokeya', language: 'bn', category: 'books/bangla-literature/essays', genres: ['bangla_literature', 'literature', 'history'], year: 1931, pages: 96, weightGrams: 150, price: '150.00', stock: 25, teacherPick: true, description: 'পর্দাপ্রথার নামে নারীদের ওপর ঘটে যাওয়া সত্য ঘটনার বিবরণ। কৌতুক ও বেদনার মিশেলে লেখা বেগম রোকেয়ার সমাজসমালোচনামূলক রচনা।' },
  { slug: 'sultanas-dream', title: "Sultana's Dream", author: 'begum-rokeya', language: 'en', category: 'books/fiction/science-fiction', genres: ['science_fiction', 'fiction'], year: 1905, pages: 64, weightGrams: 110, price: '120.00', stock: 30, studentPick: true, description: "A pioneering feminist utopia: Sultana dreams of Ladyland, a country run by women where science serves everyone and men stay at home. First published in 1905 in The Indian Ladies' Magazine." },
  { slug: 'meghnad-badh-kavya', title: 'মেঘনাদবধ কাব্য', author: 'michael-madhusudan-dutt', language: 'bn', category: 'books/poetry', extraCategories: ['books/bangla-literature/classics'], genres: ['poetry', 'bangla_literature'], year: 1861, pages: 224, weightGrams: 320, price: '260.00', stock: 11, teacherPick: true, description: 'রামায়ণের কাহিনি থেকে নেওয়া, অমিত্রাক্ষর ছন্দে লেখা মহাকাব্য। এখানে রাবণপুত্র মেঘনাদ ট্র্যাজিক নায়ক হিসেবে নতুন রূপে উপস্থিত।' },
  { slug: 'bishad-sindhu', title: 'বিষাদ-সিন্ধু', author: 'mir-mosharraf-hossain', language: 'bn', category: 'books/bangla-literature/classics', extraCategories: ['books/fiction/novels'], genres: ['fiction', 'bangla_literature', 'history'], year: 1885, pages: 400, weightGrams: 540, price: '400.00', compareAtPrice: '450.00', stock: 16, editorsPick: true, description: 'কারবালার ঐতিহাসিক ঘটনা অবলম্বনে তিন পর্বে লেখা মীর মশাররফ হোসেনের উপন্যাস — বাংলা গদ্যসাহিত্যের অন্যতম জনপ্রিয় রচনা।', used: [{ condition: 'used_good', price: '240.00', note: 'বাঁধাই মজবুত, মলাটে সামান্য দাগ।' }] },
  { slug: 'abol-tabol', title: 'আবোল তাবোল', author: 'sukumar-ray', language: 'bn', category: 'books/children', extraCategories: ['books/poetry'], genres: ['children', 'poetry', 'bangla_literature'], year: 1923, pages: 96, weightGrams: 200, price: '180.00', stock: 45, ageGroup: 'all', studentPick: true, editorsPick: true, description: 'হাঁসজারু, বকচ্ছপ, কাতুকুতু বুড়োর মতো অদ্ভুত চরিত্রে ভরা সুকুমার রায়ের ননসেন্স ছড়ার সংকলন — সব বয়সের পাঠকের প্রিয়।' },
  { slug: 'ha-ja-ba-ra-la', title: 'হ য ব র ল', author: 'sukumar-ray', language: 'bn', category: 'books/children', genres: ['children', 'fiction', 'bangla_literature'], pages: 64, weightGrams: 120, price: '150.00', stock: 28, ageGroup: '10-12', description: 'রুমাল থেকে বেড়াল হয়ে যাওয়ার মতো উদ্ভট কাণ্ডে ভরা সুকুমার রায়ের মজার গল্প।', used: [{ condition: 'used_like_new', price: '100.00', note: 'প্রায় নতুন, উপহার হিসেবে পাওয়া।' }] },
  { slug: 'tuntunir-boi', title: 'টুনটুনির বই', author: 'upendrakishore-ray-chowdhury', language: 'bn', category: 'books/children', extraCategories: ['books/children/picture-books'], genres: ['children', 'bangla_literature'], year: 1910, pages: 128, weightGrams: 240, price: '200.00', stock: 33, ageGroup: '6-9', description: 'টুনটুনি পাখি, শেয়াল, কুমির আর বাঘের মজার গল্পে ভরা বাংলার লোককাহিনির সংকলন, ছোটদের জন্য সহজ ভাষায় লেখা।' },
  { slug: 'ruposhi-bangla', title: 'রূপসী বাংলা', author: 'jibanananda-das', language: 'bn', category: 'books/poetry', extraCategories: ['books/bangla-literature/classics'], genres: ['poetry', 'bangla_literature'], year: 1957, pages: 88, weightGrams: 150, price: '180.00', stock: 19, description: 'কবির মৃত্যুর পর প্রকাশিত সনেটগুচ্ছ। বাংলার নদী, মাঠ, পাখি আর গাছপালার রূপ এখানে গভীর মমতায় আঁকা।' },
  { slug: 'banalata-sen', title: 'বনলতা সেন', author: 'jibanananda-das', language: 'bn', category: 'books/poetry', extraCategories: ['books/bangla-literature/classics'], genres: ['poetry', 'bangla_literature'], year: 1942, pages: 64, weightGrams: 120, price: '160.00', stock: 3, description: '"হাজার বছর ধরে আমি পথ হাঁটিতেছি পৃথিবীর পথে" — জীবনানন্দ দাশের বিখ্যাত কবিতাসহ তাঁর অন্যতম প্রধান কাব্যগ্রন্থ।' },
  { slug: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'jane-austen', language: 'en', category: 'books/fiction/novels', genres: ['fiction', 'literature'], year: 1813, pages: 432, weightGrams: 380, price: '350.00', compareAtPrice: '420.00', stock: 12, description: "Elizabeth Bennet and Mr Darcy misjudge each other in Jane Austen's sharp, funny novel about love, class and first impressions." },
  { slug: 'adventures-of-sherlock-holmes', title: 'The Adventures of Sherlock Holmes', author: 'arthur-conan-doyle', language: 'en', category: 'books/fiction/thriller', genres: ['thriller', 'fiction'], year: 1892, pages: 320, weightGrams: 330, price: '380.00', stock: 10, description: "Twelve stories featuring Sherlock Holmes and Dr Watson, including 'A Scandal in Bohemia' and 'The Red-Headed League'.", used: [{ condition: 'used_good', price: '220.00', note: 'Spine creased, pages clean.' }] },
];

export interface DemoProduct {
  slug: string;
  title: string;
  category: string;
  description: string;
  weightGrams: number;
  variants: Array<{ name: string; options: Record<string, string>; price: string; compareAtPrice?: string; stock: number }>;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  { slug: 'demo-ruled-notebook', title: 'রুলটানা খাতা (২০০ পৃষ্ঠা)', category: 'products/stationery/notebooks', description: '৮০ জিএসএম অফসেট কাগজ, সেলাই করা বাঁধাই। ক্লাস নোট ও প্র্যাকটিসের জন্য।', weightGrams: 350, variants: [
    { name: 'A5', options: { size: 'A5' }, price: '90.00', stock: 120 },
    { name: 'A4', options: { size: 'A4' }, price: '140.00', stock: 80 },
  ] },
  { slug: 'demo-gel-pen-set', title: 'জেল পেন সেট (১০ রঙ)', category: 'products/stationery/pens', description: '০.৫ মিমি টিপের ১০টি রঙিন জেল পেন। নোট, ডায়াগ্রাম ও জার্নালের জন্য।', weightGrams: 120, variants: [{ name: 'Default', options: {}, price: '180.00', compareAtPrice: '220.00', stock: 60 }] },
  { slug: 'demo-geometry-box', title: 'জ্যামিতি বক্স', category: 'products/school-supplies/geometry-boxes', description: 'কম্পাস, ডিভাইডার, চাঁদা, সেট স্কয়ার, স্কেল, পেনসিল ও ইরেজার — ধাতব বাক্সে।', weightGrams: 260, variants: [{ name: 'Default', options: {}, price: '220.00', stock: 45 }] },
  { slug: 'demo-wooden-book-stand', title: 'কাঠের বুক স্ট্যান্ড', category: 'products/study-accessories/book-stands', description: 'ভাঁজ করা যায় এমন কাঠের স্ট্যান্ড, ৫টি কোণে সামঞ্জস্যযোগ্য। মোটা বই ও ট্যাবলেট রাখা যায়।', weightGrams: 900, variants: [{ name: 'Default', options: {}, price: '650.00', compareAtPrice: '750.00', stock: 14 }] },
  { slug: 'demo-led-reading-lamp', title: 'এলইডি রিডিং ল্যাম্প', category: 'products/study-accessories/reading-lamps', description: 'তিন ধাপের উজ্জ্বলতা, চোখের জন্য আরামদায়ক উষ্ণ আলো, ইউএসবি চার্জিং।', weightGrams: 600, variants: [
    { name: 'সাদা', options: { color: 'white' }, price: '950.00', stock: 8 },
    { name: 'কালো', options: { color: 'black' }, price: '990.00', stock: 0 },
  ] },
];
