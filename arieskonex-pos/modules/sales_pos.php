<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
require_permission('sales');

$settings = shop_settings($pdo);
$canOverrideBelowCost = can_override_below_cost(current_user());

// ---------- POST: চেকআউট ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'checkout') {
    csrf_verify();

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
        $qty = (int)($qtys[$i] ?? 0);
        $price = (float)($prices[$i] ?? 0);
        if ($qty <= 0) continue;
        $type = (isset($types[$i]) && $types[$i] === 'service') ? 'service' : 'product';
        $sub = $qty * $price;
        $subtotal += $sub;
        $cost = 0;
        $desc = '';
        if ($type === 'product') {
            $c = $pdo->prepare("SELECT cost_price, name FROM products WHERE id = ?");
            $c->execute([$id]);
            $prow = $c->fetch();
            $cost = $prow['cost_price'] ?? 0;
            $desc = $prow['name'] ?? '';
        } else {
            $c = $pdo->prepare("SELECT name FROM services WHERE id = ?");
            $c->execute([$id]);
            $desc = $c->fetchColumn() ?: '';
        }
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

$products = $pdo->query("SELECT id, name, unit, sale_price, wholesale_price, cost_price, barcode, stock_qty FROM products WHERE status='active' ORDER BY name LIMIT 800")->fetchAll();
$services = $pdo->query("SELECT id, name, unit, price FROM services WHERE status='active' ORDER BY name")->fetchAll();
$customers = $pdo->query("SELECT id, name, mobile, (opening_balance + COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id=customers.id), 0)) AS due FROM customers ORDER BY name LIMIT 500")->fetchAll();
$paymentMethods = $pdo->query("SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order")->fetchAll();
if (empty($paymentMethods)) {
    $paymentMethods = [['method_key' => 'cash', 'method_name' => 'ক্যাশ']];
}

$pageTitle = t('pos_title');
$activeNav = 'sales';
require_once __DIR__ . '/../includes/header.php';
?>

<div class="pos-grid">
    <!-- বাম: পণ্য/সার্ভিস খোঁজ -->
    <div>
        <div class="card" style="padding:14px;">
            <input type="text" id="scanInput" class="form-control" placeholder="<?= e(t('scan_placeholder')) ?>" autofocus autocomplete="off" lang="en" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" style="margin-bottom:12px;font-size:16px;">
            <div class="gap-tabs" id="priceTabs">
                <a href="#" class="active" data-price="retail"><?= e(t('retail_price')) ?></a>
                <a href="#" data-price="wholesale"><?= e(t('wholesale_price')) ?></a>
            </div>
            <div class="gap-tabs" id="catTabs">
                <a href="#" class="active" data-filter="all"><?= e(t('filter_all')) ?></a>
                <a href="#" data-filter="product"><?= e(t('filter_product')) ?></a>
                <a href="#" data-filter="service"><?= e(t('filter_service')) ?></a>
            </div>
            <div id="itemGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(150px,1fr));gap:8px;max-height:60vh;overflow-y:auto;"></div>
        </div>
    </div>

    <!-- ডান: কার্ট -->
    <div id="cartPanel">
        <form method="POST" id="checkoutForm">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="checkout">
            <div class="card" style="padding:16px;">
                <h3 style="font-size:15px;margin:0 0 10px;"><i class="bi bi-cart3"></i> <?= e(t('cart')) ?></h3>
                <div id="cartRows" style="max-height:32vh;overflow-y:auto;">
                    <div class="empty-state" id="emptyCart" style="padding:24px;"><i class="bi bi-cart"></i><?= e(t('cart_empty')) ?></div>
                </div>

                <hr>
                <div class="form-group" style="position:relative;">
                    <label><?= e(t('customer_optional')) ?></label>
                    <input type="text" name="customer_name" id="customerName" class="form-control" autocomplete="off" placeholder="<?= e(t('customer_search_ph', 'নাম বা মোবাইল দিয়ে খুঁজুন...')) ?>">
                    <input type="hidden" name="customer_id" id="customerId">
                    <div id="customerResults" class="search-results-box"></div>
                    <div id="customerDueHint" class="form-hint" style="display:none;"></div>
                </div>
                <div class="form-group">
                    <input type="text" name="customer_mobile" id="customerMobile" class="form-control" placeholder="<?= e(t('mobile_optional')) ?>">
                </div>

                <div class="pos-total-line"><span><?= e(t('subtotal')) ?></span><span class="num" id="subtotalDisplay">৳০.০০</span></div>
                <div class="form-group" style="display:flex;align-items:center;gap:10px;margin:6px 0;">
                    <label style="margin:0;white-space:nowrap;"><?= e(t('discount')) ?></label>
                    <input type="number" step="0.01" min="0" name="discount_value" id="discountInput" class="form-control" value="0" oninput="renderCart()">
                    <select name="discount_type" id="discountTypeInput" class="form-control" style="max-width:90px;flex:none;" onchange="renderCart()">
                        <option value="fixed"><?= e(t('discount_fixed', '৳')) ?></option>
                        <option value="percent"><?= e(t('discount_percent', '%')) ?></option>
                    </select>
                </div>
                <div class="form-group" style="margin:6px 0;">
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="couponCodeInput" class="form-control" placeholder="কুপন কোড (ঐচ্ছিক)" style="text-transform:uppercase;">
                        <button type="button" class="btn btn-sm btn-outline" onclick="applyCoupon()" style="flex:none;">প্রয়োগ</button>
                    </div>
                    <input type="hidden" name="coupon_code" id="couponCodeHidden" value="">
                    <div id="couponMsg" style="font-size:12px;margin-top:4px;"></div>
                </div>
                <div class="form-group" style="display:flex;align-items:center;gap:10px;margin:6px 0;">
                    <label style="margin:0;white-space:nowrap;color:var(--danger);"><?= e(t('previous_due')) ?></label>
                    <input type="number" step="0.01" id="previousDueInput" class="form-control" value="0" oninput="renderCart()">
                </div>
                <div id="belowCostWarning" class="alert alert-danger" style="display:none;font-size:12.5px;padding:10px 12px;"></div>
                <?php if ($canOverrideBelowCost): ?>
                <div class="form-check" id="belowCostConfirmWrap" style="display:none;margin:6px 0;">
                    <input class="form-check-input" type="checkbox" name="below_cost_confirm" id="belowCostConfirm" value="1" onchange="renderCart()">
                    <label class="form-check-label" for="belowCostConfirm" style="color:var(--danger);font-size:12.5px;"><?= e(t('below_cost_authorize_label', 'আমি বুঝেই এই লোকসানি বিক্রয়টি অনুমোদন করছি')) ?></label>
                </div>
                <?php endif; ?>
                <div class="pos-total-line grand"><span><?= e(t('grand_total')) ?></span><span class="num" id="totalDisplay">৳০.০০</span></div>

                <div class="row" style="margin-top:10px;">
                    <div class="col-6 form-group">
                        <label><?= e(t('payment_method')) ?></label>
                        <select name="payment_method" class="form-control">
                            <?php foreach ($paymentMethods as $pm): ?>
                                <option value="<?= e($pm['method_key']) ?>"><?= e($pm['method_name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-6 form-group">
                        <label><?= e(t('transaction_ref')) ?></label>
                        <input type="text" name="payment_ref" class="form-control" placeholder="<?= e(t('optional')) ?>">
                    </div>
                </div>
                <div class="form-group">
                    <label><?= e(t('paid_amount')) ?></label>
                    <input type="number" step="0.01" name="paid_amount" id="paidInput" class="form-control" value="0">
                </div>
                <div class="pos-total-line"><span><?= e(t('due')) ?></span><span class="num" id="dueDisplay" style="color:var(--danger);font-weight:700;">৳০.০০</span></div>

                <button type="submit" class="btn btn-primary btn-block" style="margin-top:12px;" id="checkoutBtn" disabled><i class="bi bi-check2-circle"></i> <?= e(t('complete_sale')) ?></button>
            </div>
        </form>
    </div>
</div>

<div id="mobileCartBar" onclick="document.getElementById('cartPanel').scrollIntoView({behavior:'smooth'})">
    <span><i class="bi bi-cart-check-fill"></i> <span class="mcb-count">0</span> <?= e(t('cart')) ?></span>
    <span class="mcb-total num">৳০.০০</span>
    <span><?= e(t('view_cart', 'কার্ট দেখুন')) ?> <i class="bi bi-chevron-up"></i></span>
</div>

<script>
const I18N = {
    stock: <?= json_encode(t('stock_label'), JSON_UNESCAPED_UNICODE) ?>,
    wholesale: <?= json_encode(t('wholesale_badge'), JSON_UNESCAPED_UNICODE) ?>,
    cartEmpty: <?= json_encode(t('cart_empty'), JSON_UNESCAPED_UNICODE) ?>,
    noCustomerFound: <?= json_encode(t('no_customer_found_hint', 'তালিকায় নেই — এই নামেই নতুন কাস্টমার যুক্ত হবে।'), JSON_UNESCAPED_UNICODE) ?>,
    dueLabel: <?= json_encode(t('due_label', 'বাকি আছে'), JSON_UNESCAPED_UNICODE) ?>,
    creditLabel: <?= json_encode(t('credit_label', 'জমা আছে'), JSON_UNESCAPED_UNICODE) ?>,
    belowCostBlocked: <?= json_encode(t('below_cost_blocked_hint', 'এই ডিসকাউন্টে বিক্রয়মূল্য ক্রয়মূল্যের চেয়ে কম হয়ে যাচ্ছে (লোকসান ৳%loss%) — আপনার এই বিক্রয় সম্পন্ন করার অনুমতি নেই। ডিসকাউন্ট কমান।'), JSON_UNESCAPED_UNICODE) ?>,
    belowCostNeedsConfirm: <?= json_encode(t('below_cost_needs_confirm_hint', 'এই ডিসকাউন্টে বিক্রয়মূল্য ক্রয়মূল্যের চেয়ে কম হয়ে যাচ্ছে (লোকসান ৳%loss%) — চালিয়ে যেতে নিচের বক্সটি টিক দিন।'), JSON_UNESCAPED_UNICODE) ?>
};
const PRODUCTS = <?= json_encode($products, JSON_UNESCAPED_UNICODE) ?>;
const SERVICES = <?= json_encode($services, JSON_UNESCAPED_UNICODE) ?>;
const CUSTOMERS = <?= json_encode($customers, JSON_UNESCAPED_UNICODE) ?>;
const CAN_OVERRIDE_BELOW_COST = <?= $canOverrideBelowCost ? 'true' : 'false' ?>;
let cart = [];
let priceMode = 'retail';

/* ---------------------------------------------------------------------
   স্ক্যান ইনপুটে ফোকাস ধরে রাখা
   বারকোড স্ক্যানার আসলে একটি কীবোর্ডের মতোই কাজ করে — যেই ইনপুট ফিল্ডে
   ফোকাস আছে সেখানেই এটি লিখে দেয়। কার্টে পণ্য যোগ করতে, কাস্টমার
   বাছাই করতে, বা কোনো বাটনে ট্যাপ করতে গিয়ে ফোকাস scanInput থেকে সরে
   গেলে পরের স্ক্যানটি হয় হারিয়ে যায় (কার্টে কিছু যোগ হয় না), নয়তো
   ভুল ফিল্ডে (যেমন ছাড়/পরিমাণ) গিয়ে ঢুকে যায় এবং Enter চাপার কারণে
   ফর্ম জমা হয়ে যায় — এটাই "মাঝে মাঝে কাজ না করার" মূল কারণ।
   তাই টাইপ করার জন্য নির্দিষ্ট ফিল্ড ছাড়া অন্য যেকোনো জায়গায় ক্লিক/ট্যাপ
   করলেই ফোকাস আবার scanInput-এ ফিরিয়ে আনা হচ্ছে।
   --------------------------------------------------------------------- */
const TYPING_FIELD_IDS = ['discountInput', 'paidInput', 'customerName', 'customerMobile'];
function isTypingTarget(el) {
    if (!el || el.id === 'scanInput') return false;
    if (TYPING_FIELD_IDS.includes(el.id)) return true;
    if (el.matches && el.matches('input, select, textarea')) return true;
    return false;
}
function focusScan() {
    const si = document.getElementById('scanInput');
    if (si && document.activeElement !== si) si.focus({ preventScroll: true });
}
document.addEventListener('click', function (e) {
    if (isTypingTarget(e.target)) return;
    setTimeout(focusScan, 30);
});
window.addEventListener('pageshow', focusScan);
// scanInput ছাড়া কার্ট-ফর্মের অন্য কোনো ফিল্ডে ভুলবশত Enter (স্ক্যানার থেকে
// আসা বা হাতে চাপা) পড়লে যেন ফর্ম অনিচ্ছাকৃতভাবে জমা না হয়ে যায়
document.getElementById('checkoutForm').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
    }
});

function renderGrid(filter, query) {
    const grid = document.getElementById('itemGrid');
    grid.innerHTML = '';
    const q = (query || '').toLowerCase();

    if (filter !== 'service') {
        PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)))
            .slice(0, 60).forEach(p => {
                const price = priceMode === 'wholesale' && p.wholesale_price > 0 ? p.wholesale_price : p.sale_price;
                const btn = document.createElement('button');
                btn.type = 'button'; btn.className = 'pos-item-btn';
                btn.dataset.type = 'product'; btn.dataset.id = p.id; btn.dataset.name = p.name;
                btn.dataset.unit = p.unit; btn.dataset.price = price; btn.dataset.cost = p.cost_price; btn.dataset.priceType = priceMode;
                btn.innerHTML = `<span class="nm">${p.name}</span><span class="pr">৳${Number(price).toFixed(2)}</span> <span style="float:right;font-size:11px;color:var(--text-secondary);">${I18N.stock}: ${p.stock_qty}</span>`;
                grid.appendChild(btn);
            });
    }
    if (filter !== 'product') {
        SERVICES.filter(s => !q || s.name.toLowerCase().includes(q))
            .forEach(s => {
                const btn = document.createElement('button');
                btn.type = 'button'; btn.className = 'pos-item-btn';
                btn.dataset.type = 'service'; btn.dataset.id = s.id; btn.dataset.name = s.name;
                btn.dataset.unit = s.unit; btn.dataset.price = s.price; btn.dataset.cost = 0; btn.dataset.priceType = 'retail';
                btn.innerHTML = `<span class="nm">${s.name}</span><span class="pr">৳${Number(s.price).toFixed(2)}</span>`;
                grid.appendChild(btn);
            });
    }
}

// ইভেন্ট ডেলিগেশন — গ্রিড বারবার rebuild হলেও ক্লিক/ট্যাপ নির্ভরযোগ্যভাবে কাজ করে
document.getElementById('itemGrid').addEventListener('click', function (e) {
    const btn = e.target.closest('.pos-item-btn');
    if (!btn) return;
    addToCart(btn.dataset.type, isNaN(btn.dataset.id) ? btn.dataset.id : Number(btn.dataset.id), btn.dataset.name, btn.dataset.unit, Number(btn.dataset.price), Number(btn.dataset.cost), btn.dataset.priceType);
    btn.classList.add('tapped');
    setTimeout(() => btn.classList.remove('tapped'), 220);
});

function addToCart(type, id, name, unit, price, cost, priceType) {
    const existing = cart.find(c => c.type === type && c.id === id && c.priceType === priceType);
    if (existing) { existing.qty += 1; } else { cart.push({ type, id, name, unit, price, cost, qty: 1, priceType: priceType || 'retail' }); }
    renderCart();
    showMobileCartBar();
}

function showMobileCartBar() {
    const bar = document.getElementById('mobileCartBar');
    if (!bar) return;
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
    if (count > 0) {
        bar.style.display = 'flex';
        bar.querySelector('.mcb-count').textContent = count;
        bar.querySelector('.mcb-total').textContent = '৳' + total.toFixed(2);
    } else {
        bar.style.display = 'none';
    }
}

function renderCart() {
    const wrap = document.getElementById('cartRows');
    wrap.innerHTML = '';
    if (cart.length === 0) {
        wrap.innerHTML = '<div class="empty-state" style="padding:24px;"><i class="bi bi-cart"></i>' + I18N.cartEmpty + '</div>';
    }
    let subtotal = 0;
    cart.forEach((item, idx) => {
        subtotal += item.qty * item.price;
        const row = document.createElement('div');
        row.className = 'pos-cart-row';
        row.innerHTML = `
            <div style="flex:1;">
                <div style="font-size:13.5px;font-weight:600;">${item.name} ${item.priceType === 'wholesale' ? '<span class="badge badge-purple" style="font-size:10px;">' + I18N.wholesale + '</span>' : ''}</div>
                <div style="font-size:12px;color:var(--text-secondary);">৳${item.price.toFixed(2)} × ${item.qty} = ৳${(item.price*item.qty).toFixed(2)}</div>
            </div>
            <input type="number" min="1" class="form-control qty-input" value="${item.qty}" onchange="updateQty(${idx}, this.value)">
            <button type="button" class="btn btn-sm btn-light" onclick="removeItem(${idx})"><i class="bi bi-x"></i></button>
        `;
        wrap.appendChild(row);
    });

    const discountType = document.getElementById('discountTypeInput').value;
    let discountValue = Math.max(0, parseFloat(document.getElementById('discountInput').value) || 0);
    let discount;
    if (window.appliedCouponDiscount !== null && window.appliedCouponDiscount !== undefined) {
        // কুপন প্রয়োগ করা থাকলে ম্যানুয়াল ডিসকাউন্টের বদলে কুপনের ছাড় ব্যবহৃত হয়
        discount = Math.min(subtotal, window.appliedCouponDiscount);
    } else if (discountType === 'percent') {
        discountValue = Math.min(100, discountValue);
        discount = subtotal * discountValue / 100;
    } else {
        discount = Math.min(subtotal, discountValue);
    }
    const saleTotalBeforeDue = Math.max(0, subtotal - discount);
    const previousDue = Math.max(0, parseFloat(document.getElementById('previousDueInput').value) || 0);
    const total = saleTotalBeforeDue + previousDue;
    let paidInput = document.getElementById('paidInput');
    if (!paidInput.dataset.touched) paidInput.value = total.toFixed(2);
    const paid = parseFloat(paidInput.value) || 0;
    const due = Math.max(0, total - paid);

    document.getElementById('subtotalDisplay').textContent = '৳' + subtotal.toFixed(2);
    document.getElementById('totalDisplay').textContent = '৳' + total.toFixed(2);
    document.getElementById('dueDisplay').textContent = '৳' + due.toFixed(2);

    // ---------- সর্বনিম্ন-লাভ সুরক্ষা (ক্লায়েন্ট-পাশে তাৎক্ষণিক সতর্কতা) ----------
    // চূড়ান্ত সিদ্ধান্ত সবসময় সার্ভারে আবার যাচাই হয়; এটি শুধু ব্যবহারকারীকে
    // সাবমিট করার আগেই সমস্যাটি বুঝিয়ে দেয়।
    const totalCost = cart.reduce((s, i) => s + (Number(i.cost) || 0) * i.qty, 0);
    const belowCost = cart.length > 0 && saleTotalBeforeDue < totalCost;
    const warnBox = document.getElementById('belowCostWarning');
    const confirmWrap = document.getElementById('belowCostConfirmWrap');
    const confirmBox = document.getElementById('belowCostConfirm');
    let blockCheckout = false;
    if (belowCost) {
        const loss = (totalCost - saleTotalBeforeDue).toFixed(2);
        if (CAN_OVERRIDE_BELOW_COST) {
            warnBox.textContent = I18N.belowCostNeedsConfirm.replace('%loss%', loss);
            warnBox.style.display = 'block';
            if (confirmWrap) confirmWrap.style.display = 'block';
            if (confirmBox && !confirmBox.checked) blockCheckout = true;
        } else {
            warnBox.textContent = I18N.belowCostBlocked.replace('%loss%', loss);
            warnBox.style.display = 'block';
            blockCheckout = true;
        }
    } else {
        warnBox.style.display = 'none';
        if (confirmWrap) confirmWrap.style.display = 'none';
        if (confirmBox) confirmBox.checked = false;
    }

    document.getElementById('checkoutBtn').disabled = cart.length === 0 || blockCheckout;
    showMobileCartBar();

    // হিডেন ইনপুট পুনর্নির্মাণ
    document.querySelectorAll('.cart-hidden').forEach(el => el.remove());
    const form = document.getElementById('checkoutForm');
    cart.forEach(item => {
        [['item_type', item.type], ['item_id', item.id], ['item_qty', item.qty], ['item_price', item.price]].forEach(([n, v]) => {
            const inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = n + '[]'; inp.value = v; inp.className = 'cart-hidden';
            form.appendChild(inp);
        });
    });
}
function updateQty(idx, val) { cart[idx].qty = Math.max(1, parseInt(val) || 1); renderCart(); }
function removeItem(idx) { cart.splice(idx, 1); renderCart(); }

window.appliedCouponDiscount = null;
function applyCoupon() {
    const code = document.getElementById('couponCodeInput').value.trim();
    const msg = document.getElementById('couponMsg');
    if (!code) { return; }
    const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
    msg.style.color = 'var(--text-secondary)';
    msg.textContent = 'যাচাই করা হচ্ছে...';
    fetch('coupon_check.php?code=' + encodeURIComponent(code) + '&subtotal=' + subtotal)
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                window.appliedCouponDiscount = data.discount_amount;
                document.getElementById('couponCodeHidden').value = code;
                document.getElementById('discountInput').disabled = true;
                document.getElementById('discountTypeInput').disabled = true;
                msg.style.color = 'var(--success)';
                msg.innerHTML = '<i class="bi bi-check-circle"></i> ' + data.message + ' <a href="#" onclick="removeCoupon();return false;" style="margin-left:6px;">সরান</a>';
            } else {
                window.appliedCouponDiscount = null;
                document.getElementById('couponCodeHidden').value = '';
                msg.style.color = 'var(--danger)';
                msg.textContent = data.message;
            }
            renderCart();
        })
        .catch(() => { msg.style.color = 'var(--danger)'; msg.textContent = 'কুপন যাচাই করা যায়নি — আবার চেষ্টা করুন।'; });
}
function removeCoupon() {
    window.appliedCouponDiscount = null;
    document.getElementById('couponCodeHidden').value = '';
    document.getElementById('couponCodeInput').value = '';
    document.getElementById('discountInput').disabled = false;
    document.getElementById('discountTypeInput').disabled = false;
    document.getElementById('couponMsg').textContent = '';
    renderCart();
}

document.getElementById('paidInput').addEventListener('input', function () { this.dataset.touched = '1'; renderCart(); });

function renderCustomerResults(query) {
    const box = document.getElementById('customerResults');
    const q = toEnglishDigits(query.trim().toLowerCase());
    if (!q) { box.innerHTML = ''; box.style.display = 'none'; return; }
    const matches = CUSTOMERS.filter(c => c.name.toLowerCase().includes(q) || (c.mobile && c.mobile.includes(q))).slice(0, 10);
    if (matches.length === 0) {
        box.innerHTML = '<div class="search-result-empty">' + I18N.noCustomerFound + '</div>';
        box.style.display = 'block';
        return;
    }
    box.innerHTML = matches.map(c => {
        const due = Number(c.due || 0);
        let dueTxt = '';
        if (due > 0) {
            dueTxt = `<span style="color:var(--danger);">${I18N.dueLabel} ৳${due.toFixed(2)}</span>`;
        } else if (due < 0) {
            dueTxt = `<span style="color:var(--success);">${I18N.creditLabel} ৳${Math.abs(due).toFixed(2)}</span>`;
        }
        return `<div class="search-result-item" data-id="${c.id}">
                <span>${c.name}</span>
                <span style="color:var(--text-secondary);font-size:12px;">${c.mobile || ''}${c.mobile && dueTxt ? ' · ' : ''}${dueTxt}</span>
            </div>`;
    }).join('');
    box.style.display = 'block';
    box.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', function () {
            const c = CUSTOMERS.find(x => x.id == this.dataset.id);
            document.getElementById('customerName').value = c.name;
            document.getElementById('customerId').value = c.id;
            document.getElementById('customerMobile').value = c.mobile || '';
            showCustomerDue(c.due);
            document.getElementById('previousDueInput').value = Math.max(0, Number(c.due || 0)).toFixed(2);
            renderCart();
            box.innerHTML = ''; box.style.display = 'none';
            focusScan();
        });
    });
}
function showCustomerDue(due) {
    const hint = document.getElementById('customerDueHint');
    due = Number(due || 0);
    if (due > 0) {
        hint.textContent = I18N.dueLabel + ': ৳' + due.toFixed(2);
        hint.style.display = 'block';
        hint.style.color = 'var(--danger)';
    } else if (due < 0) {
        hint.textContent = I18N.creditLabel + ': ৳' + Math.abs(due).toFixed(2);
        hint.style.display = 'block';
        hint.style.color = 'var(--success)';
    } else {
        hint.style.display = 'none';
    }
}
hardenScanInput(document.getElementById('customerName'));
document.getElementById('customerName').addEventListener('input', function () {
    // নাম হাতে বদলালে আগের নির্বাচিত কাস্টমারের বাঁধন বাতিল
    document.getElementById('customerId').value = '';
    document.getElementById('customerDueHint').style.display = 'none';
    if (this.value.trim() === '') {
        document.getElementById('previousDueInput').value = '0';
        renderCart();
    }
    renderCustomerResults(this.value);
});
document.getElementById('customerMobile').addEventListener('input', function () {
    renderCustomerResults(this.value || document.getElementById('customerName').value);
});
document.addEventListener('click', function (e) {
    if (!e.target.closest('#customerResults') && e.target.id !== 'customerName' && e.target.id !== 'customerMobile') {
        document.getElementById('customerResults').style.display = 'none';
    }
});

hardenScanInput(document.getElementById('scanInput'));
let scanRenderTimer = null;
document.getElementById('scanInput').addEventListener('input', function () {
    // দ্রুতগতির স্ক্যানার প্রতিটি অক্ষরের পরই এই ইভেন্ট চালায় — প্রতিবার পুরো
    // গ্রিড রিবিল্ড করলে কিছু ডিভাইসে কীস্ট্রোক মিস হতে পারে, তাই সামান্য বিলম্ব
    const val = this.value;
    clearTimeout(scanRenderTimer);
    scanRenderTimer = setTimeout(() => {
        renderGrid(document.querySelector('#catTabs a.active').dataset.filter, val);
    }, 80);
});
document.getElementById('scanInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(scanRenderTimer);
        const code = toEnglishDigits(this.value.trim());
        const match = PRODUCTS.find(p => p.barcode && p.barcode === code);
        if (match) {
            const price = priceMode === 'wholesale' && match.wholesale_price > 0 ? match.wholesale_price : match.sale_price;
            addToCart('product', match.id, match.name, match.unit, price, match.cost_price, priceMode);
        }
        this.value = '';
        renderGrid('all', '');
        focusScan();
    }
});
document.querySelectorAll('#catTabs a').forEach(a => {
    a.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('#catTabs a').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        renderGrid(this.dataset.filter, document.getElementById('scanInput').value);
    });
});
document.querySelectorAll('#priceTabs a').forEach(a => {
    a.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('#priceTabs a').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        priceMode = this.dataset.price;
        renderGrid(document.querySelector('#catTabs a.active').dataset.filter, document.getElementById('scanInput').value);
    });
});

renderGrid('all', '');
renderCart();
focusScan();
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
