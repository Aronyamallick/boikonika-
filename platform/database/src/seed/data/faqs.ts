export interface SeedFaq {
  category: 'general' | 'orders' | 'payments' | 'sellers' | 'authors' | 'account';
  question: { bn: string; en: string };
  answer: { bn: string; en: string };
}

export const FAQS: SeedFaq[] = [
  {
    category: 'general',
    question: { en: 'What is Boikonika?', bn: 'বইকণিকা কী?' },
    answer: {
      en: 'A book-first marketplace and reading community for Bangladesh. You can buy new and used books from verified sellers, track your reading, join book clubs and take part in reading challenges.',
      bn: 'বাংলাদেশের জন্য একটি বইকেন্দ্রিক মার্কেটপ্লেস ও পাঠক কমিউনিটি। এখানে যাচাইকৃত বিক্রেতাদের কাছ থেকে নতুন ও পুরোনো বই কেনা, পড়ার অগ্রগতি রাখা, বুক ক্লাবে যোগ দেওয়া এবং পাঠ চ্যালেঞ্জে অংশ নেওয়া যায়।',
    },
  },
  {
    category: 'orders',
    question: { en: 'Why did my order arrive in several parcels?', bn: 'আমার অর্ডার কয়েকটি পার্সেলে এল কেন?' },
    answer: {
      en: 'Each seller ships their own items, so an order with books from different sellers arrives in separate parcels. Your order page shows the tracking status of every parcel.',
      bn: 'প্রত্যেক বিক্রেতা নিজের পণ্য আলাদাভাবে পাঠান, তাই ভিন্ন ভিন্ন বিক্রেতার বই থাকলে অর্ডার আলাদা পার্সেলে আসে। অর্ডার পাতায় প্রতিটি পার্সেলের ট্র্যাকিং দেখা যায়।',
    },
  },
  {
    category: 'orders',
    question: { en: 'How long does delivery take?', bn: 'ডেলিভারিতে কত সময় লাগে?' },
    answer: {
      en: 'Usually 1–3 days inside Dhaka and 2–5 days elsewhere in Bangladesh. The estimate for each seller is shown at checkout.',
      bn: 'সাধারণত ঢাকার ভেতরে ১–৩ দিন এবং দেশের অন্যান্য জায়গায় ২–৫ দিন। চেকআউটে প্রত্যেক বিক্রেতার আনুমানিক সময় দেখানো হয়।',
    },
  },
  {
    category: 'orders',
    question: { en: 'Can I cancel an order?', bn: 'অর্ডার কি বাতিল করা যায়?' },
    answer: {
      en: 'Yes, until the seller ships it. Open the order and choose Cancel. Any online payment is refunded to the original payment method.',
      bn: 'হ্যাঁ, বিক্রেতা পাঠানোর আগ পর্যন্ত। অর্ডারটি খুলে বাতিল নির্বাচন করুন। অনলাইনে পরিশোধিত অর্থ মূল পেমেন্ট মাধ্যমে ফেরত দেওয়া হয়।',
    },
  },
  {
    category: 'orders',
    question: { en: 'What do the used-book conditions mean?', bn: 'পুরোনো বইয়ের অবস্থার মানে কী?' },
    answer: {
      en: 'Like New: no marks and a tight binding. Good: light wear, possibly a name on the first page. Acceptable: visible wear or notes, but every page is present and readable.',
      bn: 'প্রায় নতুন: কোনো দাগ নেই, বাঁধাই মজবুত। ভালো: সামান্য ব্যবহারের ছাপ, প্রথম পাতায় নাম লেখা থাকতে পারে। চলনসই: ব্যবহারের ছাপ বা নোট আছে, তবে সব পৃষ্ঠা আছে এবং পড়া যায়।',
    },
  },
  {
    category: 'payments',
    question: { en: 'Which payment methods can I use?', bn: 'কোন কোন মাধ্যমে পেমেন্ট করা যায়?' },
    answer: {
      en: 'bKash, Nagad, Rocket, debit and credit cards, internet banking and Cash on Delivery. The methods available for your order are shown at checkout.',
      bn: 'বিকাশ, নগদ, রকেট, ডেবিট ও ক্রেডিট কার্ড, ইন্টারনেট ব্যাংকিং এবং ক্যাশ অন ডেলিভারি। আপনার অর্ডারে কোন মাধ্যমগুলো প্রযোজ্য তা চেকআউটে দেখানো হয়।',
    },
  },
  {
    category: 'payments',
    question: { en: 'Is my payment information safe?', bn: 'আমার পেমেন্টের তথ্য কি নিরাপদ?' },
    answer: {
      en: 'Yes. Payments are processed by licensed providers on their own secure pages. Boikonika never sees or stores your card number or wallet PIN.',
      bn: 'হ্যাঁ। লাইসেন্সপ্রাপ্ত প্রতিষ্ঠানগুলো তাদের নিজস্ব নিরাপদ পাতায় পেমেন্ট প্রক্রিয়া করে। বইকণিকা কখনো আপনার কার্ড নম্বর বা ওয়ালেটের পিন দেখে না বা সংরক্ষণ করে না।',
    },
  },
  {
    category: 'sellers',
    question: { en: 'How do I become a seller?', bn: 'কীভাবে বিক্রেতা হব?' },
    answer: {
      en: 'Choose Become a seller in your account, pick your seller type and upload your identity documents (and a trade licence for businesses). Applications are usually reviewed within 3 working days.',
      bn: 'অ্যাকাউন্ট থেকে বিক্রেতা হোন নির্বাচন করুন, বিক্রেতার ধরন বেছে নিন এবং পরিচয়পত্র (ব্যবসার ক্ষেত্রে ট্রেড লাইসেন্সও) আপলোড করুন। সাধারণত ৩ কর্মদিবসের মধ্যে আবেদন পর্যালোচনা করা হয়।',
    },
  },
  {
    category: 'sellers',
    question: { en: 'When do sellers get paid?', bn: 'বিক্রেতারা কখন টাকা পান?' },
    answer: {
      en: 'After an order is delivered and its return window has passed, the earnings minus commission become available and are paid to your verified bKash, Nagad, Rocket or bank account.',
      bn: 'অর্ডার ডেলিভারি হওয়ার পর ফেরতের সময়সীমা পার হলে কমিশন বাদে আয় পরিশোধযোগ্য হয় এবং আপনার যাচাইকৃত বিকাশ, নগদ, রকেট বা ব্যাংক অ্যাকাউন্টে পাঠানো হয়।',
    },
  },
  {
    category: 'authors',
    question: { en: 'I am an author. How do I claim my author page?', bn: 'আমি লেখক। কীভাবে আমার লেখক পাতা দাবি করব?' },
    answer: {
      en: 'Apply for author verification from your account. Once approved, your account is linked to your author page and you get the author dashboard with followers, reviews and sales insights.',
      bn: 'অ্যাকাউন্ট থেকে লেখক যাচাইয়ের আবেদন করুন। অনুমোদনের পর আপনার অ্যাকাউন্ট লেখক পাতার সঙ্গে যুক্ত হবে এবং অনুসারী, রিভিউ ও বিক্রির তথ্যসহ লেখক ড্যাশবোর্ড পাবেন।',
    },
  },
  {
    category: 'account',
    question: { en: 'Can I use one account as a reader and a seller?', bn: 'একটি অ্যাকাউন্ট দিয়ে কি পাঠক ও বিক্রেতা দুটোই হওয়া যায়?' },
    answer: {
      en: 'Yes. One account can have several roles, such as customer, student, author and seller. Each role adds its own dashboard and tools.',
      bn: 'হ্যাঁ। একটি অ্যাকাউন্টে একাধিক ভূমিকা থাকতে পারে, যেমন ক্রেতা, শিক্ষার্থী, লেখক ও বিক্রেতা। প্রতিটি ভূমিকার জন্য আলাদা ড্যাশবোর্ড ও টুল যুক্ত হয়।',
    },
  },
  {
    category: 'account',
    question: { en: 'How do I secure my account?', bn: 'কীভাবে অ্যাকাউন্ট সুরক্ষিত রাখব?' },
    answer: {
      en: 'Use a strong password, turn on two-step verification in your security settings and review your active devices. You can sign out of every device at once if something looks wrong.',
      bn: 'শক্তিশালী পাসওয়ার্ড ব্যবহার করুন, নিরাপত্তা সেটিংস থেকে দুই ধাপের যাচাই চালু করুন এবং সক্রিয় ডিভাইসগুলো দেখে নিন। কিছু অস্বাভাবিক মনে হলে একসঙ্গে সব ডিভাইস থেকে লগআউট করতে পারবেন।',
    },
  },
];
