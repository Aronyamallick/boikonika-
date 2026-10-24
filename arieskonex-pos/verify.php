<?php
/**
 * ইনভয়েস QR-কোড যাচাইকরণ পাতা — লগইন ছাড়াই যে কেউ QR স্ক্যান করে
 * ইনভয়েসটি আসল কিনা যাচাই করতে ও সম্পূর্ণ ইনভয়েস দেখতে পারবে।
 * URL অনুমান করে অন্য কারো ইনভয়েস দেখে ফেলা যায় না — id-এর সাথে একটি
 * গোপন-কী-ভিত্তিক টোকেন মিলিয়ে দেখা হয় (দেখুন includes/functions.php: invoice_verify_token)।
 */
require_once __DIR__ . '/includes/bootstrap.php';

$settings = shop_settings($pdo);
$type  = $_GET['type'] ?? '';
$id    = (int)($_GET['id'] ?? 0);
$token = $_GET['token'] ?? '';

$valid = false;
$items = [];
$record = null;
$partyLabel = '';
$partyName = '';
$partyMobile = '';
$previousBalance = 0.0;

if ($type === 'sale' && $id > 0) {
    $stmt = $pdo->prepare("SELECT s.*, c.name AS customer_name, c.mobile AS customer_mobile, c.address AS customer_address, c.id AS cid FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ?");
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if ($record && hash_equals(invoice_verify_token('sale', $id, $record['invoice_no']), (string)$token)) {
        $valid = true;
        $stmt = $pdo->prepare("SELECT * FROM sale_items WHERE sale_id = ?");
        $stmt->execute([$id]);
        $items = $stmt->fetchAll();
        $partyLabel = 'ক্রেতা';
        $partyName = $record['customer_name'] ?? 'ওয়াক-ইন কাস্টমার';
        $partyMobile = $record['customer_mobile'] ?? '';
        if (!empty($record['cid'])) {
            $pbStmt = $pdo->prepare("SELECT c.opening_balance AS ob, COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id = c.id AND id != ?), 0) AS other_due FROM customers c WHERE c.id = ?");
            $pbStmt->execute([$id, $record['cid']]);
            $pbRow = $pbStmt->fetch();
            if ($pbRow) $previousBalance = (float)$pbRow['ob'] + (float)$pbRow['other_due'];
        }
    }
} elseif ($type === 'purchase' && $id > 0) {
    $stmt = $pdo->prepare("SELECT p.*, s.name AS supplier_name, s.mobile AS supplier_mobile, s.id AS sid FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?");
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if ($record && hash_equals(invoice_verify_token('purchase', $id, $record['invoice_no']), (string)$token)) {
        $valid = true;
        $stmt = $pdo->prepare("SELECT pi.*, pr.name, pr.unit FROM purchase_items pi JOIN products pr ON pi.product_id = pr.id WHERE pi.purchase_id = ?");
        $stmt->execute([$id]);
        $items = $stmt->fetchAll();
        $partyLabel = 'সাপ্লায়ার';
        $partyName = $record['supplier_name'] ?? '—';
        $partyMobile = $record['supplier_mobile'] ?? '';
        if (!empty($record['sid'])) {
            $pbStmt = $pdo->prepare("SELECT s.opening_balance AS ob, COALESCE((SELECT SUM(due_amount) FROM purchases WHERE supplier_id = s.id AND id != ?), 0) AS other_due FROM suppliers s WHERE s.id = ?");
            $pbStmt->execute([$id, $record['sid']]);
            $pbRow = $pbStmt->fetch();
            if ($pbRow) $previousBalance = (float)$pbRow['ob'] + (float)$pbRow['other_due'];
        }
    }
}

$grandBalance = $previousBalance + (float)($record['due_amount'] ?? 0);
$invoiceLabel = $type === 'purchase' ? 'ক্রয় ইনভয়েস' : 'বিক্রয় ইনভয়েস';
?>
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= $valid ? e($record['invoice_no']) . ' — যাচাই' : 'ইনভয়েস যাচাই' ?> — <?= e($settings['shop_name'] ?? '') ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css?v=<?= APP_ASSET_VERSION ?>">
<link rel="icon" href="<?= BASE_URL ?>/assets/img/favicon.ico">
<style>
    body { background: var(--bg, #F5F3FA); margin:0; padding:18px; }
    .verify-wrap { max-width: 480px; margin: 0 auto; }
    .verify-status {
        display:flex; align-items:center; gap:10px;
        padding:12px 16px; border-radius:10px; margin-bottom:16px; font-weight:700; font-size:14px;
    }
    .verify-status.ok { background: var(--success-bg, #EAFBF1); color: var(--success, #16A34A); }
    .verify-status.fail { background: var(--danger-bg, #FDECEC); color: var(--danger, #DC2626); }
    .invoice-doc { background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(36,27,58,.1); font-size:13px; }
    .invoice-body { padding: 20px 20px 6px; }
    .invoice-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; gap:10px; }
    .invoice-head .shop-name { font-size:15px; font-weight:700; }
    .invoice-head .shop-name small { display:block; font-weight:400; font-size:11px; color:var(--text-secondary); }
    .invoice-head-right { text-align:right; font-size:11.5px; }
    .invoice-head-right table { margin-top:4px; border-collapse:collapse; }
    .invoice-head-right table td { padding:1.5px 0; }
    .invoice-head-right table td:first-child { color:var(--text-secondary); padding-right:10px; }
    .invoice-head-right table td:last-child { font-weight:600; text-align:right; }
    .invoice-billto { margin-bottom:14px; }
    .invoice-billto .label { font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.5px; margin-bottom:3px; }
    .invoice-billto .name { font-weight:700; font-size:13.5px; }
    .invoice-billto .line { font-size:11.5px; color:var(--text-secondary); }
    .invoice-items { width:100%; border-collapse:collapse; margin-bottom:4px; }
    .invoice-items thead th {
        background: linear-gradient(90deg,var(--brand-purple),var(--brand-magenta) 55%,var(--brand-orange));
        color:#fff; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px;
        padding:8px 10px; text-align:left; font-weight:700;
    }
    .invoice-items thead th.num, .invoice-items tbody td.num { text-align:right; }
    .invoice-items tbody td { padding:7px 10px; border-bottom:1px solid var(--border); font-size:12px; }
    .invoice-items tbody tr:last-child td { border-bottom:none; }
    .invoice-totals { max-width:260px; margin-left:auto; margin-top:8px; }
    .invoice-totals .row { display:flex; justify-content:space-between; padding:4px 10px; font-size:12px; }
    .invoice-totals .row.strong { font-weight:700; border-top:1px solid var(--border); padding-top:7px; margin-top:2px; }
    .invoice-totals .grand {
        display:flex; justify-content:space-between; align-items:center;
        background: linear-gradient(90deg,var(--brand-purple),var(--brand-magenta) 55%,var(--brand-orange));
        color:#fff; font-weight:700; font-size:14px; padding:8px 10px; border-radius:6px; margin-top:6px;
    }
    .invoice-footer { padding:10px 20px; border-top:1px solid var(--border); display:flex; flex-wrap:wrap; gap:6px 16px; font-size:10.5px; color:var(--text-secondary); }
    .invoice-wave { height:8px; background: linear-gradient(90deg,var(--brand-purple),var(--brand-magenta) 50%,var(--brand-orange)); }
    .fail-box { background:#fff; border-radius:12px; padding:32px 22px; text-align:center; box-shadow:0 1px 4px rgba(36,27,58,.1); }
    .fail-box i { font-size:42px; color: var(--danger, #DC2626); }
    .fail-box h2 { margin:12px 0 6px; font-size:17px; color:var(--text-primary); }
    .fail-box p { font-size:13px; color:var(--text-secondary); margin:0; }
    .footer-note { text-align:center; font-size:11px; color:var(--text-secondary); margin-top:16px; }
</style>
</head>
<body>
<div class="verify-wrap">
    <?php if ($valid): ?>
        <div class="verify-status ok"><i class="bi bi-patch-check-fill"></i> এই ইনভয়েসটি আসল ও যাচাইকৃত</div>
        <div class="invoice-doc">
            <div class="invoice-body">
                <div class="invoice-head">
                    <div class="shop-name"><?= e($settings['shop_name'] ?? '') ?>
                        <small><?= e($settings['address'] ?? '') ?></small>
                    </div>
                    <div class="invoice-head-right">
                        <table>
                            <tr><td><?= e($invoiceLabel) ?></td><td><?= e($record['invoice_no']) ?></td></tr>
                            <tr><td>তারিখ</td><td><?= date('d M Y', strtotime($record['sale_date'] ?? $record['purchase_date'])) ?></td></tr>
                        </table>
                    </div>
                </div>

                <div class="invoice-billto">
                    <div class="label"><?= e($partyLabel) ?></div>
                    <div class="name"><?= e($partyName) ?></div>
                    <?php if ($partyMobile): ?><div class="line"><?= e($partyMobile) ?></div><?php endif; ?>
                </div>

                <table class="invoice-items">
                    <thead><tr><th>বিবরণ</th><th class="num">পরিমাণ</th><th class="num">হার</th><th class="num">মূল্য</th></tr></thead>
                    <tbody>
                    <?php foreach ($items as $it): ?>
                        <tr>
                            <td><?= e($it['description'] ?? $it['name']) ?></td>
                            <td class="num"><?= (int)$it['qty'] ?></td>
                            <td class="num">৳<?= money($it['unit_price'] ?? $it['unit_cost']) ?></td>
                            <td class="num">৳<?= money($it['subtotal']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>

                <div class="invoice-totals">
                    <?php if (isset($record['subtotal'])): ?>
                        <div class="row"><span>সাবটোটাল</span><span>৳<?= money($record['subtotal']) ?></span></div>
                    <?php endif; ?>
                    <?php if (!empty($record['discount']) && (float)$record['discount'] > 0): ?>
                        <div class="row"><span>ডিসকাউন্ট<?php if (($record['discount_type'] ?? 'fixed') === 'percent'): ?> (<?= money($record['discount_value'] ?? 0) ?>%)<?php endif; ?></span><span>-৳<?= money($record['discount']) ?></span></div>
                    <?php endif; ?>
                    <div class="grand"><span>সর্বমোট</span><span>৳<?= money($record['total_amount']) ?></span></div>
                    <div class="row strong"><span>পরিশোধিত</span><span>৳<?= money($record['paid_amount']) ?></span></div>
                    <?php if ((float)$record['due_amount'] > 0): ?>
                        <div class="row strong"><span>এই ইনভয়েসের বাকি</span><span>৳<?= money($record['due_amount']) ?></span></div>
                    <?php endif; ?>
                    <?php if (abs($previousBalance) > 0.004): ?>
                        <?php if ($previousBalance > 0): ?>
                            <div class="row" style="color:var(--danger);"><span>পূর্বের বাকি</span><span>৳<?= money($previousBalance) ?></span></div>
                        <?php else: ?>
                            <div class="row" style="color:var(--success);"><span>পূর্বের জমা (অগ্রিম)</span><span>৳<?= money(abs($previousBalance)) ?></span></div>
                        <?php endif; ?>
                        <?php if ($grandBalance > 0.004): ?>
                            <div class="row strong" style="color:var(--danger);"><span>সর্বমোট বাকি</span><span>৳<?= money($grandBalance) ?></span></div>
                        <?php elseif ($grandBalance < -0.004): ?>
                            <div class="row strong" style="color:var(--success);"><span>সর্বমোট জমা</span><span>৳<?= money(abs($grandBalance)) ?></span></div>
                        <?php endif; ?>
                    <?php endif; ?>
                </div>
            </div>
            <div class="invoice-footer">
                <?php if (!empty($settings['mobile'])): ?><span><i class="bi bi-telephone"></i> <?= e($settings['mobile']) ?></span><?php endif; ?>
                <?php if (!empty($settings['whatsapp']) || !empty($settings['mobile'])): ?><span><i class="bi bi-whatsapp" style="color:#25D366;"></i> <?= e($settings['whatsapp'] ?: $settings['mobile']) ?></span><?php endif; ?>
                <?php if (!empty($settings['email'])): ?><span><i class="bi bi-envelope"></i> <?= e($settings['email']) ?></span><?php endif; ?>
            </div>
            <div class="invoice-wave"></div>
        </div>
        <p class="footer-note">এই পাতাটি QR কোড স্ক্যান করে স্বয়ংক্রিয়ভাবে খোলা হয়েছে — ইনভয়েসটি <?= e($settings['shop_name'] ?? '') ?>-এর সিস্টেমে সংরক্ষিত ও যাচাইকৃত।</p>
    <?php else: ?>
        <div class="verify-status fail"><i class="bi bi-x-circle-fill"></i> যাচাই ব্যর্থ হয়েছে</div>
        <div class="fail-box">
            <i class="bi bi-shield-x"></i>
            <h2>ইনভয়েসটি যাচাই করা যায়নি</h2>
            <p>এই লিংক বা QR কোডটি সঠিক নয়, ইনভয়েসটি মুছে ফেলা হয়েছে, অথবা তথ্য পরিবর্তিত হয়েছে। সরাসরি <?= e($settings['shop_name'] ?? 'দোকানে') ?>-র সাথে যোগাযোগ করুন।</p>
        </div>
    <?php endif; ?>
</div>
</body>
</html>
