<?php
/**
 * বুটস্ট্র্যাপ: সেশন শুরু, কনফিগ ও ডাটাবেজ লোড।
 * প্রতিটি সুরক্ষিত পাতার শুরুতে এই ফাইলটি include করতে হবে।
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * অপ্রত্যাশিত ফেটাল এরর হলে সাদা পেজ/৫০০ এরর না দেখিয়ে একটা বোধগম্য বার্তা দেখানো হয়।
 * display_errors বন্ধ থাকা প্রোডাকশন সার্ভারেও কাজ করবে।
 */
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
        }
        echo '<div style="font-family:sans-serif;max-width:520px;margin:60px auto;padding:28px;text-align:center;color:#3b3350;">
            <h2 style="color:#DC2626;">কিছু একটা সমস্যা হয়েছে</h2>
            <p>পেজটি লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন, অথবা <a href="' . htmlspecialchars((defined('BASE_URL') ? BASE_URL : '')) . '/modules/dashboard.php">ড্যাশবোর্ডে</a> ফিরে যান।</p>
            <p style="font-size:12px;color:#8b8398;margin-top:16px;">' . htmlspecialchars($err['message']) . ' (লাইন ' . (int)$err['line'] . ')</p>
        </div>';
    }
});

date_default_timezone_set('Asia/Dhaka');

if (!defined('APP_ROOT')) {
    define('APP_ROOT', dirname(__DIR__));
}

require_once APP_ROOT . '/includes/db.php';
require_once APP_ROOT . '/includes/functions.php';

if (!defined('BASE_URL')) {
    define('BASE_URL', '');
}

/**
 * সাইটের রুট পাথ (যেমন "" বা "/pos") — প্রতিটি রিকোয়েস্ট থেকেই নির্ণয় করা হয়।
 * CSS/JS ও ভেতরের রিডাইরেক্ট এই পাথ দিয়ে হয়, BASE_URL-এর পূর্ণ ঠিকানা দিয়ে নয়। আগে ইনস্টলের
 * সময় http:// সেভ হয়ে থাকলে পরে https:// দিয়ে খুললে (বা www/নন-www পার্থক্যে) ব্রাউজার
 * app.js/style.css ব্লক করত — ফলে POS ও স্ক্যানার একদম কাজ করত না। এখন সাইট যেভাবেই
 * খোলা হোক, ফাইলগুলো সবসময় একই সাইট থেকে লোড হয়। (QR কোড/ইমেইলের মতো বাইরের লিংকে
 * এখনো BASE_URL ব্যবহৃত হয়।)
 */
if (!defined('APP_BASE_PATH')) {
    $appScriptDir = rtrim(str_replace('\\', '/', dirname(str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? ''))), '/');
    if (preg_match('#/(modules|install)$#', $appScriptDir)) {
        $appScriptDir = rtrim(str_replace('\\', '/', dirname($appScriptDir)), '/');
    }
    define('APP_BASE_PATH', $appScriptDir === '.' ? '' : $appScriptDir);
    unset($appScriptDir);
}

// CSS/JS হালনাগাদ হলে এই সংস্করণ বদলান — ব্রাউজার ও সার্ভিস ওয়ার্কার পুরোনো ক্যাশ ফেলে নতুন ফাইল নেবে
if (!defined('APP_ASSET_VERSION')) {
    define('APP_ASSET_VERSION', '4.0.0');
}
if (!defined('APP_DEVELOPER')) {
    define('APP_DEVELOPER', 'Arieskonex Technologies');
}

/**
 * হালনাগাদ সংস্করণে নতুন কলাম যোগ হলে আগে থেকে ইনস্টল করা কপিতে
 * স্বয়ংক্রিয়ভাবে তা যুক্ত করে (ম্যানুয়াল SQL চালানোর প্রয়োজন নেই)।
 * প্রতি সেশনে একবারই চেক করা হয়, তাই প্রতিটি রিকোয়েস্টে বাড়তি ক্যোয়ারি হয় না।
 */
if (empty($_SESSION['schema_v2_checked'])) {
    try {
        $col = $pdo->query("SHOW COLUMNS FROM products LIKE 'wholesale_price'")->fetch();
        if (!$col) {
            $pdo->exec("ALTER TABLE products ADD COLUMN wholesale_price DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER sale_price");
        }
        $col2 = $pdo->query("SHOW COLUMNS FROM shop_settings LIKE 'language'")->fetch();
        if (!$col2) {
            $pdo->exec("ALTER TABLE shop_settings ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'bn'");
        }
        $tbl = $pdo->query("SHOW TABLES LIKE 'companies'")->fetch();
        if (!$tbl) {
            $pdo->exec("CREATE TABLE companies (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
        $col3 = $pdo->query("SHOW COLUMNS FROM products LIKE 'company_id'")->fetch();
        if (!$col3) {
            $pdo->exec("ALTER TABLE products ADD COLUMN company_id INT DEFAULT NULL AFTER category_id");
            try { $pdo->exec("ALTER TABLE products ADD CONSTRAINT fk_products_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL"); } catch (Exception $e) {}
        }
        $col4 = $pdo->query("SHOW COLUMNS FROM users LIKE 'permissions'")->fetch();
        if (!$col4) {
            $pdo->exec("ALTER TABLE users ADD COLUMN permissions JSON DEFAULT NULL AFTER email");
        }
        // বিক্রয় ফেরত (Sales Return) টেবিল — আগে থেকে ইনস্টল করা কপিতে স্বয়ংক্রিয়ভাবে যুক্ত হয়
        $ret = $pdo->query("SHOW TABLES LIKE 'sales_returns'")->fetch();
        if (!$ret) {
            $pdo->exec("CREATE TABLE sales_returns (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            $pdo->exec("CREATE TABLE sales_return_items (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }

        // পারফরম্যান্স: কাস্টমার/সাপ্লায়ার নাম ও মোবাইল দিয়ে প্রতিটি বিক্রয়/ক্রয়ে লুকআপ হয়,
        // তাই ইনডেক্স না থাকলে দোকানে গ্রাহক/সাপ্লায়ার সংখ্যা বাড়ার সাথে সাথে POS/ক্রয় ধীর হয়ে যাবে।
        $idxChecks = [
            ['customers', 'idx_customers_name', 'name'],
            ['customers', 'idx_customers_mobile', 'mobile'],
            ['suppliers', 'idx_suppliers_name', 'name'],
            ['suppliers', 'idx_suppliers_mobile', 'mobile'],
        ];
        foreach ($idxChecks as [$idxTable, $idxName, $idxCol]) {
            $ix = $pdo->query("SHOW INDEX FROM $idxTable WHERE Key_name = '$idxName'")->fetch();
            if (!$ix) {
                $pdo->exec("ALTER TABLE $idxTable ADD INDEX $idxName ($idxCol)");
            }
        }

        // কাস্টমার নগদ লেনদেন: 'payment' (গ্রাহকের থেকে পেলেন — বাকি কমে) বা
        // 'loan' (গ্রাহককে হাওলাত/নগদ দিলেন — বাকি বাড়ে), কেনাবেচার বাইরে।
        $col5 = $pdo->query("SHOW COLUMNS FROM customer_payments LIKE 'type'")->fetch();
        if (!$col5) {
            $pdo->exec("ALTER TABLE customer_payments ADD COLUMN type ENUM('payment','loan') NOT NULL DEFAULT 'payment' AFTER amount");
        }

        // সাপ্লায়ার নগদ লেনদেন: 'payment' (সাপ্লায়ার পাবে — সাপ্লায়ারকে পরিশোধ করা হলো,
        // বকেয়া কমে) বা 'receipt' (দোকানদার পাবে — সাপ্লায়ারের কাছ থেকে নগদ প্রাপ্তি,
        // প্রাপ্য কমে/বকেয়া বাড়ে), কেনাবেচার বাইরে।
        $col6 = $pdo->query("SHOW COLUMNS FROM supplier_payments LIKE 'type'")->fetch();
        if (!$col6) {
            $pdo->exec("ALTER TABLE supplier_payments ADD COLUMN type ENUM('payment','receipt') NOT NULL DEFAULT 'payment' AFTER amount");
        }

        // দোকানের প্রোফাইলে হোয়াটসঅ্যাপ নম্বর — ইনভয়েসে দেখানোর জন্য
        $col7 = $pdo->query("SHOW COLUMNS FROM shop_settings LIKE 'whatsapp'")->fetch();
        if (!$col7) {
            $pdo->exec("ALTER TABLE shop_settings ADD COLUMN whatsapp VARCHAR(30) DEFAULT NULL AFTER email");
        }

        // প্রতিটি পণ্যের জন্য স্বয়ংক্রিয়ভাবে তৈরি হওয়া ক্রমিক আইটেম কোড
        $col8 = $pdo->query("SHOW COLUMNS FROM products LIKE 'item_code'")->fetch();
        if (!$col8) {
            $pdo->exec("ALTER TABLE products ADD COLUMN item_code VARCHAR(20) DEFAULT NULL AFTER id");
            // বিদ্যমান পণ্যগুলোতেও ক্রমিক কোড বসিয়ে দেওয়া হয়, যাতে পুরোনো তালিকাতেও কোড দেখা যায়
            try {
                $existingProducts = $pdo->query("SELECT id FROM products ORDER BY id ASC")->fetchAll();
                $n = 1;
                $updCode = $pdo->prepare("UPDATE products SET item_code = ? WHERE id = ?");
                foreach ($existingProducts as $ep) {
                    $updCode->execute(['P' . str_pad((string)$n, 5, '0', STR_PAD_LEFT), $ep['id']]);
                    $n++;
                }
            } catch (Exception $e) {}
            try { $pdo->exec("ALTER TABLE products ADD UNIQUE INDEX uniq_products_item_code (item_code)"); } catch (Exception $e) {}
        }

        // একই মোবাইল নম্বরে একাধিক কাস্টমার/সাপ্লায়ার যুক্ত করা ঠেকাতে ইউনিক ইনডেক্স
        // (NULL একাধিকবার থাকতে পারে — শুধু প্রকৃত নম্বরের পুনরাবৃত্তি আটকানো হয়)
        $uniqChecks = [
            ['customers', 'uniq_customers_mobile', 'mobile'],
            ['suppliers', 'uniq_suppliers_mobile', 'mobile'],
        ];
        foreach ($uniqChecks as [$uTable, $uName, $uCol]) {
            $ux = $pdo->query("SHOW INDEX FROM $uTable WHERE Key_name = '$uName'")->fetch();
            if (!$ux) {
                // বিদ্যমান ডেটায় আগে থেকেই ডুপ্লিকেট মোবাইল থাকলে এই ALTER ব্যর্থ হতে পারে —
                // তখনও অ্যাপ চলতে থাকবে, তবে নতুন এন্ট্রি PHP-স্তরের যাচাইয়ে আটকানো হবেই
                try { $pdo->exec("ALTER TABLE $uTable ADD UNIQUE INDEX $uName ($uCol)"); } catch (Exception $e) {}
            }
        }
        // বিক্রয়ের সময় (অতিরিক্ত পরিশোধ দিয়ে পুরোনো বাকি সমন্বয় করার আগে)
        // কাস্টমারের তখনকার পূর্বের বাকি "স্ন্যাপশট" হিসেবে সংরক্ষণ করা হয়,
        // যাতে ইনভয়েসে সঠিক পূর্বের বাকি (সমন্বয়ের আগের) দেখানো যায়
        $col9 = $pdo->query("SHOW COLUMNS FROM sales LIKE 'previous_balance_snapshot'")->fetch();
        if (!$col9) {
            $pdo->exec("ALTER TABLE sales ADD COLUMN previous_balance_snapshot DECIMAL(12,2) DEFAULT NULL AFTER due_amount");
        }

        // ডিসকাউন্ট এখন শতাংশ (%) বা নির্দিষ্ট (৳) — কোন ধরনের এবং ব্যবহারকারী কী
        // মান দিয়েছিলেন তা রেকর্ড রাখা হয় (discount কলামে সবসময় চূড়ান্ত ৳-হিসাবই থাকে,
        // তাই পুরোনো রিপোর্ট/হিসাব অপরিবর্তিত থাকে)। below_cost_approved রেকর্ড রাখে
        // যে এই বিক্রয়টি ক্রয়মূল্যের নিচে বিক্রি করার জন্য অনুমোদিত ছিল কিনা।
        $col10 = $pdo->query("SHOW COLUMNS FROM sales LIKE 'discount_type'")->fetch();
        if (!$col10) {
            $pdo->exec("ALTER TABLE sales ADD COLUMN discount_type ENUM('fixed','percent') NOT NULL DEFAULT 'fixed' AFTER discount");
        }
        $col11 = $pdo->query("SHOW COLUMNS FROM sales LIKE 'discount_value'")->fetch();
        if (!$col11) {
            $pdo->exec("ALTER TABLE sales ADD COLUMN discount_value DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_type");
        }
        $col12 = $pdo->query("SHOW COLUMNS FROM sales LIKE 'below_cost_approved'")->fetch();
        if (!$col12) {
            $pdo->exec("ALTER TABLE sales ADD COLUMN below_cost_approved TINYINT(1) NOT NULL DEFAULT 0 AFTER discount_value");
        }

        // ইমেইল গেটওয়ে (SMTP) কনফিগারেশন — পাসওয়ার্ড রিসেট ও অন্যান্য নোটিফিকেশন ইমেইলের জন্য
        $tblEmailSettings = $pdo->query("SHOW TABLES LIKE 'email_settings'")->fetch();
        if (!$tblEmailSettings) {
            $pdo->exec("CREATE TABLE email_settings (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
        $tblEmailLogs = $pdo->query("SHOW TABLES LIKE 'email_logs'")->fetch();
        if (!$tblEmailLogs) {
            $pdo->exec("CREATE TABLE email_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                to_email VARCHAR(150),
                subject VARCHAR(255),
                status VARCHAR(20) DEFAULT 'sent',
                error TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }

        // পাসওয়ার্ড রিসেট টোকেন — "পাসওয়ার্ড ভুলে গেছেন?" ফিচারের জন্য (সব রোলের
        // ইউজারের জন্যই কাজ করে — owner/cashier/salesman)। শুধু টোকেনের hash
        // সংরক্ষণ করা হয়, আসল টোকেন নয় — DB ফাঁস হলেও কেউ তা দিয়ে পাসওয়ার্ড
        // রিসেট করতে পারবে না।
        $tblPwReset = $pdo->query("SHOW TABLES LIKE 'password_resets'")->fetch();
        if (!$tblPwReset) {
            $pdo->exec("CREATE TABLE password_resets (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                expires_at DATETIME NOT NULL,
                used_at DATETIME DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_password_resets_token (token_hash),
                INDEX idx_password_resets_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            try { $pdo->exec("ALTER TABLE password_resets ADD CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"); } catch (Exception $e) {}
        }

        // ---------------------------------------------------------------
        // ডিসকাউন্ট/কুপন কোড — POS চেকআউটে প্রয়োগযোগ্য
        // ---------------------------------------------------------------
        $tblCoupons = $pdo->query("SHOW TABLES LIKE 'coupons'")->fetch();
        if (!$tblCoupons) {
            $pdo->exec("CREATE TABLE coupons (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
        $tblCouponUsages = $pdo->query("SHOW TABLES LIKE 'coupon_usages'")->fetch();
        if (!$tblCouponUsages) {
            $pdo->exec("CREATE TABLE coupon_usages (
                id INT PRIMARY KEY AUTO_INCREMENT,
                coupon_id INT NOT NULL,
                sale_id INT DEFAULT NULL,
                customer_id INT DEFAULT NULL,
                discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
                INDEX idx_coupon_usages_coupon (coupon_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }

        // ---------------------------------------------------------------
        // কোটেশন (বিক্রির আগে দাম প্রস্তাব) — পরে বিক্রয়ে রূপান্তরযোগ্য
        // ---------------------------------------------------------------
        $tblQuot = $pdo->query("SHOW TABLES LIKE 'quotations'")->fetch();
        if (!$tblQuot) {
            $pdo->exec("CREATE TABLE quotations (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            $pdo->exec("CREATE TABLE quotation_items (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }

        // ---------------------------------------------------------------
        // একাউন্টস/ক্যাশ লেজার — বিক্রয়/ক্রয়ের বাইরের নগদ লেনদেন (বেতন,
        // ভাড়া, মালিকের উত্তোলন/জমা ইত্যাদি) হাতে এন্ট্রি করার খাতা
        // ---------------------------------------------------------------
        $tblAcct = $pdo->query("SHOW TABLES LIKE 'account_transactions'")->fetch();
        if (!$tblAcct) {
            $pdo->exec("CREATE TABLE account_transactions (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }

        // ---------------------------------------------------------------
        // মাল্টি-ওয়্যারহাউজ / শাখা স্টক ট্রান্সফার
        // পণ্যের মোট স্টক (products.stock_qty) সবসময়ই আগের মতো
        // POS/ক্রয়/সমন্বয়ে ব্যবহৃত হয় — product_stock টেবিল শুধু "কোন শাখায়
        // কতটা আছে" তার একটি অতিরিক্ত ভাঙন। ক্রয়/বিক্রয়/ফেরত/সমন্বয় সবসময়
        // "প্রধান শাখা"-তে ধরা হয় (POS-এ শাখা বাছাইয়ের অপশন নেই); অন্য
        // শাখার স্টক শুধুমাত্র ট্রান্সফারের মাধ্যমে বদলায়।
        // ---------------------------------------------------------------
        $tblWh = $pdo->query("SHOW TABLES LIKE 'warehouses'")->fetch();
        if (!$tblWh) {
            $pdo->exec("CREATE TABLE warehouses (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(150) NOT NULL,
                address VARCHAR(255) DEFAULT NULL,
                is_main TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            $pdo->exec("INSERT INTO warehouses (name, is_main) VALUES ('প্রধান শাখা', 1)");

            $pdo->exec("CREATE TABLE product_stock (
                id INT PRIMARY KEY AUTO_INCREMENT,
                product_id INT NOT NULL,
                warehouse_id INT NOT NULL,
                qty DECIMAL(12,3) NOT NULL DEFAULT 0,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
                UNIQUE KEY uniq_product_warehouse (product_id, warehouse_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // বিদ্যমান সব পণ্যের বর্তমান মোট স্টক প্রাথমিকভাবে "প্রধান শাখা"-র হিসেবে বসিয়ে দেওয়া হয়
            $mainWid = (int)$pdo->query("SELECT id FROM warehouses WHERE is_main=1 ORDER BY id ASC LIMIT 1")->fetchColumn();
            if ($mainWid) {
                $pdo->exec("INSERT INTO product_stock (product_id, warehouse_id, qty)
                    SELECT id, $mainWid, stock_qty FROM products");
            }

            $pdo->exec("CREATE TABLE stock_transfers (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            $pdo->exec("CREATE TABLE stock_transfer_items (
                id INT PRIMARY KEY AUTO_INCREMENT,
                transfer_id INT NOT NULL,
                product_id INT NOT NULL,
                qty DECIMAL(12,3) NOT NULL DEFAULT 0,
                FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }

        // sales টেবিলে কুপন সংক্রান্ত কলাম — কোন ইনভয়েসে কোন কুপন প্রয়োগ হয়েছে তা ট্র্যাক করতে
        $colCp1 = $pdo->query("SHOW COLUMNS FROM sales LIKE 'coupon_id'")->fetch();
        if (!$colCp1) {
            $pdo->exec("ALTER TABLE sales ADD COLUMN coupon_id INT DEFAULT NULL AFTER discount_value");
        }
        $colCp2 = $pdo->query("SHOW COLUMNS FROM sales LIKE 'coupon_code'")->fetch();
        if (!$colCp2) {
            $pdo->exec("ALTER TABLE sales ADD COLUMN coupon_code VARCHAR(50) DEFAULT NULL AFTER coupon_id");
        }
    } catch (Exception $e) {
        // নীরবে উপেক্ষা করুন — টেবিল/কলাম না থাকলেও অ্যাপ চলতে থাকবে
    }
    $_SESSION['schema_v2_checked'] = true;
}

/**
 * স্কিমা v3: সার্ভিসেরও বারকোড/কোড — POS-এ স্ক্যান করলেই সার্ভিস সরাসরি কার্টে যুক্ত হয়।
 * বিদ্যমান সার্ভিসগুলোতে স্বয়ংক্রিয়ভাবে S00001, S00002 ... কোড বসানো হয়।
 */
if (empty($_SESSION['schema_v3_checked'])) {
    try {
        $colSvc = $pdo->query("SHOW COLUMNS FROM services LIKE 'code'")->fetch();
        if (!$colSvc) {
            $pdo->exec("ALTER TABLE services ADD COLUMN code VARCHAR(50) DEFAULT NULL AFTER id");
            $pdo->exec("UPDATE services SET code = CONCAT('S', LPAD(id, 5, '0')) WHERE code IS NULL OR code = ''");
            try { $pdo->exec("ALTER TABLE services ADD UNIQUE INDEX uniq_services_code (code)"); } catch (Exception $e) {}
        }
    } catch (Exception $e) {
        // নীরবে উপেক্ষা — কলাম না থাকলেও অ্যাপ চলবে
    }
    $_SESSION['schema_v3_checked'] = true;
}



/**
 * সক্রিয় ভাষা নির্ধারণ: সেশন ওভাররাইড > দোকানের ডিফল্ট ভাষা > বাংলা।
 * $LANG গ্লোবাল অ্যারেতে লোড হয়; t($key) ফাংশন দিয়ে ব্যবহার করুন।
 */
$activeLang = $_SESSION['lang'] ?? null;
if (!$activeLang) {
    try {
        $activeLang = shop_settings($pdo)['language'] ?? 'bn';
    } catch (Exception $e) {
        $activeLang = 'bn';
    }
}
$activeLang = preg_replace('/[^a-z]/', '', strtolower($activeLang)) ?: 'bn';
$langFile = APP_ROOT . '/lang/' . $activeLang . '.php';
if (!is_file($langFile)) {
    $langFile = APP_ROOT . '/lang/bn.php';
}
$GLOBALS['LANG'] = is_file($langFile) ? require $langFile : [];
$GLOBALS['ACTIVE_LANG'] = $activeLang;
