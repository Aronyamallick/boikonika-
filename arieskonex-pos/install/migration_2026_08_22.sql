-- =====================================================================
-- মাইগ্রেশন — ২০২৬-০৮-২২
-- এই ফাইলটি phpMyAdmin দিয়ে ইম্পোর্ট করুন অথবা mysql কমান্ড লাইনে চালান।
-- বিদ্যমান (আগে থেকে ইনস্টল করা) ডাটাবেজে চালাতে হবে — নতুন ইনস্টলে
-- install/schema.sql-ই যথেষ্ট। অ্যাপে লগইন করলে এই পরিবর্তনগুলো এমনিতেই
-- স্বয়ংক্রিয়ভাবে যুক্ত হয়ে যায় (includes/bootstrap.php), তাই এই ফাইলটি
-- আলাদা করে না চালালেও চলবে — শুধু যারা ম্যানুয়ালি মাইগ্রেট করতে চান
-- তাদের জন্য এটি রাখা হয়েছে।
--
-- এই আপডেটে যা যুক্ত হচ্ছে:
--   ১) email_settings / email_logs — ইমেইল গেটওয়ে (SMTP) কনফিগারেশন।
--      পেমেন্ট মেথড এপিআই পাতায় (payment_api.php) গিয়ে SMTP হোস্ট/পোর্ট/
--      ইউজারনেম/পাসওয়ার্ড বসিয়ে সক্রিয় করতে হবে।
--   ২) password_resets — "পাসওয়ার্ড ভুলে গেছেন?" ফিচারের জন্য টোকেন
--      সংরক্ষণ (owner/cashier/salesman — সব রোলের ইউজারের জন্যই কাজ করে)।
--      শুধু টোকেনের hash সংরক্ষণ করা হয়, আসল টোকেন নয়।
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS email_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    provider_name VARCHAR(100) DEFAULT NULL,
    smtp_host VARCHAR(255) DEFAULT NULL,
    smtp_port INT DEFAULT 587,
    smtp_username VARCHAR(255) DEFAULT NULL,
    smtp_password VARCHAR(255) DEFAULT NULL,
    smtp_encryption ENUM('none','ssl','tls') NOT NULL DEFAULT 'tls',
    from_email VARCHAR(150) DEFAULT NULL,
    from_name VARCHAR(150) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    to_email VARCHAR(150),
    subject VARCHAR(255),
    status VARCHAR(20) DEFAULT 'sent',
    error TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_resets_token (token_hash),
    INDEX idx_password_resets_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
