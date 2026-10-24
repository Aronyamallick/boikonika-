<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
require_permission('sales');

$settings = shop_settings($pdo);
$canOverrideBelowCost = can_override_below_cost(current_user());

// ---------- POST: চেকআউট ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'checkout') {
    csrf_verify();

    // চেকআউট টোকেন (এককালীন): প্রতিটি কার্টের একটি আলাদা টোকেন থাকে। একই কার্ট দুবার জমা
    // পড়লে (ডাবল-ক্লিক, নেটওয়ার্ক রিট্রাই, ব্যাক করে আবার সাবমিট) দ্বিতীয় বিক্রয় তৈরি হয় না —
    // আগের ইনভয়েসটিই দেখানো হয়। POS পাতাও এই তালিকা দেখে সম্পন্ন কার্ট আর ফিরিয়ে আনে না।
    $posNonce = substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string)($_POST['pos_nonce'] ?? '')), 0, 64);
    if ($posNonce !== '' && !empty($_SESSION['pos_done'][$posNonce])) {
        flash_set(t('sale_already_completed', 'এই বিক্রয়টি আগেই সম্পন্ন হয়েছে — নতুন করে আর বিক্রয় তৈরি করা হয়নি।'), 'warning');
        redirect('sales_list.php?view=show&id=' . (int)$_SESSION['pos_done'][$posNonce]);
    }

    $customerName = trim($_POST['customer_name'] ?? '');
    $customerMobile = trim($_POST['customer_mobile'] ?? '');
    $customerIdPosted = (int)($_POST['customer_id'] ?? 0);
    // ডিসকাউন্ট শতাংশ (%) বা নির্দিষ্ট (৳) — উভয় ধরনই সমর্থিত। চূড়ান্ত ৳-হিসাব
    // (নিচে $discount) সার্ভারেই আবার হিসাব করা হয়, ক্লায়েন্ট থেকে পাঠানো
    // কোনো প্রস্তাবিত মোট টাকার অংক সরাসরি বিশ্বাস করা হয় না।
    $discountType = (($_POST['discount_type'] ?? 'fixed') === 'percent') ? 'percent' : 'fixed';
    $discountValue = max(0, (float)($_POST['discount_value'] ?? 0));
    $belowCostConfirmed = !empty($_POST['below_cost_confirm']);
    $paid = max(0, (float)($_POST['paid_amount'] ?? 0)); // ঋণাত্মক মান দিয়ে ভুলবশত বাকি/হিসাব বিগড়ে যাওয়া ঠেকাতে
    $paymentMethod = $_POST['payment_method'] ?? 'cash';
    $paymentRef = trim($_POST['payment_ref'] ?? '');
    $types = $_POST['item_type'] ?? [];
    $ids = $_POST['item_id'] ?? [];
    $qtys = $_POST['item_qty'] ?? [];
    $prices = $_POST['item_price'] ?? [];

    if (empty($ids)) {
        flash_set(t('err_cart_empty'), 'danger');
        redirect('sales_pos.php');
    }

    $customerId = null;
    if ($customerName !== '') {
        if ($customerIdPosted > 0) {
            // কাস্টমার লেজার থেকে নির্দিষ্টভাবে নির্বাচিত — সরাসরি সেই আইডি ব্যবহার (একই নামে একাধিক কাস্টমার থাকলেও ভুল হবে না)
            $chk = $pdo->prepare("SELECT id FROM customers WHERE id = ? LIMIT 1");
            $chk->execute([$customerIdPosted]);
            if ($chk->fetch()) {
                $customerId = $customerIdPosted;
            }
        }
        if (!$customerId) {
            $stmt = $pdo->prepare("SELECT id FROM customers WHERE name = ? LIMIT 1");
            $stmt->execute([$customerName]);
            $existing = $stmt->fetch();
            if ($existing) {
                $customerId = $existing['id'];
            }
        }
        if ($customerId) {
            if ($customerMobile !== '') {
                $stmt = $pdo->prepare("UPDATE customers SET mobile = COALESCE(NULLIF(?, ''), mobile) WHERE id = ?");
                $stmt->execute([$customerMobile, $customerId]);
            }
        } else {
            $stmt = $pdo->prepare("INSERT INTO customers (name, mobile) VALUES (?, ?)");
            $stmt->execute([$customerName, $customerMobile]);
            $customerId = $pdo->lastInsertId();
        }
    }

    $items = [];
    $subtotal = 0;
    foreach ($ids as $i => $id) {
        $id = (int)$id;
        $qty = (int)($qtys[$i] ?? 0);
        $price = max(0, (float)($prices[$i] ?? 0));
        if ($qty <= 0 || $id <= 0) continue;
        $type = (isset($types[$i]) && $types[$i] === 'service') ? 'service' : 'product';
        $sub = $qty * $price;
        $cost = 0;
        $desc = '';
        if ($type === 'product') {
            $c = $pdo->prepare("SELECT cost_price, name FROM products WHERE id = ?");
            $c->execute([$id]);
            $prow = $c->fetch();
            if (!$prow) continue; // মুছে ফেলা/অস্তিত্বহীন পণ্য — বিক্রয়ে যুক্ত হবে না
            $cost = $prow['cost_price'] ?? 0;
            $desc = $prow['name'] ?? '';
        } else {
            $c = $pdo->prepare("SELECT name FROM services WHERE id = ?");
            $c->execute([$id]);
            $desc = $c->fetchColumn();
            if ($desc === false) continue;
        }
        $subtotal += $sub;
        $items[] = ['type' => $type, 'id' => (int)$id, 'qty' => $qty, 'price' => $price, 'cost' => $cost, 'subtotal' => $sub, 'desc' => $desc];
    }
    if (empty($items)) {
        flash_set(t('err_no_valid_items'), 'danger');
        redirect('sales_pos.php');
    }

    // ---------- কুপন কোড (থাকলে) — ম্যানুয়াল ডিসকাউন্টের বদলে কুপনের ছাড়ই
    // ব্যবহৃত হয় (দুটো একসাথে যোগ হয় না)। যাচাই সবসময় সার্ভারেই আবার হয়,
    // ক্লায়েন্টের প্রিভিউ কখনো সরাসরি বিশ্বাস করা হয় না।
    $couponCode = trim($_POST['coupon_code'] ?? '');
    $appliedCoupon = null;
    if ($couponCode !== '') {
        $couponResult = validate_coupon($pdo, $couponCode, $subtotal);
        if (!$couponResult['ok']) {
            flash_set('কুপন প্রয়োগ করা যায়নি: ' . $couponResult['message'], 'danger');
            redirect('sales_pos.php');
        }
        $appliedCoupon = $couponResult['coupon'];
        $discountType = 'fixed';
        $discountValue = $couponResult['discount_amount'];
    }

    // শতাংশ হলে সাবটোটালের ভিত্তিতে ৳-এ রূপান্তর; নির্দিষ্ট (৳) হলে সাবটোটালের
    // বেশি ডিসকাউন্ট দেওয়া যাবে না
    if ($discountType === 'percent') {
        $discountValue = min(100, $discountValue);
        $discount = round($subtotal * $discountValue / 100, 2);
    } else {
        $discount = min($subtotal, $discountValue);
    }

    $total = max(0, $subtotal - $discount);
    $due = max(0, $total - $paid);

    // ---------- সর্বনিম্ন-লাভ সুরক্ষা ----------
    // মোট বিক্রয়মূল্য (ডিসকাউন্টের পরে) কখনোই মোট ক্রয়মূল্যের চেয়ে কম হতে
    // দেওয়া হয় না — যদি না ব্যবহারকারীর কাছে বিশেষ অনুমতি থাকে এবং তিনি
    // সজ্ঞানে লোকসানি বিক্রয়টি অনুমোদন করেন।
    $totalCost = 0.0;
    foreach ($items as $it) {
        $totalCost += (float)$it['cost'] * (int)$it['qty'];
    }
    $belowCost = $total < $totalCost;
    $belowCostApproved = 0;
    if ($belowCost) {
        if (!$canOverrideBelowCost) {
            flash_set(t('err_below_cost_blocked') . ' (বিক্রয়মূল্য ৳' . money($total) . ' < ক্রয়মূল্য ৳' . money($totalCost) . ')', 'danger');
            redirect('sales_pos.php');
        }
        if (!$belowCostConfirmed) {
            flash_set(t('err_below_cost_confirm_needed') . ' (লোকসান ৳' . money($totalCost - $total) . ')', 'danger');
            redirect('sales_pos.php');
        }
        $belowCostApproved = 1;
    }

    try {
        $invoiceNo = generate_invoice_no($pdo, 'sales', ($settings['invoice_prefix'] ?? 'INV'));

        $pdo->beginTransaction();

        // অতিরিক্ত পরিশোধ দিয়ে পুরোনো বাকি সমন্বয় করার আগে কাস্টমারের তখনকার
        // পূর্বের বাকি "স্ন্যাপশট" হিসেবে নেওয়া হয়, যাতে ইনভয়েসে সঠিক পূর্বের
        // বাকি (সমন্বয়ের আগের) দেখানো যায় — নিচের সমন্বয়ের ফলে এই মান বদলাবে না
        $previousBalanceSnapshot = 0.0;
        if ($customerId) {
            $pbSnapStmt = $pdo->prepare("SELECT c.opening_balance AS ob, COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id = c.id), 0) AS other_due FROM customers c WHERE c.id = ?");
            $pbSnapStmt->execute([$customerId]);
            $pbSnapRow = $pbSnapStmt->fetch();
            if ($pbSnapRow) {
                $previousBalanceSnapshot = (float)$pbSnapRow['ob'] + (float)$pbSnapRow['other_due'];
            }
        }

        $stmt = $pdo->prepare("INSERT INTO sales (customer_id, invoice_no, subtotal, discount, discount_type, discount_value, coupon_id, coupon_code, below_cost_approved, total_amount, paid_amount, due_amount, previous_balance_snapshot, payment_method, payment_ref, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$customerId, $invoiceNo, $subtotal, $discount, $discountType, $discountValue, $appliedCoupon['id'] ?? null, $appliedCoupon['code'] ?? null, $belowCostApproved, $total, $paid, $due, $previousBalanceSnapshot, $paymentMethod, $paymentRef, current_user()['id'] ?? null]);
        $saleId = $pdo->lastInsertId();

        if ($appliedCoupon) {
            $pdo->prepare("INSERT INTO coupon_usages (coupon_id, sale_id, customer_id, discount_amount) VALUES (?,?,?,?)")
                ->execute([$appliedCoupon['id'], $saleId, $customerId, $discount]);
            $pdo->prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?")->execute([$appliedCoupon['id']]);
        }

        $stmtItem = $pdo->prepare("INSERT INTO sale_items (sale_id, item_type, product_id, service_id, description, qty, unit_price, unit_cost, subtotal) VALUES (?,?,?,?,?,?,?,?,?)");
        $stmtStock = $pdo->prepare("UPDATE products SET stock_qty = GREATEST(0, stock_qty - ?) WHERE id = ?");
        $stmtMaterials = $pdo->prepare("SELECT product_id, qty_per_unit FROM service_materials WHERE service_id = ?");
        $stmtMaterialUse = $pdo->prepare("INSERT INTO sale_item_materials (sale_item_id, product_id, qty) VALUES (?,?,?)");

        foreach ($items as $it) {
            if ($it['type'] === 'product') {
                $stmtItem->execute([$saleId, 'product', $it['id'], null, $it['desc'], $it['qty'], $it['price'], $it['cost'], $it['subtotal']]);
                $stmtStock->execute([$it['qty'], $it['id']]);
            } else {
                $stmtItem->execute([$saleId, 'service', null, $it['id'], $it['desc'], $it['qty'], $it['price'], 0, $it['subtotal']]);
                $saleItemId = $pdo->lastInsertId();
                // সার্ভিসের সাথে যুক্ত কাঁচামাল (যেমন ফটোকপির কাগজ/কালি) থাকলে
                // সেই পরিমাণ স্টক থেকে স্বয়ংক্রিয়ভাবে বাদ যাবে
                $stmtMaterials->execute([$it['id']]);
                foreach ($stmtMaterials->fetchAll() as $mat) {
                    $useQty = (float)$mat['qty_per_unit'] * $it['qty'];
                    if ($useQty <= 0) continue;
                    $stmtStock->execute([$useQty, $mat['product_id']]);
                    $stmtMaterialUse->execute([$saleItemId, $mat['product_id'], $useQty]);
                }
            }
        }

        // গ্রাহক টোটালের চেয়ে বেশি টাকা দিলে অতিরিক্ত অংশ হারিয়ে না গিয়ে
        // কাস্টমার লেজারে জমা হয় — আগে অন্য কোনো বাকি ইনভয়েস থাকলে তা সমন্বয়,
        // তারপরও কিছু থেকে গেলে সেটি অগ্রিম/জমা (কাস্টমার পাবে) হিসেবে থাকে।
        $overpaid = max(0, $paid - $total);
        if ($overpaid > 0 && $customerId) {
            $remaining = $overpaid;

            $obStmt = $pdo->prepare("SELECT opening_balance FROM customers WHERE id = ?");
            $obStmt->execute([$customerId]);
            $openingBalance = (float)$obStmt->fetchColumn();
            if ($openingBalance > 0) {
                $applyToOpening = min($remaining, $openingBalance);
                $pdo->prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?")->execute([$applyToOpening, $customerId]);
                $remaining -= $applyToOpening;
            }

            if ($remaining > 0) {
                $dueSales = $pdo->prepare("SELECT id, due_amount FROM sales WHERE customer_id = ? AND id != ? AND due_amount > 0 ORDER BY id ASC");
                $dueSales->execute([$customerId, $saleId]);
                foreach ($dueSales->fetchAll() as $ds) {
                    if ($remaining <= 0) break;
                    $pay = min($remaining, $ds['due_amount']);
                    $pdo->prepare("UPDATE sales SET due_amount = due_amount - ?, paid_amount = paid_amount + ? WHERE id = ?")->execute([$pay, $pay, $ds['id']]);
                    $remaining -= $pay;
                }
            }

            if ($remaining > 0) {
                $pdo->prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?")->execute([$remaining, $customerId]);
            }

            $pdo->prepare("INSERT INTO customer_payments (customer_id, amount, type, payment_date, note, created_by) VALUES (?,?,?,?,?,?)")
                ->execute([$customerId, $overpaid, 'payment', date('Y-m-d'), 'অতিরিক্ত পরিশোধ — ' . $invoiceNo, current_user()['id'] ?? null]);
        }

        $pdo->commit();
        if ($posNonce !== '') {
            $_SESSION['pos_done'][$posNonce] = (int)$saleId;
            if (count($_SESSION['pos_done']) > 30) {
                $_SESSION['pos_done'] = array_slice($_SESSION['pos_done'], -30, null, true);
            }
        }
        log_activity($pdo, 'নতুন বিক্রয় ' . $invoiceNo . ' — ৳' . money($total));
        if ($belowCostApproved) {
            log_activity($pdo, 'সতর্কতা: ' . $invoiceNo . ' ক্রয়মূল্যের নিচে (লোকসানে) বিক্রি হয়েছে — ৳' . money($totalCost - $total) . ' লোকসান, অনুমোদনকারী: ' . (current_user()['name'] ?? ''));
        }
        redirect('sales_list.php?view=show&id=' . $saleId . '&fresh=1');
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        flash_set(t('err_sale_failed') . ': ' . $ex->getMessage(), 'danger');
        redirect('sales_pos.php');
    }
}

// ---------- POS ডাটা ----------
// গুরুত্বপূর্ণ: PDO ডেসিমাল কলামগুলো স্ট্রিং ("120.00") হিসেবে ফেরত দেয়। আগে এগুলো সরাসরি
// জাভাস্ক্রিপ্টে পাঠানো হতো, ফলে বারকোড স্ক্যানে যুক্ত হওয়া আইটেমের দাম স্ট্রিং থাকত এবং
// কার্ট রেন্ডারে `price.toFixed is not a function` এরর হয়ে পুরো POS আটকে (ফ্রিজ) যেত —
// রিলোড না করা পর্যন্ত আর কিছু কাজ করত না। এখন সার্ভারেই সব সংখ্যা সঠিক টাইপে পাঠানো হয়।
$products = array_map(function ($p) {
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
    ];
}, $pdo->query("SELECT id, item_code, name, unit, sale_price, wholesale_price, cost_price, barcode, stock_qty FROM products WHERE status='active' ORDER BY name LIMIT 3000")->fetchAll());

try {
    $serviceRows = $pdo->query("SELECT id, code, name, unit, price FROM services WHERE status='active' ORDER BY name")->fetchAll();
} catch (Exception $e) {
    // পুরোনো ইনস্টলে code কলাম তখনো না থাকলে
    $serviceRows = $pdo->query("SELECT id, '' AS code, name, unit, price FROM services WHERE status='active' ORDER BY name")->fetchAll();
}
$services = array_map(function ($s) {
    return [
        'id' => (int)$s['id'],
        'code' => (string)($s['code'] ?? ''),
        'name' => (string)$s['name'],
        'unit' => (string)($s['unit'] ?? ''),
        'price' => (float)$s['price'],
    ];
}, $serviceRows);

$customers = array_map(function ($c) {
    return ['id' => (int)$c['id'], 'name' => (string)$c['name'], 'mobile' => (string)($c['mobile'] ?? ''), 'due' => (float)$c['due']];
}, $pdo->query("SELECT id, name, mobile, (opening_balance + COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id=customers.id), 0)) AS due FROM customers ORDER BY name LIMIT 2000")->fetchAll());

$paymentMethods = $pdo->query("SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order")->fetchAll();
if (empty($paymentMethods)) {
    $paymentMethods = [['method_key' => 'cash', 'method_name' => 'ক্যাশ']];
}

$pageTitle = t('pos_title');
$activeNav = 'sales';
$bodyClass = 'page-pos';
require_once __DIR__ . '/../includes/header.php';
?>

<div class="pos-grid">
    <!-- বাম: স্ক্যান + পণ্য/সার্ভিস খোঁজ -->
    <div class="pos-left">
        <div class="card pos-scan-card">
            <div class="pos-scan-bar" id="scanBar">
                <i class="bi bi-upc-scan pos-scan-icon"></i>
                <input type="text" id="scanInput" class="pos-scan-input" placeholder="<?= e(t('scan_placeholder')) ?>" autocomplete="off" lang="en" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
                <span class="scanner-status" id="scannerStatus" title="<?= e(t('scanner_ready_hint', 'বারকোড স্ক্যানার প্রস্তুত — যেকোনো সময় স্ক্যান করুন, আইটেম সরাসরি কার্টে যুক্ত হবে')) ?>"><span class="dot"></span><span class="txt"><?= e(t('scanner_ready', 'স্ক্যানার প্রস্তুত')) ?></span></span>
            </div>
            <div class="pos-filter-row">
                <div class="seg-tabs" id="priceTabs">
                    <a href="#" class="active" data-price="retail"><?= e(t('retail_price')) ?></a>
                    <a href="#" data-price="wholesale"><?= e(t('wholesale_price')) ?></a>
                </div>
                <div class="seg-tabs" id="catTabs">
                    <a href="#" class="active" data-filter="all"><?= e(t('filter_all')) ?></a>
                    <a href="#" data-filter="product"><?= e(t('filter_product')) ?></a>
                    <a href="#" data-filter="service"><?= e(t('filter_service')) ?></a>
                </div>
            </div>
            <div id="itemGrid" class="pos-item-grid"></div>
            <div class="pos-shortcuts">
                <span><kbd>F2</kbd> <?= e(t('kb_focus_scan', 'স্ক্যান/খোঁজ')) ?></span>
                <span><kbd>F9</kbd> <?= e(t('kb_complete', 'বিক্রয় সম্পন্ন')) ?></span>
                <span><kbd>Esc</kbd> <?= e(t('kb_clear', 'খোঁজ মুছুন')) ?></span>
            </div>
        </div>
    </div>

    <!-- ডান: কার্ট -->
    <div id="cartPanel" class="pos-right">
        <form method="POST" id="checkoutForm">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="checkout">
            <input type="hidden" name="pos_nonce" id="posNonce" value="">
            <div class="card pos-cart-card">
                <div class="pos-cart-head">
                    <h3><i class="bi bi-cart3"></i> <?= e(t('cart')) ?> <span class="cart-count-pill" id="cartCountPill">0</span></h3>
                    <button type="button" class="btn btn-sm btn-light" id="clearCartBtn" style="display:none;"><i class="bi bi-trash3"></i> <?= e(t('clear_cart', 'খালি করুন')) ?></button>
                </div>
                <div id="cartRows" class="pos-cart-rows"></div>

                <div class="pos-cart-section">
                    <div class="form-group" style="position:relative;margin-bottom:8px;">
                        <label><?= e(t('customer_optional')) ?></label>
                        <input type="text" name="customer_name" id="customerName" class="form-control" autocomplete="off" placeholder="<?= e(t('customer_search_ph', 'নাম বা মোবাইল দিয়ে খুঁজুন...')) ?>">
                        <input type="hidden" name="customer_id" id="customerId">
                        <div id="customerResults" class="search-results-box"></div>
                        <div id="customerDueHint" class="form-hint" style="display:none;"></div>
                    </div>
                    <div class="form-group" style="margin-bottom:6px;">
                        <input type="text" name="customer_mobile" id="customerMobile" class="form-control" placeholder="<?= e(t('mobile_optional')) ?>">
                    </div>
                </div>

                <div class="pos-cart-section">
                    <div class="pos-total-line"><span><?= e(t('subtotal')) ?></span><span class="num" id="subtotalDisplay">৳0.00</span></div>
                    <div class="pos-inline-field">
                        <label><?= e(t('discount')) ?></label>
                        <input type="number" step="0.01" min="0" name="discount_value" id="discountInput" class="form-control" value="0">
                        <select name="discount_type" id="discountTypeInput" class="form-control" style="max-width:80px;flex:none;">
                            <option value="fixed"><?= e(t('discount_fixed', '৳')) ?></option>
                            <option value="percent"><?= e(t('discount_percent', '%')) ?></option>
                        </select>
                    </div>
                    <div class="pos-inline-field">
                        <input type="text" id="couponCodeInput" class="form-control" placeholder="<?= e(t('coupon_ph', 'কুপন কোড (ঐচ্ছিক)')) ?>" style="text-transform:uppercase;">
                        <button type="button" class="btn btn-sm btn-outline" id="applyCouponBtn" style="flex:none;"><?= e(t('apply', 'প্রয়োগ')) ?></button>
                    </div>
                    <input type="hidden" name="coupon_code" id="couponCodeHidden" value="">
                    <div id="couponMsg" style="font-size:12px;margin:-2px 0 6px;"></div>
                    <div class="pos-inline-field">
                        <label style="color:var(--danger);"><?= e(t('previous_due')) ?></label>
                        <input type="number" step="0.01" min="0" id="previousDueInput" class="form-control" value="0">
                    </div>
                    <div id="belowCostWarning" class="alert alert-danger" style="display:none;font-size:12.5px;padding:10px 12px;"></div>
                    <?php if ($canOverrideBelowCost): ?>
                    <div class="form-check" id="belowCostConfirmWrap" style="display:none;margin:6px 0;">
                        <input class="form-check-input" type="checkbox" name="below_cost_confirm" id="belowCostConfirm" value="1">
                        <label class="form-check-label" for="belowCostConfirm" style="color:var(--danger);font-size:12.5px;"><?= e(t('below_cost_authorize_label', 'আমি বুঝেই এই লোকসানি বিক্রয়টি অনুমোদন করছি')) ?></label>
                    </div>
                    <?php endif; ?>
                    <div class="pos-grand-total"><span><?= e(t('grand_total')) ?></span><span class="num" id="totalDisplay">৳0.00</span></div>
                </div>

                <div class="pos-cart-section">
                    <div class="row g-2">
                        <div class="col-6 form-group" style="margin-bottom:8px;">
                            <label><?= e(t('payment_method')) ?></label>
                            <select name="payment_method" id="paymentMethod" class="form-control">
                                <?php foreach ($paymentMethods as $pm): ?>
                                    <option value="<?= e($pm['method_key']) ?>"><?= e($pm['method_name']) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-6 form-group" style="margin-bottom:8px;">
                            <label><?= e(t('transaction_ref')) ?></label>
                            <input type="text" name="payment_ref" class="form-control" placeholder="<?= e(t('optional')) ?>">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:6px;">
                        <label><?= e(t('paid_amount')) ?></label>
                        <input type="number" step="0.01" min="0" name="paid_amount" id="paidInput" class="form-control pos-paid-input" value="0">
                    </div>
                    <div class="pos-total-line"><span><?= e(t('due')) ?></span><span class="num" id="dueDisplay" style="color:var(--danger);font-weight:700;">৳0.00</span></div>
                    <div class="pos-total-line" id="changeLine" style="display:none;"><span><?= e(t('change_return', 'ফেরত দিন')) ?></span><span class="num" id="changeDisplay" style="color:var(--success);font-weight:700;">৳0.00</span></div>

                    <button type="submit" class="btn btn-primary btn-block btn-lg pos-checkout-btn" id="checkoutBtn" disabled><i class="bi bi-check2-circle"></i> <span><?= e(t('complete_sale')) ?></span> <kbd>F9</kbd></button>
                </div>
            </div>
        </form>
    </div>
</div>

<div id="mobileCartBar">
    <span><i class="bi bi-cart-check-fill"></i> <span class="mcb-count">0</span> <?= e(t('cart')) ?></span>
    <span class="mcb-total num">৳0.00</span>
    <span><?= e(t('view_cart', 'কার্ট দেখুন')) ?> <i class="bi bi-chevron-up"></i></span>
</div>

<script>
(function () {
'use strict';

const I18N = {
    stock: <?= json_encode(t('stock_label'), JSON_UNESCAPED_UNICODE) ?>,
    wholesale: <?= json_encode(t('wholesale_badge'), JSON_UNESCAPED_UNICODE) ?>,
    service: <?= json_encode(t('filter_service'), JSON_UNESCAPED_UNICODE) ?>,
    cartEmpty: <?= json_encode(t('cart_empty'), JSON_UNESCAPED_UNICODE) ?>,
    noItems: <?= json_encode(t('pos_no_items', 'কোনো আইটেম পাওয়া যায়নি'), JSON_UNESCAPED_UNICODE) ?>,
    noCustomerFound: <?= json_encode(t('no_customer_found_hint', 'তালিকায় নেই — এই নামেই নতুন কাস্টমার যুক্ত হবে।'), JSON_UNESCAPED_UNICODE) ?>,
    dueLabel: <?= json_encode(t('due_label', 'বাকি আছে'), JSON_UNESCAPED_UNICODE) ?>,
    creditLabel: <?= json_encode(t('credit_label', 'জমা আছে'), JSON_UNESCAPED_UNICODE) ?>,
    belowCostBlocked: <?= json_encode(t('below_cost_blocked_hint', 'এই ডিসকাউন্টে বিক্রয়মূল্য ক্রয়মূল্যের চেয়ে কম হয়ে যাচ্ছে (লোকসান ৳%loss%) — আপনার এই বিক্রয় সম্পন্ন করার অনুমতি নেই। ডিসকাউন্ট কমান।'), JSON_UNESCAPED_UNICODE) ?>,
    belowCostNeedsConfirm: <?= json_encode(t('below_cost_needs_confirm_hint', 'এই ডিসকাউন্টে বিক্রয়মূল্য ক্রয়মূল্যের চেয়ে কম হয়ে যাচ্ছে (লোকসান ৳%loss%) — চালিয়ে যেতে নিচের বক্সটি টিক দিন।'), JSON_UNESCAPED_UNICODE) ?>,
    added: <?= json_encode(t('scan_added', 'কার্টে যুক্ত হয়েছে'), JSON_UNESCAPED_UNICODE) ?>,
    notFound: <?= json_encode(t('scan_not_found', 'এই বারকোডের কোনো পণ্য/সার্ভিস পাওয়া যায়নি'), JSON_UNESCAPED_UNICODE) ?>,
    lowStock: <?= json_encode(t('scan_low_stock', 'সতর্কতা: স্টকে আছে মাত্র'), JSON_UNESCAPED_UNICODE) ?>,
    searching: <?= json_encode(t('scan_searching', 'খোঁজা হচ্ছে...'), JSON_UNESCAPED_UNICODE) ?>,
    clearConfirm: <?= json_encode(t('clear_cart_confirm', 'কার্টের সব আইটেম মুছে ফেলবেন?'), JSON_UNESCAPED_UNICODE) ?>,
    processing: <?= json_encode(t('processing', 'প্রসেস হচ্ছে...'), JSON_UNESCAPED_UNICODE) ?>,
    couponChecking: <?= json_encode(t('coupon_checking', 'যাচাই করা হচ্ছে...'), JSON_UNESCAPED_UNICODE) ?>,
    couponRemove: <?= json_encode(t('remove', 'সরান'), JSON_UNESCAPED_UNICODE) ?>,
    couponFailed: <?= json_encode(t('coupon_check_failed', 'কুপন যাচাই করা যায়নি — আবার চেষ্টা করুন।'), JSON_UNESCAPED_UNICODE) ?>
};
const LOOKUP_URL = 'pos_lookup.php';
const CART_KEY = 'arieskonex_pos_cart_v1';
const CAN_OVERRIDE_BELOW_COST = <?= $canOverrideBelowCost ? 'true' : 'false' ?>;
const PRODUCTS = <?= json_encode($products, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?>;
const SERVICES = <?= json_encode($services, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?>;
const CUSTOMERS = <?= json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?>;
// এই সেশনে সম্পন্ন হওয়া কার্টের টোকেন — এগুলোর কার্ট আর কখনো ফিরিয়ে আনা হয় না (ডাবল বিক্রয় প্রতিরোধ)
const DONE_NONCES = <?= json_encode(array_values(array_map('strval', array_keys($_SESSION['pos_done'] ?? [])))) ?>;
// টাচ-স্ক্রিন (মোবাইল/ট্যাব): বারবার স্ক্যান-বক্সে ফোকাস দিলে কীবোর্ড খুলে স্ক্রিন ঢেকে যায়।
// স্ক্যানার ইনপুট পাতা-জুড়ে ধরা হয় বলে সেখানে অটো-ফোকাসের প্রয়োজনও নেই।
const TOUCH_ONLY = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches);

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const money = v => '৳' + num(v).toFixed(2);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normCode = s => toEnglishDigits(String(s == null ? '' : s)).trim().toLowerCase();
const toast = (msg, type) => appToast(msg, type);
function newNonce() {
    try {
        const a = new Uint8Array(12);
        crypto.getRandomValues(a);
        return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
}

let cart = [];
let cartNonce = '';
let priceMode = 'retail';
let appliedCouponDiscount = null;
let submitting = false;

/* ---------------------------------------------------------------------
   কোড ইনডেক্স — বারকোড / আইটেম কোড / সার্ভিস কোড থেকে O(1) এ আইটেম খোঁজা
   --------------------------------------------------------------------- */
const CODE_INDEX = new Map();
function indexProduct(p) {
    if (p.barcode) CODE_INDEX.set(normCode(p.barcode), { type: 'product', item: p });
    if (p.item_code && !CODE_INDEX.has(normCode(p.item_code))) CODE_INDEX.set(normCode(p.item_code), { type: 'product', item: p });
}
function indexService(s) {
    if (s.code && !CODE_INDEX.has(normCode(s.code))) CODE_INDEX.set(normCode(s.code), { type: 'service', item: s });
}
PRODUCTS.forEach(indexProduct);
SERVICES.forEach(indexService);

function productPrice(p) {
    return priceMode === 'wholesale' && num(p.wholesale_price) > 0 ? num(p.wholesale_price) : num(p.sale_price);
}

/* ---------------------------------------------------------------------
   শব্দ/টোস্ট ফিডব্যাক — স্ক্যান সফল হলো কিনা ক্যাশিয়ার স্ক্রিনে না তাকিয়েই বুঝবেন
   --------------------------------------------------------------------- */
let audioCtx = null;
function beep(ok) {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = ok ? 1250 : 260;
        g.gain.setValueAtTime(0.08, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (ok ? 0.09 : 0.28));
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + (ok ? 0.1 : 0.3));
    } catch (e) { /* শব্দ না হলেও সমস্যা নেই */ }
}
function flashScanBar(ok) {
    const bar = $('scanBar');
    bar.classList.remove('ok', 'err');
    void bar.offsetWidth; // অ্যানিমেশন রিস্টার্ট
    bar.classList.add(ok ? 'ok' : 'err');
}

/* ---------------------------------------------------------------------
   কার্ট
   --------------------------------------------------------------------- */
function addToCart(type, item, opts) {
    opts = opts || {};
    const isService = type === 'service';
    const priceType = isService ? 'retail' : priceMode;
    const price = isService ? num(item.price) : productPrice(item);
    const id = Number(item.id);
    let line = cart.find(c => c.type === type && c.id === id && c.priceType === priceType);
    if (line) {
        line.qty += 1;
    } else {
        line = { type, id, name: String(item.name), unit: String(item.unit || ''), price, cost: isService ? 0 : num(item.cost_price), qty: 1, priceType, stock: isService ? null : num(item.stock_qty) };
        cart.push(line);
    }
    renderCart(line);
    if (opts.fromScan) {
        beep(true);
        flashScanBar(true);
        if (line.stock !== null && line.qty > line.stock) {
            toast(I18N.lowStock + ' ' + line.stock + ' ' + line.unit + ' — ' + line.name, 'warning');
        } else {
            toast(line.name + ' — ' + I18N.added + ' (×' + line.qty + ')', 'success');
        }
    }
}

function cartTotals() {
    const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const discountType = $('discountTypeInput').value;
    let discountValue = Math.max(0, num($('discountInput').value));
    let discount;
    if (appliedCouponDiscount !== null) {
        discount = Math.min(subtotal, appliedCouponDiscount);
    } else if (discountType === 'percent') {
        discount = subtotal * Math.min(100, discountValue) / 100;
    } else {
        discount = Math.min(subtotal, discountValue);
    }
    const saleTotal = Math.max(0, subtotal - discount);
    const previousDue = Math.max(0, num($('previousDueInput').value));
    return { subtotal, discount, saleTotal, previousDue, total: saleTotal + previousDue };
}

function renderCart(highlightLine) {
    const wrap = $('cartRows');
    if (cart.length === 0) {
        wrap.innerHTML = '<div class="empty-state pos-empty-cart"><i class="bi bi-upc-scan"></i>' + esc(I18N.cartEmpty) + '</div>';
    } else {
        wrap.innerHTML = cart.map((item, idx) => `
            <div class="pos-cart-row${item === highlightLine ? ' flash' : ''}" data-idx="${idx}">
                <div class="pcr-info">
                    <div class="pcr-name">${esc(item.name)}
                        ${item.priceType === 'wholesale' ? '<span class="badge badge-purple" style="font-size:10px;">' + esc(I18N.wholesale) + '</span>' : ''}
                        ${item.type === 'service' ? '<span class="badge badge-info" style="font-size:10px;">' + esc(I18N.service) + '</span>' : ''}
                    </div>
                    <div class="pcr-sub num">${money(item.price)} × ${item.qty} = <strong>${money(item.price * item.qty)}</strong></div>
                </div>
                <div class="qty-stepper">
                    <button type="button" class="qs-btn" data-act="dec" aria-label="-"><i class="bi bi-dash"></i></button>
                    <input type="number" min="1" class="qty-input num" value="${item.qty}" data-act="qty">
                    <button type="button" class="qs-btn" data-act="inc" aria-label="+"><i class="bi bi-plus"></i></button>
                </div>
                <button type="button" class="pcr-remove" data-act="remove" aria-label="remove"><i class="bi bi-x-lg"></i></button>
            </div>`).join('');
        if (highlightLine) {
            // শুধু কার্ট-তালিকার ভেতরে স্ক্রল (scrollIntoView পুরো পাতা সরিয়ে দিত — মোবাইলে বিরক্তিকর)
            const el = wrap.querySelector('.pos-cart-row.flash');
            if (el) {
                if (el.offsetTop < wrap.scrollTop) wrap.scrollTop = el.offsetTop;
                else if (el.offsetTop + el.offsetHeight > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = el.offsetTop + el.offsetHeight - wrap.clientHeight;
            }
        }
    }

    const t = cartTotals();
    const paidInput = $('paidInput');
    if (!paidInput.dataset.touched) paidInput.value = t.total.toFixed(2);
    const paid = num(paidInput.value);
    const due = Math.max(0, t.total - paid);
    const change = Math.max(0, paid - t.total);

    $('subtotalDisplay').textContent = money(t.subtotal);
    $('totalDisplay').textContent = money(t.total);
    $('dueDisplay').textContent = money(due);
    $('changeLine').style.display = change > 0.004 ? 'flex' : 'none';
    $('changeDisplay').textContent = money(change);

    // ---------- সর্বনিম্ন-লাভ সুরক্ষা (ক্লায়েন্ট-পাশে তাৎক্ষণিক সতর্কতা; চূড়ান্ত যাচাই সার্ভারে) ----------
    const totalCost = cart.reduce((s, i) => s + (Number(i.cost) || 0) * i.qty, 0);
    const belowCost = cart.length > 0 && t.saleTotal < totalCost - 0.004;
    const warnBox = $('belowCostWarning');
    const confirmWrap = $('belowCostConfirmWrap');
    const confirmBox = $('belowCostConfirm');
    let blockCheckout = false;
    if (belowCost) {
        const loss = (totalCost - t.saleTotal).toFixed(2);
        warnBox.textContent = (CAN_OVERRIDE_BELOW_COST ? I18N.belowCostNeedsConfirm : I18N.belowCostBlocked).replace('%loss%', loss);
        warnBox.style.display = 'block';
        if (CAN_OVERRIDE_BELOW_COST) {
            if (confirmWrap) confirmWrap.style.display = 'block';
            if (confirmBox && !confirmBox.checked) blockCheckout = true;
        } else {
            blockCheckout = true;
        }
    } else {
        warnBox.style.display = 'none';
        if (confirmWrap) confirmWrap.style.display = 'none';
        if (confirmBox) confirmBox.checked = false;
    }

    $('checkoutBtn').disabled = submitting || cart.length === 0 || blockCheckout;
    const count = cart.reduce((s, i) => s + i.qty, 0);
    $('cartCountPill').textContent = count;
    $('clearCartBtn').style.display = cart.length ? 'inline-flex' : 'none';
    updateMobileCartBar(count, t.total);

    // হিডেন ইনপুট পুনর্নির্মাণ (সার্ভারে পাঠানোর জন্য)
    const form = $('checkoutForm');
    form.querySelectorAll('.cart-hidden').forEach(el => el.remove());
    const frag = document.createDocumentFragment();
    cart.forEach(item => {
        [['item_type', item.type], ['item_id', item.id], ['item_qty', item.qty], ['item_price', item.price]].forEach(([n, v]) => {
            const inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = n + '[]'; inp.value = v; inp.className = 'cart-hidden';
            frag.appendChild(inp);
        });
    });
    form.appendChild(frag);
    if (!cartNonce) cartNonce = newNonce();
    $('posNonce').value = cartNonce;

    saveCart();
}

function updateMobileCartBar(count, total) {
    const bar = $('mobileCartBar');
    if (!bar) return;
    bar.classList.toggle('show', count > 0);
    bar.querySelector('.mcb-count').textContent = count;
    bar.querySelector('.mcb-total').textContent = money(total);
}

// কার্ট সেশন-স্টোরেজে রাখা হয় — ভুলবশত রিলোড/নেটওয়ার্ক সমস্যাতেও কার্ট হারায় না
function saveCart() {
    try { sessionStorage.setItem(CART_KEY, JSON.stringify({ cart, priceMode, nonce: cartNonce, t: Date.now() })); } catch (e) {}
}
function loadCart() {
    try {
        const raw = sessionStorage.getItem(CART_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.cart) || Date.now() - (data.t || 0) > 12 * 3600 * 1000) return;
        // এই কার্টের বিক্রয় আগেই সম্পন্ন হয়ে থাকলে (যেমন ইনভয়েস পাতায় যাওয়া হয়নি) তা ফেরত আনা হবে না
        if (data.nonce && DONE_NONCES.indexOf(String(data.nonce)) !== -1) {
            sessionStorage.removeItem(CART_KEY);
            return;
        }
        cartNonce = typeof data.nonce === 'string' ? data.nonce.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) : '';
        cart = data.cart.filter(i => i && (i.type === 'product' || i.type === 'service')).map(i => ({
            type: i.type, id: Number(i.id), name: String(i.name || ''), unit: String(i.unit || ''),
            price: num(i.price), cost: num(i.cost), qty: Math.max(1, parseInt(i.qty, 10) || 1),
            priceType: i.priceType === 'wholesale' ? 'wholesale' : 'retail', stock: i.stock == null ? null : num(i.stock)
        }));
    } catch (e) { cart = []; }
}

$('cartRows').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.dataset.act === 'qty') return;
    const row = btn.closest('.pos-cart-row');
    const idx = Number(row.dataset.idx);
    if (!cart[idx]) return;
    if (btn.dataset.act === 'inc') cart[idx].qty += 1;
    else if (btn.dataset.act === 'dec') cart[idx].qty = Math.max(1, cart[idx].qty - 1);
    else if (btn.dataset.act === 'remove') cart.splice(idx, 1);
    renderCart();
});
$('cartRows').addEventListener('change', function (e) {
    if (e.target.dataset.act !== 'qty') return;
    const idx = Number(e.target.closest('.pos-cart-row').dataset.idx);
    if (!cart[idx]) return;
    cart[idx].qty = Math.max(1, parseInt(e.target.value, 10) || 1);
    renderCart();
});
$('clearCartBtn').addEventListener('click', function () {
    if (!confirm(I18N.clearConfirm)) return;
    cart = [];
    renderCart();
    focusScan();
});

/* ---------------------------------------------------------------------
   আইটেম গ্রিড
   --------------------------------------------------------------------- */
function currentFilter() { const a = document.querySelector('#catTabs a.active'); return a ? a.dataset.filter : 'all'; }
let lastGridMatches = [];
function renderGrid(filter, query) {
    const grid = $('itemGrid');
    const q = normCode(query);
    const matches = [];
    if (filter !== 'service') {
        for (const p of PRODUCTS) {
            if (!q || p.name.toLowerCase().includes(q) || normCode(p.barcode).includes(q) || normCode(p.item_code).includes(q)) {
                matches.push({ type: 'product', item: p });
                if (matches.length >= 80) break;
            }
        }
    }
    if (filter !== 'product') {
        SERVICES.forEach(s => {
            if (!q || s.name.toLowerCase().includes(q) || normCode(s.code).includes(q)) matches.push({ type: 'service', item: s });
        });
    }
    lastGridMatches = matches;
    if (!matches.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:30px;"><i class="bi bi-search"></i>' + esc(I18N.noItems) + '</div>';
        return;
    }
    grid.innerHTML = matches.map((m, i) => {
        const it = m.item;
        if (m.type === 'product') {
            const stock = num(it.stock_qty);
            const stockCls = stock <= 0 ? 'out' : (stock <= 5 ? 'low' : '');
            return `<button type="button" class="pos-item-btn" data-i="${i}">
                <span class="nm">${esc(it.name)}</span>
                <span class="meta"><span class="pr num">${money(productPrice(it))}</span><span class="stk ${stockCls}">${esc(I18N.stock)}: ${stock}</span></span>
            </button>`;
        }
        return `<button type="button" class="pos-item-btn svc" data-i="${i}">
            <span class="nm"><i class="bi bi-printer"></i> ${esc(it.name)}</span>
            <span class="meta"><span class="pr num">${money(it.price)}</span><span class="stk">${esc(it.unit)}</span></span>
        </button>`;
    }).join('');
}
$('itemGrid').addEventListener('click', function (e) {
    const btn = e.target.closest('.pos-item-btn');
    if (!btn) return;
    const m = lastGridMatches[Number(btn.dataset.i)];
    if (!m) return;
    addToCart(m.type, m.item);
    btn.classList.add('tapped');
    setTimeout(() => btn.classList.remove('tapped'), 220);
});

/* ---------------------------------------------------------------------
   বারকোড স্ক্যান
   ১) লোড করা তালিকায় বারকোড/আইটেম কোড/সার্ভিস কোড দিয়ে তাৎক্ষণিক খোঁজ
   ২) না পেলে সার্ভারে খোঁজ (pos_lookup.php) — নতুন/অনেক পণ্যের ক্ষেত্রেও কাজ করে
   ৩) হাতে টাইপ করে Enter দিলে ও খোঁজে ঠিক একটি আইটেম থাকলে সেটিই যুক্ত হয়
   --------------------------------------------------------------------- */
const pendingLookups = new Map(); // কোড → একই কোড কতবার স্ক্যান হয়েছে (উত্তর আসার আগে)
function handleScan(rawCode, opts) {
    opts = opts || {};
    const code = toEnglishDigits(String(rawCode || '')).trim();
    if (!code) return;
    const hit = CODE_INDEX.get(normCode(code));
    if (hit) { addToCart(hit.type, hit.item, { fromScan: true }); return; }

    if (opts.allowSingleMatch && lastGridMatches.length === 1) {
        addToCart(lastGridMatches[0].type, lastGridMatches[0].item, { fromScan: true });
        return;
    }

    const key = normCode(code);
    if (pendingLookups.has(key)) { pendingLookups.set(key, pendingLookups.get(key) + 1); return; }
    pendingLookups.set(key, 1);
    setScannerStatus('busy');
    const ctrl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 8000);
    fetch(LOOKUP_URL + '?code=' + encodeURIComponent(code), { credentials: 'same-origin', signal: ctrl ? ctrl.signal : undefined, headers: { 'Accept': 'application/json' } })
        .then(r => r.ok ? r.json() : { ok: false })
        .then(data => {
            const times = pendingLookups.get(key) || 1;
            if (data && data.ok && data.item) {
                if (data.type === 'service') {
                    const s = { id: Number(data.item.id), code: String(data.item.code || ''), name: String(data.item.name), unit: String(data.item.unit || ''), price: num(data.item.price) };
                    if (!SERVICES.some(x => x.id === s.id)) SERVICES.push(s);
                    indexService(s);
                    for (let n = 0; n < times; n++) addToCart('service', s, { fromScan: n === times - 1 });
                } else {
                    const it = data.item;
                    const p = { id: Number(it.id), item_code: String(it.item_code || ''), name: String(it.name), unit: String(it.unit || ''), sale_price: num(it.sale_price), wholesale_price: num(it.wholesale_price), cost_price: num(it.cost_price), barcode: String(it.barcode || ''), stock_qty: num(it.stock_qty) };
                    if (!PRODUCTS.some(x => x.id === p.id)) PRODUCTS.push(p);
                    indexProduct(p);
                    for (let n = 0; n < times; n++) addToCart('product', p, { fromScan: n === times - 1 });
                }
            } else {
                beep(false); flashScanBar(false);
                toast(I18N.notFound + ': ' + code, 'danger');
            }
        })
        .catch(() => { beep(false); flashScanBar(false); toast(I18N.notFound + ': ' + code, 'danger'); })
        .finally(() => { clearTimeout(timer); pendingLookups.delete(key); setScannerStatus('ready'); });
}

function setScannerStatus(state) {
    const el = $('scannerStatus');
    el.classList.toggle('busy', state === 'busy');
    el.querySelector('.txt').textContent = state === 'busy' ? I18N.searching : <?= json_encode(t('scanner_ready', 'স্ক্যানার প্রস্তুত'), JSON_UNESCAPED_UNICODE) ?>;
}

/* হার্ডওয়্যার বারকোড স্ক্যানার আসলে খুব দ্রুত টাইপ করা একটি কীবোর্ড (প্রতি অক্ষরে
   ~১০-৩০ms) এবং শেষে Enter পাঠায়। নিচের লিসেনার পুরো পাতায় এই "দ্রুত-টাইপ + Enter"
   প্যাটার্ন ধরে — ফোকাস যেখানেই থাকুক (কাস্টমার নাম, পরিশোধ, বা কোথাও না), স্ক্যান করা
   আইটেম সরাসরি কার্টে যুক্ত হয়। ভুল ফিল্ডে ঢুকে যাওয়া অক্ষরগুলো মুছে আগের মান ফিরিয়ে
   দেওয়া হয়, এবং Enter-এ ফর্ম কখনো ভুলবশত জমা হয় না। */
const SCAN_MAX_GAP = 50;     // দুই অক্ষরের মাঝে গড় সর্বোচ্চ সময় (ms)
const SCAN_MIN_LEN = 3;
const burst = { chars: '', start: 0, last: 0, target: null, before: null, touched: null };
function resetBurst() { burst.chars = ''; burst.start = 0; burst.last = 0; burst.target = null; burst.before = null; burst.touched = null; }
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
    const now = performance.now();
    if (e.key === 'Enter' || e.key === 'Tab') {
        const avgGap = burst.chars.length > 1 ? (burst.last - burst.start) / (burst.chars.length - 1) : Infinity;
        const isScan = burst.chars.length >= SCAN_MIN_LEN && (now - burst.last) < 120 && avgGap < SCAN_MAX_GAP;
        if (isScan) {
            e.preventDefault();
            e.stopPropagation();
            const tgt = burst.target;
            const code = burst.chars;
            if (tgt && tgt !== $('scanInput') && burst.before !== null && 'value' in tgt) {
                tgt.value = burst.before;
                tgt.dispatchEvent(new Event('input', { bubbles: true }));
                // পরিশোধ ফিল্ডটি আগে হাতে বদলানো না হয়ে থাকলে আবার "স্বয়ংক্রিয়" (= সর্বমোট) অবস্থায় ফেরে
                if (tgt === $('paidInput') && !burst.touched) { delete tgt.dataset.touched; renderCart(); }
            }
            const si = $('scanInput');
            clearTimeout(scanRenderTimer);
            si.value = '';
            renderGrid(currentFilter(), '');
            resetBurst();
            handleScan(code);
            focusScan();
            return;
        }
        resetBurst();
        return;
    }
    const ch = scanCharFromEvent(e); // বাংলা লেআউট চালু থাকলেও ফিজিক্যাল কী থেকে ইংরেজি অক্ষর
    if (ch === null) return; // Shift ইত্যাদি বাফার ভাঙে না
    if (now - burst.last > SCAN_MAX_GAP * 2 || !burst.chars) {
        burst.chars = '';
        burst.start = now;
        burst.target = e.target;
        burst.before = (e.target && 'value' in e.target) ? e.target.value : null;
        burst.touched = $('paidInput').dataset.touched || null;
    }
    burst.chars += ch;
    burst.last = now;
}, true);

// হাতে টাইপ করে খোঁজা
const scanInput = $('scanInput');
hardenScanInput(scanInput);
let scanRenderTimer = null;
scanInput.addEventListener('input', function () {
    const val = this.value;
    clearTimeout(scanRenderTimer);
    scanRenderTimer = setTimeout(() => renderGrid(currentFilter(), val), 90);
});
scanInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(scanRenderTimer);
        const code = this.value.trim();
        if (!code) return;
        renderGrid(currentFilter(), code);
        handleScan(code, { allowSingleMatch: true });
        this.value = '';
        renderGrid(currentFilter(), '');
    } else if (e.key === 'Escape') {
        this.value = '';
        renderGrid(currentFilter(), '');
    }
});

/* ---------------------------------------------------------------------
   ফোকাস ব্যবস্থাপনা ও কীবোর্ড শর্টকাট
   --------------------------------------------------------------------- */
function isTypingTarget(el) {
    if (!el || el.id === 'scanInput') return false;
    return !!(el.matches && el.matches('input:not([type=checkbox]):not([type=radio]), select, textarea'));
}
function focusScan(force) {
    if (TOUCH_ONLY && !force) return;
    if (document.activeElement !== scanInput) scanInput.focus({ preventScroll: true });
}
document.addEventListener('click', function (e) {
    if (isTypingTarget(e.target) || e.target.closest('label, .search-results-box, .dropdown-menu')) return;
    if (window.getSelection && String(window.getSelection())) return;
    setTimeout(() => { if (!isTypingTarget(document.activeElement)) focusScan(); }, 30);
});
window.addEventListener('pageshow', function (e) {
    // বিক্রয় জমা দেওয়ার পর ব্যাক-বাটনে ফিরলে পুরোনো (সম্পন্ন) কার্ট দেখাবে না — নতুন করে লোড
    if (e.persisted && submitting) { location.reload(); return; }
    focusScan();
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'F2') { e.preventDefault(); focusScan(true); scanInput.select(); }
    else if (e.key === 'F9' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        if (!$('checkoutBtn').disabled) $('checkoutForm').requestSubmit ? $('checkoutForm').requestSubmit($('checkoutBtn')) : $('checkoutBtn').click();
    }
});
// কার্ট-ফর্মের ফিল্ডে Enter চাপলে (হাতে বা স্ক্যানার থেকে) ফর্ম অনিচ্ছাকৃতভাবে জমা হবে না
$('checkoutForm').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && !e.ctrlKey && !e.metaKey) e.preventDefault();
});
$('checkoutForm').addEventListener('submit', function (e) {
    if (submitting || cart.length === 0 || $('checkoutBtn').disabled) { e.preventDefault(); return; }
    renderCart();
    submitting = true;
    const btn = $('checkoutBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ' + esc(I18N.processing);
});

/* ---------------------------------------------------------------------
   ডিসকাউন্ট / কুপন / পরিশোধ
   --------------------------------------------------------------------- */
['discountInput', 'previousDueInput'].forEach(id => $(id).addEventListener('input', () => renderCart()));
$('discountTypeInput').addEventListener('change', () => renderCart());
const bcc = $('belowCostConfirm');
if (bcc) bcc.addEventListener('change', () => renderCart());
$('paidInput').addEventListener('input', function () { this.dataset.touched = '1'; renderCart(); });
$('paidInput').addEventListener('focus', function () { this.select(); });

$('applyCouponBtn').addEventListener('click', applyCoupon);
function applyCoupon() {
    const code = $('couponCodeInput').value.trim();
    const msg = $('couponMsg');
    if (!code) return;
    const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
    msg.style.color = 'var(--text-secondary)';
    msg.textContent = I18N.couponChecking;
    fetch('coupon_check.php?code=' + encodeURIComponent(code) + '&subtotal=' + subtotal, { credentials: 'same-origin' })
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                appliedCouponDiscount = num(data.discount_amount);
                $('couponCodeHidden').value = code;
                $('discountInput').disabled = true;
                $('discountTypeInput').disabled = true;
                msg.style.color = 'var(--success)';
                msg.innerHTML = '<i class="bi bi-check-circle"></i> ' + esc(data.message) + ' <a href="#" id="removeCouponLink" style="margin-left:6px;">' + esc(I18N.couponRemove) + '</a>';
                $('removeCouponLink').addEventListener('click', function (ev) { ev.preventDefault(); removeCoupon(); });
            } else {
                appliedCouponDiscount = null;
                $('couponCodeHidden').value = '';
                msg.style.color = 'var(--danger)';
                msg.textContent = data.message;
            }
            renderCart();
        })
        .catch(() => { msg.style.color = 'var(--danger)'; msg.textContent = I18N.couponFailed; });
}
function removeCoupon() {
    appliedCouponDiscount = null;
    $('couponCodeHidden').value = '';
    $('couponCodeInput').value = '';
    $('discountInput').disabled = false;
    $('discountTypeInput').disabled = false;
    $('couponMsg').textContent = '';
    renderCart();
}

/* ---------------------------------------------------------------------
   কাস্টমার খোঁজ
   --------------------------------------------------------------------- */
function renderCustomerResults(query) {
    const box = $('customerResults');
    const q = toEnglishDigits(String(query || '').trim().toLowerCase());
    if (!q) { box.innerHTML = ''; box.style.display = 'none'; return; }
    const matches = CUSTOMERS.filter(c => c.name.toLowerCase().includes(q) || (c.mobile && c.mobile.includes(q))).slice(0, 10);
    if (matches.length === 0) {
        box.innerHTML = '<div class="search-result-empty">' + esc(I18N.noCustomerFound) + '</div>';
        box.style.display = 'block';
        return;
    }
    box.innerHTML = matches.map(c => {
        const due = num(c.due);
        let dueTxt = '';
        if (due > 0) dueTxt = `<span style="color:var(--danger);">${esc(I18N.dueLabel)} ${money(due)}</span>`;
        else if (due < 0) dueTxt = `<span style="color:var(--success);">${esc(I18N.creditLabel)} ${money(Math.abs(due))}</span>`;
        return `<div class="search-result-item" data-id="${c.id}">
                <span>${esc(c.name)}</span>
                <span style="color:var(--text-secondary);font-size:12px;">${esc(c.mobile)}${c.mobile && dueTxt ? ' · ' : ''}${dueTxt}</span>
            </div>`;
    }).join('');
    box.style.display = 'block';
}
$('customerResults').addEventListener('click', function (e) {
    const el = e.target.closest('.search-result-item');
    if (!el) return;
    const c = CUSTOMERS.find(x => x.id === Number(el.dataset.id));
    if (!c) return;
    $('customerName').value = c.name;
    $('customerId').value = c.id;
    $('customerMobile').value = c.mobile || '';
    showCustomerDue(c.due);
    $('previousDueInput').value = Math.max(0, num(c.due)).toFixed(2);
    renderCart();
    this.innerHTML = ''; this.style.display = 'none';
    focusScan();
});
function showCustomerDue(due) {
    const hint = $('customerDueHint');
    due = num(due);
    if (due > 0) {
        hint.textContent = I18N.dueLabel + ': ' + money(due);
        hint.style.display = 'block'; hint.style.color = 'var(--danger)';
    } else if (due < 0) {
        hint.textContent = I18N.creditLabel + ': ' + money(Math.abs(due));
        hint.style.display = 'block'; hint.style.color = 'var(--success)';
    } else {
        hint.style.display = 'none';
    }
}
hardenScanInput($('customerName'));
hardenScanInput($('customerMobile'));
$('customerName').addEventListener('input', function () {
    $('customerId').value = '';
    $('customerDueHint').style.display = 'none';
    if (this.value.trim() === '') { $('previousDueInput').value = '0'; renderCart(); }
    renderCustomerResults(this.value);
});
$('customerMobile').addEventListener('input', function () {
    renderCustomerResults(this.value || $('customerName').value);
});
document.addEventListener('click', function (e) {
    if (!e.target.closest('#customerResults') && e.target.id !== 'customerName' && e.target.id !== 'customerMobile') {
        $('customerResults').style.display = 'none';
    }
});

/* ---------------------------------------------------------------------
   ট্যাব
   --------------------------------------------------------------------- */
document.querySelectorAll('#catTabs a').forEach(a => a.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelectorAll('#catTabs a').forEach(x => x.classList.remove('active'));
    this.classList.add('active');
    renderGrid(this.dataset.filter, scanInput.value);
}));
document.querySelectorAll('#priceTabs a').forEach(a => a.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelectorAll('#priceTabs a').forEach(x => x.classList.remove('active'));
    this.classList.add('active');
    priceMode = this.dataset.price;
    renderGrid(currentFilter(), scanInput.value);
    saveCart();
}));
$('mobileCartBar').addEventListener('click', () => $('cartPanel').scrollIntoView({ behavior: 'smooth' }));
if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
        document.body.classList.toggle('cart-in-view', entries[0].isIntersecting);
    }, { threshold: 0.05 }).observe($('cartPanel'));
}

/* ---------------------------------------------------------------------
   শুরু
   --------------------------------------------------------------------- */
loadCart();
renderGrid('all', '');
renderCart();
focusScan();

// অন্য পাতা থেকে স্ক্যান করলে এখানে ?scan=CODE সহ আসে — সাথে সাথে কার্টে যুক্ত
const params = new URLSearchParams(location.search);
const scanParam = params.get('scan');
if (scanParam) {
    params.delete('scan');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : ''));
    handleScan(scanParam);
}
})();
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
