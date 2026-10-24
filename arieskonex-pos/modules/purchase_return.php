<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
require_permission('purchase'); // ক্রয় ফেরত ক্রয়-এরই অংশ, তাই একই অনুমতি ব্যবহার করা হয়েছে

$settings = shop_settings($pdo);

// ---------- POST: ফেরত সংরক্ষণ ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_purchase_return') {
    csrf_verify();

    $supplierName = trim($_POST['supplier_name'] ?? '');
    $supplierIdPosted = (int)($_POST['supplier_id'] ?? 0);
    $returnDate   = $_POST['return_date'] ?: date('Y-m-d');
    $reason       = trim($_POST['reason'] ?? '');
    $itemIds      = $_POST['item_id'] ?? [];
    $itemQty      = $_POST['item_qty'] ?? [];
    $itemCost     = $_POST['item_cost'] ?? [];

    if (empty($itemIds)) {
        flash_set(t('err_valid_item_required', 'অন্তত একটি বৈধ পণ্যের সারি দিন।'), 'danger');
        redirect('purchase_return.php?view=add');
    }

    $supplierId = null;
    if ($supplierIdPosted > 0) {
        // পিকার থেকে নির্দিষ্ট সাপ্লায়ার নির্বাচিত — সরাসরি সেই আইডি ব্যবহার (নাম দিয়ে ভুল সাপ্লায়ার মিলে যাওয়ার ঝুঁকি এড়াতে)
        $chk = $pdo->prepare("SELECT id FROM suppliers WHERE id = ? LIMIT 1");
        $chk->execute([$supplierIdPosted]);
        if ($chk->fetch()) {
            $supplierId = $supplierIdPosted;
        }
    }
    if (!$supplierId && $supplierName !== '') {
        $stmt = $pdo->prepare("SELECT id FROM suppliers WHERE name = ? LIMIT 1");
        $stmt->execute([$supplierName]);
        $existing = $stmt->fetch();
        $supplierId = $existing ? $existing['id'] : null;
    }

    // মোট কত ক্রয় হয়েছে ও ইতিমধ্যে কত ফেরত হয়েছে তা প্রতিটি পণ্যের জন্য বের করে
    // ফেরতের পরিমাণ সেই সীমার মধ্যে বেঁধে দেওয়া হয় — ক্রয়ের চেয়ে বেশি ফেরত করা যাবে না
    $purchasedQtyStmt = $pdo->prepare("SELECT COALESCE(SUM(qty),0) FROM purchase_items WHERE product_id = ?");
    $returnedQtyStmt  = $pdo->prepare("SELECT COALESCE(SUM(qty),0) FROM purchase_return_items WHERE product_id = ?");

    $total = 0;
    $items = [];
    $qtyCapped = false;
    foreach ($itemIds as $i => $pid) {
        $qty = (int)($itemQty[$i] ?? 0);
        $cost = (float)($itemCost[$i] ?? 0);
        if ($qty <= 0 || !$pid) continue;
        $pid = (int)$pid;

        $purchasedQtyStmt->execute([$pid]);
        $purchasedQty = (int)$purchasedQtyStmt->fetchColumn();
        $returnedQtyStmt->execute([$pid]);
        $alreadyReturnedQty = (int)$returnedQtyStmt->fetchColumn();
        $maxReturnable = $purchasedQty - $alreadyReturnedQty;

        if ($qty > $maxReturnable) {
            $qty = max(0, $maxReturnable);
            $qtyCapped = true;
        }
        if ($qty <= 0) continue;

        $subtotal = $qty * $cost;
        $total += $subtotal;
        $items[] = ['product_id' => $pid, 'qty' => $qty, 'unit_cost' => $cost, 'subtotal' => $subtotal];
    }
    if ($qtyCapped) {
        flash_set(t('err_return_exceeds_purchase', 'ক্রয়কৃত পরিমাণের বেশি ফেরত দেওয়া যায় না — কিছু পণ্যের পরিমাণ সর্বোচ্চ সীমায় সমন্বয় করা হয়েছে।'), 'warning');
    }
    if (empty($items)) {
        flash_set(t('err_valid_item_required', 'অন্তত একটি বৈধ পণ্যের সারি দিন।'), 'danger');
        redirect('purchase_return.php?view=add');
    }

    try {
        // ইউনিক ফেরত নং
        $attempt = 0;
        do {
            $cnt = (int)$pdo->query("SELECT COUNT(*) FROM purchase_returns WHERE DATE(return_date) = CURDATE()")->fetchColumn();
            $returnNo = 'PRTN-' . date('Ymd') . '-' . str_pad((string)($cnt + 1 + $attempt), 4, '0', STR_PAD_LEFT);
            $chk = $pdo->prepare("SELECT COUNT(*) FROM purchase_returns WHERE return_no = ?");
            $chk->execute([$returnNo]);
            $attempt++;
        } while ((int)$chk->fetchColumn() > 0 && $attempt < 20);

        $pdo->beginTransaction();

        $insRet = $pdo->prepare("INSERT INTO purchase_returns (supplier_id, return_no, return_date, total_amount, reason, created_by) VALUES (?,?,?,?,?,?)");
        $insRet->execute([$supplierId, $returnNo, $returnDate, $total, $reason ?: null, current_user()['id'] ?? null]);
        $returnId = $pdo->lastInsertId();

        $insItem = $pdo->prepare("INSERT INTO purchase_return_items (return_id, product_id, description, qty, unit_cost, subtotal) VALUES (?,?,?,?,?,?)");
        $stmtStock = $pdo->prepare("UPDATE products SET stock_qty = GREATEST(0, stock_qty - ?) WHERE id = ?");
        $nameStmt = $pdo->prepare("SELECT name FROM products WHERE id = ?");

        foreach ($items as $it) {
            $nameStmt->execute([$it['product_id']]);
            $pname = $nameStmt->fetchColumn() ?: '';
            $insItem->execute([$returnId, $it['product_id'], $pname, $it['qty'], $it['unit_cost'], $it['subtotal']]);
            // ফেরতকৃত পণ্য দোকান থেকে সরবরাহকারীর কাছে ফিরে যাচ্ছে — স্টক থেকে বাদ
            $stmtStock->execute([$it['qty'], $it['product_id']]);
        }

        // --- সরবরাহকারীর বকেয়ার সাথে ক্রেডিট সমন্বয় (আগে opening balance, তারপর পুরনো ক্রয় থেকে) ---
        if ($supplierId && $total > 0) {
            $remaining = $total;
            $obStmt = $pdo->prepare("SELECT opening_balance FROM suppliers WHERE id = ?");
            $obStmt->execute([$supplierId]);
            $openingBalance = (float)$obStmt->fetchColumn();
            if ($openingBalance > 0 && $remaining > 0) {
                $applyToOpening = min($remaining, $openingBalance);
                $obUpd = $pdo->prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?");
                $obUpd->execute([$applyToOpening, $supplierId]);
                $remaining -= $applyToOpening;
            }
            $duePurchases = $pdo->prepare("SELECT id, due_amount FROM purchases WHERE supplier_id = ? AND due_amount > 0 ORDER BY id ASC");
            $duePurchases->execute([$supplierId]);
            foreach ($duePurchases->fetchAll() as $dp) {
                if ($remaining <= 0) break;
                $apply = min($remaining, (float)$dp['due_amount']);
                // টাকা পরিশোধ হয়নি, শুধু বাকি ও মোট কমছে (ক্রেডিট নোট) — তাই paid_amount অপরিবর্তিত থাকে
                $upd = $pdo->prepare("UPDATE purchases SET due_amount = due_amount - ?, total_amount = total_amount - ? WHERE id = ?");
                $upd->execute([$apply, $apply, $dp['id']]);
                $remaining -= $apply;
            }
            // কোনো বকেয়া বাকি নেই অথচ ফেরতের ক্রেডিট এখনও অবশিষ্ট — অর্থাৎ সরবরাহকারীর কাছ থেকে
            // এখন এই পরিমাণ টাকা প্রাপ্য (রিসিভেবল)। opening_balance ঋণাত্মক করে সেটি ধরে রাখা হয়,
            // যাতে সাপ্লায়ার লেজারে এটি "প্রাপ্য" হিসেবে দেখানো যায় এবং হারিয়ে না যায়।
            if ($remaining > 0) {
                $obUpd2 = $pdo->prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?");
                $obUpd2->execute([$remaining, $supplierId]);
                $remaining = 0;
            }
        }

        $pdo->commit();
        log_activity($pdo, t('log_purchase_return', 'ক্রয় ফেরত') . ' ' . $returnNo . ' — ৳' . money($total));
        flash_set(t('purchase_return_saved', 'ক্রয় ফেরত সফলভাবে সংরক্ষিত হয়েছে। ফেরত নং:') . ' ' . $returnNo);
        redirect('purchase_return.php?view=show&id=' . $returnId);
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        flash_set(t('purchase_return_save_failed', 'ক্রয় ফেরত সংরক্ষণ ব্যর্থ হয়েছে:') . ' ' . $ex->getMessage(), 'danger');
        redirect('purchase_return.php?view=add');
    }
}

$view = $_GET['view'] ?? 'list';
$pageTitle = t('nav_purchase_return', 'ক্রয় ফেরত');
$activeNav = 'purchase_return';

// ---------- ভিউ: নতুন ফেরত ফর্ম ----------
if ($view === 'add') {
    $products = $pdo->query("
        SELECT p.id, p.item_code, p.name, p.unit, p.cost_price, p.barcode, p.stock_qty, co.name AS company_name,
               GREATEST(0, COALESCE((SELECT SUM(qty) FROM purchase_items WHERE product_id = p.id), 0)
                          - COALESCE((SELECT SUM(qty) FROM purchase_return_items WHERE product_id = p.id), 0)) AS returnable_qty
        FROM products p LEFT JOIN companies co ON p.company_id = co.id WHERE p.status='active' ORDER BY p.name LIMIT 3000")->fetchAll();
    $suppliers = $pdo->query("SELECT id, name, mobile, company FROM suppliers ORDER BY name")->fetchAll();
    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head">
        <a href="purchase_return.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> <?= e(t('back_to_list', 'তালিকায় ফিরুন')) ?></a>
    </div>
    <form method="POST" class="card" style="padding:20px;">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_purchase_return">
        <div class="row">
            <div class="col-md-4 form-group" style="position:relative;">
                <label><?= e(t('supplier_name', 'সাপ্লায়ারের নাম')) ?> <small style="color:var(--text-secondary);font-weight:400;">(<?= e(t('optional', 'ঐচ্ছিক')) ?>)</small></label>
                <input type="text" name="supplier_name" id="supplierSearch" class="form-control" autocomplete="off" placeholder="<?= e(t('supplier_search_ph', 'নাম বা মোবাইল দিয়ে খুঁজুন...')) ?>">
                <input type="hidden" name="supplier_id" id="supplierId">
                <div id="supplierResults" class="search-results-box"></div>
            </div>
            <div class="col-md-2 form-group">
                <label><?= e(t('supplier_mobile', 'সাপ্লায়ারের মোবাইল')) ?></label>
                <input type="text" id="supplierMobile" class="form-control" readonly>
            </div>
            <div class="col-md-3 form-group">
                <label><?= e(t('company', 'কোম্পানি')) ?></label>
                <input type="text" id="supplierCompany" class="form-control" readonly>
            </div>
            <div class="col-md-3 form-group">
                <label><?= e(t('return_date', 'ফেরতের তারিখ')) ?></label>
                <input type="date" name="return_date" class="form-control" value="<?= date('Y-m-d') ?>">
            </div>
        </div>
        <div class="row">
            <div class="col-md-12 form-group">
                <label><?= e(t('reason', 'কারণ')) ?></label>
                <input type="text" name="reason" class="form-control" placeholder="<?= e(t('reason_placeholder', 'যেমন: ত্রুটিপূর্ণ পণ্য')) ?>">
            </div>
        </div>

        <label><?= e(t('items', 'পণ্যসমূহ')) ?></label>
        <input type="text" id="prodSearch" class="form-control" placeholder="<?= e(t('scan_or_search_ph', '🔍 বারকোড স্ক্যান করুন অথবা পণ্যের নাম লিখে খুঁজুন...')) ?>" style="margin-bottom:8px;font-size:16px;" autocomplete="off" lang="en" autocapitalize="off" autocorrect="off" spellcheck="false">
        <div id="searchResults" class="search-results-box"></div>
        <div id="itemRows"></div>
        <button type="button" class="btn btn-light btn-sm" onclick="addRow()"><i class="bi bi-plus"></i> <?= e(t('add_empty_row', 'খালি সারি যুক্ত করুন')) ?></button>

        <div class="row" style="margin-top:18px;">
            <div class="col-md-4 form-group">
                <label><?= e(t('total_auto', 'মোট (স্বয়ংক্রিয়)')) ?></label>
                <input type="text" id="grandTotalDisplay" class="form-control" readonly value="৳ ০.০০">
            </div>
        </div>
        <p style="font-size:12.5px;color:var(--text-secondary);"><?= e(t('purchase_return_hint', 'ফেরতের পরিমাণ সরবরাহকারীর বকেয়া থেকে স্বয়ংক্রিয়ভাবে সমন্বয় হবে এবং পণ্যের স্টক থেকে বাদ যাবে।')) ?></p>
        <button type="submit" class="btn btn-primary"><?= e(t('save_purchase_return', 'ফেরত সংরক্ষণ করুন')) ?></button>
    </form>

    <template id="rowTemplate">
        <div class="row g-2 item-row" style="margin-bottom:8px;align-items:center;">
            <div class="col-md-5">
                <div class="row-prod-name" style="font-weight:600;font-size:13.5px;padding:7px 0;"></div>
                <div class="row-prod-limit" style="font-size:11.5px;color:var(--text-secondary);"></div>
                <input type="hidden" name="item_id[]" class="prod-id">
                <input type="hidden" class="prod-max">
            </div>
            <div class="col-md-2"><input type="number" name="item_qty[]" class="form-control item-qty" placeholder="<?= e(t('qty', 'পরিমাণ')) ?>" value="1" min="1" oninput="calcTotal()"></div>
            <div class="col-md-2"><input type="number" step="0.01" name="item_cost[]" class="form-control item-cost" placeholder="<?= e(t('unit_price', 'একক মূল্য')) ?>" oninput="calcTotal()"></div>
            <div class="col-md-2 num item-subtotal">৳ ০.০০</div>
            <div class="col-md-1"><button type="button" class="btn btn-sm btn-light" onclick="this.closest('.item-row').remove(); calcTotal();"><i class="bi bi-trash"></i></button></div>
        </div>
    </template>

    <script>
    const PRODUCTS = <?= json_encode($products, JSON_UNESCAPED_UNICODE) ?>;
    const SUPPLIERS = <?= json_encode($suppliers, JSON_UNESCAPED_UNICODE) ?>;
    const I18N = {
        noProductSelected: <?= json_encode(t('no_product_selected', '— পণ্য নির্বাচন করা হয়নি —'), JSON_UNESCAPED_UNICODE) ?>,
        noProductFound: <?= json_encode(t('no_product_found_hint', 'কোনো পণ্য পাওয়া যায়নি।'), JSON_UNESCAPED_UNICODE) ?>,
        stockLabel: <?= json_encode(t('stock_label', 'স্টক'), JSON_UNESCAPED_UNICODE) ?>,
        noSupplierFound: <?= json_encode(t('no_supplier_found_hint', 'কোনো সাপ্লায়ার পাওয়া যায়নি — নতুন হলে শুধু নাম লিখে রাখুন।'), JSON_UNESCAPED_UNICODE) ?>,
        returnableLabel: <?= json_encode(t('returnable_label', 'ফেরতযোগ্য'), JSON_UNESCAPED_UNICODE) ?>,
        returnableZero: <?= json_encode(t('returnable_zero', 'এই পণ্যের ফেরতযোগ্য পরিমাণ শেষ — আগে যা ক্রয় হয়েছে তার সবটাই ফেরত দেওয়া হয়ে গেছে।'), JSON_UNESCAPED_UNICODE) ?>
    };

    function renderSupplierResults(query) {
        const box = document.getElementById('supplierResults');
        const q = toEnglishDigits(query.trim().toLowerCase());
        if (!q) { box.innerHTML = ''; box.style.display = 'none'; return; }
        const matches = SUPPLIERS.filter(s => s.name.toLowerCase().includes(q) || (s.mobile && s.mobile.includes(q))).slice(0, 10);
        if (matches.length === 0) {
            box.innerHTML = '<div class="search-result-empty">' + I18N.noSupplierFound + '</div>';
            box.style.display = 'block';
            return;
        }
        box.innerHTML = matches.map(s => `
            <div class="search-result-item" data-id="${s.id}">
                <span>${s.name}</span>
                <span style="color:var(--text-secondary);font-size:12px;">${s.mobile || ''}${s.mobile && s.company ? ' · ' : ''}${s.company || ''}</span>
            </div>`).join('');
        box.style.display = 'block';
        box.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', function () {
                const s = SUPPLIERS.find(x => x.id == this.dataset.id);
                document.getElementById('supplierSearch').value = s.name;
                document.getElementById('supplierId').value = s.id;
                document.getElementById('supplierMobile').value = s.mobile || '';
                document.getElementById('supplierCompany').value = s.company || '';
                box.innerHTML = ''; box.style.display = 'none';
            });
        });
    }
    hardenScanInput(document.getElementById('supplierSearch'));
    document.getElementById('supplierSearch').addEventListener('input', function () {
        // নাম হাতে বদলালে আগের নির্বাচিত সাপ্লায়ারের সাথে বাঁধন বাতিল — নতুন করে বেছে নিতে হবে
        document.getElementById('supplierId').value = '';
        document.getElementById('supplierMobile').value = '';
        document.getElementById('supplierCompany').value = '';
        renderSupplierResults(this.value);
    });
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#supplierResults') && e.target.id !== 'supplierSearch') {
            document.getElementById('supplierResults').style.display = 'none';
        }
    });

    function addRow(product) {
        const tpl = document.getElementById('rowTemplate').content.cloneNode(true);
        const row = tpl.querySelector('.item-row');
        if (product) {
            row.querySelector('.row-prod-name').textContent = product.name + (product.barcode ? ' (' + product.barcode + ')' : '');
            row.querySelector('.prod-id').value = product.id;
            row.querySelector('.item-cost').value = product.cost_price;
            const maxQty = Number(product.returnable_qty) || 0;
            row.querySelector('.prod-max').value = maxQty;
            const qtyInput = row.querySelector('.item-qty');
            qtyInput.max = maxQty;
            if (maxQty <= 0) {
                qtyInput.value = 0;
                row.querySelector('.row-prod-limit').innerHTML = '<span style="color:var(--danger);">' + I18N.returnableZero + '</span>';
            } else {
                if (Number(qtyInput.value) > maxQty) qtyInput.value = maxQty;
                row.querySelector('.row-prod-limit').textContent = I18N.returnableLabel + ': ' + maxQty;
            }
            qtyInput.addEventListener('change', function () {
                const m = Number(row.querySelector('.prod-max').value) || 0;
                if (Number(this.value) > m) this.value = m;
                calcTotal();
            });
        } else {
            row.querySelector('.row-prod-name').innerHTML = '<span style="color:var(--text-secondary);font-weight:400;">' + I18N.noProductSelected + '</span>';
        }
        document.getElementById('itemRows').appendChild(tpl);
        calcTotal();
    }

    function renderSearchResults(query) {
        const box = document.getElementById('searchResults');
        const q = query.trim().toLowerCase();
        if (!q) { box.innerHTML = ''; box.style.display = 'none'; return; }
        const matches = PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q)) || (p.item_code && p.item_code.toLowerCase().includes(q))).slice(0, 12);
        if (matches.length === 0) {
            box.innerHTML = '<div class="search-result-empty">' + I18N.noProductFound + '</div>';
            box.style.display = 'block';
            return;
        }
        box.innerHTML = matches.map(p => `
            <div class="search-result-item" data-id="${p.id}">
                <span>${escHtml(p.name)}</span>
                <span style="color:var(--text-secondary);font-size:12px;">${escHtml(p.company_name || '')}${p.company_name ? ' · ' : ''}${escHtml(p.barcode || '')} · ${I18N.stockLabel} ${p.stock_qty} · ${I18N.returnableLabel} ${p.returnable_qty}</span>
            </div>`).join('');
        box.style.display = 'block';
        box.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', function () {
                const p = PRODUCTS.find(x => x.id == this.dataset.id);
                addRow(p);
                document.getElementById('prodSearch').value = '';
                box.innerHTML = ''; box.style.display = 'none';
                document.getElementById('prodSearch').focus();
            });
        });
    }

    hardenScanInput(document.getElementById('prodSearch'));
    document.getElementById('prodSearch').addEventListener('input', function () { renderSearchResults(this.value); });
    document.getElementById('prodSearch').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            // বারকোড বা আইটেম কোড (বড়/ছোট হাতের অক্ষর নির্বিশেষে) মিলিয়ে দেখা হয়
            const code = toEnglishDigits(this.value.trim()).toLowerCase();
            if (!code) return;
            const match = PRODUCTS.find(p => (p.barcode && String(p.barcode).toLowerCase() === code) || (p.item_code && String(p.item_code).toLowerCase() === code));
            if (match) {
                // একই পণ্য আবার স্ক্যান করলে নতুন সারি নয় — আগের সারির পরিমাণ ১ বাড়ে
                const existingRow = Array.from(document.querySelectorAll('#itemRows .item-row')).find(r => r.querySelector('.prod-id') && r.querySelector('.prod-id').value == match.id);
                if (existingRow) {
                    const qi = existingRow.querySelector('.item-qty');
                    const max = qi.max !== '' ? Number(qi.max) : Infinity;
                    qi.value = Math.min(max, (Number(qi.value) || 0) + 1);
                    qi.dispatchEvent(new Event('change'));
                    calcTotal();
                } else {
                    addRow(match);
                }
                appToast(match.name + ' ✓', 'success');
                this.value = '';
                document.getElementById('searchResults').innerHTML = '';
                document.getElementById('searchResults').style.display = 'none';
            } else if (document.getElementById('searchResults').querySelectorAll('.search-result-item').length === 0) {
                appToast('এই বারকোড/কোডের কোনো পণ্য পাওয়া যায়নি: ' + this.value.trim(), 'danger');
                this.select(); // পরের স্ক্যান যেন পুরোনো লেখার সাথে জুড়ে না যায় — সেটিকে প্রতিস্থাপন করবে
            }
        }
    });
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#searchResults') && e.target.id !== 'prodSearch') {
            document.getElementById('searchResults').style.display = 'none';
        }
    });

    function calcTotal() {
        let grand = 0;
        document.querySelectorAll('.item-row').forEach(row => {
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const cost = parseFloat(row.querySelector('.item-cost').value) || 0;
            const sub = qty * cost;
            row.querySelector('.item-subtotal').textContent = '৳ ' + bdMoney(sub);
            grand += sub;
        });
        document.getElementById('grandTotalDisplay').value = '৳ ' + bdMoney(grand);
    }
    </script>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: ফেরতের বিস্তারিত ----------
if ($view === 'show') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT r.*, s.name AS supplier_name, s.mobile AS supplier_mobile FROM purchase_returns r LEFT JOIN suppliers s ON r.supplier_id = s.id WHERE r.id = ?");
    $stmt->execute([$id]);
    $return = $stmt->fetch();
    if (!$return) { flash_set(t('return_not_found', 'ফেরতটি খুঁজে পাওয়া যায়নি।'), 'danger'); redirect('purchase_return.php'); }
    $stmt = $pdo->prepare("SELECT ri.*, p.unit FROM purchase_return_items ri LEFT JOIN products p ON ri.product_id = p.id WHERE ri.return_id = ?");
    $stmt->execute([$id]);
    $items = $stmt->fetchAll();

    $hideBottomNav = true; // ইনভয়েস/প্রিন্ট ভিউতে মোবাইল বটম ন্যাভিগেশন বার দেখানো হয় না
    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head no-print">
        <a href="purchase_return.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> <?= e(t('back_to_list', 'তালিকায় ফিরুন')) ?></a>
        <button onclick="window.print()" class="btn btn-outline btn-sm"><i class="bi bi-printer"></i> <?= e(t('print', 'প্রিন্ট')) ?></button>
    </div>
    <div class="card" style="max-width:720px;margin:0 auto;padding:26px;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:20px;">
            <div class="brand-lockup"><div class="book-spine-mark"><span></span><span></span><span></span><span></span></div>
                <div class="shop-name"><?= e($settings['shop_name'] ?? '') ?></div></div>
            <div style="text-align:right;font-size:13px;color:var(--text-secondary);">
                <?= e(t('return_no', 'ফেরত নং')) ?>: <strong><?= e($return['return_no']) ?></strong><br><?= e(t('date', 'তারিখ')) ?>: <?= date('d M Y', strtotime($return['return_date'])) ?>
            </div>
        </div>
        <p><strong><?= e(t('supplier', 'সাপ্লায়ার')) ?>:</strong> <?= e($return['supplier_name'] ?? t('walk_in_generic', 'নির্দিষ্ট নয়')) ?> <?= $return['supplier_mobile'] ? '('.e($return['supplier_mobile']).')' : '' ?></p>
        <table class="data-table">
            <thead><tr><th><?= e(t('product', 'পণ্য')) ?></th><th class="num"><?= e(t('qty', 'পরিমাণ')) ?></th><th class="num"><?= e(t('unit_price', 'একক মূল্য')) ?></th><th class="num"><?= e(t('subtotal', 'সাবটোটাল')) ?></th></tr></thead>
            <tbody>
            <?php foreach ($items as $it): ?>
                <tr><td><?= e($it['description']) ?></td><td class="num"><?= (int)$it['qty'] ?> <?= e($it['unit']) ?></td><td class="num">৳<?= money($it['unit_cost']) ?></td><td class="num">৳<?= money($it['subtotal']) ?></td></tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <div style="max-width:280px;margin-left:auto;margin-top:14px;">
            <div class="pos-total-line grand"><span><?= e(t('total', 'মোট')) ?></span><span>৳<?= money($return['total_amount']) ?></span></div>
        </div>
        <?php if ($return['reason']): ?><p style="margin-top:14px;font-size:13px;color:var(--text-secondary);"><?= e(t('reason', 'কারণ')) ?>: <?= e($return['reason']) ?></p><?php endif; ?>
    </div>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: ফেরত তালিকা ----------
$stmt = $pdo->query("SELECT r.*, s.name AS supplier_name FROM purchase_returns r LEFT JOIN suppliers s ON r.supplier_id = s.id ORDER BY r.id DESC LIMIT 200");
$returns = $stmt->fetchAll();
require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <div></div>
    <a href="purchase_return.php?view=add" class="btn btn-primary"><i class="bi bi-plus-lg"></i> <?= e(t('new_purchase_return', 'নতুন ক্রয় ফেরত')) ?></a>
</div>
<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th><?= e(t('return_no', 'ফেরত নং')) ?></th><th><?= e(t('supplier', 'সাপ্লায়ার')) ?></th><th><?= e(t('date', 'তারিখ')) ?></th><th class="num"><?= e(t('total', 'মোট')) ?></th><th></th></tr></thead>
        <tbody>
        <?php if (empty($returns)): ?>
            <tr><td colspan="5"><div class="empty-state"><i class="bi bi-arrow-counterclockwise"></i><?= e(t('no_purchase_returns', 'এখনো কোনো ক্রয় ফেরত নথিভুক্ত হয়নি।')) ?></div></td></tr>
        <?php endif; ?>
        <?php foreach ($returns as $r): ?>
            <tr>
                <td><a href="purchase_return.php?view=show&id=<?= $r['id'] ?>"><?= e($r['return_no']) ?></a></td>
                <td><?= e($r['supplier_name'] ?? t('walk_in_generic', 'নির্দিষ্ট নয়')) ?></td>
                <td><?= date('d M Y', strtotime($r['return_date'])) ?></td>
                <td class="num">৳<?= money($r['total_amount']) ?></td>
                <td><a href="purchase_return.php?view=show&id=<?= $r['id'] ?>" class="btn btn-sm btn-light"><i class="bi bi-eye"></i></a></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
