<?php
/**
 * POS বারকোড লুকআপ — ছোট JSON এন্ডপয়েন্ট।
 * POS পাতায় আগে থেকে লোড করা তালিকায় স্ক্যান করা কোড না পেলে (যেমন অনেক পণ্য থাকলে,
 * বা পাতা খোলার পরে নতুন পণ্য যুক্ত হলে) sales_pos.php এই এন্ডপয়েন্টে জিজ্ঞাসা করে।
 * মিল খোঁজা হয়: পণ্যের barcode → item_code → সার্ভিসের code (সব case-insensitive)।
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
require_permission('sales');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// সেশন লক ছেড়ে দেওয়া হয়, যাতে দ্রুত পরপর স্ক্যানে অনুরোধগুলো একে অপরকে আটকে না রাখে
session_write_close();

$bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
$code = trim(str_replace($bnDigits, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], (string)($_GET['code'] ?? '')));

if ($code === '' || mb_strlen($code) > 100) {
    echo json_encode(['ok' => false]);
    exit;
}

$stmt = $pdo->prepare("SELECT id, item_code, name, unit, sale_price, wholesale_price, cost_price, barcode, stock_qty FROM products WHERE status='active' AND (barcode = ? OR item_code = ?) LIMIT 1");
$stmt->execute([$code, $code]);
$product = $stmt->fetch();
if ($product) {
    echo json_encode([
        'ok' => true,
        'type' => 'product',
        'item' => [
            'id' => (int)$product['id'],
            'item_code' => $product['item_code'],
            'name' => $product['name'],
            'unit' => $product['unit'],
            'sale_price' => (float)$product['sale_price'],
            'wholesale_price' => (float)$product['wholesale_price'],
            'cost_price' => (float)$product['cost_price'], // POS-এর লোকসান-সতর্কতার জন্য প্রয়োজন
            'barcode' => $product['barcode'],
            'stock_qty' => (float)$product['stock_qty'],
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, code, name, unit, price FROM services WHERE status='active' AND code = ? LIMIT 1");
    $stmt->execute([$code]);
    $service = $stmt->fetch();
} catch (Exception $e) {
    $service = null;
}
if ($service) {
    echo json_encode([
        'ok' => true,
        'type' => 'service',
        'item' => [
            'id' => (int)$service['id'],
            'code' => $service['code'],
            'name' => $service['name'],
            'unit' => $service['unit'],
            'price' => (float)$service['price'],
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => false]);
exit;
