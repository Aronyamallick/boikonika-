<?php
/**
 * POS-এ কুপন কোড লাইভ যাচাই — ছোট JSON এন্ডপয়েন্ট। sales_pos.php-এর
 * "প্রয়োগ" বাটন থেকে fetch() দিয়ে কল হয়। চূড়ান্ত/আসল হিসাব সবসময়
 * চেকআউটের সময় সার্ভারেই আবার হয় (validate_coupon() ফাংশন দিয়ে) —
 * এই এন্ডপয়েন্ট শুধু ব্যবহারকারীকে আগেভাগে দেখানোর জন্য (প্রিভিউ)।
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
require_permission('sales');

header('Content-Type: application/json; charset=utf-8');

$code = trim($_GET['code'] ?? '');
$subtotal = max(0, (float)($_GET['subtotal'] ?? 0));

$result = validate_coupon($pdo, $code, $subtotal);

echo json_encode([
    'ok' => $result['ok'],
    'message' => $result['message'],
    'discount_amount' => round((float)$result['discount_amount'], 2),
    'discount_type' => $result['coupon']['discount_type'] ?? null,
], JSON_UNESCAPED_UNICODE);
exit;
