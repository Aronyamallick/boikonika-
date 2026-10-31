-- =====================================================================
-- মাইগ্রেশন — ২০২৬-০৮-১৫
-- এই ফাইলটি phpMyAdmin দিয়ে ইম্পোর্ট করুন অথবা mysql কমান্ড লাইনে চালান।
-- বিদ্যমান (আগে থেকে ইনস্টল করা) ডাটাবেজে চালাতে হবে — নতুন ইনস্টলে
-- install/schema.sql-ই যথেষ্ট, এই ফাইলটি আলাদা করে চালানোর দরকার নেই।
--
-- এই আপডেটে যা যুক্ত হচ্ছে:
--   ১) সেলসম্যানের যুক্ত করা নতুন পণ্য মালিকের অনুমোদন ছাড়া বিক্রয়ে দেখাবে না
--   ২) সার্ভিস (ফটোকপি/প্রিন্ট/স্ক্যান ইত্যাদি) বিক্রি হলে তার সাথে যুক্ত
--      কাঁচামাল (কাগজ/কালি) পণ্যের স্টক থেকে স্বয়ংক্রিয়ভাবে বাদ যাবে
--   ৩) ক্রয় ফেরত (Purchase Return) — নাম বা বারকোড দিয়ে এন্ট্রি করা যাবে
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- ১) পণ্য অনুমোদন ওয়ার্কফ্লো — status-এ 'pending' যুক্ত, কে যুক্ত করেছে তা রাখতে created_by
-- ---------------------------------------------------------------------
ALTER TABLE products
    MODIFY status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active';

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS created_by INT DEFAULT NULL AFTER low_stock_threshold;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS rejected_reason VARCHAR(255) DEFAULT NULL AFTER created_by;

-- ---------------------------------------------------------------------
-- ২) সার্ভিসের সাথে যুক্ত কাঁচামাল (Bill of Materials) — যেমন
--    "ফটোকপি" সার্ভিসের ১ ইউনিটে A4 কাগজ ১ পিস + কালি খরচ ইত্যাদি
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_materials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    service_id INT NOT NULL,
    product_id INT NOT NULL,
    qty_per_unit DECIMAL(10,3) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_service_product (service_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- প্রতিটি বিক্রিত সার্ভিস-আইটেমের জন্য প্রকৃতপক্ষে কোন পণ্য কত পরিমাণ বাদ
-- হয়েছে তার হিসাব রাখা হয়, যাতে বিক্রয়-ফেরত হলে সঠিকভাবে স্টক ফেরত দেওয়া যায়।
CREATE TABLE IF NOT EXISTS sale_item_materials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sale_item_id INT NOT NULL,
    product_id INT NOT NULL,
    qty DECIMAL(10,3) NOT NULL DEFAULT 0,
    restocked_qty DECIMAL(10,3) NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_sim_sale_item (sale_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- ৩) ক্রয় ফেরত (Purchase Return) — সরবরাহকারীকে পণ্য ফেরত
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_returns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_id INT DEFAULT NULL,
    return_no VARCHAR(50) NOT NULL UNIQUE,
    return_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    reason VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    INDEX idx_purchase_returns_date (return_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_return_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    return_id INT NOT NULL,
    product_id INT NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    qty INT NOT NULL DEFAULT 1,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_pri_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
