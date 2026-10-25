/**
 * Default CMS pages (Markdown, Bangla + English). Seeded once — admins edit them in the CMS and
 * re-seeding never overwrites their changes. Have the legal pages reviewed before launch.
 */
export interface SeedPage {
  slug: string;
  title: { bn: string; en: string };
  body: { bn: string; en: string };
}

export const PAGES: SeedPage[] = [
  {
    slug: 'about',
    title: { bn: 'আমাদের সম্পর্কে', en: 'About Boikonika' },
    body: {
      en: `Boikonika is a book-first marketplace and reading community for Bangladesh. Readers, students, teachers, authors, publishers and booksellers come here to buy and sell books, find what to read next, join book clubs and build a reading habit.

## What you can do
- Buy new and used books from verified sellers, with a clear condition grade on every used copy.
- Compare offers from several sellers for the same edition.
- Track your reading, join challenges and earn badges for real progress.
- Join or start book clubs for your school, college, university or friends.
- Read a preview before you buy and keep purchased digital books in your library.

## Our principles
- **Books first.** Recommendations follow what you read, not how long you scroll.
- **Trust.** Sellers, authors and publishers are verified before they can sell or claim a profile.
- **Respect for creators.** Only rights holders may upload digital books, and we act quickly on copyright complaints.
- **Your data is yours.** You decide what your profile shows and can switch off personalisation at any time.

Boikonika is built and maintained by Arieskonex Technologies.`,
      bn: `বইকণিকা বাংলাদেশের জন্য একটি বইকেন্দ্রিক মার্কেটপ্লেস ও পাঠক কমিউনিটি। পাঠক, শিক্ষার্থী, শিক্ষক, লেখক, প্রকাশক ও বই বিক্রেতারা এখানে বই কেনাবেচা করেন, পরের বইটি খুঁজে নেন, বুক ক্লাবে যোগ দেন এবং পড়ার অভ্যাস গড়ে তোলেন।

## আপনি যা করতে পারেন
- যাচাইকৃত বিক্রেতাদের কাছ থেকে নতুন ও পুরোনো বই কিনুন; প্রতিটি পুরোনো বইয়ের অবস্থা স্পষ্টভাবে লেখা থাকে।
- একই সংস্করণের জন্য একাধিক বিক্রেতার অফার তুলনা করুন।
- পড়ার অগ্রগতি রাখুন, চ্যালেঞ্জে অংশ নিন এবং সত্যিকারের অগ্রগতির জন্য ব্যাজ অর্জন করুন।
- স্কুল, কলেজ, বিশ্ববিদ্যালয় বা বন্ধুদের নিয়ে বুক ক্লাবে যোগ দিন অথবা নতুন ক্লাব শুরু করুন।
- কেনার আগে প্রিভিউ পড়ুন এবং কেনা ডিজিটাল বই নিজের লাইব্রেরিতে রাখুন।

## আমাদের নীতি
- **বই সবার আগে।** সুপারিশ হয় আপনি কী পড়ছেন তার ভিত্তিতে, কতক্ষণ স্ক্রল করছেন তার ভিত্তিতে নয়।
- **আস্থা।** বিক্রি শুরু বা প্রোফাইল দাবি করার আগে বিক্রেতা, লেখক ও প্রকাশকদের যাচাই করা হয়।
- **স্রষ্টার প্রতি সম্মান।** শুধু স্বত্বাধিকারীরাই ডিজিটাল বই আপলোড করতে পারেন, আর কপিরাইট অভিযোগে আমরা দ্রুত ব্যবস্থা নিই।
- **আপনার তথ্য আপনার।** প্রোফাইলে কী দেখা যাবে তা আপনিই ঠিক করেন এবং যেকোনো সময় ব্যক্তিগতকৃত সুপারিশ বন্ধ করতে পারেন।

বইকণিকা তৈরি ও রক্ষণাবেক্ষণ করে Arieskonex Technologies।`,
    },
  },
  {
    slug: 'terms',
    title: { bn: 'ব্যবহারের শর্তাবলি', en: 'Terms of Use' },
    body: {
      en: `These terms apply to everyone who uses Boikonika: readers, students, teachers, authors, publishers, sellers, institutions and delivery partners. By creating an account or placing an order you agree to them.

## 1. Your account
- Give accurate information and keep your password and verification codes private.
- One person holds one account; an account can carry several roles (for example customer and author).
- You are responsible for activity on your account. If you suspect unauthorised access, sign out of all devices from your security settings and contact support.

## 2. Buying
- Prices are shown in Bangladeshi Taka (BDT). Delivery charges are shown before you pay.
- An order can contain items from several sellers. Each seller ships, and is responsible for, their part of the order.
- Used books are graded New, Used – Like New, Used – Good or Used – Acceptable, and sellers must describe defects honestly.
- Returns and refunds follow the Return Policy.

## 3. Selling
- Only verified sellers may list products. Verification needs identity documents and, for businesses, a trade licence.
- Listings must be accurate, legal and owned or authorised by the seller. Counterfeit, pirated or photocopied books are forbidden.
- Boikonika deducts the commission shown in your seller dashboard from each completed sale and pays the balance on the payout schedule.

## 4. Content you post
- You keep ownership of the reviews, posts and other content you create, and give Boikonika permission to show it on the platform.
- Content must follow the Community Guidelines. We may remove content or restrict accounts that break them.

## 5. Copyright
Upload only content you own or are authorised to distribute. Rights holders can report infringement under the Copyright Policy, and repeat infringers lose their accounts.

## 6. Payments
Online payments are processed by licensed payment providers such as bKash, Nagad, Rocket and card gateways. Boikonika never stores your card number or mobile wallet PIN.

## 7. Suspension and termination
We may warn, restrict, suspend or close accounts that break these terms or the law. You can appeal a decision by contacting support, and you may close your account at any time.

## 8. Liability
Boikonika provides the marketplace and the community; sellers are responsible for the products they sell. To the extent the law allows, our liability for a claim is limited to the amount you paid for the order concerned.

## 9. Changes
We will tell you about material changes to these terms at least 7 days before they take effect.

## 10. Governing law
These terms are governed by the laws of Bangladesh, and the courts of Dhaka have jurisdiction.`,
      bn: `এই শর্তাবলি বইকণিকার সব ব্যবহারকারীর জন্য প্রযোজ্য: পাঠক, শিক্ষার্থী, শিক্ষক, লেখক, প্রকাশক, বিক্রেতা, প্রতিষ্ঠান ও ডেলিভারি সহযোগী। অ্যাকাউন্ট খুলে বা অর্ডার করে আপনি এই শর্তাবলিতে সম্মতি দিচ্ছেন।

## ১. আপনার অ্যাকাউন্ট
- সঠিক তথ্য দিন এবং পাসওয়ার্ড ও যাচাই কোড গোপন রাখুন।
- একজন ব্যক্তির একটি অ্যাকাউন্ট থাকবে; একটি অ্যাকাউন্টে একাধিক ভূমিকা থাকতে পারে (যেমন ক্রেতা ও লেখক)।
- অ্যাকাউন্টের সব কার্যক্রমের দায় আপনার। অননুমোদিত প্রবেশের সন্দেহ হলে নিরাপত্তা সেটিংস থেকে সব ডিভাইস থেকে লগআউট করুন এবং সহায়তা টিমকে জানান।

## ২. কেনাকাটা
- দাম বাংলাদেশি টাকায় (৳) দেখানো হয়। পেমেন্টের আগেই ডেলিভারি চার্জ দেখানো হয়।
- একটি অর্ডারে একাধিক বিক্রেতার পণ্য থাকতে পারে। প্রত্যেক বিক্রেতা নিজের অংশ পাঠান এবং তার দায় নেন।
- পুরোনো বইয়ের অবস্থা নতুন, পুরোনো — প্রায় নতুন, পুরোনো — ভালো অথবা পুরোনো — চলনসই হিসেবে চিহ্নিত হয়; বিক্রেতাকে ত্রুটি সৎভাবে উল্লেখ করতে হয়।
- ফেরত ও রিফান্ড রিটার্ন নীতিমালা অনুযায়ী হয়।

## ৩. বিক্রি
- শুধু যাচাইকৃত বিক্রেতারা পণ্য তালিকাভুক্ত করতে পারেন। যাচাইয়ের জন্য পরিচয়পত্র এবং ব্যবসার ক্ষেত্রে ট্রেড লাইসেন্স লাগে।
- তালিকা সঠিক, বৈধ এবং বিক্রেতার মালিকানাধীন বা অনুমোদিত হতে হবে। নকল, পাইরেটেড বা ফটোকপি করা বই বিক্রি নিষিদ্ধ।
- প্রতিটি সম্পন্ন বিক্রি থেকে বিক্রেতা ড্যাশবোর্ডে দেখানো কমিশন কেটে রাখা হয় এবং বাকি অর্থ পেআউট সূচি অনুযায়ী পরিশোধ করা হয়।

## ৪. আপনার পোস্ট করা কনটেন্ট
- আপনার লেখা রিভিউ, পোস্ট ও অন্যান্য কনটেন্টের মালিকানা আপনার থাকে; প্ল্যাটফর্মে তা দেখানোর অনুমতি আপনি বইকণিকাকে দেন।
- কনটেন্টকে কমিউনিটি নির্দেশিকা মেনে চলতে হবে। নির্দেশিকা ভঙ্গ করলে কনটেন্ট সরানো বা অ্যাকাউন্ট সীমিত করা হতে পারে।

## ৫. কপিরাইট
শুধু নিজের মালিকানাধীন বা বিতরণের অনুমতি আছে এমন কনটেন্ট আপলোড করুন। স্বত্বাধিকারীরা কপিরাইট নীতিমালা অনুযায়ী লঙ্ঘনের অভিযোগ করতে পারেন; বারবার লঙ্ঘনকারীর অ্যাকাউন্ট বন্ধ করা হয়।

## ৬. পেমেন্ট
অনলাইন পেমেন্ট প্রক্রিয়া করে লাইসেন্সপ্রাপ্ত পেমেন্ট প্রতিষ্ঠান, যেমন বিকাশ, নগদ, রকেট ও কার্ড গেটওয়ে। বইকণিকা কখনো আপনার কার্ড নম্বর বা মোবাইল ওয়ালেটের পিন সংরক্ষণ করে না।

## ৭. স্থগিত ও বন্ধ
এই শর্তাবলি বা আইন ভঙ্গ করলে আমরা সতর্ক করতে, সীমিত করতে, স্থগিত করতে বা অ্যাকাউন্ট বন্ধ করতে পারি। সিদ্ধান্তের বিরুদ্ধে সহায়তা টিমের মাধ্যমে আপিল করা যায়, আর আপনি যেকোনো সময় নিজের অ্যাকাউন্ট বন্ধ করতে পারেন।

## ৮. দায়সীমা
বইকণিকা মার্কেটপ্লেস ও কমিউনিটির সুবিধা দেয়; বিক্রিত পণ্যের দায় সংশ্লিষ্ট বিক্রেতার। আইনের অনুমোদিত সীমা পর্যন্ত কোনো দাবিতে আমাদের দায় সংশ্লিষ্ট অর্ডারে আপনার পরিশোধিত অর্থের মধ্যে সীমাবদ্ধ।

## ৯. পরিবর্তন
শর্তাবলিতে গুরুত্বপূর্ণ পরিবর্তন কার্যকর হওয়ার অন্তত ৭ দিন আগে আমরা আপনাকে জানাব।

## ১০. প্রযোজ্য আইন
এই শর্তাবলি বাংলাদেশের আইন দ্বারা পরিচালিত এবং ঢাকার আদালতের এখতিয়ারাধীন।`,
    },
  },
  {
    slug: 'privacy',
    title: { bn: 'গোপনীয়তা নীতি', en: 'Privacy Policy' },
    body: {
      en: `This policy explains what Boikonika collects, why, and the choices you have.

## What we collect
- **Account details:** name, username, email and/or mobile number, password (stored only as a one-way hash) and your language and theme preferences.
- **Orders:** delivery addresses, items, payment status and delivery updates. We never receive your card number or wallet PIN; payment providers handle them.
- **Verification (KYC):** identity and business documents for sellers, authors, publishers, teachers, students and institutions. They are stored in private, encrypted storage, only authorised reviewers can open them, and every view is logged.
- **Reading and community activity:** your library, reading progress, reviews, posts, clubs and challenge progress.
- **Security data:** devices you sign in from, IP addresses and login history, used to protect your account.

## Why we use it
To run your account and orders, deliver books, prevent fraud and abuse, show recommendations (you can turn this off), and improve the service using aggregated statistics.

## Who sees it
- Sellers see the name, phone number and delivery address for their own orders only.
- Couriers receive what they need to deliver your parcel.
- Payment providers receive what they need to process a payment.
- Your public profile shows only what your privacy settings allow. NID and other document numbers are never shown publicly.
We do not sell your personal data.

## How long we keep it
Order records are kept as accounting law requires. Verification documents are deleted 90 days after a rejected application, and after the retention period once an approved verification ends. Deleted accounts are anonymised.

## Your choices
You can update your profile, change privacy settings, switch off personalised recommendations, choose which notifications you receive, download your data and delete your account from your settings.

## Children
Students under 18 should use Boikonika with a parent's or guardian's permission. Teachers and institutions must not upload students' personal documents without consent.

## Contact
Questions about privacy can be sent through the Contact page.`,
      bn: `এই নীতিতে বলা হয়েছে বইকণিকা কোন তথ্য সংগ্রহ করে, কেন করে এবং আপনার কী কী নিয়ন্ত্রণ আছে।

## আমরা যা সংগ্রহ করি
- **অ্যাকাউন্টের তথ্য:** নাম, ইউজারনেম, ইমেইল এবং/অথবা মোবাইল নম্বর, পাসওয়ার্ড (শুধু একমুখী হ্যাশ হিসেবে সংরক্ষিত) এবং ভাষা ও থিমের পছন্দ।
- **অর্ডার:** ডেলিভারির ঠিকানা, পণ্য, পেমেন্টের অবস্থা ও ডেলিভারির হালনাগাদ তথ্য। আপনার কার্ড নম্বর বা ওয়ালেটের পিন আমরা কখনো পাই না; সেগুলো পেমেন্ট প্রতিষ্ঠান পরিচালনা করে।
- **যাচাই (কেওয়াইসি):** বিক্রেতা, লেখক, প্রকাশক, শিক্ষক, শিক্ষার্থী ও প্রতিষ্ঠানের পরিচয় ও ব্যবসায়িক কাগজপত্র। এগুলো ব্যক্তিগত ও এনক্রিপ্টেড স্টোরেজে রাখা হয়, শুধু অনুমোদিত পর্যালোচকেরা দেখতে পারেন এবং প্রতিবার দেখার রেকর্ড রাখা হয়।
- **পড়া ও কমিউনিটি কার্যক্রম:** আপনার লাইব্রেরি, পড়ার অগ্রগতি, রিভিউ, পোস্ট, ক্লাব ও চ্যালেঞ্জের অগ্রগতি।
- **নিরাপত্তা তথ্য:** যে ডিভাইস থেকে লগইন করেন, আইপি ঠিকানা ও লগইনের ইতিহাস — আপনার অ্যাকাউন্ট সুরক্ষার জন্য।

## কেন ব্যবহার করি
অ্যাকাউন্ট ও অর্ডার পরিচালনা, বই পৌঁছে দেওয়া, প্রতারণা ও অপব্যবহার প্রতিরোধ, সুপারিশ দেখানো (আপনি বন্ধ করতে পারেন) এবং সমষ্টিগত পরিসংখ্যান দিয়ে সেবা উন্নত করার জন্য।

## কারা দেখতে পায়
- বিক্রেতারা শুধু নিজেদের অর্ডারের নাম, ফোন নম্বর ও ডেলিভারির ঠিকানা দেখতে পান।
- কুরিয়ার পার্সেল পৌঁছাতে যতটুকু তথ্য দরকার ততটুকু পায়।
- পেমেন্ট প্রতিষ্ঠান পেমেন্ট প্রক্রিয়ার জন্য প্রয়োজনীয় তথ্য পায়।
- আপনার পাবলিক প্রোফাইলে শুধু গোপনীয়তা সেটিংসে অনুমোদিত তথ্য দেখা যায়। এনআইডি বা অন্য কোনো কাগজপত্রের নম্বর কখনো প্রকাশ্যে দেখানো হয় না।
আমরা আপনার ব্যক্তিগত তথ্য বিক্রি করি না।

## কতদিন রাখি
হিসাব সংক্রান্ত আইন অনুযায়ী অর্ডারের রেকর্ড রাখা হয়। আবেদন বাতিল হলে ৯০ দিন পর, আর অনুমোদিত যাচাইয়ের ক্ষেত্রে সংরক্ষণকাল শেষে যাচাইয়ের কাগজপত্র মুছে ফেলা হয়। মুছে ফেলা অ্যাকাউন্টের তথ্য বেনামি করা হয়।

## আপনার নিয়ন্ত্রণ
সেটিংস থেকে প্রোফাইল হালনাগাদ, গোপনীয়তা সেটিংস পরিবর্তন, ব্যক্তিগতকৃত সুপারিশ বন্ধ, কোন নোটিফিকেশন পাবেন তা নির্বাচন, নিজের তথ্য ডাউনলোড এবং অ্যাকাউন্ট মুছে ফেলতে পারেন।

## শিশু-কিশোর
১৮ বছরের কম বয়সী শিক্ষার্থীদের অভিভাবকের অনুমতি নিয়ে বইকণিকা ব্যবহার করা উচিত। শিক্ষক ও প্রতিষ্ঠান সম্মতি ছাড়া শিক্ষার্থীদের ব্যক্তিগত কাগজপত্র আপলোড করতে পারবেন না।

## যোগাযোগ
গোপনীয়তা নিয়ে প্রশ্ন থাকলে যোগাযোগ পাতার মাধ্যমে পাঠান।`,
    },
  },
  {
    slug: 'return-policy',
    title: { bn: 'রিটার্ন ও রিফান্ড নীতিমালা', en: 'Return & Refund Policy' },
    body: {
      en: `## When you can return an item
You can request a return within 7 days of delivery if the item:
- is damaged, defective or has missing pages;
- is not what you ordered (wrong title, edition or format);
- is in a worse condition than the grade the seller listed.

Change-of-mind returns are accepted only when the seller's store policy allows them, and the item must be unused and in its original packaging.

Digital books cannot be returned once you have opened them, unless the file is faulty.

## How to return
1. Open the order and choose **Request return** for the item.
2. Tell us the reason and add photos where they help.
3. The seller replies within 2 working days. If they do not, or you disagree with the answer, Boikonika support reviews the request.

## Refunds
- Approved refunds go back to the original payment method. Mobile wallet and card refunds usually arrive within 3–10 working days, depending on the provider.
- Cash on Delivery orders are refunded to a bKash, Nagad or Rocket account of your choice.
- Delivery charges are refunded when the return is caused by the seller (damaged, wrong or misdescribed item).`,
      bn: `## কখন ফেরত দিতে পারবেন
ডেলিভারির ৭ দিনের মধ্যে ফেরতের অনুরোধ করতে পারবেন, যদি পণ্যটি:
- ক্ষতিগ্রস্ত, ত্রুটিপূর্ণ বা পৃষ্ঠা অনুপস্থিত থাকে;
- অর্ডার করা পণ্য না হয় (ভুল বই, সংস্করণ বা ফরম্যাট);
- বিক্রেতার উল্লেখ করা অবস্থার চেয়ে খারাপ অবস্থায় থাকে।

শুধু মত পরিবর্তনের কারণে ফেরত নেওয়া হয় তখনই, যখন বিক্রেতার স্টোর নীতিতে তা অনুমোদিত; সেক্ষেত্রে পণ্য অব্যবহৃত ও মূল প্যাকেটে থাকতে হবে।

ডিজিটাল বই খোলার পর ফেরত দেওয়া যায় না, তবে ফাইল ত্রুটিপূর্ণ হলে দেওয়া যায়।

## কীভাবে ফেরত দেবেন
১. অর্ডারটি খুলে পণ্যের পাশে **ফেরতের অনুরোধ** নির্বাচন করুন।
২. কারণ লিখুন এবং প্রয়োজনে ছবি যুক্ত করুন।
৩. বিক্রেতা ২ কর্মদিবসের মধ্যে উত্তর দেবেন। উত্তর না দিলে বা উত্তরে আপনি একমত না হলে বইকণিকা সহায়তা টিম অনুরোধটি পর্যালোচনা করবে।

## রিফান্ড
- অনুমোদিত রিফান্ড মূল পেমেন্ট মাধ্যমে ফেরত যায়। প্রতিষ্ঠানভেদে মোবাইল ওয়ালেট ও কার্ডে সাধারণত ৩–১০ কর্মদিবস লাগে।
- ক্যাশ অন ডেলিভারি অর্ডারের রিফান্ড আপনার পছন্দের বিকাশ, নগদ বা রকেট অ্যাকাউন্টে পাঠানো হয়।
- বিক্রেতার কারণে ফেরত হলে (ক্ষতিগ্রস্ত, ভুল বা ভুলভাবে বর্ণিত পণ্য) ডেলিভারি চার্জও ফেরত দেওয়া হয়।`,
    },
  },
  {
    slug: 'shipping-policy',
    title: { bn: 'ডেলিভারি নীতিমালা', en: 'Delivery Policy' },
    body: {
      en: `## Where we deliver
We deliver to all 64 districts of Bangladesh through partner couriers and sellers' own delivery services.

## Delivery time
- Inside Dhaka: usually 1–3 days.
- Outside Dhaka: usually 2–5 days.
Each seller ships separately, so items in one order can arrive on different days. Your order page shows each shipment's tracking status.

## Delivery charges
Charges depend on the delivery method and on whether the address is inside or outside Dhaka. They are always shown at checkout before you pay. Some sellers offer free delivery above a minimum order value.

## Cash on Delivery
Cash on Delivery is available for most orders. Please keep the exact amount ready and check the parcel before paying.

## If delivery fails
The courier tries again or contacts you. Parcels that cannot be delivered after repeated attempts return to the seller and any online payment is refunded under the Return Policy.`,
      bn: `## কোথায় ডেলিভারি দিই
সহযোগী কুরিয়ার ও বিক্রেতাদের নিজস্ব ডেলিভারির মাধ্যমে বাংলাদেশের ৬৪টি জেলাতেই ডেলিভারি দেওয়া হয়।

## ডেলিভারির সময়
- ঢাকার ভেতরে: সাধারণত ১–৩ দিন।
- ঢাকার বাইরে: সাধারণত ২–৫ দিন।
প্রত্যেক বিক্রেতা আলাদাভাবে পাঠান, তাই একই অর্ডারের পণ্য ভিন্ন ভিন্ন দিনে পৌঁছাতে পারে। অর্ডার পাতায় প্রতিটি চালানের ট্র্যাকিং দেখা যায়।

## ডেলিভারি চার্জ
চার্জ নির্ভর করে ডেলিভারির ধরন এবং ঠিকানা ঢাকার ভেতরে না বাইরে তার ওপর। পেমেন্টের আগে চেকআউটে সবসময় চার্জ দেখানো হয়। কিছু বিক্রেতা নির্দিষ্ট মূল্যের বেশি অর্ডারে ফ্রি ডেলিভারি দেন।

## ক্যাশ অন ডেলিভারি
বেশিরভাগ অর্ডারে ক্যাশ অন ডেলিভারি সুবিধা আছে। অনুগ্রহ করে নির্দিষ্ট টাকা প্রস্তুত রাখুন এবং টাকা দেওয়ার আগে পার্সেল দেখে নিন।

## ডেলিভারি ব্যর্থ হলে
কুরিয়ার আবার চেষ্টা করে বা আপনার সঙ্গে যোগাযোগ করে। বারবার চেষ্টার পরও পৌঁছানো না গেলে পার্সেল বিক্রেতার কাছে ফেরত যায় এবং অনলাইন পেমেন্ট রিটার্ন নীতিমালা অনুযায়ী ফেরত দেওয়া হয়।`,
    },
  },
  {
    slug: 'seller-policy',
    title: { bn: 'বিক্রেতা নীতিমালা', en: 'Seller Policy' },
    body: {
      en: `## Becoming a seller
1. Apply from your account and choose Book Seller, General Seller, Publisher or Author.
2. Upload your NID, passport or driving licence. Businesses also upload a trade licence and, where applicable, a TIN certificate.
3. Our team reviews the application, usually within 3 working days. You will be told if anything needs to be resubmitted.

## Listing rules
- Describe every product accurately. Used books must carry an honest condition grade and mention any marks, missing pages or damage.
- Sell only original books. Pirated copies, unauthorised photocopies and counterfeit products are removed, and the account may be suspended.
- Do not list prohibited items or misleading prices.
- When an edition already exists on Boikonika, add your offer to it instead of creating a duplicate.

## Orders
- Confirm or cancel new orders within 24 hours and ship within the handling time on your store.
- Keep stock up to date. Repeatedly cancelling orders for lack of stock lowers your store rating.
- Use the customer's address and phone number only to deliver their order.

## Commission and payouts
The commission for your account is shown in your seller dashboard. Earnings become available after the order is delivered and the return window has passed, and are paid to your verified bKash, Nagad, Rocket or bank account.

## Performance
Late shipping, high cancellation rates and policy violations can lead to warnings, listing removal, temporary restriction or suspension.`,
      bn: `## বিক্রেতা হতে
১. অ্যাকাউন্ট থেকে আবেদন করুন এবং বই বিক্রেতা, সাধারণ বিক্রেতা, প্রকাশক বা লেখক নির্বাচন করুন।
২. এনআইডি, পাসপোর্ট বা ড্রাইভিং লাইসেন্স আপলোড করুন। ব্যবসার ক্ষেত্রে ট্রেড লাইসেন্স এবং প্রযোজ্য হলে টিআইএন সনদও দিন।
৩. আমাদের টিম সাধারণত ৩ কর্মদিবসের মধ্যে আবেদন পর্যালোচনা করে। কিছু আবার জমা দিতে হলে আপনাকে জানানো হবে।

## তালিকাভুক্তির নিয়ম
- প্রতিটি পণ্যের সঠিক বর্ণনা দিন। পুরোনো বইয়ের অবস্থা সৎভাবে উল্লেখ করুন এবং দাগ, অনুপস্থিত পৃষ্ঠা বা ক্ষতির কথা জানান।
- শুধু মূল বই বিক্রি করুন। পাইরেটেড কপি, অননুমোদিত ফটোকপি ও নকল পণ্য সরিয়ে ফেলা হয় এবং অ্যাকাউন্ট স্থগিত হতে পারে।
- নিষিদ্ধ পণ্য বা বিভ্রান্তিকর দাম দেবেন না।
- কোনো সংস্করণ আগে থেকেই বইকণিকায় থাকলে নতুন করে না বানিয়ে সেটিতেই আপনার অফার যুক্ত করুন।

## অর্ডার
- নতুন অর্ডার ২৪ ঘণ্টার মধ্যে নিশ্চিত বা বাতিল করুন এবং স্টোরে উল্লেখ করা সময়ের মধ্যে পাঠান।
- স্টক হালনাগাদ রাখুন। স্টক না থাকার কারণে বারবার অর্ডার বাতিল হলে স্টোরের রেটিং কমে যায়।
- ক্রেতার ঠিকানা ও ফোন নম্বর শুধু তার অর্ডার পৌঁছাতে ব্যবহার করুন।

## কমিশন ও পেআউট
আপনার অ্যাকাউন্টের কমিশন বিক্রেতা ড্যাশবোর্ডে দেখানো হয়। অর্ডার ডেলিভারি হওয়ার পর এবং ফেরতের সময়সীমা পার হলে আয় পরিশোধযোগ্য হয়, যা আপনার যাচাইকৃত বিকাশ, নগদ, রকেট বা ব্যাংক অ্যাকাউন্টে পাঠানো হয়।

## পারফরম্যান্স
দেরিতে পাঠানো, বেশি বাতিল এবং নীতিমালা ভঙ্গের কারণে সতর্কবার্তা, তালিকা অপসারণ, সাময়িক সীমাবদ্ধতা বা স্থগিতাদেশ হতে পারে।`,
    },
  },
  {
    slug: 'copyright-policy',
    title: { bn: 'কপিরাইট নীতিমালা', en: 'Copyright Policy' },
    body: {
      en: `Boikonika respects the rights of authors and publishers. Digital books, previews and excerpts may be uploaded only by the rights holder or with their written permission.

## Reporting infringement
If you own the rights to a work and believe it is being shared on Boikonika without permission, use **Report → Copyright** on the item, or the [copyright complaint form](/copyright). Include:
- your name and contact details, and whether you are the rights holder or act for them;
- the work that is being infringed;
- links to the content on Boikonika;
- a statement that the information is accurate and that you have not authorised the use.

We review complete notices, usually within 2 working days. Infringing content is removed or restricted and the uploader is notified.

## Counter-notice
If your content was removed and you believe that was a mistake, or that you have the right to share it, you can send a counter-notice from your [account standing](/account/standing) page (the notification you received links there). Explain why and provide evidence such as a licence or a publishing agreement. We forward the counter-notice to the person who reported the content and may restore the content if they do not pursue the claim.

## Repeat infringers
Accounts that repeatedly infringe copyright are suspended or closed.

## Quotations
Short quotations for review, criticism, teaching or research are welcome when they are credited and kept short.`,
      bn: `বইকণিকা লেখক ও প্রকাশকদের অধিকারকে সম্মান করে। ডিজিটাল বই, প্রিভিউ ও অংশবিশেষ শুধু স্বত্বাধিকারী অথবা তার লিখিত অনুমতি নিয়ে আপলোড করা যায়।

## লঙ্ঘনের অভিযোগ
কোনো রচনার স্বত্ব আপনার হলে এবং তা অনুমতি ছাড়া বইকণিকায় শেয়ার হচ্ছে মনে হলে সংশ্লিষ্ট কনটেন্টে **রিপোর্ট → কপিরাইট** ব্যবহার করুন অথবা [কপিরাইট অভিযোগের ফর্ম](/copyright) পূরণ করুন। যা দিতে হবে:
- আপনার নাম ও যোগাযোগের তথ্য, এবং আপনি স্বত্বাধিকারী নাকি তার পক্ষে অভিযোগ করছেন;
- কোন রচনার স্বত্ব লঙ্ঘিত হয়েছে;
- বইকণিকায় সংশ্লিষ্ট কনটেন্টের লিংক;
- এই মর্মে বিবৃতি যে তথ্যগুলো সঠিক এবং আপনি এই ব্যবহারের অনুমতি দেননি।

সম্পূর্ণ অভিযোগ সাধারণত ২ কর্মদিবসের মধ্যে পর্যালোচনা করা হয়। লঙ্ঘনকারী কনটেন্ট সরিয়ে বা সীমিত করে আপলোডকারীকে জানানো হয়।

## পাল্টা আবেদন
আপনার কনটেন্ট ভুলবশত সরানো হয়েছে বা তা শেয়ার করার অধিকার আপনার আছে মনে হলে আপনার [অ্যাকাউন্টের অবস্থান](/account/standing) পাতা থেকে পাল্টা আবেদন করতে পারেন (প্রাপ্ত নোটিফিকেশন সেখানেই নিয়ে যায়)। কারণ ব্যাখ্যা করুন এবং লাইসেন্স বা প্রকাশনা চুক্তির মতো প্রমাণ দিন। পাল্টা আবেদনটি অভিযোগকারীর কাছে পাঠানো হয়, এবং তারা দাবি অব্যাহত না রাখলে কনটেন্ট পুনর্বহাল করা হতে পারে।

## বারবার লঙ্ঘন
যেসব অ্যাকাউন্ট বারবার কপিরাইট লঙ্ঘন করে সেগুলো স্থগিত বা বন্ধ করা হয়।

## উদ্ধৃতি
রিভিউ, সমালোচনা, শিক্ষা বা গবেষণার জন্য সূত্র উল্লেখ করে সংক্ষিপ্ত উদ্ধৃতি দেওয়া যায়।`,
    },
  },
  {
    slug: 'community-guidelines',
    title: { bn: 'কমিউনিটি নির্দেশিকা', en: 'Community Guidelines' },
    body: {
      en: `Boikonika is a place to talk about books and learn together. These guidelines keep it useful and safe for readers of every age.

## Do
- Be respectful, even when you disagree about a book.
- Write honest reviews about the book or the product, not the person.
- Mark spoilers.
- Credit authors when you quote them, and keep quotations short.
- Report content that breaks these rules instead of replying to it.

## Do not
- Harass, bully, threaten or impersonate anyone.
- Post hate speech or attack people for their religion, ethnicity, gender, disability or any other identity.
- Share sexual content, violent content or anything harmful to children.
- Share pirated books, download links to copyrighted material or other people's private information.
- Spam, post repeated promotions or fake reviews, or trade reviews for rewards.
- Post deliberately false information in educational content.

## What happens when rules are broken
Reports are reviewed by moderators. Depending on how serious a violation is and whether it has happened before, we may remove content, issue a warning, temporarily restrict posting, suspend or permanently ban the account. You will be told what action was taken and how to appeal.

## Your wellbeing
Boikonika has no endless feed by design. You can set daily reading goals, mute topics and accounts, take a break from notifications and see how much time you spend reading in your settings.`,
      bn: `বইকণিকা বই নিয়ে কথা বলা ও একসঙ্গে শেখার জায়গা। এই নির্দেশিকা সব বয়সী পাঠকের জন্য জায়গাটিকে কার্যকর ও নিরাপদ রাখে।

## যা করবেন
- কোনো বই নিয়ে দ্বিমত থাকলেও শ্রদ্ধাশীল থাকুন।
- ব্যক্তি নয়, বই বা পণ্য নিয়ে সৎ রিভিউ লিখুন।
- স্পয়লার থাকলে তা চিহ্নিত করুন।
- উদ্ধৃতি দিলে লেখকের নাম উল্লেখ করুন এবং উদ্ধৃতি সংক্ষিপ্ত রাখুন।
- নিয়ম ভঙ্গকারী কনটেন্টের উত্তর না দিয়ে রিপোর্ট করুন।

## যা করবেন না
- কাউকে হয়রানি, উত্ত্যক্ত বা হুমকি দেবেন না, অন্য কারও পরিচয় ধারণ করবেন না।
- ঘৃণাসূচক কথা বলবেন না বা ধর্ম, জাতিসত্তা, লিঙ্গ, প্রতিবন্ধিতা বা অন্য কোনো পরিচয়ের কারণে কাউকে আক্রমণ করবেন না।
- যৌন বা সহিংস কনটেন্ট কিংবা শিশুদের জন্য ক্ষতিকর কিছু শেয়ার করবেন না।
- পাইরেটেড বই, কপিরাইটযুক্ত কনটেন্টের ডাউনলোড লিংক বা অন্যের ব্যক্তিগত তথ্য শেয়ার করবেন না।
- স্প্যাম, বারবার প্রচারণা, ভুয়া রিভিউ বা পুরস্কারের বিনিময়ে রিভিউ দেবেন না।
- শিক্ষামূলক কনটেন্টে জেনেশুনে ভুল তথ্য দেবেন না।

## নিয়ম ভঙ্গ হলে
মডারেটররা রিপোর্ট পর্যালোচনা করেন। লঙ্ঘনের গুরুত্ব এবং আগে ঘটেছে কি না তার ওপর নির্ভর করে কনটেন্ট সরানো, সতর্কবার্তা, সাময়িকভাবে পোস্ট করা সীমিত, অ্যাকাউন্ট স্থগিত বা স্থায়ীভাবে নিষিদ্ধ করা হতে পারে। কী ব্যবস্থা নেওয়া হয়েছে এবং কীভাবে আপিল করবেন তা আপনাকে জানানো হবে।

## আপনার সুস্থতা
বইকণিকায় ইচ্ছাকৃতভাবেই অসীম ফিড নেই। সেটিংস থেকে দৈনিক পড়ার লক্ষ্য ঠিক করতে, বিষয় ও অ্যাকাউন্ট মিউট করতে, নোটিফিকেশন থেকে বিরতি নিতে এবং পড়ায় কত সময় দিচ্ছেন তা দেখতে পারবেন।`,
    },
  },
  {
    slug: 'cookie-policy',
    title: { bn: 'কুকি নীতি', en: 'Cookie Policy' },
    body: {
      en: `Boikonika uses a small number of cookies and similar browser storage.

## Essential
- **Session cookie:** keeps you signed in. It is HTTP-only and cannot be read by scripts.
- **Security token:** protects forms against cross-site request forgery.
- **Preferences:** remembers your language and light or dark theme.

## Analytics
With your consent, we measure page views and feature use in aggregate to improve the service. Analytics data is not used for advertising and is not sold.

We do not use third-party advertising cookies. You can clear cookies in your browser at any time; you will then need to sign in again.`,
      bn: `বইকণিকা অল্প কিছু কুকি ও এ ধরনের ব্রাউজার স্টোরেজ ব্যবহার করে।

## অপরিহার্য
- **সেশন কুকি:** আপনাকে লগইন অবস্থায় রাখে। এটি HTTP-only, স্ক্রিপ্ট দিয়ে পড়া যায় না।
- **নিরাপত্তা টোকেন:** ফর্মকে ক্রস-সাইট রিকোয়েস্ট ফোর্জারি থেকে রক্ষা করে।
- **পছন্দ:** আপনার ভাষা এবং লাইট বা ডার্ক থিম মনে রাখে।

## অ্যানালিটিক্স
আপনার সম্মতি থাকলে সেবা উন্নত করতে আমরা সমষ্টিগতভাবে পেজ ভিউ ও ফিচারের ব্যবহার পরিমাপ করি। এই তথ্য বিজ্ঞাপনে ব্যবহার বা বিক্রি করা হয় না।

আমরা তৃতীয় পক্ষের বিজ্ঞাপনী কুকি ব্যবহার করি না। ব্রাউজার থেকে যেকোনো সময় কুকি মুছতে পারেন; তখন আবার লগইন করতে হবে।`,
    },
  },
];
