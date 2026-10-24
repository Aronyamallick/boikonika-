-- =====================================================================
-- মাইগ্রেশন — ২০২৬-০৮-১৯
-- এই ফাইলটি phpMyAdmin দিয়ে ইম্পোর্ট করুন অথবা mysql কমান্ড লাইনে চালান।
-- বিদ্যমান (আগে থেকে ইনস্টল করা) ডাটাবেজে চালাতে হবে — নতুন ইনস্টলে
-- install/schema.sql-ই যথেষ্ট। অ্যাপে লগইন করলে এই পরিবর্তনগুলো এমনিতেই
-- স্বয়ংক্রিয়ভাবে যুক্ত হয়ে যায় (includes/bootstrap.php), তাই এই ফাইলটি
-- আলাদা করে না চালালেও চলবে — শুধু যারা ম্যানুয়ালি মাইগ্রেট করতে চান
-- তাদের জন্য এটি রাখা হয়েছে।
--
-- এই আপডেটে যা যুক্ত হচ্ছে:
--   ১) প্রতিটি পণ্যের জন্য স্বয়ংক্রিয়/ক্রমিকভাবে তৈরি হওয়া আইটেম কোড
--      (products.item_code) — বিদ্যমান পণ্যগুলোতেও id অনুযায়ী ক্রমিক
--      কোড বসিয়ে দেওয়া হয়
--   ২) একই মোবাইল নম্বরে একাধিক কাস্টমার/সাপ্লায়ার যুক্ত করা ঠেকাতে
--      customers.mobile ও suppliers.mobile কলামে ইউনিক ইনডেক্স।
--      সতর্কতা: বিদ্যমান ডেটায় আগে থেকেই ডুপ্লিকেট মোবাইল নম্বর থাকলে
--      এই ধাপ ব্যর্থ হবে — আগে ডুপ্লিকেটগুলো ঠিক করে নিন, তারপর আবার
--      চালান।
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ১) আইটেম কোড কলাম
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_code VARCHAR(20) DEFAULT NULL AFTER id;

-- বিদ্যমান পণ্যগুলোতে id অনুযায়ী ক্রমিক কোড বসানো (যেগুলোর item_code এখনো ফাঁকা)
SET @rownum = 0;
UPDATE products
SET item_code = CONCAT('P', LPAD((@rownum := @rownum + 1), 5, '0'))
WHERE item_code IS NULL
ORDER BY id ASC;

ALTER TABLE products ADD UNIQUE INDEX IF NOT EXISTS uniq_products_item_code (item_code);

-- ২) মোবাইল নম্বর ইউনিক — আগে ডুপ্লিকেট থাকলে এই দুটি লাইন ব্যর্থ হতে পারে
ALTER TABLE customers ADD UNIQUE INDEX IF NOT EXISTS uniq_customers_mobile (mobile);
ALTER TABLE suppliers ADD UNIQUE INDEX IF NOT EXISTS uniq_suppliers_mobile (mobile);

SET FOREIGN_KEY_CHECKS = 1;
