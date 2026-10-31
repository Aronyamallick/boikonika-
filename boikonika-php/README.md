# বইকণিকা (Boikonika) — PHP + MySQL সংস্করণ

বাংলাদেশের জন্য বইকেন্দ্রিক মাল্টি-ভেন্ডর মার্কেটপ্লেস। যেকোনো cPanel শেয়ার্ড হোস্টিংয়ে চলে — শুধু ফাইল আপলোড করে ইনস্টল উইজার্ড চালালেই হবে।
নির্মাতা: **Arieskonex Technologies** · সংস্করণ ১.০.০

*English instructions follow the Bangla section.*

---

## কী কী আছে

- **কেনাকাটা:** নতুন ও পুরোনো বই, স্টেশনারি ও পড়াশোনার উপকরণ; একই বইয়ে একাধিক বিক্রেতার অফার; ক্যাটাগরি, লেখক, প্রকাশক ও দোকানের পাতা; বাংলা/ইংরেজি ও ISBN দিয়ে সার্চ; ফিল্টার ও সাজানো; উইশলিস্ট; যাচাইকৃত ক্রেতার রিভিউ।
- **কার্ট ও চেকআউট:** লগইন ছাড়াই কার্ট (লগইনের পর একসাথে হয়); প্রতি বিক্রেতায় আলাদা পার্সেল ও ডেলিভারি চার্জ (ঢাকার ভেতরে/বাইরে, নির্দিষ্ট অঙ্কের পর ফ্রি); কুপন; **ক্যাশ অন ডেলিভারি, বিকাশ (Tokenized Checkout) ও SSLCOMMERZ** (কার্ড, নগদ, রকেট, ইন্টারনেট ব্যাংকিং)।
- **অর্ডার:** পার্সেলের অবস্থা ও ট্র্যাকিং নম্বর, অর্ডার বাতিল, ফেরতের অনুরোধ, রিফান্ড (গেটওয়ে বা হাতে), নির্ধারিত সময়ে পরিশোধ না হলে অনলাইন অর্ডার নিজে থেকে বাতিল ও স্টক ফেরত।
- **বিক্রেতা:** পরিচয়পত্রসহ আবেদন (ছবি গোপনে সংরক্ষিত, নম্বর এনক্রিপ্টেড), দোকান সেটিংস, বই/পণ্য যোগ (ক্যাটালগে খুঁজে বা নতুন), পুরোনো কপির ছবি, অর্ডার নিশ্চিত/প্যাক/পাঠানো/ডেলিভারি, ফেরত সামলানো, আয়ের হিসাব ও বিকাশ/নগদ/রকেট/ব্যাংকে পেমেন্ট তোলা।
- **অ্যাডমিন:** ড্যাশবোর্ড, ব্যবহারকারী ও স্টাফের ভূমিকা, বিক্রেতা যাচাই, ক্যাটালগ যাচাই ও সম্পাদনা, অর্ডার, রিফান্ড, ফেরত, বিক্রেতার পেমেন্ট, কুপন, ডেলিভারি চার্জ, তথ্য পাতা (বাংলা ও ইংরেজি), হোম ব্যানার, যোগাযোগের বার্তা, সেটিংস (সাইট, অর্ডার, পেমেন্ট, ইমেইল), সিস্টেম স্বাস্থ্য, অডিট লগ।
- **অ্যাকাউন্ট ও নিরাপত্তা:** ইমেইলে ৬ সংখ্যার কোড দিয়ে সাইন আপ ও পাসওয়ার্ড রিসেট, “লগইন রাখুন”, দুই ধাপের যাচাই (অথেন্টিকেটর অ্যাপ + রিকভারি কোড), সব ডিভাইসের তালিকা ও লগআউট, লগইন ইতিহাস, নিজের তথ্য ডাউনলোড ও অ্যাকাউন্ট মুছে ফেলা।
- বাংলা (ডিফল্ট) ও ইংরেজি (`/en/…`), লাইট ও ডার্ক থিম, মোবাইলে মানানসই, ইনস্টলযোগ্য ওয়েব অ্যাপ, সাইটম্যাপ ও সার্চ ইঞ্জিনের জন্য প্রস্তুত।

পরবর্তী সংস্করণে আসবে: কমিউনিটি, বুক ক্লাব, স্টুডেন্ট জোন, ই-বুক, AI সহকারী এবং মোবাইল অ্যাপের জন্য PHP API।

## যা লাগবে

| | |
| --- | --- |
| PHP | 8.1 বা নতুন (8.2/8.3 পরামর্শযোগ্য) |
| PHP এক্সটেনশন | pdo_mysql, mbstring, openssl, gd, curl, fileinfo, json |
| ডাটাবেস | MySQL 5.7+ বা MariaDB 10.3+ |
| ওয়েব সার্ভার | Apache, `mod_rewrite` চালু (cPanel-এ সাধারণত থাকে) |
| SSL | অনলাইন পেমেন্টের জন্য HTTPS আবশ্যক (cPanel → SSL/TLS Status → AutoSSL) |

## cPanel-এ ইনস্টল

1. **ডাটাবেস তৈরি:** cPanel → **MySQL® Databases** → নতুন ডাটাবেস (যেমন `boikonika`) ও নতুন ইউজার বানান, তারপর ইউজারকে ডাটাবেসে **ALL PRIVILEGES** দিন। নাম, ইউজার ও পাসওয়ার্ড লিখে রাখুন।
2. **PHP সংস্করণ:** cPanel → **Select PHP Version** (বা MultiPHP Manager) → 8.1 বা নতুন বেছে নিন, ওপরের এক্সটেনশনগুলো টিক দিন।
3. **ফাইল আপলোড:** cPanel → **File Manager** → `public_html` খুলুন → **Upload** → `boikonika-php-v1.0.0.zip` আপলোড করুন → ফাইলে রাইট-ক্লিক → **Extract**।
   - ডোমেইনের মূলে চালাতে চাইলে সরাসরি `public_html`-এ এক্সট্র্যাক্ট করুন।
   - সাবফোল্ডারে (যেমন `public_html/shop`) রাখলেও চলবে — সাইট হবে `https://your-domain.com/shop`।
   - File Manager-এ **Settings → Show Hidden Files** চালু রাখুন যাতে `.htaccess` ফাইলগুলো দেখা যায়; এগুলো মুছবেন না।
4. **ইনস্টলার চালান:** ব্রাউজারে `https://your-domain.com/install/` খুলুন (সাবফোল্ডারে থাকলে `/shop/install/`)।
   - ধাপ ১: সব চেক সবুজ হলে এগিয়ে যান।
   - ধাপ ২: ডাটাবেসের তথ্য দিন (হোস্ট সাধারণত `localhost`)।
   - ধাপ ৩: সাইটের ঠিকানা (https সহ), সাইটের নাম, সাপোর্ট ইমেইল এবং প্রধান অ্যাডমিনের নাম, ইমেইল ও পাসওয়ার্ড দিন → **ইনস্টল করুন**।
5. **`install` ফোল্ডারটি মুছে ফেলুন** (File Manager থেকে)। অ্যাডমিন ড্যাশবোর্ড এটি মনে করিয়ে দেবে।
6. **ক্রন জব:** cPanel → **Cron Jobs** → “Once Per Five Minutes” → কমান্ড:
   ```
   php /home/আপনার-cpanel-ইউজার/public_html/cron.php
   ```
   (সঠিক পথ অ্যাডমিন → সিস্টেম পাতায় দেখানো থাকে।) হোস্ট শুধু URL চালাতে দিলে: `wget -q -O - "https://your-domain.com/cron.php?key=…"` — কী-টিও সিস্টেম পাতায় আছে।
7. **লগইন করে সেটআপ শেষ করুন:** অ্যাডমিন হিসেবে লগইন → **অ্যাকাউন্ট → নিরাপত্তা**-তে দুই ধাপের যাচাই চালু করুন → **অ্যাডমিন → সেটিংস**:
   - **ইমেইল:** cPanel → Email Accounts-এ একটি মেইলবক্স (যেমন `no-reply@your-domain.com`) বানিয়ে SMTP দিন (হোস্ট `mail.your-domain.com`, পোর্ট 465, SSL) → “টেস্ট ইমেইল পাঠান”। ইমেইল কাজ না করলে কেউ সাইন আপের কোড পাবে না।
   - **পেমেন্ট:** বিকাশ মার্চেন্ট (Tokenized Checkout) ও SSLCOMMERZ-এর তথ্য দিন। প্রথমে স্যান্ডবক্সে পরীক্ষা করুন, তারপর লাইভ তথ্য দিয়ে স্যান্ডবক্স বন্ধ করুন। SSLCOMMERZ-কে IPN ঠিকানা দিন (সেটিংস পাতায় দেখানো আছে)।
   - **অর্ডার ও বিক্রি:** কমিশন, ক্যাশ অন ডেলিভারির সর্বোচ্চ অঙ্ক, ফেরতের দিন, সর্বনিম্ন পেমেন্ট ইত্যাদি।
8. **নীতিমালার পাতা** (অ্যাডমিন → পাতা) পড়ে আপনার ব্যবসা অনুযায়ী সম্পাদনা করুন এবং চালুর আগে আইনি পরামর্শ নিন।

## হালনাগাদ (নতুন সংস্করণ)

1. ডাটাবেস (cPanel → phpMyAdmin → Export) ও `app/config.php`, `uploads/`, `storage/private/` এর ব্যাকআপ নিন।
2. নতুন zip-এর ফাইলগুলো ওপর দিয়ে আপলোড করুন — **`app/config.php`, `uploads/`, `storage/` ওভাররাইট করবেন না**, এবং `install` ফোল্ডার মুছে দিন।
3. অ্যাডমিন → সিস্টেম → “ডাটাবেস হালনাগাদ প্রয়োগ করুন”। ডাটাবেসের সব পরিবর্তন `database/migrations`-এর ক্রমিক ফাইল দিয়ে হয় এবং প্রতিটি একবারই প্রয়োগ হয়।

## ব্যাকআপ

- **ডাটাবেস:** প্রতিদিন (cPanel → Backup বা JetBackup)।
- **ফাইল:** `uploads/` (বইয়ের ছবি) ও `storage/private/` (বিক্রেতার পরিচয়পত্র — গোপন রাখুন)।
- **`app/config.php`:** পাসওয়ার্ড ম্যানেজারে কপি রাখুন। এর `app_key` হারালে এনক্রিপ্ট করা তথ্য (পরিচয়পত্রের নম্বর, পেমেন্ট অ্যাকাউন্ট, পেমেন্ট গেটওয়ের পাসওয়ার্ড) আর পড়া যাবে না।

## নিরাপত্তা

- পাসওয়ার্ড Argon2id/bcrypt হ্যাশ হিসেবে রাখা হয়; কখনো সাধারণ লেখা হিসেবে নয়।
- কার্ডের তথ্য কখনো সাইটে আসে না — পেমেন্ট বিকাশ ও SSLCOMMERZ-এর পাতায় হয়; প্রতিটি পেমেন্ট গেটওয়ের API দিয়ে যাচাই করে তবেই “পরিশোধিত” ধরা হয়।
- টাকার হিসাব DECIMAL ও পয়সার পূর্ণসংখ্যায় — কখনো ফ্লোটিং পয়েন্ট নয়।
- পরিচয়পত্রের ছবি `storage/private`-এ, ওয়েব থেকে সরাসরি খোলা যায় না; নম্বর AES-256-GCM-এ এনক্রিপ্টেড; প্রতিবার দেখা অডিট লগে লেখা হয়।
- প্রতিটি ফর্মে CSRF সুরক্ষা, লগইন/সাইন আপ/কোডে রেট লিমিট, ৫ বার ভুল পাসওয়ার্ডে ১৫ মিনিট লক, কঠোর Content-Security-Policy ও নিরাপত্তা হেডার, আপলোড করা ছবি নতুন করে এনকোড (লোকেশন ডেটা মুছে যায়), `uploads`-এ কোনো স্ক্রিপ্ট চলে না।
- ব্যবহারকারীরা দেখেন শুধু একটি রেফারেন্স নম্বরসহ ত্রুটির বার্তা; বিস্তারিত থাকে `storage/logs`-এ।

## সমস্যা হলে

| সমস্যা | সমাধান |
| --- | --- |
| পাতা খুললে 500 / ফাঁকা পাতা | PHP সংস্করণ ৮.১+ ও এক্সটেনশন যাচাই করুন; `storage/logs/` দেখুন। |
| সব পাতায় 404 (হোম ছাড়া) | `.htaccess` আপলোড হয়নি বা `mod_rewrite` বন্ধ — Show Hidden Files চালু করে যাচাই করুন। |
| সাইন আপের কোড আসে না | অ্যাডমিন → সেটিংস → ইমেইল-এ SMTP দিন ও টেস্ট ইমেইল পাঠান; স্প্যাম ফোল্ডার দেখুন। |
| ছবি আপলোড হয় না | `uploads/` ও `storage/` ফোল্ডারের permission 755 (বা 775) দিন। |
| অনলাইন অর্ডার বাতিল হচ্ছে না | ক্রন জব যোগ করুন (ধাপ ৬)। |

---

# Boikonika — PHP + MySQL edition (English)

A book-first multi-vendor marketplace for Bangladesh that runs on any cPanel shared hosting: upload the files and run the install wizard. Developed by **Arieskonex Technologies**. Version 1.0.0.

## What’s included

- **Shopping:** new and used books plus stationery and study supplies; several sellers’ offers per edition; category, author, publisher and shop pages; search in Bangla, English or by ISBN; filters and sorting; wishlist; verified-purchase reviews.
- **Cart and checkout:** guest cart that joins your account at login; one parcel and delivery fee per seller (inside/outside Dhaka, free above a threshold); coupons; **cash on delivery, bKash (Tokenized Checkout) and SSLCOMMERZ** (cards, Nagad, Rocket, internet banking).
- **Orders:** parcel status and tracking numbers, cancellation, return requests, refunds (through the gateway or by hand), and automatic cancellation of unpaid online orders with stock released.
- **Sellers:** application with identity documents (photos stored privately, numbers encrypted), shop settings, listings (find the edition in the catalogue or add it), photos of used copies, confirm/pack/ship/deliver, returns, earnings and payouts to bKash, Nagad, Rocket or bank.
- **Admin:** dashboard, users and staff roles, seller verification, catalogue review and editing, orders, refunds, returns, payouts, coupons, delivery fees, information pages (Bangla and English), home banners, contact messages, settings (site, orders, payments, email), system health and the audit log.
- **Accounts and security:** sign-up and password reset with 6-digit email codes, “keep me logged in”, two-step verification (authenticator app + recovery codes), signed-in devices with remote sign-out, sign-in history, data download and account deletion.
- Bangla (default) and English (`/en/…`), light and dark themes, phone-friendly, installable web app, sitemap and search-engine ready.

Coming in the next packages: community, book clubs, Student Zone, e-books, the AI assistant and a PHP API for the mobile app.

## Requirements

PHP 8.1+ with pdo_mysql, mbstring, openssl, gd, curl, fileinfo and json · MySQL 5.7+ or MariaDB 10.3+ · Apache with `mod_rewrite` · HTTPS for online payments.

## Installing on cPanel

1. **Database:** cPanel → **MySQL® Databases** → create a database and a user, and give the user **ALL PRIVILEGES** on it.
2. **PHP:** cPanel → **Select PHP Version** (or MultiPHP Manager) → 8.1 or newer, with the extensions above.
3. **Upload:** File Manager → `public_html` → **Upload** `boikonika-php-v1.0.0.zip` → right-click → **Extract**. Extract straight into `public_html` for the domain root, or into a subfolder such as `public_html/shop` (the site is then at `/shop`). Turn on **Settings → Show Hidden Files** and keep every `.htaccess` file.
4. **Run the installer:** open `https://your-domain.com/install/` (or `/shop/install/`) and follow the three steps: checks, database, site and super-admin account.
5. **Delete the `install` folder.**
6. **Cron:** cPanel → **Cron Jobs** → every five minutes: `php /home/YOUR-CPANEL-USER/public_html/cron.php` (the exact path and a URL alternative with its key are shown in Admin → System).
7. **Finish in Admin:** log in, turn on two-step verification (Account → Security), then **Admin → Settings**:
   - **Email:** create a mailbox in cPanel → Email Accounts and enter its SMTP details (host `mail.your-domain.com`, port 465, SSL); send the test email. Without working email nobody receives sign-up codes.
   - **Payments:** enter your bKash Tokenized Checkout and SSLCOMMERZ credentials. Test in sandbox mode first, then switch to live credentials and turn sandbox off. Give SSLCOMMERZ the IPN address shown on the settings page.
   - **Orders & selling:** commission, cash-on-delivery limit, return window, minimum payout.
8. Review the **policy pages** (Admin → Pages) for your business and have them checked by a lawyer before launch.

## Updating to a new version

Back up the database and `app/config.php`, `uploads/` and `storage/private/`. Upload the new files over the old ones **without overwriting `app/config.php`, `uploads/` or `storage/`**, delete `install/`, then open Admin → System → **Apply database updates**. Schema changes only happen through numbered files in `database/migrations`, each applied once and recorded.

## Backups

Back up the database daily, plus `uploads/` and `storage/private/` (identity documents — keep these backups private). Keep a copy of `app/config.php` in a password manager: its `app_key` encrypts document numbers, payout accounts and gateway passwords, and they can’t be read without it.

## Security notes

Passwords are hashed (Argon2id or bcrypt). Card details never reach the site, and every online payment is confirmed with the gateway’s API before an order counts as paid. Money is stored as DECIMAL and calculated in whole poisha, never floating point. Identity-document photos live in `storage/private` (not web-accessible), numbers are encrypted with AES-256-GCM, and every view is written to the audit log. All forms have CSRF protection; sign-in, sign-up and codes are rate-limited; five wrong passwords lock an account for 15 minutes. Pages are sent with a strict Content-Security-Policy and security headers, uploaded images are re-encoded (which removes location data), and nothing in `uploads/` can run as code. Visitors only ever see an error reference number; details go to `storage/logs`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| 500 error or blank page | Check the PHP version (8.1+) and extensions; look in `storage/logs/`. |
| Every page except home gives 404 | `.htaccess` is missing or `mod_rewrite` is off. |
| Sign-up codes don’t arrive | Set up SMTP in Admin → Settings → Email and send a test email; check spam. |
| Image uploads fail | Give `uploads/` and `storage/` permission 755 (or 775). |
| Unpaid online orders aren’t cancelled | Add the cron job (step 6). |

## Folder layout

```
index.php          front controller (all pages)
.htaccess          URL rewriting and protection of private folders
cron.php           scheduled tasks
install/           installation wizard — delete after installing
app/               code: Core (framework), Services, Controllers, Views, lang/{bn,en}
database/          migrations (schema history) and seed data
assets/            CSS, JavaScript, fonts (Noto Sans Bengali, Inter), icons
uploads/           public images (covers, products, logos)
storage/           logs, cache, sessions and private files (never web-accessible)
```
