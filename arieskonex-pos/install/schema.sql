-- =====================================================================
-- Mallik Book House & Computer — Database Schema
-- Developed by Askurex Technologies
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- Shop / business profile (single row)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    shop_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    address TEXT,
    mobile VARCHAR(30),
    email VARCHAR(150),
    whatsapp VARCHAR(30) DEFAULT NULL,
    logo VARCHAR(255) DEFAULT NULL,
    currency VARCHAR(10) DEFAULT 'BDT',
    stagnant_stock_days INT DEFAULT 60,
    invoice_prefix VARCHAR(10) DEFAULT 'INV',
    purchase_prefix VARCHAR(10) DEFAULT 'PUR',
    language VARCHAR(5) NOT NULL DEFAULT 'bn',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Users (owner / cashier / salesman)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('owner','cashier','salesman') NOT NULL DEFAULT 'cashier',
    mobile VARCHAR(30),
    email VARCHAR(150),
    photo VARCHAR(255) DEFAULT NULL,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Product categories (stationery / book / photocopy-print / other)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    type ENUM('stationery','book','print','other') NOT NULL DEFAULT 'stationery',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- কোম্পানি / ব্র্যান্ড (স্টেশনারি ব্র্যান্ড অথবা বইয়ের প্রকাশনী গোষ্ঠী)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Products (stationery items & books share one table; author / publisher
-- / edition are only used for books but kept nullable for everything else)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    item_code VARCHAR(20) DEFAULT NULL UNIQUE,
    category_id INT DEFAULT NULL,
    company_id INT DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(100) DEFAULT NULL UNIQUE,
    unit VARCHAR(50) DEFAULT 'পিস',
    cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    sale_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    wholesale_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock_qty INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    author VARCHAR(255) DEFAULT NULL,
    publisher VARCHAR(255) DEFAULT NULL,
    edition VARCHAR(100) DEFAULT NULL,
    status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active',
    created_by INT DEFAULT NULL,
    rejected_reason VARCHAR(255) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    INDEX idx_products_name (name),
    INDEX idx_products_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Services (photocopy / print / scan / lamination / online form / CV etc.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'টি',
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- সার্ভিসের সাথে যুক্ত কাঁচামাল (Bill of Materials) — যেমন "ফটোকপি"
-- সার্ভিসের ১ ইউনিটে A4 কাগজ ১ পিস খরচ হয়, বিক্রির সময় স্বয়ংক্রিয়ভাবে
-- সেই পরিমাণ কাগজ পণ্যের স্টক থেকে বাদ যায়।
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

-- ---------------------------------------------------------------------
-- Online / custom orders (form fill-up, CV, bulk print jobs, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS online_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT DEFAULT NULL,
    order_type VARCHAR(150) NOT NULL,
    description TEXT,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    advance_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('pending','processing','completed','delivered') NOT NULL DEFAULT 'pending',
    order_date DATE NOT NULL,
    delivery_date DATE DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255) DEFAULT NULL,
    mobile VARCHAR(30) UNIQUE,
    address TEXT,
    opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Purchases (stock-in from suppliers)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_id INT DEFAULT NULL,
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    purchase_date DATE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    due_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    note VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    purchase_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Purchase returns (goods returned to a supplier) — নাম/বারকোড দিয়ে
-- এন্ট্রি করা যায়, ঠিক purchase.php-এর মতোই।
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

CREATE TABLE IF NOT EXISTS supplier_payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type ENUM('payment','receipt') NOT NULL DEFAULT 'payment',
    payment_date DATE NOT NULL,
    note VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(30) DEFAULT NULL UNIQUE,
    address TEXT,
    customer_type ENUM('regular','wholesale','student') NOT NULL DEFAULT 'regular',
    opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sales (POS invoices)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT DEFAULT NULL,
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_type ENUM('fixed','percent') NOT NULL DEFAULT 'fixed',
    discount_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    coupon_id INT DEFAULT NULL,
    coupon_code VARCHAR(50) DEFAULT NULL,
    below_cost_approved TINYINT(1) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    due_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    previous_balance_snapshot DECIMAL(12,2) DEFAULT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    payment_ref VARCHAR(100) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_sales_date (sale_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    item_type ENUM('product','service') NOT NULL DEFAULT 'product',
    product_id INT DEFAULT NULL,
    service_id INT DEFAULT NULL,
    description VARCHAR(255) DEFAULT NULL,
    qty INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    INDEX idx_sale_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- প্রতিটি বিক্রিত সার্ভিস-আইটেমের জন্য প্রকৃতপক্ষে কোন কাঁচামাল পণ্য কত
-- পরিমাণ বাদ হয়েছে তার হিসাব — বিক্রয়-ফেরত হলে সঠিক পরিমাণ স্টকে ফেরত দিতে ব্যবহৃত হয়।
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

CREATE TABLE IF NOT EXISTS customer_payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type ENUM('payment','loan') NOT NULL DEFAULT 'payment',
    payment_date DATE NOT NULL,
    note VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sales returns (goods returned by customers against a sale invoice)
-- ফেরত দিলে পণ্যের স্টক ফিরিয়ে দেওয়া হয় এবং মূল ইনভয়েসের
-- সাবটোটাল/ডিসকাউন্ট/মোট/পরিশোধ/বাকি হালনাগাদ হয়।
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_returns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    return_no VARCHAR(50) NOT NULL UNIQUE,
    return_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    return_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    credit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    refund_method VARCHAR(50) DEFAULT NULL,
    refund_ref VARCHAR(100) DEFAULT NULL,
    reason VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    INDEX idx_sales_returns_sale (sale_id),
    INDEX idx_sales_returns_date (return_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_return_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    return_id INT NOT NULL,
    sale_item_id INT NOT NULL,
    product_id INT DEFAULT NULL,
    description VARCHAR(255) DEFAULT NULL,
    qty INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    restocked TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
    INDEX idx_sales_return_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Income & expenses
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    note VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Payment method / gateway configuration
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
    id INT PRIMARY KEY AUTO_INCREMENT,
    method_key VARCHAR(50) NOT NULL UNIQUE,
    method_name VARCHAR(100) NOT NULL,
    merchant_number VARCHAR(100) DEFAULT NULL,
    api_key VARCHAR(255) DEFAULT NULL,
    api_secret VARCHAR(255) DEFAULT NULL,
    extra_config TEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- SMS gateway configuration (for বাকি / due reminders)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    provider_name VARCHAR(100) DEFAULT NULL,
    api_url TEXT DEFAULT NULL,
    api_key VARCHAR(255) DEFAULT NULL,
    sender_id VARCHAR(50) DEFAULT NULL,
    message_template TEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sms_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT DEFAULT NULL,
    mobile VARCHAR(30),
    message TEXT,
    status VARCHAR(20) DEFAULT 'sent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Email gateway (SMTP) configuration — password reset & notification emails
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Password reset tokens — "forgot password" for all user roles
-- (owner / cashier / salesman). Only the token HASH is stored.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_password_resets_token (token_hash),
    INDEX idx_password_resets_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Discount / coupon codes — applicable at POS checkout
-- ---------------------------------------------------------------------
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
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    INDEX idx_coupon_usages_coupon (coupon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- কোটেশন (বিক্রির আগে দাম প্রস্তাব) — পরে বিক্রয়ে রূপান্তরযোগ্য
-- ---------------------------------------------------------------------
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
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
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
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- একাউন্টস/ক্যাশ লেজার — বিক্রয়/ক্রয়ের বাইরের নগদ লেনদেন (বেতন, ভাড়া,
-- মালিকের উত্তোলন/জমা ইত্যাদি) হাতে এন্ট্রি করার খাতা
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- মাল্টি-ওয়্যারহাউজ / শাখা স্টক ট্রান্সফার। products.stock_qty সবসময়ই
-- "প্রধান শাখা"-র স্টক (POS/ক্রয়/সমন্বয়ে ব্যবহৃত) — product_stock টেবিল
-- শুধু অন্য শাখার ভাঙন ধরে রাখে।
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255) DEFAULT NULL,
    is_main TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_stock (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    qty DECIMAL(12,3) NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_product_warehouse (product_id, warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_transfers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transfer_no VARCHAR(50) NOT NULL UNIQUE,
    from_warehouse_id INT NOT NULL,
    to_warehouse_id INT NOT NULL,
    transfer_date DATE NOT NULL,
    note VARCHAR(255) DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transfer_id INT NOT NULL,
    product_id INT NOT NULL,
    qty DECIMAL(12,3) NOT NULL DEFAULT 0,
    FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Backup log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backup_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    file_name VARCHAR(255) NOT NULL,
    file_size INT DEFAULT 0,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Activity log (simple audit trail)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT DEFAULT NULL,
    action VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Seed data: default payment methods & a few common categories
-- ---------------------------------------------------------------------
INSERT INTO payment_methods (method_key, method_name, is_active, sort_order) VALUES
('cash', 'ক্যাশ', 1, 1),
('bkash', 'বিকাশ', 0, 2),
('nagad', 'নগদ', 0, 3),
('rocket', 'রকেট', 0, 4),
('card', 'কার্ড', 0, 5);

INSERT INTO warehouses (name, is_main) VALUES ('প্রধান শাখা', 1);

INSERT INTO categories (name, type) VALUES
('খাতা ও কাগজ', 'stationery'),
('কলম ও লেখার সামগ্রী', 'stationery'),
('পাঠ্যবই', 'book'),
('গল্প ও উপন্যাস', 'book'),
('প্রিন্ট ও ফটোকপি কাগজ', 'print');

INSERT INTO services (name, price, unit) VALUES
('ফটোকপি (প্রতি পাতা)', 2.00, 'পাতা'),
('প্রিন্ট - সাদাকালো (প্রতি পাতা)', 3.00, 'পাতা'),
('প্রিন্ট - কালার (প্রতি পাতা)', 10.00, 'পাতা'),
('স্ক্যান (প্রতি পাতা)', 5.00, 'পাতা'),
('লেমিনেশন (প্রতি পিস)', 20.00, 'পিস'),
('অনলাইন ফরম পূরণ', 50.00, 'টি'),
('সিভি তৈরি', 100.00, 'টি');

SET FOREIGN_KEY_CHECKS = 1;
