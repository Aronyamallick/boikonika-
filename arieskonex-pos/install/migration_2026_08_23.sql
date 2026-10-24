-- =====================================================================
-- মাইগ্রেশন — ২০২৬-০৮-২৩
-- এই ফাইলটি phpMyAdmin দিয়ে ইম্পোর্ট করুন অথবা mysql কমান্ড লাইনে চালান।
-- বিদ্যমান (আগে থেকে ইনস্টল করা) ডাটাবেজে চালাতে হবে — নতুন ইনস্টলে
-- install/schema.sql-ই যথেষ্ট। অ্যাপে লগইন করলে এই পরিবর্তনগুলো এমনিতেই
-- স্বয়ংক্রিয়ভাবে যুক্ত হয়ে যায় (includes/bootstrap.php), তাই এই ফাইলটি
-- আলাদা করে না চালালেও চলবে — শুধু যারা ম্যানুয়ালি মাইগ্রেট করতে চান
-- তাদের জন্য এটি রাখা হয়েছে।
--
-- এই আপডেটে যা যুক্ত হচ্ছে:
--   ১) coupons / coupon_usages — ডিসকাউন্ট/কুপন কোড, POS চেকআউটে প্রযোজ্য।
--      sales টেবিলে coupon_id/coupon_code কলামও যুক্ত হচ্ছে।
--   ২) quotations / quotation_items — কোটেশন (বিক্রির আগে দাম প্রস্তাব),
--      পরে "সেলে রূপান্তর" করা যায়।
--   ৩) account_transactions — একাউন্টস/ক্যাশ লেজারের ম্যানুয়াল এন্ট্রি
--      (বেতন, ভাড়া, মালিকের উত্তোলন/জমা ইত্যাদি)।
--   ৪) warehouses / product_stock / stock_transfers / stock_transfer_items —
--      মাল্টি-শাখা স্টক ট্রান্সফার। এই মাইগ্রেশন প্রথমবার চালানোর সময়
--      স্বয়ংক্রিয়ভাবে একটি "প্রধান শাখা" তৈরি হয় এবং বিদ্যমান সব পণ্যের
--      বর্তমান স্টক (products.stock_qty) সেই শাখার হিসেবে বসে যায় —
--      products.stock_qty কলামটি নিজে অপরিবর্তিত থাকে (POS/ক্রয়/সমন্বয়
--      আগের মতোই এটা ব্যবহার করবে, কোনো বিদ্যমান ফিচার প্রভাবিত হয় না)।
--   বারকোড/QR কোড ফিচারের জন্য নতুন কোনো টেবিল/কলাম লাগে না — products.barcode
--   কলাম আগে থেকেই আছে।
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ---------- ১) ডিসকাউন্ট/কুপন কোড ----------
CREATE TABLE IF NOT EXISTS coupons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type ENUM('fixed','percent') NOT NULL DEFAULT 'percent',
    discount_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    min_purchase DECIMAL(12,2) NOT NULL DEFAULT 0,
    max_discount DECIMAL(12,2) DEFAULT NULL,
    usage_limit INT DEFAULT NULL,
    used_count INT NOT NULL DEFAULT 0,
    valid_from DATE DEFAULT NULL,
    valid_to DATE DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupon_usages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coupon_id INT NOT NULL,
    sale_id INT DEFAULT NULL,
    customer_id INT DEFAULT NULL,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coupon_usages_coupon (coupon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sales টেবিলে কুপন সংক্রান্ত কলাম (কলাম আগে থেকে থাকলে এই লাইনগুলো এরর দিলে উপেক্ষা করুন)
ALTER TABLE sales ADD COLUMN coupon_id INT DEFAULT NULL AFTER discount_value;
ALTER TABLE sales ADD COLUMN coupon_code VARCHAR(50) DEFAULT NULL AFTER coupon_id;

-- ---------- ২) কোটেশন ----------
CREATE TABLE IF NOT EXISTS quotations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_no VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT DEFAULT NULL,
    customer_name VARCHAR(255) DEFAULT NULL,
    customer_mobile VARCHAR(30) DEFAULT NULL,
    quote_date DATE NOT NULL,
    valid_until DATE DEFAULT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_type ENUM('fixed','percent') NOT NULL DEFAULT 'fixed',
    discount_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('pending','converted','rejected','expired') NOT NULL DEFAULT 'pending',
    converted_sale_id INT DEFAULT NULL,
    note VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_quotations_date (quote_date),
    INDEX idx_quotations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotation_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_id INT NOT NULL,
    item_type ENUM('product','service') NOT NULL DEFAULT 'product',
    product_id INT DEFAULT NULL,
    service_id INT DEFAULT NULL,
    description VARCHAR(255) DEFAULT NULL,
    qty INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ৩) একাউন্টস/ক্যাশ লেজার ----------
CREATE TABLE IF NOT EXISTS account_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type ENUM('in','out') NOT NULL DEFAULT 'out',
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    txn_date DATE NOT NULL,
    method VARCHAR(50) DEFAULT 'cash',
    note VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_acct_txn_date (txn_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ৪) মাল্টি-শাখা স্টক ট্রান্সফার ----------
CREATE TABLE IF NOT EXISTS warehouses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255) DEFAULT NULL,
    is_main TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO warehouses (name, is_main)
SELECT 'প্রধান শাখা', 1 WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE is_main = 1);

CREATE TABLE IF NOT EXISTS product_stock (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    qty DECIMAL(12,3) NOT NULL DEFAULT 0,
    UNIQUE KEY uniq_product_warehouse (product_id, warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- বিদ্যমান সব পণ্যের বর্তমান মোট স্টক প্রাথমিকভাবে "প্রধান শাখা"-র হিসেবে বসিয়ে দেওয়া হয়
-- (শুধু প্রথমবার — পরে আবার এই ফাইল চালালে ডুপ্লিকেট এন্ট্রি হবে না, UNIQUE KEY আটকাবে)
INSERT IGNORE INTO product_stock (product_id, warehouse_id, qty)
SELECT p.id, w.id, p.stock_qty FROM products p, warehouses w WHERE w.is_main = 1;

CREATE TABLE IF NOT EXISTS stock_transfers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transfer_no VARCHAR(50) NOT NULL UNIQUE,
    from_warehouse_id INT NOT NULL,
    to_warehouse_id INT NOT NULL,
    transfer_date DATE NOT NULL,
    note VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transfer_id INT NOT NULL,
    product_id INT NOT NULL,
    qty DECIMAL(12,3) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
