<?php
/**
 * POS থেকে তাৎক্ষণিক নতুন পণ্য যুক্ত করা — ছোট JSON এন্ডপয়েন্ট।
 * বিক্রয়ের সময় স্ক্যান/খোঁজে কোনো পণ্য না পেলে sales_pos.php-এর "নতুন পণ্য যুক্ত করুন"
 * ফর্ম এখানে পাঠায়, তাই বিক্রয় ছেড়ে স্টক পাতায় যেতে হয় না।
 *
 * নিয়ম stock.php-এর মতোই:
 * - মালিক যুক্ত করলে পণ্য সাথে সাথে সক্রিয় হয় এবং কার্টে যোগ হয়।
 * - "পণ্য যুক্ত করুন" অনুমতিপ্রাপ্ত অন্য ইউজার যুক্ত করলে পণ্যটি মালিকের অনুমোদনের অপেক্ষায়
 *   (pending) থাকে — অনুমোদনের আগে বিক্রি করা যায় না।
 *
 * action=create        নতুন পণ্য তৈরি (একই নামের সক্রিয় পণ্য থাকলে আগে সেটি জানানো হয়)
 * action=link_barcode  বারকোডহীন বিদ্যমান পণ্যে স্ক্যান করা বারকোডটি সংরক্ষণ (শুধু মালিক)
 */
require_once __DIR__ . '/../includes/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function quick_product_respond(array $data, $httpCode = 200) {
    http_response_code($httpCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function quick_product_fail($message, $httpCode = 400) {
    quick_product_respond(['ok' => false, 'message' => $message], $httpCode);
}

function quick_product_row(PDO $pdo, $id) {
    $stmt = $pdo->prepare("SELECT id, item_code, name, unit, sale_price, wholesale_price, cost_price, barcode, stock_qty, status FROM products WHERE id = ?");
    $stmt->execute([(int)$id]);
    $p = $stmt->fetch();
    if (!$p) return null;
    return [
        'id' => (int)$p['id'],
        'item_code' => (string)($p['item_code'] ?? ''),
        'name' => (string)$p['name'],
        'unit' => (string)($p['unit'] ?? ''),
        'sale_price' => (float)$p['sale_price'],
        'wholesale_price' => (float)$p['wholesale_price'],
        'cost_price' => (float)$p['cost_price'],
        'barcode' => (string)($p['barcode'] ?? ''),
        'stock_qty' => (float)$p['stock_qty'],
        'status' => (string)$p['status'],
    ];
}

if (empty($_SESSION['user'])) {
    quick_product_fail(t('qp_session_expired', 'সেশন শেষ হয়ে গেছে — আবার লগইন করুন।'), 401);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    quick_product_fail('Method not allowed', 405);
}
$csrf = (string)($_POST['csrf_token'] ?? '');
if ($csrf === '' || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrf)) {
    quick_product_fail(t('qp_csrf_failed', 'নিরাপত্তা যাচাই ব্যর্থ হয়েছে — পাতাটি রিলোড করে আবার চেষ্টা করুন।'), 403);
}

$user = current_user();
$isOwner = is_owner($user);
if (!has_permission($user, 'sales') || (!$isOwner && !has_permission($user, 'add_product'))) {
    quick_product_fail(t('qp_no_permission', 'নতুন পণ্য যুক্ত করার অনুমতি আপনার নেই — মালিকের সাথে যোগাযোগ করুন।'), 403);
}
$userId = $user['id'] ?? null;
// সেশন লক ছেড়ে দেওয়া হয়, যাতে এই অনুরোধ চলাকালীন POS-এর অন্য অনুরোধ আটকে না থাকে
session_write_close();

$bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
$enDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
$barcode = trim(str_replace($bnDigits, $enDigits, (string)($_POST['barcode'] ?? '')));
$action = ($_POST['action'] ?? 'create') === 'link_barcode' ? 'link_barcode' : 'create';

if ($barcode !== '' && mb_strlen($barcode) > 100) {
    quick_product_fail(t('qp_barcode_too_long', 'বারকোড সর্বোচ্চ ১০০ অক্ষরের হতে পারে।'));
}

/** বারকোডটি অন্য কোনো পণ্য/সার্ভিসে ব্যবহৃত হলে তার বিবরণ, না হলে null */
function quick_product_barcode_owner(PDO $pdo, $barcode, $exceptProductId = 0) {
    $stmt = $pdo->prepare("SELECT id, name, status FROM products WHERE (barcode = ? OR item_code = ?) AND id != ? LIMIT 1");
    $stmt->execute([$barcode, $barcode, (int)$exceptProductId]);
    if ($row = $stmt->fetch()) {
        return ['type' => 'product', 'id' => (int)$row['id'], 'name' => $row['name'], 'status' => $row['status']];
    }
    try {
        $stmt = $pdo->prepare("SELECT id, name FROM services WHERE code = ? LIMIT 1");
        $stmt->execute([$barcode]);
        if ($row = $stmt->fetch()) {
            return ['type' => 'service', 'id' => (int)$row['id'], 'name' => $row['name'], 'status' => 'active'];
        }
    } catch (Exception $e) {
        // পুরোনো ইনস্টলে services.code কলাম না থাকলে
    }
    return null;
}

// ---------- বিদ্যমান (বারকোডহীন) পণ্যে বারকোড সংরক্ষণ ----------
if ($action === 'link_barcode') {
    if (!$isOwner) {
        quick_product_fail(t('qp_link_owner_only', 'বিদ্যমান পণ্যে বারকোড যুক্ত করতে পারেন শুধু মালিক।'), 403);
    }
    $productId = (int)($_POST['product_id'] ?? 0);
    $product = quick_product_row($pdo, $productId);
    if (!$product || $product['status'] !== 'active') {
        quick_product_fail(t('qp_product_missing', 'পণ্যটি পাওয়া যায়নি বা সক্রিয় নেই।'));
    }
    if ($barcode !== '' && $product['barcode'] === '') {
        if ($taken = quick_product_barcode_owner($pdo, $barcode, $productId)) {
            quick_product_fail(sprintf(t('qp_barcode_taken', 'এই বারকোডটি ইতোমধ্যে "%s"-এ ব্যবহৃত হচ্ছে।'), $taken['name']));
        }
        $pdo->prepare("UPDATE products SET barcode = ?, updated_at = NOW() WHERE id = ? AND (barcode IS NULL OR barcode = '')")
            ->execute([$barcode, $productId]);
        log_activity($pdo, t('log_barcode_linked', 'POS থেকে বারকোড যুক্ত') . ': ' . $product['name'] . ' (' . $barcode . ')');
        $product = quick_product_row($pdo, $productId);
    }
    quick_product_respond(['ok' => true, 'product' => $product]);
}

// ---------- নতুন পণ্য তৈরি ----------
$name = trim(preg_replace('/\s+/u', ' ', (string)($_POST['name'] ?? '')));
$unit = trim((string)($_POST['unit'] ?? '')) ?: t('unit_piece', 'পিস');
$salePrice = round((float)($_POST['sale_price'] ?? 0), 2);
// ক্রয়মূল্য শুধু মালিক দেন (অন্যরা দেখতে পান না) — অনুমোদনের সময় মালিক স্টক পাতায় ঠিক করতে পারবেন
$costPrice = $isOwner ? max(0, round((float)($_POST['cost_price'] ?? 0), 2)) : 0.0;
$stockQty = max(0, (int)($_POST['stock_qty'] ?? 0));
$categoryId = (int)($_POST['category_id'] ?? 0);
$force = !empty($_POST['force']);

if ($name === '') {
    quick_product_fail(t('qp_name_required', 'পণ্যের নাম দিন।'));
}
if (mb_strlen($name) > 255 || mb_strlen($unit) > 50) {
    quick_product_fail(t('qp_too_long', 'নাম বা একক অনেক বড় হয়ে গেছে।'));
}
if ($salePrice <= 0) {
    quick_product_fail(t('qp_price_required', 'বিক্রয় মূল্য দিন (০-এর বেশি)।'));
}
if ($categoryId > 0) {
    $chk = $pdo->prepare("SELECT id FROM categories WHERE id = ?");
    $chk->execute([$categoryId]);
    if (!$chk->fetch()) $categoryId = 0;
}

if ($barcode !== '') {
    if ($taken = quick_product_barcode_owner($pdo, $barcode)) {
        if ($taken['type'] === 'product' && $taken['status'] === 'active') {
            // ইতোমধ্যে সক্রিয় পণ্য — নতুন না বানিয়ে সেটিই ফেরত দেওয়া হয় (POS কার্টে যোগ করবে)
            quick_product_respond(['ok' => true, 'existing' => true, 'product' => quick_product_row($pdo, $taken['id']),
                'message' => sprintf(t('qp_barcode_exists_active', 'এই বারকোডে আগে থেকেই "%s" আছে — সেটিই কার্টে যুক্ত হলো।'), $taken['name'])]);
        }
        $statusLabel = $taken['status'] === 'pending' ? t('qp_status_pending', 'অনুমোদনের অপেক্ষায়') : ($taken['type'] === 'service' ? t('qp_status_service', 'সার্ভিস') : t('qp_status_inactive', 'নিষ্ক্রিয়'));
        quick_product_fail(sprintf(t('qp_barcode_taken_status', 'এই বারকোডটি ইতোমধ্যে "%s" (%s)-এ ব্যবহৃত হচ্ছে।'), $taken['name'], $statusLabel));
    }
}

// একই নামে সক্রিয় পণ্য থাকলে ডুপ্লিকেট না বানিয়ে আগে জানানো হয় — ব্যবহারকারী চাইলে সেটিই নিতে পারেন
if (!$force) {
    $dupStmt = $pdo->prepare("SELECT id FROM products WHERE status = 'active' AND LOWER(TRIM(name)) = LOWER(?) LIMIT 1");
    $dupStmt->execute([$name]);
    if ($dupId = $dupStmt->fetchColumn()) {
        $dup = quick_product_row($pdo, $dupId);
        quick_product_respond([
            'ok' => false,
            'duplicate' => $dup,
            'can_link_barcode' => $isOwner && $barcode !== '' && $dup['barcode'] === '',
            'message' => sprintf(t('qp_duplicate_name', 'এই নামে একটি পণ্য আগে থেকেই আছে: "%s" (৳%s)।'), $dup['name'], money($dup['sale_price'])),
        ]);
    }
}

$needsApproval = !$isOwner;
$data = [
    'item_code' => generate_item_code($pdo),
    'category_id' => $categoryId ?: null,
    'name' => $name,
    'barcode' => $barcode !== '' ? $barcode : null,
    'unit' => $unit,
    'cost_price' => $costPrice,
    'sale_price' => $salePrice,
    'wholesale_price' => 0,
    'stock_qty' => $stockQty,
    'low_stock_threshold' => 5,
    'status' => $needsApproval ? 'pending' : 'active',
    'created_by' => $userId,
];

$newId = 0;
for ($attempt = 0; $attempt < 3 && !$newId; $attempt++) {
    try {
        $cols = implode(',', array_keys($data));
        $ph = implode(',', array_fill(0, count($data), '?'));
        $pdo->prepare("INSERT INTO products ($cols) VALUES ($ph)")->execute(array_values($data));
        $newId = (int)$pdo->lastInsertId();
    } catch (PDOException $ex) {
        // একই মুহূর্তে অন্য কেউ পণ্য যুক্ত করলে আইটেম কোড মিলে যেতে পারে — নতুন কোড নিয়ে আবার চেষ্টা
        if ($ex->getCode() == 23000 && stripos($ex->getMessage(), 'item_code') !== false) {
            $data['item_code'] = generate_item_code($pdo);
            continue;
        }
        quick_product_fail(t('product_save_failed', 'সংরক্ষণ ব্যর্থ হয়েছে — বারকোড হয়তো আগে থেকেই ব্যবহৃত হচ্ছে।'));
    }
}
if (!$newId) {
    quick_product_fail(t('product_save_failed', 'সংরক্ষণ ব্যর্থ হয়েছে — বারকোড হয়তো আগে থেকেই ব্যবহৃত হচ্ছে।'));
}

if ($needsApproval) {
    log_activity($pdo, t('log_product_pending', 'নতুন পণ্য (অনুমোদনের অপেক্ষায়)') . ': ' . $name . ' — POS');
} else {
    log_activity($pdo, t('log_product_new', 'নতুন পণ্য') . ': ' . $name . ' — POS');
}

quick_product_respond([
    'ok' => true,
    'pending' => $needsApproval,
    'product' => quick_product_row($pdo, $newId),
    'message' => $needsApproval
        ? t('product_pending_approval', 'পণ্যটি যুক্ত হয়েছে, তবে মালিকের অনুমোদনের আগে বিক্রয়ে দেখাবে না।')
        : t('qp_created', 'নতুন পণ্য যুক্ত হয়েছে।'),
]);
