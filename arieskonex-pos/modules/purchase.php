<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
require_permission('purchase');

$settings = shop_settings($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'create_product_from_purchase') {
    csrf_verify();

    $productName = trim($_POST['product_name'] ?? '');
    $productBarcode = trim($_POST['product_barcode'] ?? '');
    $productCategoryId = $_POST['product_category_id'] ?: null;
    $productCompanyId = $_POST['product_company_id'] ?: null;
    $productUnit = trim($_POST['product_unit'] ?? '') ?: t('unit_piece', 'পিস');
    $productCostPrice = (float)($_POST['product_cost_price'] ?? 0);
    $productSalePrice = (float)($_POST['product_sale_price'] ?? 0);
    $productWholesalePrice = (float)($_POST['product_wholesale_price'] ?? 0);
    $productStockQty = (int)($_POST['product_stock_qty'] ?? 0);
    $productLowStockThreshold = (int)($_POST['product_low_stock_threshold'] ?: 5);

    if ($productName === '') {
        flash_set(t('err_product_name_required', 'পণ্যের নাম আবশ্যক।'), 'danger');
        redirect('purchase.php?view=add');
    }

    try {
        // মালিক ছাড়া অন্য কেউ (ক্রয়ের অনুমতিপ্রাপ্ত সেলসম্যান) নতুন পণ্য যুক্ত করলে
        // মালিকের অনুমোদনের আগ পর্যন্ত সেটি অনুমোদনের অপেক্ষায় থাকবে
        $status = is_owner() ? 'active' : 'pending';
        $createdBy = is_owner() ? null : (current_user()['id'] ?? null);
        $stmt = $pdo->prepare("INSERT INTO products (category_id, company_id, name, barcode, unit, cost_price, sale_price, wholesale_price, stock_qty, low_stock_threshold, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$productCategoryId, $productCompanyId, $productName, $productBarcode ?: null, $productUnit, $productCostPrice, $productSalePrice, $productWholesalePrice, $productStockQty, $productLowStockThreshold, $status, $createdBy]);
        if ($status === 'pending') {
            flash_set(t('product_pending_approval', 'পণ্যটি যুক্ত হয়েছে, তবে মালিকের অনুমোদনের আগে বিক্রয়ে দেখাবে না।'));
        } else {
            flash_set(t('product_added', 'নতুন পণ্য যুক্ত হয়েছে।'));
        }
    } catch (Throwable $ex) {
        flash_set(t('product_save_failed', 'পণ্য যুক্ত করা যায়নি — বারকোড বা নাম দ্বিগুণ হতে পারে।'), 'danger');
    }
    redirect('purchase.php?view=add');
}

// ---------- POST: নতুন ক্রয় সংরক্ষণ ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_purchase') {
    csrf_verify();

    $supplierName = trim($_POST['supplier_name'] ?? '');
    $supplierMobile = trim($_POST['supplier_mobile'] ?? '');
    $supplierCompany = trim($_POST['supplier_company'] ?? '');
    $supplierIdPosted = (int)($_POST['supplier_id'] ?? 0);
    $purchaseDate = $_POST['purchase_date'] ?: date('Y-m-d');
    $paidAmount = max(0, (float)($_POST['paid_amount'] ?? 0)); // ঋণাত্মক মান দিয়ে ভুলবশত বাকি/হিসাব বিগড়ে যাওয়া ঠেকাতে
    $note = trim($_POST['note'] ?? '');
    $itemIds = $_POST['item_id'] ?? [];
    $itemQty = $_POST['item_qty'] ?? [];
    $itemCost = $_POST['item_cost'] ?? [];

    if ($supplierName === '' || empty($itemIds)) {
        flash_set(t('err_supplier_and_item_required', 'সাপ্লায়ারের নাম ও অন্তত একটি পণ্য আবশ্যক।'), 'danger');
        redirect('purchase.php?view=add');
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
    if (!$supplierId) {
        $stmt = $pdo->prepare("SELECT id FROM suppliers WHERE name = ? LIMIT 1");
        $stmt->execute([$supplierName]);
        $existing = $stmt->fetch();
        if ($existing) {
            $supplierId = $existing['id'];
        }
    }
    if ($supplierId) {
        // বিদ্যমান সাপ্লায়ার — কোম্পানি/মোবাইল হালনাগাদ থাকলে সংরক্ষণ করি (ফাঁকা দিয়ে পুরনো তথ্য মুছে ফেলা হয় না)
        if ($supplierCompany !== '' || $supplierMobile !== '') {
            $stmt = $pdo->prepare("UPDATE suppliers SET company = COALESCE(NULLIF(?, ''), company), mobile = COALESCE(NULLIF(?, ''), mobile) WHERE id = ?");
            $stmt->execute([$supplierCompany, $supplierMobile, $supplierId]);
        }
    } else {
        $stmt = $pdo->prepare("INSERT INTO suppliers (name, mobile, company) VALUES (?, ?, ?)");
        $stmt->execute([$supplierName, $supplierMobile, $supplierCompany]);
        $supplierId = $pdo->lastInsertId();
    }

    $total = 0;
    $items = [];
    foreach ($itemIds as $i => $pid) {
        $qty = (int)$itemQty[$i];
        $cost = (float)$itemCost[$i];
        if ($qty <= 0 || !$pid) continue;
        $subtotal = $qty * $cost;
        $total += $subtotal;
        $items[] = ['product_id' => (int)$pid, 'qty' => $qty, 'unit_cost' => $cost, 'subtotal' => $subtotal];
    }
    if (empty($items)) {
        flash_set(t('err_valid_item_required', 'অন্তত একটি বৈধ পণ্যের সারি দিন।'), 'danger');
        redirect('purchase.php?view=add');
    }

    $due = max(0, $total - $paidAmount);

    try {
        $invoiceNo = generate_invoice_no($pdo, 'purchases', ($settings['purchase_prefix'] ?? 'PUR'));

        $pdo->beginTransaction();
        $stmt = $pdo->prepare("INSERT INTO purchases (supplier_id, invoice_no, purchase_date, total_amount, paid_amount, due_amount, note, created_by) VALUES (?,?,?,?,?,?,?,?)");
        $stmt->execute([$supplierId, $invoiceNo, $purchaseDate, $total, $paidAmount, $due, $note, current_user()['id'] ?? null]);
        $purchaseId = $pdo->lastInsertId();

        $stmtItem = $pdo->prepare("INSERT INTO purchase_items (purchase_id, product_id, qty, unit_cost, subtotal) VALUES (?,?,?,?,?)");
        $stmtStock = $pdo->prepare("UPDATE products SET stock_qty = stock_qty + ?, cost_price = ? WHERE id = ?");
        foreach ($items as $it) {
            $stmtItem->execute([$purchaseId, $it['product_id'], $it['qty'], $it['unit_cost'], $it['subtotal']]);
            $stmtStock->execute([$it['qty'], $it['unit_cost'], $it['product_id']]);
        }

        // সাপ্লায়ারকে টোটালের চেয়ে বেশি টাকা দিলে অতিরিক্ত অংশ হারিয়ে না গিয়ে
        // সাপ্লায়ার লেজারে জমা হয় — আগে অন্য কোনো বাকি ক্রয় থাকলে তা সমন্বয়,
        // তারপরও কিছু থেকে গেলে সেটি সাপ্লায়ারের কাছে প্রাপ্য (দোকানদার পাবে) হিসেবে থাকে।
        $overpaid = max(0, $paidAmount - $total);
        if ($overpaid > 0) {
            $remaining = $overpaid;

            $obStmt = $pdo->prepare("SELECT opening_balance FROM suppliers WHERE id = ?");
            $obStmt->execute([$supplierId]);
            $openingBalance = (float)$obStmt->fetchColumn();
            if ($openingBalance > 0) {
                $applyToOpening = min($remaining, $openingBalance);
                $pdo->prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?")->execute([$applyToOpening, $supplierId]);
                $remaining -= $applyToOpening;
            }

            if ($remaining > 0) {
                $duePurchases = $pdo->prepare("SELECT id, due_amount FROM purchases WHERE supplier_id = ? AND id != ? AND due_amount > 0 ORDER BY id ASC");
                $duePurchases->execute([$supplierId, $purchaseId]);
                foreach ($duePurchases->fetchAll() as $dp) {
                    if ($remaining <= 0) break;
                    $pay = min($remaining, $dp['due_amount']);
                    $pdo->prepare("UPDATE purchases SET due_amount = due_amount - ?, paid_amount = paid_amount + ? WHERE id = ?")->execute([$pay, $pay, $dp['id']]);
                    $remaining -= $pay;
                }
            }

            if ($remaining > 0) {
                $pdo->prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?")->execute([$remaining, $supplierId]);
            }

            $pdo->prepare("INSERT INTO supplier_payments (supplier_id, amount, type, payment_date, note, created_by) VALUES (?,?,?,?,?,?)")
                ->execute([$supplierId, $overpaid, 'payment', date('Y-m-d'), 'অতিরিক্ত পরিশোধ — ' . $invoiceNo, current_user()['id'] ?? null]);
        }

        $pdo->commit();
        log_activity($pdo, t('log_new_purchase', 'নতুন ক্রয়') . ' ' . $invoiceNo . ' — ৳' . money($total));
        flash_set(t('purchase_saved', 'ক্রয় সফলভাবে সংরক্ষিত হয়েছে। ইনভয়েস:') . ' ' . $invoiceNo);
        redirect('purchase.php?view=show&id=' . $purchaseId);
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        flash_set(t('purchase_save_failed', 'ক্রয় সংরক্ষণ ব্যর্থ হয়েছে:') . ' ' . $ex->getMessage(), 'danger');
        redirect('purchase.php?view=add');
    }
}

$view = $_GET['view'] ?? 'list';
$pageTitle = t('nav_purchase');
$activeNav = 'purchase';

// ---------- ভিউ: নতুন ক্রয় ফর্ম ----------
if ($view === 'add') {
    $products = $pdo->query("SELECT p.id, p.item_code, p.name, p.unit, p.cost_price, p.barcode, p.stock_qty, co.name AS company_name FROM products p LEFT JOIN companies co ON p.company_id = co.id WHERE p.status='active' ORDER BY p.name LIMIT 3000")->fetchAll();
    $suppliers = $pdo->query("SELECT id, name, mobile, company FROM suppliers ORDER BY name")->fetchAll();
    $companies = $pdo->query("SELECT * FROM companies ORDER BY name")->fetchAll();
    $categories = $pdo->query("SELECT * FROM categories ORDER BY name")->fetchAll();
    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head">
        <a href="purchase.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> <?= e(t('back_to_list', 'তালিকায় ফিরুন')) ?></a>
    </div>
    <form method="POST" class="card" style="padding:20px;">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_purchase">
        <div class="row">
            <div class="col-md-5 form-group" style="position:relative;">
                <label><?= e(t('supplier_name', 'সাপ্লায়ারের নাম')) ?></label>
                <input type="text" name="supplier_name" id="supplierSearch" class="form-control" autocomplete="off" placeholder="<?= e(t('supplier_search_ph', 'নাম বা মোবাইল দিয়ে খুঁজুন, অথবা নতুন নাম লিখুন...')) ?>" required>
                <input type="hidden" name="supplier_id" id="supplierId">
                <div id="supplierResults" class="search-results-box"></div>
            </div>
            <div class="col-md-2 form-group">
                <label><?= e(t('supplier_mobile', 'সাপ্লায়ারের মোবাইল')) ?></label>
                <input type="text" name="supplier_mobile" id="supplierMobile" class="form-control">
            </div>
            <div class="col-md-2 form-group">
                <label><?= e(t('company', 'কোম্পানি')) ?></label>
                <input type="text" name="supplier_company" id="supplierCompany" class="form-control" placeholder="সাপ্লায়ারের কোম্পানি">
            </div>
            <div class="col-md-3 form-group">
                <label><?= e(t('purchase_date', 'ক্রয়ের তারিখ')) ?></label>
                <input type="date" name="purchase_date" class="form-control" value="<?= date('Y-m-d') ?>">
            </div>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:-6px;"><?= e(t('supplier_picker_hint', 'তালিকা থেকে বেছে নিলে মোবাইল ও কোম্পানি স্বয়ংক্রিয় পূরণ হবে। তালিকায় না থাকলে নতুন নাম/মোবাইল লিখলে সয়ংক্রিয়ভাবে নতুন সাপ্লায়ার যুক্ত হয়ে যাবে।')) ?></p>

        <label><?= e(t('items', 'পণ্যসমূহ')) ?></label>
        <input type="text" id="prodSearch" class="form-control" placeholder="<?= e(t('scan_or_search_ph', '🔍 বারকোড স্ক্যান করুন অথবা পণ্যের নাম লিখে খুঁজুন...')) ?>" style="margin-bottom:8px;font-size:16px;" autocomplete="off" lang="en" autocapitalize="off" autocorrect="off" spellcheck="false">
        <button type="button" class="btn btn-light btn-sm" style="margin-bottom:8px;" data-bs-toggle="modal" data-bs-target="#quickProductModal"><i class="bi bi-plus-lg"></i> <?= e(t('new_product', 'নতুন পণ্য')) ?></button>
        <div id="searchResults" class="search-results-box"></div>
        <div id="itemRows"></div>
        <button type="button" class="btn btn-light btn-sm" onclick="addRow()"><i class="bi bi-plus"></i> <?= e(t('add_empty_row', 'খালি সারি যুক্ত করুন')) ?></button>

        <div class="row" style="margin-top:18px;">
            <div class="col-md-4 form-group">
                <label><?= e(t('paid_amount', 'পরিশোধিত পরিমাণ (৳)')) ?></label>
                <input type="number" step="0.01" name="paid_amount" id="paidAmount" class="form-control" value="0">
            </div>
            <div class="col-md-4 form-group">
                <label><?= e(t('total_auto', 'মোট (স্বয়ংক্রিয়)')) ?></label>
                <input type="text" id="grandTotalDisplay" class="form-control" readonly value="৳ ০.০০">
            </div>
            <div class="col-md-4 form-group">
                <label><?= e(t('note', 'নোট')) ?></label>
                <input type="text" name="note" class="form-control">
            </div>
        </div>
        <button type="submit" class="btn btn-primary"><?= e(t('save_purchase', 'ক্রয় সংরক্ষণ করুন')) ?></button>
    </form>

    <div class="modal fade" id="quickProductModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form method="POST">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="create_product_from_purchase">
            <div class="modal-header">
              <h5 class="modal-title"><?= e(t('new_product', 'নতুন পণ্য')) ?></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row">
                <div class="col-md-8 form-group">
                  <label><?= e(t('product_name', 'পণ্যের নাম')) ?></label>
                  <input type="text" name="product_name" class="form-control" required>
                </div>
                <div class="col-md-4 form-group">
                  <label><?= e(t('barcode', 'বারকোড')) ?></label>
                  <input type="text" name="product_barcode" class="form-control">
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 form-group">
                  <label><?= e(t('category', 'ক্যাটাগরি')) ?></label>
                  <select name="product_category_id" class="form-control">
                    <option value=""><?= e(t('select_dash', '— নির্বাচন করুন —')) ?></option>
                    <?php foreach ($categories as $c): ?><option value="<?= (int)$c['id'] ?>"><?= e($c['name']) ?></option><?php endforeach; ?>
                  </select>
                </div>
                <div class="col-md-6 form-group">
                  <label><?= e(t('company', 'কোম্পানি')) ?></label>
                  <select name="product_company_id" class="form-control">
                    <option value=""><?= e(t('select_dash', '— নির্বাচন করুন —')) ?></option>
                    <?php foreach ($companies as $co): ?><option value="<?= (int)$co['id'] ?>"><?= e($co['name']) ?></option><?php endforeach; ?>
                  </select>
                </div>
              </div>
              <div class="row">
                <div class="col-md-4 form-group">
                  <label><?= e(t('unit', 'একক')) ?></label>
                  <input type="text" name="product_unit" class="form-control" value="পিস">
                </div>
                <div class="col-md-4 form-group">
                  <label><?= e(t('cost_price_bdt', 'ক্রয়মূল্য (৳)')) ?></label>
                  <input type="number" step="0.01" name="product_cost_price" class="form-control" value="0" required>
                </div>
                <div class="col-md-4 form-group">
                  <label><?= e(t('retail_price_bdt', 'খুচরা মূল্য (৳)')) ?></label>
                  <input type="number" step="0.01" name="product_sale_price" class="form-control" value="0" required>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 form-group">
                  <label><?= e(t('wholesale_price_bdt', 'পাইকারি মূল্য (৳)')) ?></label>
                  <input type="number" step="0.01" name="product_wholesale_price" class="form-control" value="0">
                </div>
                <div class="col-md-6 form-group">
                  <label><?= e(t('current_stock', 'বর্তমান স্টক')) ?></label>
                  <input type="number" name="product_stock_qty" class="form-control" value="0">
                </div>
              </div>
              <div class="form-group">
                <label><?= e(t('low_stock_threshold', 'লো-স্টক থ্রেশহোল্ড')) ?></label>
                <input type="number" name="product_low_stock_threshold" class="form-control" value="5">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal"><?= e(t('cancel', 'বাতিল')) ?></button>
              <button type="submit" class="btn btn-primary"><?= e(t('save', 'সংরক্ষণ করুন')) ?></button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <template id="rowTemplate">
        <div class="row g-2 item-row" style="margin-bottom:8px;align-items:center;">
            <div class="col-md-5">
                <div class="row-prod-name" style="font-weight:600;font-size:13.5px;padding:7px 0;"></div>
                <input type="hidden" name="item_id[]" class="prod-id">
            </div>
            <div class="col-md-2"><input type="number" name="item_qty[]" class="form-control item-qty" placeholder="<?= e(t('qty', 'পরিমাণ')) ?>" value="1" oninput="calcTotal()"></div>
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
        noProductFound: <?= json_encode(t('no_product_found_hint', 'কোনো পণ্য পাওয়া যায়নি — নাম লিখে "নতুন পণ্য" থেকে আগে যুক্ত করুন।'), JSON_UNESCAPED_UNICODE) ?>,
        stockLabel: <?= json_encode(t('stock_label', 'স্টক'), JSON_UNESCAPED_UNICODE) ?>,
        noSupplierFound: <?= json_encode(t('no_supplier_found_hint', 'তালিকায় নেই — এই নামেই নতুন সাপ্লায়ার যুক্ত হবে।'), JSON_UNESCAPED_UNICODE) ?>
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
        // নাম হাতে বদলালে আগের নির্বাচিত সাপ্লায়ারের সাথে বাঁধন বাতিল — হয় তালিকা থেকে আবার বেছে নিন, নয়তো এটি নতুন সাপ্লায়ার হিসেবে যুক্ত হবে
        document.getElementById('supplierId').value = '';
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
                <span style="color:var(--text-secondary);font-size:12px;">${escHtml(p.company_name || '')}${p.company_name ? ' · ' : ''}${escHtml(p.barcode || '')} · ${I18N.stockLabel} ${p.stock_qty}</span>
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

// ---------- ভিউ: একটি ক্রয়ের বিস্তারিত ----------
if ($view === 'show') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT p.*, s.name AS supplier_name, s.mobile AS supplier_mobile FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?");
    $stmt->execute([$id]);
    $purchase = $stmt->fetch();
    if (!$purchase) { flash_set(t('purchase_not_found', 'ক্রয়টি খুঁজে পাওয়া যায়নি।'), 'danger'); redirect('purchase.php'); }
    $stmt = $pdo->prepare("SELECT pi.*, p.name, p.unit FROM purchase_items pi JOIN products p ON pi.product_id = p.id WHERE pi.purchase_id = ?");
    $stmt->execute([$id]);
    $items = $stmt->fetchAll();

    // এই ইনভয়েসের আগে থেকে সাপ্লায়ারের পূর্বের বাকি বা অগ্রিম (জমা) হিসাব
    $previousBalance = 0.0;
    if (!empty($purchase['supplier_id'])) {
        $pbStmt = $pdo->prepare("SELECT s.opening_balance AS ob, COALESCE((SELECT SUM(due_amount) FROM purchases WHERE supplier_id = s.id AND id != ?), 0) AS other_due FROM suppliers s WHERE s.id = ?");
        $pbStmt->execute([$id, $purchase['supplier_id']]);
        $pbRow = $pbStmt->fetch();
        if ($pbRow) {
            $previousBalance = (float)$pbRow['ob'] + (float)$pbRow['other_due'];
        }
    }
    $grandBalance = $previousBalance + (float)$purchase['due_amount'];

    // হোয়াটসঅ্যাপ / জিমেইলে শেয়ার করার জন্য ইনভয়েসের সংক্ষিপ্ত লেখা তৈরি
    $shareLines = [];
    $shareLines[] = ($settings['shop_name'] ?? '') . ' — ' . t('invoice', 'ইনভয়েস');
    $shareLines[] = t('invoice', 'ইনভয়েস') . ' নং: ' . $purchase['invoice_no'];
    $shareLines[] = t('date', 'তারিখ') . ': ' . $purchase['purchase_date'];
    $shareLines[] = t('supplier', 'সাপ্লায়ার') . ': ' . ($purchase['supplier_name'] ?? '—');
    $shareLines[] = '';
    foreach ($items as $it) {
        $shareLines[] = '- ' . $it['name'] . ' x' . (int)$it['qty'] . ' ' . $it['unit'] . ' = ৳' . money($it['subtotal']);
    }
    $shareLines[] = '';
    $shareLines[] = t('total', 'মোট') . ': ৳' . money($purchase['total_amount']);
    $shareLines[] = t('paid', 'পরিশোধিত') . ': ৳' . money($purchase['paid_amount']);
    if ((float)$purchase['due_amount'] > 0) {
        $shareLines[] = t('due_this_invoice', 'এই ইনভয়েসের বাকি') . ': ৳' . money($purchase['due_amount']);
    }
    if (abs($previousBalance) > 0.004) {
        $shareLines[] = $previousBalance > 0
            ? t('previous_due', 'পূর্বের বাকি') . ': ৳' . money($previousBalance)
            : t('previous_advance', 'পূর্বের জমা (অগ্রিম)') . ': ৳' . money(abs($previousBalance));
        if ($grandBalance > 0.004) {
            $shareLines[] = t('total_due', 'সর্বমোট বাকি') . ': ৳' . money($grandBalance);
        } elseif ($grandBalance < -0.004) {
            $shareLines[] = t('total_advance', 'সর্বমোট জমা') . ': ৳' . money(abs($grandBalance));
        }
    }
    $shareText = implode("\n", $shareLines);
    $shareWaNumber = whatsapp_number($purchase['supplier_mobile'] ?? '');
    $shopWaNumber = whatsapp_number(!empty($settings['whatsapp']) ? $settings['whatsapp'] : ($settings['mobile'] ?? ''));
    $verifyUrl = invoice_verify_url('purchase', $purchase['id'], $purchase['invoice_no']);

    $hideBottomNav = true; // ইনভয়েস/প্রিন্ট ভিউতে মোবাইল বটম ন্যাভিগেশন বার দেখানো হয় না
    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head no-print">
        <a href="purchase.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> <?= e(t('back_to_list', 'তালিকায় ফিরুন')) ?></a>
        <button onclick="window.print()" class="btn btn-outline btn-sm"><i class="bi bi-printer"></i> <?= e(t('print', 'প্রিন্ট')) ?></button>
        <button onclick="shareInvoiceWhatsApp()" class="btn btn-outline btn-sm"><i class="bi bi-whatsapp" style="color:#25D366;"></i> <?= e(t('whatsapp', 'হোয়াটসঅ্যাপ')) ?></button>
        <button onclick="shareInvoiceGmail()" class="btn btn-outline btn-sm"><i class="bi bi-envelope" style="color:#EA4335;"></i> <?= e(t('gmail', 'জিমেইল')) ?></button>
    </div>
    <div class="card" style="max-width:720px;margin:0 auto;padding:26px;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:20px;">
            <div class="brand-lockup"><div class="book-spine-mark"><span></span><span></span><span></span><span></span></div>
                <div class="shop-name"><?= e($settings['shop_name'] ?? '') ?></div></div>
            <div style="text-align:right;font-size:13px;color:var(--text-secondary);">
                <?= e(t('invoice', 'ইনভয়েস')) ?>: <strong><?= e($purchase['invoice_no']) ?></strong><br><?= e(t('date', 'তারিখ')) ?>: <?= e($purchase['purchase_date']) ?>
            </div>
        </div>
        <p><strong><?= e(t('supplier', 'সাপ্লায়ার')) ?>:</strong> <?= e($purchase['supplier_name'] ?? '—') ?> <?= $purchase['supplier_mobile'] ? '('.e($purchase['supplier_mobile']).')' : '' ?></p>
        <table class="data-table">
            <thead><tr><th><?= e(t('product', 'পণ্য')) ?></th><th class="num"><?= e(t('qty', 'পরিমাণ')) ?></th><th class="num"><?= e(t('unit_price', 'একক মূল্য')) ?></th><th class="num"><?= e(t('subtotal', 'সাবটোটাল')) ?></th></tr></thead>
            <tbody>
            <?php foreach ($items as $it): ?>
                <tr><td><?= e($it['name']) ?></td><td class="num"><?= (int)$it['qty'] ?> <?= e($it['unit']) ?></td><td class="num">৳<?= money($it['unit_cost']) ?></td><td class="num">৳<?= money($it['subtotal']) ?></td></tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <div style="max-width:280px;margin-left:auto;margin-top:14px;">
            <div class="pos-total-line grand"><span><?= e(t('total', 'মোট')) ?></span><span>৳<?= money($purchase['total_amount']) ?></span></div>
            <div class="pos-total-line"><span><?= e(t('paid', 'পরিশোধিত')) ?></span><span>৳<?= money($purchase['paid_amount']) ?></span></div>
            <?php if ((float)$purchase['due_amount'] > 0): ?>
                <div class="pos-total-line"><span><?= e(t('due_this_invoice', 'এই ইনভয়েসের বাকি')) ?></span><span>৳<?= money($purchase['due_amount']) ?></span></div>
            <?php endif; ?>
            <?php if (abs($previousBalance) > 0.004): ?>
                <?php if ($previousBalance > 0): ?>
                    <div class="pos-total-line" style="color:var(--danger);"><span><?= e(t('previous_due', 'পূর্বের বাকি')) ?></span><span>৳<?= money($previousBalance) ?></span></div>
                <?php else: ?>
                    <div class="pos-total-line" style="color:var(--success);"><span><?= e(t('previous_advance', 'পূর্বের জমা (অগ্রিম)')) ?></span><span>৳<?= money(abs($previousBalance)) ?></span></div>
                <?php endif; ?>
                <?php if ($grandBalance > 0.004): ?>
                    <div class="pos-total-line grand" style="color:var(--danger);"><span><?= e(t('total_due', 'সর্বমোট বাকি')) ?></span><span>৳<?= money($grandBalance) ?></span></div>
                <?php elseif ($grandBalance < -0.004): ?>
                    <div class="pos-total-line grand" style="color:var(--success);"><span><?= e(t('total_advance', 'সর্বমোট জমা')) ?></span><span>৳<?= money(abs($grandBalance)) ?></span></div>
                <?php endif; ?>
            <?php endif; ?>
        </div>
        <?php if ($purchase['note']): ?><p style="margin-top:14px;font-size:13px;color:var(--text-secondary);"><?= e(t('note', 'নোট')) ?>: <?= e($purchase['note']) ?></p><?php endif; ?>
        <div style="margin-top:18px;padding-top:12px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;font-size:11px;color:var(--text-secondary);">
            <?php if (!empty($settings['mobile'])): ?><span><i class="bi bi-telephone"></i> <?= e($settings['mobile']) ?></span><?php endif; ?>
            <?php if ($shopWaNumber): ?><span><i class="bi bi-whatsapp" style="color:#25D366;"></i> <?= e($settings['whatsapp'] ?: $settings['mobile']) ?></span><?php endif; ?>
            <?php if (!empty($settings['email'])): ?><span><i class="bi bi-envelope"></i> <?= e($settings['email']) ?></span><?php endif; ?>
            <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
                <canvas id="invoiceQr" style="width:56px;height:56px;display:block;"></canvas>
                <div style="font-size:9px;line-height:1.3;max-width:80px;"><?= e(t('scan_to_verify', 'ইনভয়েস যাচাই করতে স্ক্যান করুন')) ?></div>
            </div>
        </div>
    </div>
    <script>
    const SHARE_TEXT = <?= json_encode($shareText, JSON_UNESCAPED_UNICODE) ?>;
    const SHARE_WA_NUMBER = <?= json_encode($shareWaNumber) ?>;
    const SHARE_SUBJECT = <?= json_encode(t('invoice', 'ইনভয়েস') . ' ' . $purchase['invoice_no'] . ' — ' . ($settings['shop_name'] ?? ''), JSON_UNESCAPED_UNICODE) ?>;
    const VERIFY_URL = <?= json_encode($verifyUrl) ?>;

    function shareInvoiceWhatsApp() {
        const base = SHARE_WA_NUMBER ? ('https://wa.me/' + SHARE_WA_NUMBER) : 'https://api.whatsapp.com/send';
        window.open(base + '?text=' + encodeURIComponent(SHARE_TEXT), '_blank');
    }

    function shareInvoiceGmail() {
        const url = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(SHARE_SUBJECT) + '&body=' + encodeURIComponent(SHARE_TEXT);
        window.open(url, '_blank');
    }
    </script>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
    <script>
    (function () {
        const canvas = document.getElementById('invoiceQr');
        if (canvas && window.QRCode) {
            QRCode.toCanvas(canvas, VERIFY_URL, { width: 110, margin: 0, color: { dark: '#241B3A', light: '#00000000' } }, function (err) {
                if (err) console.error(err);
            });
        }
    })();
    </script>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: ক্রয় তালিকা ----------
$stmt = $pdo->query("SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id ORDER BY p.id DESC LIMIT 200");
$purchases = $stmt->fetchAll();
require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <div></div>
    <a href="purchase.php?view=add" class="btn btn-primary"><i class="bi bi-plus-lg"></i> <?= e(t('new_purchase', 'নতুন ক্রয়')) ?></a>
</div>
<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th><?= e(t('invoice', 'ইনভয়েস')) ?></th><th><?= e(t('supplier', 'সাপ্লায়ার')) ?></th><th><?= e(t('date', 'তারিখ')) ?></th><th class="num"><?= e(t('total', 'মোট')) ?></th><th class="num"><?= e(t('paid', 'পরিশোধিত')) ?></th><th class="num"><?= e(t('due', 'বাকি')) ?></th><th></th></tr></thead>
        <tbody>
        <?php if (empty($purchases)): ?>
            <tr><td colspan="7"><div class="empty-state"><i class="bi bi-truck"></i><?= e(t('no_purchases', 'এখনো কোনো ক্রয় নথিভুক্ত হয়নি।')) ?></div></td></tr>
        <?php endif; ?>
        <?php foreach ($purchases as $p): ?>
            <tr>
                <td><a href="purchase.php?view=show&id=<?= $p['id'] ?>"><?= e($p['invoice_no']) ?></a></td>
                <td><?= e($p['supplier_name'] ?? '—') ?></td>
                <td><?= e($p['purchase_date']) ?></td>
                <td class="num">৳<?= money($p['total_amount']) ?></td>
                <td class="num">৳<?= money($p['paid_amount']) ?></td>
                <td class="num"><?= $p['due_amount'] > 0 ? '<span class="badge badge-danger">৳'.money($p['due_amount']).'</span>' : '৳০.০০' ?></td>
                <td><a href="purchase.php?view=show&id=<?= $p['id'] ?>" class="btn btn-sm btn-light"><i class="bi bi-eye"></i></a></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
