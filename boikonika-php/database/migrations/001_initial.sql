-- Boikonika core schema (MySQL 5.7+ / MariaDB 10.3+). Money is DECIMAL(12,2); never floating point.

CREATE TABLE settings (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  value MEDIUMTEXT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- accounts
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NULL,
  phone VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_path VARCHAR(255) NULL,
  locale CHAR(2) NOT NULL DEFAULT 'bn',
  status ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME NULL,
  notify_email TINYINT(1) NOT NULL DEFAULT 1,
  failed_logins TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  totp_secret_enc VARCHAR(255) NULL,
  totp_enabled_at DATETIME NULL,
  last_login_at DATETIME NULL,
  last_login_ip VARCHAR(45) NULL,
  suspended_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
  user_id INT UNSIGNED NOT NULL,
  role VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, role),
  CONSTRAINT fk_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  selector CHAR(24) NULL,
  token_hash CHAR(64) NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  UNIQUE KEY uq_sessions_selector (selector),
  KEY idx_sessions_user (user_id, revoked_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  success TINYINT(1) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_login_events_user (user_id, created_at),
  CONSTRAINT fk_login_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE recovery_codes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  KEY idx_recovery_user (user_id),
  CONSTRAINT fk_recovery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sign-up and password-reset codes (stored hashed). Pending sign-up details wait in payload.
CREATE TABLE verification_codes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purpose ENUM('register','reset','email_change') NOT NULL,
  target VARCHAR(191) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  payload TEXT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ip VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  KEY idx_codes_target (purpose, target, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rate_limits (
  bucket CHAR(40) NOT NULL PRIMARY KEY,
  hits INT UNSIGNED NOT NULL,
  reset_at INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- catalogue
CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED NULL,
  kind ENUM('book','general') NOT NULL DEFAULT 'book',
  slug VARCHAR(120) NOT NULL,
  name_bn VARCHAR(120) NOT NULL,
  name_en VARCHAR(120) NOT NULL,
  icon VARCHAR(40) NULL,
  position INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_categories_slug (slug),
  KEY idx_categories_parent (parent_id, position),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE authors (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL,
  name_bn VARCHAR(160) NOT NULL,
  name_en VARCHAR(160) NULL,
  bio_bn TEXT NULL,
  bio_en TEXT NULL,
  photo_path VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_authors_slug (slug),
  KEY idx_authors_name (name_bn),
  KEY idx_authors_name_en (name_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE publishers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL,
  name_bn VARCHAR(160) NOT NULL,
  name_en VARCHAR(160) NULL,
  description_bn TEXT NULL,
  description_en TEXT NULL,
  logo_path VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_publishers_slug (slug),
  KEY idx_publishers_name (name_bn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sellers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  store_name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NULL,
  logo_path VARCHAR(255) NULL,
  banner_path VARCHAR(255) NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(191) NULL,
  business_type ENUM('individual','business','publisher') NOT NULL DEFAULT 'individual',
  business_name VARCHAR(160) NULL,
  address TEXT NOT NULL,
  district VARCHAR(60) NOT NULL,
  status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  review_note VARCHAR(500) NULL,
  commission_percent DECIMAL(5,2) NULL,
  accepted_policy_at DATETIME NOT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_sellers_user (user_id),
  UNIQUE KEY uq_sellers_slug (slug),
  KEY idx_sellers_status (status),
  CONSTRAINT fk_sellers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Identity documents: images live in storage/private, numbers are encrypted, only the last 4 shown.
CREATE TABLE seller_documents (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_id INT UNSIGNED NOT NULL,
  doc_type ENUM('nid','passport','birth_certificate','trade_license') NOT NULL,
  number_enc TEXT NOT NULL,
  number_last4 VARCHAR(4) NOT NULL,
  front_path VARCHAR(255) NOT NULL,
  back_path VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  KEY idx_docs_seller (seller_id),
  CONSTRAINT fk_docs_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A catalogue entry: a book edition (ISBN) or a general product. Sellers offer it through listings.
CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type ENUM('book','general') NOT NULL DEFAULT 'book',
  slug VARCHAR(191) NOT NULL,
  title VARCHAR(255) NOT NULL,
  title_alt VARCHAR(255) NULL,
  subtitle VARCHAR(255) NULL,
  isbn VARCHAR(13) NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'bn',
  edition VARCHAR(80) NULL,
  pages SMALLINT UNSIGNED NULL,
  binding ENUM('hardcover','paperback','other') NULL,
  published_year SMALLINT UNSIGNED NULL,
  publisher_id INT UNSIGNED NULL,
  category_id INT UNSIGNED NULL,
  brand VARCHAR(120) NULL,
  description MEDIUMTEXT NULL,
  cover_path VARCHAR(255) NULL,
  status ENUM('pending','active','rejected','archived') NOT NULL DEFAULT 'pending',
  review_note VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  seller_id INT UNSIGNED NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0,
  rating_count INT UNSIGNED NOT NULL DEFAULT 0,
  sold_count INT UNSIGNED NOT NULL DEFAULT 0,
  min_price DECIMAL(12,2) NULL,
  max_discount_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  has_used TINYINT(1) NOT NULL DEFAULT 0,
  offer_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  search_text TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_products_slug (slug),
  UNIQUE KEY uq_products_isbn (isbn),
  KEY idx_products_browse (status, type, offer_count),
  KEY idx_products_category (category_id),
  KEY idx_products_publisher (publisher_id),
  KEY idx_products_created (created_at),
  CONSTRAINT fk_products_publisher FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_authors (
  product_id INT UNSIGNED NOT NULL,
  author_id INT UNSIGNED NOT NULL,
  role ENUM('author','translator','editor','illustrator') NOT NULL DEFAULT 'author',
  position TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, author_id, role),
  KEY idx_pa_author (author_id),
  CONSTRAINT fk_pa_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_author FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  path VARCHAR(255) NOT NULL,
  position TINYINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_pimages_product (product_id),
  CONSTRAINT fk_pimages_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A seller's offer: condition, price and stock for one product.
CREATE TABLE listings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  seller_id INT UNSIGNED NOT NULL,
  item_condition ENUM('new','like_new','good','acceptable') NOT NULL DEFAULT 'new',
  condition_note VARCHAR(255) NULL,
  price DECIMAL(12,2) NOT NULL,
  compare_at_price DECIMAL(12,2) NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  sku VARCHAR(60) NULL,
  status ENUM('active','paused','suspended') NOT NULL DEFAULT 'active',
  suspended_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_listings_product (product_id, status),
  KEY idx_listings_seller (seller_id, status),
  CONSTRAINT fk_listings_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_listings_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE listing_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  listing_id INT UNSIGNED NOT NULL,
  path VARCHAR(255) NOT NULL,
  position TINYINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_limages_listing (listing_id),
  CONSTRAINT fk_limages_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  body TEXT NULL,
  status ENUM('published','hidden') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_reviews_user_product (product_id, user_id),
  KEY idx_reviews_product (product_id, status, created_at),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wishlist_items (
  user_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, product_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- cart and checkout
CREATE TABLE addresses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  label VARCHAR(40) NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  division VARCHAR(40) NOT NULL,
  district VARCHAR(60) NOT NULL,
  area VARCHAR(120) NOT NULL,
  address_line VARCHAR(255) NOT NULL,
  postcode VARCHAR(10) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  KEY idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE shipping_methods (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  name_bn VARCHAR(80) NOT NULL,
  name_en VARCHAR(80) NOT NULL,
  inside_dhaka_fee DECIMAL(12,2) NOT NULL,
  outside_dhaka_fee DECIMAL(12,2) NOT NULL,
  free_threshold DECIMAL(12,2) NULL,
  min_days TINYINT UNSIGNED NOT NULL,
  max_days TINYINT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  position INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_shipping_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE carts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  token CHAR(64) NULL,
  coupon_code VARCHAR(40) NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_carts_user (user_id),
  UNIQUE KEY uq_carts_token (token),
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cart_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cart_id INT UNSIGNED NOT NULL,
  listing_id INT UNSIGNED NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  added_at DATETIME NOT NULL,
  UNIQUE KEY uq_cart_items (cart_id, listing_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE coupons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  description VARCHAR(255) NULL,
  type ENUM('percent','fixed') NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  max_discount DECIMAL(12,2) NULL,
  min_order DECIMAL(12,2) NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  usage_limit INT UNSIGNED NULL,
  per_user_limit INT UNSIGNED NULL DEFAULT 1,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- orders and money
CREATE TABLE orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(20) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  status ENUM('awaiting_payment','placed','completed','cancelled') NOT NULL,
  payment_method ENUM('cod','bkash','sslcommerz') NOT NULL,
  payment_status ENUM('unpaid','pending','paid','failed','refunded','partially_refunded','cancelled') NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  shipping_total DECIMAL(12,2) NOT NULL,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  refunded_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  coupon_id INT UNSIGNED NULL,
  coupon_code VARCHAR(40) NULL,
  shipping_method_id INT UNSIGNED NULL,
  shipping_method_name VARCHAR(80) NOT NULL,
  ship_name VARCHAR(120) NOT NULL,
  ship_phone VARCHAR(20) NOT NULL,
  ship_division VARCHAR(40) NOT NULL,
  ship_district VARCHAR(60) NOT NULL,
  ship_area VARCHAR(120) NOT NULL,
  ship_address VARCHAR(255) NOT NULL,
  ship_postcode VARCHAR(10) NULL,
  inside_dhaka TINYINT(1) NOT NULL,
  note VARCHAR(500) NULL,
  idempotency_key CHAR(64) NOT NULL,
  locale CHAR(2) NOT NULL DEFAULT 'bn',
  payment_due_at DATETIME NULL,
  paid_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  cancel_reason VARCHAR(255) NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_orders_number (number),
  UNIQUE KEY uq_orders_idempotency (idempotency_key),
  KEY idx_orders_user (user_id, created_at),
  KEY idx_orders_status (status, created_at),
  KEY idx_orders_due (payment_status, payment_due_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One parcel per seller in an order.
CREATE TABLE seller_orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  seller_id INT UNSIGNED NOT NULL,
  number VARCHAR(24) NOT NULL,
  status ENUM('awaiting_payment','pending','confirmed','processing','shipped','delivered','cancelled','returned') NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  shipping_fee DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  seller_earning DECIMAL(12,2) NOT NULL,
  courier VARCHAR(60) NULL,
  tracking_number VARCHAR(80) NULL,
  confirmed_at DATETIME NULL,
  shipped_at DATETIME NULL,
  delivered_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  cancel_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_seller_orders_number (number),
  KEY idx_seller_orders_order (order_id),
  KEY idx_seller_orders_seller (seller_id, status, created_at),
  CONSTRAINT fk_so_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_so_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  seller_order_id INT UNSIGNED NOT NULL,
  listing_id INT UNSIGNED NULL,
  product_id INT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  item_condition VARCHAR(20) NOT NULL,
  cover_path VARCHAR(255) NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  KEY idx_items_order (order_id),
  KEY idx_items_seller_order (seller_order_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_so FOREIGN KEY (seller_order_id) REFERENCES seller_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  seller_order_id INT UNSIGNED NULL,
  actor_user_id INT UNSIGNED NULL,
  type VARCHAR(40) NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL,
  KEY idx_events_order (order_id, created_at),
  CONSTRAINT fk_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE coupon_redemptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_redemptions_coupon_user (coupon_id, user_id),
  CONSTRAINT fk_redemptions_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  CONSTRAINT fk_redemptions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Online payment attempts. No card data is ever stored; raw holds the sanitised gateway reply.
CREATE TABLE payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  provider ENUM('bkash','sslcommerz') NOT NULL,
  reference VARCHAR(32) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('initiated','pending','paid','failed','cancelled','expired') NOT NULL DEFAULT 'initiated',
  provider_payment_id VARCHAR(120) NULL,
  transaction_id VARCHAR(120) NULL,
  failure_reason VARCHAR(255) NULL,
  raw TEXT NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_payments_reference (reference),
  KEY idx_payments_order (order_id),
  KEY idx_payments_provider (provider, provider_payment_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE returns (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_order_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  reason ENUM('damaged','wrong_item','not_as_described','missing_parts','other') NOT NULL,
  details VARCHAR(1000) NULL,
  status ENUM('requested','approved','rejected','received','refunded','cancelled') NOT NULL DEFAULT 'requested',
  response_note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_returns_so (seller_order_id),
  KEY idx_returns_status (status, created_at),
  CONSTRAINT fk_returns_so FOREIGN KEY (seller_order_id) REFERENCES seller_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_returns_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refunds (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  seller_order_id INT UNSIGNED NULL,
  payment_id INT UNSIGNED NULL,
  return_id INT UNSIGNED NULL,
  amount DECIMAL(12,2) NOT NULL,
  seller_debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  reason VARCHAR(500) NOT NULL,
  status ENUM('requested','processing','completed','failed','rejected') NOT NULL DEFAULT 'requested',
  method ENUM('gateway','manual') NULL,
  provider_refund_id VARCHAR(120) NULL,
  reference VARCHAR(120) NULL,
  failure_reason VARCHAR(255) NULL,
  requested_by INT UNSIGNED NULL,
  processed_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  processed_at DATETIME NULL,
  KEY idx_refunds_order (order_id),
  KEY idx_refunds_status (status, created_at),
  CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payout_accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_id INT UNSIGNED NOT NULL,
  method ENUM('bkash','nagad','rocket','bank') NOT NULL,
  account_name VARCHAR(120) NOT NULL,
  account_number_enc TEXT NOT NULL,
  account_last4 VARCHAR(4) NOT NULL,
  bank_name VARCHAR(120) NULL,
  branch VARCHAR(120) NULL,
  routing_number VARCHAR(20) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  KEY idx_payout_accounts_seller (seller_id),
  CONSTRAINT fk_payout_accounts_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payouts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_id INT UNSIGNED NOT NULL,
  payout_account_id INT UNSIGNED NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('requested','processing','paid','rejected','cancelled') NOT NULL DEFAULT 'requested',
  method_snapshot VARCHAR(160) NOT NULL,
  reference VARCHAR(120) NULL,
  note VARCHAR(500) NULL,
  requested_at DATETIME NOT NULL,
  processed_at DATETIME NULL,
  processed_by INT UNSIGNED NULL,
  KEY idx_payouts_seller (seller_id, status),
  KEY idx_payouts_status (status, requested_at),
  CONSTRAINT fk_payouts_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payouts_account FOREIGN KEY (payout_account_id) REFERENCES payout_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- content and platform
CREATE TABLE pages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL,
  title_bn VARCHAR(160) NOT NULL,
  title_en VARCHAR(160) NOT NULL,
  body_bn MEDIUMTEXT NULL,
  body_en MEDIUMTEXT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  footer_group ENUM('none','company','support','policies') NOT NULL DEFAULT 'none',
  position INT NOT NULL DEFAULT 0,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_pages_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE banners (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title_bn VARCHAR(160) NOT NULL,
  title_en VARCHAR(160) NOT NULL,
  subtitle_bn VARCHAR(255) NULL,
  subtitle_en VARCHAR(255) NULL,
  button_bn VARCHAR(60) NULL,
  button_en VARCHAR(60) NULL,
  image_path VARCHAR(255) NULL,
  link_url VARCHAR(255) NULL,
  position INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contact_messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(20) NULL,
  topic ENUM('order','seller','account','copyright','other') NOT NULL DEFAULT 'other',
  subject VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('new','open','replied','closed') NOT NULL DEFAULT 'new',
  reply TEXT NULL,
  replied_by INT UNSIGNED NULL,
  replied_at DATETIME NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL,
  KEY idx_messages_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body VARCHAR(500) NULL,
  link VARCHAR(255) NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  KEY idx_notifications_user (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mail_queue (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  to_email VARCHAR(191) NOT NULL,
  to_name VARCHAR(120) NULL,
  subject VARCHAR(255) NOT NULL,
  html MEDIUMTEXT NOT NULL,
  text MEDIUMTEXT NOT NULL,
  status ENUM('queued','sending','sent','failed') NOT NULL DEFAULT 'queued',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  send_after DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  KEY idx_mail_queue_status (status, send_after)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id VARCHAR(40) NULL,
  details TEXT NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL,
  KEY idx_audit_created (created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_actor (actor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
