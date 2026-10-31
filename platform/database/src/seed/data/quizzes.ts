/** Starter quizzes written by the Boikonika team (facts checked; explanations shown after submitting). */
export interface SeedQuiz {
  slug: string;
  title: string;
  description: string;
  subject: string;
  academicLevel: string;
  language: 'bn' | 'en';
  timeLimitSeconds: number | null;
  passPercent: number;
  questions: Array<{ prompt: string; options: string[]; correctIndex: number; explanation: string }>;
}

export const QUIZZES: SeedQuiz[] = [
  {
    slug: 'bangla-sahitya-rabindranath-nazrul',
    title: 'বাংলা সাহিত্য: রবীন্দ্রনাথ ও নজরুল',
    description: 'দুই কবির জীবন ও সাহিত্য নিয়ে সাতটি প্রশ্ন।',
    subject: 'bangla',
    academicLevel: 'general',
    language: 'bn',
    timeLimitSeconds: 300,
    passPercent: 60,
    questions: [
      { prompt: 'রবীন্দ্রনাথ ঠাকুর কোন সালে সাহিত্যে নোবেল পুরস্কার পান?', options: ['১৯০৫', '১৯১৩', '১৯২১', '১৯৪১'], correctIndex: 1, explanation: '১৯১৩ সালে তিনি প্রথম এশীয় হিসেবে সাহিত্যে নোবেল পুরস্কার পান।' },
      { prompt: 'কোন কাব্যগ্রন্থের ইংরেজি অনুবাদের (Song Offerings) জন্য রবীন্দ্রনাথ নোবেল পান?', options: ['সোনার তরী', 'গীতাঞ্জলি', 'বলাকা', 'মানসী'], correctIndex: 1, explanation: 'গীতাঞ্জলির ইংরেজি অনুবাদ Song Offerings প্রকাশিত হয় ১৯১২ সালে।' },
      { prompt: 'বাংলাদেশের জাতীয় সংগীত "আমার সোনার বাংলা"-র রচয়িতা কে?', options: ['কাজী নজরুল ইসলাম', 'জসীমউদ্‌দীন', 'রবীন্দ্রনাথ ঠাকুর', 'দ্বিজেন্দ্রলাল রায়'], correctIndex: 2, explanation: 'গানটি রবীন্দ্রনাথ ঠাকুর ১৯০৫ সালে রচনা করেন।' },
      { prompt: 'কাজী নজরুল ইসলামকে কোন নামে ডাকা হয়?', options: ['বিশ্বকবি', 'বিদ্রোহী কবি', 'পল্লীকবি', 'রূপসী বাংলার কবি'], correctIndex: 1, explanation: '"বিদ্রোহী" কবিতার জন্য তিনি বিদ্রোহী কবি নামে পরিচিত।' },
      { prompt: 'বাংলাদেশের জাতীয় কবি কে?', options: ['রবীন্দ্রনাথ ঠাকুর', 'জীবনানন্দ দাশ', 'কাজী নজরুল ইসলাম', 'শামসুর রাহমান'], correctIndex: 2, explanation: 'কাজী নজরুল ইসলাম বাংলাদেশের জাতীয় কবি।' },
      { prompt: '"পথের পাঁচালী" উপন্যাসের লেখক কে?', options: ['শরৎচন্দ্র চট্টোপাধ্যায়', 'বিভূতিভূষণ বন্দ্যোপাধ্যায়', 'মানিক বন্দ্যোপাধ্যায়', 'তারাশঙ্কর বন্দ্যোপাধ্যায়'], correctIndex: 1, explanation: 'পথের পাঁচালী বিভূতিভূষণ বন্দ্যোপাধ্যায়ের প্রথম উপন্যাস (১৯২৯)।' },
      { prompt: '"রূপসী বাংলা" কাব্যগ্রন্থটি কার লেখা?', options: ['জীবনানন্দ দাশ', 'সুকান্ত ভট্টাচার্য', 'জসীমউদ্‌দীন', 'সুফিয়া কামাল'], correctIndex: 0, explanation: 'রূপসী বাংলা জীবনানন্দ দাশের মৃত্যুর পর ১৯৫৭ সালে প্রকাশিত হয়।' },
    ],
  },
  {
    slug: 'physics-basic-units-ssc',
    title: 'পদার্থবিজ্ঞান: একক ও মৌলিক ধারণা',
    description: 'এসএসসি পর্যায়ের পদার্থবিজ্ঞানের একক ও সূত্র নিয়ে ছয়টি প্রশ্ন।',
    subject: 'physics',
    academicLevel: 'ssc',
    language: 'bn',
    timeLimitSeconds: 300,
    passPercent: 60,
    questions: [
      { prompt: 'বলের এসআই একক কী?', options: ['জুল', 'নিউটন', 'ওয়াট', 'প্যাসকেল'], correctIndex: 1, explanation: '১ নিউটন = ১ কেজি ভরের বস্তুতে ১ মি/সে² ত্বরণ সৃষ্টিকারী বল।' },
      { prompt: 'কাজের এসআই একক কী?', options: ['জুল', 'নিউটন', 'ওয়াট', 'হার্জ'], correctIndex: 0, explanation: 'কাজ = বল × সরণ; একক নিউটন-মিটার বা জুল।' },
      { prompt: 'ক্ষমতার এসআই একক কী?', options: ['জুল', 'ওয়াট', 'অ্যাম্পিয়ার', 'ভোল্ট'], correctIndex: 1, explanation: 'ক্ষমতা = কাজ ÷ সময়; ১ ওয়াট = ১ জুল/সেকেন্ড।' },
      { prompt: 'ভরবেগের রাশিমালা কোনটি?', options: ['ভর × ত্বরণ', 'ভর × বেগ', 'বল × সময়²', 'ভর ÷ বেগ'], correctIndex: 1, explanation: 'ভরবেগ p = mv।' },
      { prompt: 'পৃথিবীপৃষ্ঠে অভিকর্ষজ ত্বরণের মান প্রায় কত?', options: ['৯.৮ মি/সে²', '৯৮ মি/সে²', '১.৬ মি/সে²', '৩×১০⁸ মি/সে²'], correctIndex: 0, explanation: 'g ≈ ৯.৮ মি/সে²; চাঁদে এর মান প্রায় ১.৬ মি/সে²।' },
      { prompt: 'শূন্য মাধ্যমে আলোর বেগ প্রায় কত?', options: ['৩×১০⁵ মি/সে', '৩×১০⁸ মি/সে', '৩৪০ মি/সে', '৯.৮ মি/সে'], correctIndex: 1, explanation: 'শূন্য মাধ্যমে আলোর বেগ প্রায় ৩×১০⁸ মিটার/সেকেন্ড; ৩৪০ মি/সে হলো বাতাসে শব্দের বেগ।' },
    ],
  },
  {
    slug: 'general-knowledge-bangladesh',
    title: 'General knowledge: Bangladesh',
    description: 'Seven questions about the country, its history and nature.',
    subject: 'general_knowledge',
    academicLevel: 'general',
    language: 'en',
    timeLimitSeconds: 240,
    passPercent: 60,
    questions: [
      { prompt: 'What is the capital of Bangladesh?', options: ['Chattogram', 'Dhaka', 'Khulna', 'Rajshahi'], correctIndex: 1, explanation: 'Dhaka is the capital and largest city.' },
      { prompt: 'On which date is Bangladesh’s Independence Day?', options: ['21 February', '26 March', '16 December', '14 April'], correctIndex: 1, explanation: 'Independence was declared on 26 March 1971.' },
      { prompt: 'Which date is celebrated as Victory Day?', options: ['16 December', '26 March', '15 August', '21 February'], correctIndex: 0, explanation: 'The Liberation War ended in victory on 16 December 1971.' },
      { prompt: 'UNESCO declared which day International Mother Language Day, honouring the 1952 Language Movement?', options: ['26 March', '21 February', '1 May', '14 April'], correctIndex: 1, explanation: 'UNESCO declared 21 February International Mother Language Day in 1999.' },
      { prompt: 'Which is the largest mangrove forest in the world, shared by Bangladesh and India?', options: ['Lawachara', 'Sundarbans', 'Madhupur', 'Ratargul'], correctIndex: 1, explanation: 'The Sundarbans is the largest mangrove forest and a UNESCO World Heritage Site.' },
      { prompt: 'What is the currency of Bangladesh?', options: ['Rupee', 'Taka', 'Rupiah', 'Ringgit'], correctIndex: 1, explanation: 'The Bangladeshi taka (৳) is the national currency.' },
      { prompt: 'What is the national flower of Bangladesh?', options: ['Rose', 'Water lily (shapla)', 'Marigold', 'Lotus'], correctIndex: 1, explanation: 'The water lily (shapla) is the national flower.' },
    ],
  },
  {
    slug: 'english-grammar-tenses',
    title: 'English grammar: tenses',
    description: 'Five quick questions on verb tenses.',
    subject: 'english',
    academicLevel: 'ssc',
    language: 'en',
    timeLimitSeconds: 180,
    passPercent: 60,
    questions: [
      { prompt: 'She ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], correctIndex: 1, explanation: 'Present simple with a third-person singular subject takes -s: goes.' },
      { prompt: 'They ___ football when it started to rain.', options: ['played', 'were playing', 'have played', 'play'], correctIndex: 1, explanation: 'The past continuous describes an action in progress when another happened.' },
      { prompt: 'I have just ___ my homework.', options: ['finish', 'finishing', 'finished', 'finishes'], correctIndex: 2, explanation: 'The present perfect is have/has + past participle.' },
      { prompt: 'By next June, he ___ his degree.', options: ['completes', 'will have completed', 'has completed', 'completed'], correctIndex: 1, explanation: 'The future perfect describes an action finished before a future time.' },
      { prompt: 'What is the past participle of "write"?', options: ['wrote', 'writed', 'written', 'writing'], correctIndex: 2, explanation: 'write – wrote – written.' },
    ],
  },
];
