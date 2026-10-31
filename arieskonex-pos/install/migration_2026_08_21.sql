-- =====================================================================
-- মাইগ্রেশন — ২০২৬-০৮-২১
-- এই ফাইলটি phpMyAdmin দিয়ে ইম্পোর্ট করুন অথবা mysql কমান্ড লাইনে চালান।
-- বিদ্যমান (আগে থেকে ইনস্টল করা) ডাটাবেজে চালাতে হবে — নতুন ইনস্টলে
-- install/schema.sql-ই যথেষ্ট। অ্যাপে লগইন করলে এই পরিবর্তনগুলো এমনিতেই
-- স্বয়ংক্রিয়ভাবে যুক্ত হয়ে যায় (includes/bootstrap.php), তাই এই ফাইলটি
-- আলাদা করে না চালালেও চলবে — শুধু যারা ম্যানুয়ালি মাইগ্রেট করতে চান
-- তাদের জন্য এটি রাখা হয়েছে।
--
-- এই আপডেটে যা যুক্ত হচ্ছে:
--   ১) sales.discount_type / sales.discount_value — POS-এ এখন ডিসকাউন্ট
--      শতাংশ (%) বা নির্দিষ্ট টাকা (৳) দুইভাবেই দেওয়া যায়। discount
--      কলামে সবসময় চূড়ান্ত হিসাব-করা ৳ পরিমাণ থাকে (পুরোনো রিপোর্ট/
--      লাভ-ক্ষতির হিসাব অপরিবর্তিত থাকে); discount_type/discount_value
--      শুধু রেকর্ড রাখে ব্যবহারকারী আসলে কী দিয়েছিলেন।
--   ২) sales.below_cost_approved — ক্রয়মূল্যের নিচে বিক্রির (লোকসানি
--      বিক্রয়) জন্য অনুমোদিত ব্যবহারকারী কর্তৃক সজ্ঞানে অনুমোদন দেওয়া
--      হয়েছিল কিনা তার রেকর্ড।
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_type ENUM('fixed','percent') NOT NULL DEFAULT 'fixed' AFTER discount;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_type;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS below_cost_approved TINYINT(1) NOT NULL DEFAULT 0 AFTER discount_value;

SET FOREIGN_KEY_CHECKS = 1;
