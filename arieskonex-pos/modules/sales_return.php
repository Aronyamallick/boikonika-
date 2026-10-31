<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
require_permission('sales_return');

$settings = shop_settings($pdo);
$view     = $_GET['view'] ?? ((isset($_GET['sale_id']) && (int)$_GET['sale_id'] > 0) ? 'new' : 'list');
$pageTitle = t('sales_return_title', 'বিক্রয় ফেরত');
$activeNav = 'sales_return';

// ---------- POST: ফেরত প্রক্রিয়াকরণ ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'process_return') {
    csrf_verify();

    $saleId      = (int)($_POST['sale_id'] ?? 0);
    $itemIds     = $_POST['item_id'] ?? [];
    $qtys        = $_POST['item_qty'] ?? [];
    $refundAmt   = (float)($_POST['refund_amount'] ?? 0);
    $creditAmt   = (float)($_POST['credit_amount'] ?? 0);
    $refundMethod = trim($_POST['refund_method'] ?? '') ?: null;
    $refundRef   = trim($_POST['refund_ref'] ?? '') ?: null;
    $reason      = trim($_POST['reason'] ?? '') ?: null;

    if ($saleId <= 0 || empty($itemIds)) {
        flash_set(t('err_return_sale_required', 'বিক্রয়টি খুঁজে পাওয়া যায়নি।'), 'danger');
        redirect('sales_return.php');
    }

    try {
        $pdo->beginTransaction();

        $saleStmt = $pdo->prepare("SELECT * FROM sales WHERE id = ? FOR UPDATE");
        $saleStmt->execute([$saleId]);
        $sale = $saleStmt->fetch();
        if (!$sale) {
            $pdo->rollBack();
            flash_set(t('err_return_sale_required', 'বিক্রয়টি খুঁজে পাওয়া যায়নি।'), 'danger');
            redirect('sales_return.php');
        }

        // ফেরতযোগ্য আইটেম সংগ্রহ — আগের ফেরতের পরিমাণ বাদ দিয়ে
        $alreadyReturnedStmt = $pdo->prepare("SELECT COALESCE(SUM(qty),0) v FROM sales_return_items WHERE sale_item_id = ?");
        $itemStmt = $pdo->prepare("SELECT * FROM sale_items WHERE id = ? AND sale_id = ?");

        $returnable = [];
        foreach ($itemIds as $i => $saleItemId) {
            $saleItemId = (int)$saleItemId;
            $qty = (int)($qtys[$i] ?? 0);
            if ($saleItemId <= 0 || $qty <= 0) continue;

            $itemStmt->execute([$saleItemId, $saleId]);
            $item = $itemStmt->fetch();
            if (!$item) continue;

            $alreadyReturnedStmt->execute([$saleItemId]);
            $returnedQty = (int)$alreadyReturnedStmt->fetch()['v'];
            $available = (int)$item['qty'] - $returnedQty;
            $qty = min($qty, $available);
            if ($qty <= 0) continue;

            $returnable[] = [
                'sale_item_id' => $saleItemId,
                'item_type'    => $item['item_type'],
                'product_id'   => $item['product_id'],
                'description'  => $item['description'],
                'qty'          => $qty,
                'orig_qty'     => (int)$item['qty'],
                'unit_price'   => (float)$item['unit_price'],
                'unit_cost'    => (float)$item['unit_cost'],
                'subtotal'     => $qty * (float)$item['unit_price'],
            ];
        }

        if (empty($returnable)) {
            $pdo->rollBack();
            flash_set(t('err_return_no_valid_items', 'ফেরতের জন্য কোনো বৈধ আইটেম নির্বাচন করা হয়নি।'), 'danger');
            redirect('sales_return.php?sale_id=' . $saleId);
        }

        // --- হিসাব ---
        $subtotal = 0.0;
        foreach ($returnable as $r) { $subtotal += $r['subtotal']; }

        $saleSubtotal = (float)$sale['subtotal'];
        $discountShare = $saleSubtotal > 0
            ? round(((float)$sale['discount'] / $saleSubtotal) * $subtotal, 2)
            : 0;
        $returnTotal = max(0, $subtotal - $discountShare);

        // পরিশোধিত অংশ থেকে অনুপাতিক রিফান্ড (সর্বোচ্চ সীমা)
        $saleTotal = (float)$sale['total_amount'];
        $paidRatio = $saleTotal > 0 ? $subtotal / $saleTotal : 0;
        $maxRefund = round($paidRatio * (float)$sale['paid_amount'], 2);

        // ক্লায়েন্ট-পাঠানো মানের সাথে নিরাপদ যোগ — ছোট পার্থক্য সামঞ্জস্য করে নিই
        $refundAmt = min(max(0, $refundAmt), $maxRefund);
        $creditAmt = max(0, $creditAmt);
        if (abs($refundAmt + $creditAmt - $returnTotal) > 0.01) {
            $creditAmt = max(0, $returnTotal - $refundAmt);
        }

        // --- ফেরত সংরক্ষণ ---
        // ইউনিক ফেরত নং — আজকের ফেরত সংখ্যা থেকে, সংঘর্ষ হলে সাফিক্স বাড়াই
        $attempt = 0;
        do {
            $retCount = (int)$pdo->query("SELECT COUNT(*) FROM sales_returns WHERE DATE(return_date) = CURDATE()")->fetchColumn();
            $returnNo = 'RTN-' . date('Ymd') . '-' . str_pad((string)($retCount + 1 + $attempt), 4, '0', STR_PAD_LEFT);
            $chk = $pdo->prepare("SELECT COUNT(*) FROM sales_returns WHERE return_no = ?");
            $chk->execute([$returnNo]);
            $attempt++;
        } while ((int)$chk->fetchColumn() > 0 && $attempt < 20);



        $insRet = $pdo->prepare("INSERT INTO sales_returns (sale_id, return_no, subtotal, discount, return_total, refund_amount, credit_amount, refund_method, refund_ref, reason, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $insRet->execute([$saleId, $returnNo, $subtotal, $discountShare, $returnTotal, $refundAmt, $creditAmt, $refundMethod, $refundRef, $reason, current_user()['id'] ?? null]);
        $returnId = $pdo->lastInsertId();

        $insItem = $pdo->prepare("INSERT INTO sales_return_items (return_id, sale_item_id, product_id, description, qty, unit_price, unit_cost, subtotal, restocked) VALUES (?,?,?,?,?,?,?,?,?)");
        $restock = $pdo->prepare("UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?");
        $materialsStmt = $pdo->prepare("SELECT id, product_id, qty, restocked_qty FROM sale_item_materials WHERE sale_item_id = ?");
        $materialRestockUpd = $pdo->prepare("UPDATE sale_item_materials SET restocked_qty = restocked_qty + ? WHERE id = ?");

        foreach ($returnable as $r) {
            $restocked = 0;
            if ($r['item_type'] === 'product' && $r['product_id']) {
                $restock->execute([$r['qty'], $r['product_id']]);
                $restocked = 1;
            } elseif ($r['item_type'] === 'service' && $r['orig_qty'] > 0) {
                // সার্ভিসের সাথে যুক্ত কাঁচামাল (যেমন কাগজ/কালি) ফেরত পরিমাণ
                // অনুপাতে স্টকে ফিরিয়ে দেওয়া হয়
                $materialsStmt->execute([$r['sale_item_id']]);
                foreach ($materialsStmt->fetchAll() as $mat) {
                    $usedPerUnit = (float)$mat['qty'] / $r['orig_qty'];
                    $restoreQty = $usedPerUnit * $r['qty'];
                    $remainingConsumed = (float)$mat['qty'] - (float)$mat['restocked_qty'];
                    $restoreQty = min($restoreQty, $remainingConsumed);
                    if ($restoreQty <= 0) continue;
                    $restock->execute([$restoreQty, $mat['product_id']]);
                    $materialRestockUpd->execute([$restoreQty, $mat['id']]);
                }
                $restocked = 1;
            }
            $insItem->execute([$returnId, $r['sale_item_id'], $r['product_id'], $r['description'], $r['qty'], $r['unit_price'], $r['unit_cost'], $r['subtotal'], $restocked]);
        }

        // --- মূল ইনভয়েস হালনাগাদ ---
        // subtotal/discount/total কমে, পরিশোধিত অংশ শুধু রিফান্ড পরিমাণে কমে,
        // আর বাকির (due) উপর ক্যাশ/রিফান্ড ছাড়া বাকি অংশ (credit) সমন্বয় হয়।
        $updSale = $pdo->prepare("UPDATE sales SET subtotal = GREATEST(0, subtotal - ?), discount = GREATEST(0, discount - ?), total_amount = GREATEST(0, total_amount - ?), paid_amount = GREATEST(0, paid_amount - ?), due_amount = GREATEST(0, due_amount - ?) WHERE id = ?");
        $updSale->execute([$subtotal, $discountShare, $returnTotal, $refundAmt, $creditAmt, $saleId]);



        // টাকা ফেরত (রিফান্ড) থাকলে তা কাস্টমার পেমেন্ট হিস্ট্রিতে নেতিবাচক এন্ট্রি হিসেবে
        if ($refundAmt > 0 && $sale['customer_id']) {
            $insPay = $pdo->prepare("INSERT INTO customer_payments (customer_id, amount, payment_date, note, created_by) VALUES (?,?,?,?,?)");
            $insPay->execute([$sale['customer_id'], -$refundAmt, date('Y-m-d'), 'বিক্রয় ফেরত — ' . $returnNo, current_user()['id'] ?? null]);
        }

        $pdo->commit();
        log_activity($pdo, 'বিক্রয় ফেরত ' . $returnNo . ' — ৳' . money($returnTotal));
        flash_set(t('return_success', 'বিক্রয় ফেরত সফলভাবে সম্পন্ন হয়েছে।') . ' ' . $returnNo);
        redirect('sales_return.php?view=show&id=' . $returnId);
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        flash_set(t('return_save_failed', 'ফেরত সংরক্ষণ ব্যর্থ হয়েছে:') . ' ' . $ex->getMessage(), 'danger');
        redirect('sales_return.php?sale_id=' . $saleId);
    }
}

// ---------- ভিউ: ফেরত রসিদ / বিস্তারিত ----------
if ($view === 'show') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT r.*, s.invoice_no, s.sale_date, c.name AS customer_name, u.name AS cashier_name FROM sales_returns r JOIN sales s ON r.sale_id = s.id LEFT JOIN customers c ON s.customer_id = c.id LEFT JOIN users u ON r.created_by = u.id WHERE r.id = ?");
    $stmt->execute([$id]);
    $ret = $stmt->fetch();
    if (!$ret) { flash_set('ফেরত রেকর্ডটি খুঁজে পাওয়া যায়নি।', 'danger'); redirect('sales_return.php'); }

    $stmt = $pdo->prepare("SELECT * FROM sales_return_items WHERE return_id = ?");
    $stmt->execute([$id]);
    $items = $stmt->fetchAll();

    $hideBottomNav = true; // ইনভয়েস/প্রিন্ট ভিউতে মোবাইল বটম ন্যাভিগেশন বার দেখানো হয় না
    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head no-print">
        <a href="sales_return.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> <?= e(t('back_to_list', 'তালিকায় ফিরুন')) ?></a>
        <button onclick="window.print()" class="btn btn-outline btn-sm"><i class="bi bi-printer"></i> <?= e(t('print', 'প্রিন্ট')) ?></button>
    </div>
    <div class="card" style="max-width:720px;margin:0 auto;padding:26px;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:20px;">
            <div class="brand-lockup">
                <div class="book-spine-mark"><span></span><span></span><span></span><span></span></div>
                <div class="shop-name"><?= e($settings['shop_name'] ?? '') ?>
                    <small><?= e($settings['address'] ?? '') ?><?= $settings['mobile'] ? ' · ' . e($settings['mobile']) : '' ?></small>
                </div>
            </div>
            <div style="text-align:right;font-size:13px;color:var(--text-secondary);">
                <?= e(t('return_no', 'ফেরত নং')) ?>: <strong><?= e($ret['return_no']) ?></strong><br>
                <?= e(t('date', 'তারিখ')) ?>: <?= date('d M Y, h:i A', strtotime($ret['return_date'])) ?><br>
                <?= e(t('cashier', 'ক্যাশিয়ার')) ?>: <?= e($ret['cashier_name'] ?? '—') ?>
            </div>
        </div>
        <p><strong><?= e(t('invoice', 'ইনভয়েস')) ?>:</strong> <a href="sales_list.php?view=show&id=<?= (int)$ret['sale_id'] ?>"><?= e($ret['invoice_no']) ?></a>
            &nbsp;—&nbsp; <strong><?= e(t('customer', 'কাস্টমার')) ?>:</strong> <?= e($ret['customer_name'] ?? 'ওয়াক-ইন কাস্টমার') ?></p>
        <table class="data-table">
            <thead><tr><th><?= e(t('product', 'পণ্য')) ?></th><th class="num"><?= e(t('qty', 'পরিমাণ')) ?></th><th class="num"><?= e(t('unit_price', 'একক মূল্য')) ?></th><th class="num"><?= e(t('subtotal', 'সাবটোটাল')) ?></th></tr></thead>
            <tbody>
            <?php foreach ($items as $it): ?>
                <tr>
                    <td><?= e($it['description']) ?> <?php if (!$it['restocked']): ?><span class="badge badge-info"><?= e(t('no_restock', 'স্টকে ফেরত যায়নি')) ?></span><?php endif; ?></td>
                    <td class="num"><?= (int)$it['qty'] ?></td>
                    <td class="num">৳<?= money($it['unit_price']) ?></td>
                    <td class="num">৳<?= money($it['subtotal']) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <div style="max-width:280px;margin-left:auto;margin-top:14px;">
            <div class="pos-total-line"><span><?= e(t('subtotal', 'সাবটোটাল')) ?></span><span>৳<?= money($ret['subtotal']) ?></span></div>
            <div class="pos-total-line"><span><?= e(t('discount', 'ডিসকাউন্ট')) ?></span><span>৳<?= money($ret['discount']) ?></span></div>
            <div class="pos-total-line grand"><span><?= e(t('return_total', 'ফেরতের মোট')) ?></span><span>৳<?= money($ret['return_total']) ?></span></div>
            <div class="pos-total-line"><span><?= e(t('refund_amount', 'রিফান্ড')) ?></span><span>৳<?= money($ret['refund_amount']) ?></span></div>
            <div class="pos-total-line"><span><?= e(t('credit_amount', 'বাকিতে সমন্বয়')) ?></span><span>৳<?= money($ret['credit_amount']) ?></span></div>
        </div>
        <?php if ($ret['reason']): ?><p style="margin-top:14px;font-size:13px;color:var(--text-secondary);"><?= e(t('reason', 'কারণ')) ?>: <?= e($ret['reason']) ?></p><?php endif; ?>
        <p style="text-align:center;margin-top:26px;font-size:12px;color:var(--text-secondary);"><?= e(t('return_thanks', 'ফেরত প্রক্রিয়াকরণের জন্য ধন্যবাদ!')) ?></p>
    </div>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: নির্দিষ্ট বিক্রয় থেকে ফেরত ----------
if ($view === 'new') {
    $saleId = (int)($_GET['sale_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT s.*, c.name AS customer_name, c.mobile AS customer_mobile FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ?");
    $stmt->execute([$saleId]);
    $sale = $stmt->fetch();
    if (!$sale) { flash_set('বিক্রয়টি খুঁজে পাওয়া যায়নি।', 'danger'); redirect('sales_return.php'); }

    $stmt = $pdo->prepare("SELECT * FROM sale_items WHERE sale_id = ?");
    $stmt->execute([$saleId]);
    $items = $stmt->fetchAll();

    // প্রতিটি আইটেমে আগে কত ফেরত হয়েছে
    $returnedMap = [];
    $itemIds = array_map('intval', array_column($items, 'id'));
    if ($itemIds) {
        $retStmt = $pdo->prepare("SELECT sale_item_id, COALESCE(SUM(qty),0) v FROM sales_return_items WHERE sale_item_id IN (" . implode(',', $itemIds) . ") GROUP BY sale_item_id");
        $retStmt->execute();
        foreach ($retStmt->fetchAll() as $r) { $returnedMap[(int)$r['sale_item_id']] = (int)$r['v']; }
    }



    $paymentMethods = $pdo->query("SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order")->fetchAll();
    if (empty($paymentMethods)) {
        $paymentMethods = [['method_key' => 'cash', 'method_name' => 'ক্যাশ']];
    }

    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head no-print">
        <a href="sales_return.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> <?= e(t('back_to_list', 'তালিকায় ফিরুন')) ?></a>
    </div>
    <div class="card" style="max-width:820px;margin:0 auto;padding:20px;">
        <h3 style="margin-top:0;"><?= e(t('return_for_invoice', 'ইনভয়েস থেকে ফেরত')) ?>: <?= e($sale['invoice_no']) ?></h3>
        <p style="color:var(--text-secondary);font-size:13.5px;margin-bottom:14px;">
            <?= e(t('customer', 'কাস্টমার')) ?>: <?= e($sale['customer_name'] ?? 'ওয়াক-ইন') ?>
            · <?= e(t('date', 'তারিখ')) ?>: <?= date('d M Y, h:i A', strtotime($sale['sale_date'])) ?>
            · <?= e(t('total', 'মোট')) ?>: ৳<?= money($sale['total_amount']) ?>
            · <?= e(t('paid', 'পরিশোধিত')) ?>: ৳<?= money($sale['paid_amount']) ?>
            · <?= e(t('due', 'বাকি')) ?>: ৳<?= money($sale['due_amount']) ?>
        </p>

        <form method="POST" id="returnForm">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="process_return">
            <input type="hidden" name="sale_id" value="<?= (int)$sale['id'] ?>">

            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:34px;"><input type="checkbox" id="checkAll" checked></th>
                            <th><?= e(t('product', 'পণ্য')) ?></th>
                            <th class="num"><?= e(t('sold_qty', 'বিক্রিত')) ?></th>
                            <th class="num"><?= e(t('returned_qty', 'আগে ফেরত')) ?></th>
                            <th class="num" style="width:120px;"><?= e(t('return_qty', 'ফেরত পরিমাণ')) ?></th>
                            <th class="num"><?= e(t('unit_price', 'একক মূল্য')) ?></th>
                            <th class="num"><?= e(t('subtotal', 'সাবটোটাল')) ?></th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php
                    $shownRows = 0;
                    foreach ($items as $it) {
                        $returned = $returnedMap[(int)$it['id']] ?? 0;
                        if (((int)$it['qty'] - $returned) > 0) { $shownRows++; }
                    }
                    if (empty($items)): ?>
                        <tr><td colspan="7"><div class="empty-state"><?= e(t('no_items_on_sale', 'এই ইনভয়েসে কোনো আইটেম নেই।')) ?></div></td></tr>
                    <?php elseif ($shownRows === 0): ?>
                        <tr><td colspan="7"><div class="empty-state"><?= e(t('all_items_returned', 'এই ইনভয়েসের সব পণ্য ইতোমধ্যে ফেরত দেওয়া হয়েছে।')) ?></div></td></tr>
                    <?php endif; ?>
                    <?php foreach ($items as $k => $it): ?>
                        <?php
                        $returned = $returnedMap[(int)$it['id']] ?? 0;
                        $available = (int)$it['qty'] - $returned;
                        if ($available <= 0) continue;
                        ?>


                        <tr>
                            <td><input type="checkbox" class="item-check" name="item_id[]" value="<?= (int)$it['id'] ?>" checked data-available="<?= $available ?>"></td>
                            <td><?= e($it['description']) ?> <?php if ($it['item_type'] === 'service'): ?><span class="badge badge-info"><?= e(t('service', 'সার্ভিস')) ?></span><?php endif; ?></td>
                            <td class="num"><?= (int)$it['qty'] ?></td>
                            <td class="num"><?= $returned > 0 ? $returned : '—' ?></td>
                            <td><input type="number" name="item_qty[]" class="form-control qty-return num" min="1" max="<?= $available ?>" value="<?= $available ?>" data-price="<?= (float)$it['unit_price'] ?>" data-available="<?= $available ?>"></td>
                            <td class="num">৳<?= money($it['unit_price']) ?></td>
                            <td class="num item-subtotal">৳<?= money($available * (float)$it['unit_price']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <div style="max-width:420px;margin-left:auto;margin-top:16px;">
                <div class="pos-total-line"><span><?= e(t('subtotal', 'সাবটোটাল')) ?></span><span id="rtSubtotal">৳০.০০</span></div>
                <div class="pos-total-line"><span><?= e(t('discount', 'ডিসকাউন্ট (আনুপাতিক)')) ?></span><span id="rtDiscount">৳০.০০</span></div>
                <div class="pos-total-line grand"><span><?= e(t('return_total', 'ফেরত মোট')) ?></span><span id="rtTotal">৳০.০০</span></div>

                <div class="row" style="margin-top:10px;">
                    <div class="col-6 form-group">
                        <label><?= e(t('refund_amount', 'রিফান্ড (৳)')) ?></label>
                        <input type="number" step="0.01" name="refund_amount" id="refundInput" class="form-control" value="0" oninput="recalcReturn()">
                        <div class="form-hint" id="refundMaxHint"></div>
                    </div>
                    <div class="col-6 form-group">
                        <label><?= e(t('credit_amount', 'বাকিতে সমন্বয় (৳)')) ?></label>
                        <input type="number" step="0.01" name="credit_amount" id="creditInput" class="form-control" value="0" readonly>
                    </div>
                </div>
                <div class="row">
                    <div class="col-6 form-group">
                        <label><?= e(t('refund_method', 'রিফান্ড মেথড')) ?></label>
                        <select name="refund_method" class="form-control">
                            <option value="">—</option>
                            <?php foreach ($paymentMethods as $pm): ?>
                                <option value="<?= e($pm['method_key']) ?>"><?= e($pm['method_name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-6 form-group">
                        <label><?= e(t('transaction_ref', 'ট্রানজেকশন রেফ.')) ?></label>
                        <input type="text" name="refund_ref" class="form-control" placeholder="<?= e(t('optional', 'ঐচ্ছিক')) ?>">
                    </div>
                </div>
                <div class="form-group">
                    <label><?= e(t('reason', 'কারণ')) ?></label>
                    <input type="text" name="reason" class="form-control" placeholder="<?= e(t('reason_placeholder', 'যেমন: ভুল পণ্য / ত্রুটিপূর্ণ পণ্য')) ?>">
                </div>
                <button type="submit" class="btn btn-primary btn-block"><i class="bi bi-arrow-counterclockwise"></i> <?= e(t('process_return', 'ফেরত সম্পন্ন করুন')) ?></button>
            </div>
        </form>
    </div>

    <script>
    const RT_CONFIG = {
        saleDiscount: <?= (float)$sale['discount'] ?>,
        saleSubtotal: <?= (float)$sale['subtotal'] ?>,
        salePaid: <?= (float)$sale['paid_amount'] ?>,
        saleTotal: <?= (float)$sale['total_amount'] ?>
    };
    const RT_I18N = {
        maxHint: <?= json_encode(t('refund_max_hint', 'সর্বোচ্চ রিফান্ড'), JSON_UNESCAPED_UNICODE) ?>
    };

    function calcReturnRows() {
        let subtotal = 0;
        document.querySelectorAll('#returnForm tbody tr').forEach(function (row) {
            const check = row.querySelector('.item-check');
            const qtyInput = row.querySelector('.qty-return');
            const subEl = row.querySelector('.item-subtotal');
            if (!check || !qtyInput) return;
            if (!check.checked) {
                qtyInput.disabled = true;
                if (subEl) subEl.textContent = '৳০.০০';
                return;
            }
            qtyInput.disabled = false;
            const qty = Math.max(0, parseInt(qtyInput.value) || 0);
            let max = parseInt(qtyInput.dataset.available) || 0;
            if (qty > max) qtyInput.value = max;
            const sub = Math.min(qty, max) * (parseFloat(qtyInput.dataset.price) || 0);
            if (subEl) subEl.textContent = '৳' + sub.toFixed(2);
            subtotal += sub;
        });
        return subtotal;
    }

    function recalcReturn() {
        const subtotal = calcReturnRows();
        let discount = 0;
        if (RT_CONFIG.saleSubtotal > 0) {
            discount = (RT_CONFIG.saleDiscount / RT_CONFIG.saleSubtotal) * subtotal;
        }
        const total = Math.max(0, subtotal - discount);

        document.getElementById('rtSubtotal').textContent = '৳' + subtotal.toFixed(2);
        document.getElementById('rtDiscount').textContent = '৳' + discount.toFixed(2);
        document.getElementById('rtTotal').textContent = '৳' + total.toFixed(2);

        // সর্বোচ্চ রিফান্ড = পরিশোধিত অংশের অনুপাত
        let maxRefund = 0;
        if (RT_CONFIG.saleTotal > 0) {
            maxRefund = (subtotal / RT_CONFIG.saleTotal) * RT_CONFIG.salePaid;
        }
        maxRefund = Math.round(maxRefund * 100) / 100;
        document.getElementById('refundMaxHint').textContent = RT_I18N.maxHint + ': ৳' + maxRefund.toFixed(2);

        const refundEl = document.getElementById('refundInput');
        let refund = parseFloat(refundEl.value) || 0;
        if (refund > maxRefund + 0.01) {
            refund = maxRefund;
            refundEl.value = refund.toFixed(2);
        }
        if (refund < 0) { refund = 0; refundEl.value = '0'; }
        const credit = Math.max(0, total - refund);
        document.getElementById('creditInput').value = credit.toFixed(2);
    }

    const checkAll = document.getElementById('checkAll');
    if (checkAll) {
        checkAll.addEventListener('change', function () {
            document.querySelectorAll('#returnForm .item-check').forEach(function (c) { c.checked = this.checked; }, this);
            recalcReturn();
        });
        document.querySelectorAll('#returnForm .item-check').forEach(function (c) {
            c.addEventListener('change', recalcReturn);
        });
        document.querySelectorAll('#returnForm .qty-return').forEach(function (q) {
            q.addEventListener('input', recalcReturn);
        });
        document.getElementById('refundInput').addEventListener('input', recalcReturn);
        recalcReturn();
    }


    </script>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: ফেরত তালিকা ----------
$from = $_GET['from'] ?? date('Y-m-01');
$to   = $_GET['to'] ?? date('Y-m-d');
$search = trim($_GET['q'] ?? '');

$where = ["DATE(r.return_date) BETWEEN ? AND ?"];
$params = [$from, $to];
if ($search !== '') {
    $where[] = "(r.return_no LIKE ? OR s.invoice_no LIKE ? OR EXISTS (SELECT 1 FROM sales_return_items sri WHERE sri.return_id = r.id AND sri.description LIKE ?))";
    $like = "%$search%";
    array_push($params, $like, $like, $like);
}
$whereSql = 'WHERE ' . implode(' AND ', $where);

$stmt = $pdo->prepare("SELECT r.*, s.invoice_no, c.name AS customer_name FROM sales_returns r JOIN sales s ON r.sale_id = s.id LEFT JOIN customers c ON s.customer_id = c.id $whereSql ORDER BY r.id DESC LIMIT 300");
$stmt->execute($params);
$returns = $stmt->fetchAll();

$totalsStmt = $pdo->prepare("SELECT COALESCE(SUM(r.return_total),0) t, COALESCE(SUM(r.refund_amount),0) rf FROM sales_returns r JOIN sales s ON r.sale_id = s.id $whereSql");
$totalsStmt->execute($params);
$totals = $totalsStmt->fetch();

// ---------- পণ্যের নাম দিয়ে বিক্রয় (ইনভয়েস) খুঁজে নতুন ফেরত শুরু করা ----------
// গ্রাহক রসিদ ছাড়াই ফেরত দিতে এলে, কোন ইনভয়েসে পণ্যটি বিক্রি হয়েছিল তা পণ্যের
// নাম দিয়ে খুঁজে বের করা যায় — শুধু ইনভয়েস নম্বর মনে রাখার প্রয়োজন নেই।
$findQuery = trim($_GET['pq'] ?? '');
$findResults = [];
if ($findQuery !== '') {
    $like = "%$findQuery%";
    $findStmt = $pdo->prepare("
        SELECT DISTINCT s.id, s.invoice_no, s.sale_date, c.name AS customer_name
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE si.description LIKE ? OR s.invoice_no LIKE ?
        ORDER BY s.sale_date DESC
        LIMIT 30");
    $findStmt->execute([$like, $like]);
    $findResults = $findStmt->fetchAll();
}

require_once __DIR__ . '/../includes/header.php';
?>
<div class="card" style="padding:16px;margin-bottom:16px;">
    <h3 style="margin:0 0 8px;font-size:14.5px;"><i class="bi bi-search"></i> <?= e(t('find_sale_to_return', 'পণ্যের নাম দিয়ে বিক্রয় খুঁজে ফেরত শুরু করুন')) ?></h3>
    <form method="GET" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <input type="text" name="pq" class="form-control" placeholder="<?= e(t('find_by_product_ph', 'পণ্যের নাম বা ইনভয়েস নং লিখুন...')) ?>" value="<?= e($findQuery) ?>" style="min-width:240px;flex:1;">
        <button class="btn btn-primary btn-sm"><i class="bi bi-search"></i> <?= e(t('search', 'খুঁজুন')) ?></button>
    </form>
    <?php if ($findQuery !== ''): ?>
        <div class="table-wrap" style="border:none;margin-top:10px;">
            <table class="data-table">
                <thead><tr><th><?= e(t('invoice', 'ইনভয়েস')) ?></th><th><?= e(t('customer', 'কাস্টমার')) ?></th><th><?= e(t('date', 'তারিখ')) ?></th><th></th></tr></thead>
                <tbody>
                <?php if (empty($findResults)): ?>
                    <tr><td colspan="4"><div class="empty-state"><?= e(t('no_sale_found_for_product', 'এই নামের কোনো পণ্যযুক্ত বিক্রয় পাওয়া যায়নি।')) ?></div></td></tr>
                <?php endif; ?>
                <?php foreach ($findResults as $fr): ?>
                    <tr>
                        <td><?= e($fr['invoice_no']) ?></td>
                        <td><?= e($fr['customer_name'] ?? 'ওয়াক-ইন') ?></td>
                        <td><?= date('d M Y, h:i A', strtotime($fr['sale_date'])) ?></td>
                        <td><a href="sales_return.php?sale_id=<?= (int)$fr['id'] ?>" class="btn btn-sm btn-primary"><i class="bi bi-arrow-counterclockwise"></i> <?= e(t('start_return', 'ফেরত শুরু করুন')) ?></a></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</div>

<div class="page-head">
    <form method="GET" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <input type="text" name="q" class="form-control" placeholder="<?= e(t('search_return_ph', 'ফেরত নং / ইনভয়েস / পণ্যের নাম খুঁজুন...')) ?>" value="<?= e($search) ?>" style="width:220px;">
        <input type="date" name="from" class="form-control" value="<?= e($from) ?>">
        <input type="date" name="to" class="form-control" value="<?= e($to) ?>">
        <button class="btn btn-light btn-sm"><i class="bi bi-search"></i> <?= e(t('search', 'খুঁজুন')) ?></button>
    </form>
</div>

<div class="row g-3" style="margin-bottom:16px;">
    <div class="col-6 col-md-3"><div class="stat-card c-purple sm"><div class="stat-label"><?= e(t('return_total', 'মোট ফেরত')) ?></div><div class="stat-value num">৳<?= money($totals['t']) ?></div></div></div>
    <div class="col-6 col-md-3"><div class="stat-card c-orange sm"><div class="stat-label"><?= e(t('refund_amount', 'মোট রিফান্ড')) ?></div><div class="stat-value num">৳<?= money($totals['rf']) ?></div></div></div>
    <div class="col-6 col-md-3"><div class="stat-card c-success sm"><div class="stat-label"><?= e(t('return_count', 'ফেরত সংখ্যা')) ?></div><div class="stat-value num"><?= count($returns) ?></div></div></div>
    <div class="col-6 col-md-3"><a href="sales_list.php" class="stat-card-link"><div class="stat-card c-yellow sm"><div class="stat-label"><?= e(t('go_to_sales', 'বিক্রয় তালিকা')) ?></div><div class="stat-value"><i class="bi bi-arrow-right"></i></div></div></a></div>
</div>

<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th><?= e(t('return_no', 'ফেরত নং')) ?></th><th><?= e(t('invoice', 'ইনভয়েস')) ?></th><th><?= e(t('customer', 'কাস্টমার')) ?></th><th><?= e(t('date', 'তারিখ')) ?></th><th class="num"><?= e(t('return_total', 'মোট')) ?></th><th class="num"><?= e(t('refund_amount', 'রিফান্ড')) ?></th><th></th></tr></thead>
        <tbody>
        <?php if (empty($returns)): ?>
            <tr><td colspan="7"><div class="empty-state"><i class="bi bi-arrow-counterclockwise"></i><?= e(t('no_returns', 'এই সময়ে কোনো ফেরত নেই।')) ?></div></td></tr>
        <?php endif; ?>
        <?php foreach ($returns as $r): ?>
            <tr>
                <td><a href="sales_return.php?view=show&id=<?= $r['id'] ?>"><?= e($r['return_no']) ?></a></td>
                <td><a href="sales_list.php?view=show&id=<?= $r['sale_id'] ?>"><?= e($r['invoice_no']) ?></a></td>
                <td><?= e($r['customer_name'] ?? 'ওয়াক-ইন') ?></td>
                <td><?= date('d M Y, h:i A', strtotime($r['return_date'])) ?></td>
                <td class="num">৳<?= money($r['return_total']) ?></td>
                <td class="num">৳<?= money($r['refund_amount']) ?></td>
                <td><a href="sales_return.php?view=show&id=<?= $r['id'] ?>" class="btn btn-sm btn-light"><i class="bi bi-eye"></i></a></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
