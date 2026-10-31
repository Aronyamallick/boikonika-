<?php
/**
 * কোটেশন — বিক্রির আগে দাম প্রস্তাব। স্টক/বাকি কোনোটাই প্রভাবিত করে না
 * যতক্ষণ না "সেলে রূপান্তর" করা হয়। রূপান্তরের সময় sales_pos.php-এর
 * চেকআউট লজিকের মূল অংশ (ইনভয়েস তৈরি, স্টক বাদ, সেল-আইটেম) পুনরায় ব্যবহার হয়।
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
require_permission('sales');

$settings = shop_settings($pdo);

// ---------- POST অ্যাকশন ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'save_quotation') {
        $customerName = trim($_POST['customer_name'] ?? '');
        $customerMobile = trim($_POST['customer_mobile'] ?? '');
        $customerIdPosted = (int)($_POST['customer_id'] ?? 0);
        $validUntil = trim($_POST['valid_until'] ?? '') ?: null;
        $note = trim($_POST['note'] ?? '');
        $discountType = (($_POST['discount_type'] ?? 'fixed') === 'percent') ? 'percent' : 'fixed';
        $discountValue = max(0, (float)($_POST['discount_value'] ?? 0));
        $types = $_POST['item_type'] ?? [];
        $ids = $_POST['item_id'] ?? [];
        $qtys = $_POST['item_qty'] ?? [];
        $prices = $_POST['item_price'] ?? [];
        $descs = $_POST['item_desc'] ?? [];

        if (empty($ids)) {
            flash_set('অন্তত একটি পণ্য/সার্ভিস যোগ করুন।', 'danger');
            redirect('quotation.php?view=create');
        }

        $customerId = null;
        if ($customerIdPosted > 0) {
            $chk = $pdo->prepare("SELECT id FROM customers WHERE id = ? LIMIT 1");
            $chk->execute([$customerIdPosted]);
            if ($chk->fetch()) $customerId = $customerIdPosted;
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
            $items[] = ['type' => $type, 'id' => (int)$id, 'qty' => $qty, 'price' => $price, 'desc' => trim($descs[$i] ?? ''), 'subtotal' => $sub];
        }
        if (empty($items)) {
            flash_set('কোনো বৈধ আইটেম পাওয়া যায়নি।', 'danger');
            redirect('quotation.php?view=create');
        }

        if ($discountType === 'percent') {
            $discountValue = min(100, $discountValue);
            $discount = round($subtotal * $discountValue / 100, 2);
        } else {
            $discount = min($subtotal, $discountValue);
        }
        $total = max(0, $subtotal - $discount);

        $quoteNo = generate_doc_no($pdo, 'quotations', 'quote_date', 'quotation_no', 'QT');

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO quotations (quotation_no, customer_id, customer_name, customer_mobile, quote_date, valid_until, subtotal, discount_type, discount_value, discount, total_amount, status, note, created_by) VALUES (?,?,?,?,CURDATE(),?,?,?,?,?,?,'pending',?,?)");
            $stmt->execute([$quoteNo, $customerId, $customerName ?: null, $customerMobile ?: null, $validUntil, $subtotal, $discountType, $discountValue, $discount, $total, $note, current_user()['id']]);
            $quotationId = $pdo->lastInsertId();

            $itemStmt = $pdo->prepare("INSERT INTO quotation_items (quotation_id, item_type, product_id, service_id, description, qty, unit_price, subtotal) VALUES (?,?,?,?,?,?,?,?)");
            foreach ($items as $it) {
                if ($it['type'] === 'product') {
                    $itemStmt->execute([$quotationId, 'product', $it['id'], null, $it['desc'], $it['qty'], $it['price'], $it['subtotal']]);
                } else {
                    $itemStmt->execute([$quotationId, 'service', null, $it['id'], $it['desc'], $it['qty'], $it['price'], $it['subtotal']]);
                }
            }
            $pdo->commit();
            log_activity($pdo, 'নতুন কোটেশন তৈরি: ' . $quoteNo);
            flash_set('কোটেশন তৈরি হয়েছে।');
            redirect('quotation.php?view=show&id=' . $quotationId);
        } catch (Throwable $ex) {
            $pdo->rollBack();
            flash_set('কোটেশন সংরক্ষণ ব্যর্থ: ' . $ex->getMessage(), 'danger');
            redirect('quotation.php?view=create');
        }
    }

    if ($action === 'set_status') {
        $id = (int)($_POST['id'] ?? 0);
        $status = in_array($_POST['status'] ?? '', ['rejected', 'expired', 'pending'], true) ? $_POST['status'] : 'pending';
        $pdo->prepare("UPDATE quotations SET status=? WHERE id=? AND status != 'converted'")->execute([$status, $id]);
        flash_set('কোটেশনের অবস্থা হালনাগাদ হয়েছে।');
        redirect('quotation.php?view=show&id=' . $id);
    }

    // ---------- কোটেশনকে বিক্রয়ে রূপান্তর ----------
    if ($action === 'convert') {
        $id = (int)($_POST['id'] ?? 0);
        $paid = max(0, (float)($_POST['paid_amount'] ?? 0));
        $paymentMethod = $_POST['payment_method'] ?? 'cash';

        $qStmt = $pdo->prepare("SELECT * FROM quotations WHERE id=?");
        $qStmt->execute([$id]);
        $quote = $qStmt->fetch();
        if (!$quote || $quote['status'] === 'converted') {
            flash_set('এই কোটেশনটি রূপান্তরযোগ্য নয়।', 'danger');
            redirect('quotation.php');
        }
        $qiStmt = $pdo->prepare("SELECT * FROM quotation_items WHERE quotation_id=?");
        $qiStmt->execute([$id]);
        $qItems = $qiStmt->fetchAll();
        if (empty($qItems)) {
            flash_set('এই কোটেশনে কোনো আইটেম নেই।', 'danger');
            redirect('quotation.php?view=show&id=' . $id);
        }

        $pdo->beginTransaction();
        try {
            $invoiceNo = generate_invoice_no($pdo, 'sales', ($settings['invoice_prefix'] ?? 'INV'));
            $total = (float)$quote['total_amount'];
            $due = max(0, $total - $paid);

            $prevBal = 0.0;
            if ($quote['customer_id']) {
                $pb = $pdo->prepare("SELECT c.opening_balance AS ob, COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id=c.id),0) AS od FROM customers c WHERE c.id=?");
                $pb->execute([$quote['customer_id']]);
                $pbRow = $pb->fetch();
                if ($pbRow) $prevBal = (float)$pbRow['ob'] + (float)$pbRow['od'];
            }

            $stmt = $pdo->prepare("INSERT INTO sales (customer_id, invoice_no, subtotal, discount, discount_type, discount_value, total_amount, paid_amount, due_amount, previous_balance_snapshot, payment_method, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
            $stmt->execute([$quote['customer_id'], $invoiceNo, $quote['subtotal'], $quote['discount'], $quote['discount_type'], $quote['discount_value'], $total, $paid, $due, $prevBal, $paymentMethod, current_user()['id']]);
            $saleId = $pdo->lastInsertId();

            $itemStmt = $pdo->prepare("INSERT INTO sale_items (sale_id, item_type, product_id, service_id, description, qty, unit_price, unit_cost, subtotal) VALUES (?,?,?,?,?,?,?,?,?)");
            $stockStmt = $pdo->prepare("UPDATE products SET stock_qty = GREATEST(0, stock_qty - ?) WHERE id = ?");
            foreach ($qItems as $it) {
                $cost = 0;
                if ($it['item_type'] === 'product' && $it['product_id']) {
                    $cRow = $pdo->prepare("SELECT cost_price FROM products WHERE id=?");
                    $cRow->execute([$it['product_id']]);
                    $cost = (float)$cRow->fetchColumn();
                }
                $itemStmt->execute([$saleId, $it['item_type'], $it['product_id'], $it['service_id'], $it['description'], $it['qty'], $it['unit_price'], $cost, $it['subtotal']]);
                if ($it['item_type'] === 'product' && $it['product_id']) {
                    $stockStmt->execute([$it['qty'], $it['product_id']]);
                }
            }

            $pdo->prepare("UPDATE quotations SET status='converted', converted_sale_id=? WHERE id=?")->execute([$saleId, $id]);
            $pdo->commit();
            log_activity($pdo, 'কোটেশন ' . $quote['quotation_no'] . ' বিক্রয়ে রূপান্তরিত হয়েছে — ' . $invoiceNo);
            flash_set('কোটেশনটি বিক্রয়ে রূপান্তরিত হয়েছে — ইনভয়েস ' . $invoiceNo);
            redirect('sales_list.php?view=show&id=' . $saleId . '&fresh=1');
        } catch (Throwable $ex) {
            $pdo->rollBack();
            flash_set('রূপান্তর ব্যর্থ: ' . $ex->getMessage(), 'danger');
            redirect('quotation.php?view=show&id=' . $id);
        }
    }
}

$view = $_GET['view'] ?? 'list';
$pageTitle = 'কোটেশন';
$activeNav = 'quotation';

// ---------- ভিউ: নতুন কোটেশন তৈরি ----------
if ($view === 'create') {
    $products = $pdo->query("SELECT id, name, unit, sale_price, wholesale_price, barcode, stock_qty FROM products WHERE status='active' ORDER BY name LIMIT 800")->fetchAll();
    $services = $pdo->query("SELECT id, name, unit, price FROM services WHERE status='active' ORDER BY name")->fetchAll();
    $customers = $pdo->query("SELECT id, name, mobile FROM customers ORDER BY name LIMIT 500")->fetchAll();

    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head no-print">
        <a href="quotation.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> তালিকায় ফিরুন</a>
    </div>
    <form method="POST" id="quoteForm">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_quotation">
        <div class="row">
            <div class="col-md-7">
                <div class="card" style="padding:16px;">
                    <h3 style="font-size:15px;margin:0 0 10px;">পণ্য/সার্ভিস যোগ করুন</h3>
                    <input type="text" id="itemSearch" class="form-control" placeholder="নাম বা বারকোড দিয়ে খুঁজুন..." autocomplete="off">
                    <div id="itemGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(150px,1fr));gap:8px;max-height:50vh;overflow-y:auto;margin-top:10px;"></div>
                </div>
            </div>
            <div class="col-md-5">
                <div class="card" style="padding:16px;">
                    <h3 style="font-size:15px;margin:0 0 10px;"><i class="bi bi-file-earmark-text"></i> কোটেশন আইটেম</h3>
                    <div id="cartRows"><div class="empty-state" id="emptyCart" style="padding:20px;"><i class="bi bi-cart"></i>এখনো কিছু যোগ হয়নি।</div></div>
                    <hr>
                    <div class="form-group" style="position:relative;">
                        <label>কাস্টমার (ঐচ্ছিক)</label>
                        <input type="text" id="customerName" name="customer_name" class="form-control" autocomplete="off" placeholder="নাম লিখুন">
                        <input type="hidden" name="customer_id" id="customerId">
                        <div id="customerResults" class="search-results-box"></div>
                    </div>
                    <div class="form-group"><input type="text" name="customer_mobile" id="customerMobile" class="form-control" placeholder="মোবাইল (ঐচ্ছিক)"></div>
                    <div class="form-group"><label>মেয়াদ শেষ (ঐচ্ছিক)</label><input type="date" name="valid_until" class="form-control"></div>
                    <div class="pos-total-line"><span>সাবটোটাল</span><span class="num" id="subtotalDisplay">৳০.০০</span></div>
                    <div class="form-group" style="display:flex;align-items:center;gap:10px;margin:6px 0;">
                        <label style="margin:0;white-space:nowrap;">ডিসকাউন্ট</label>
                        <input type="number" step="0.01" min="0" name="discount_value" id="discountInput" class="form-control" value="0" oninput="renderCart()">
                        <select name="discount_type" id="discountTypeInput" class="form-control" style="max-width:90px;flex:none;" onchange="renderCart()">
                            <option value="fixed">৳</option>
                            <option value="percent">%</option>
                        </select>
                    </div>
                    <div class="pos-total-line grand"><span>মোট</span><span class="num" id="totalDisplay">৳০.০০</span></div>
                    <div class="form-group"><label>নোট (ঐচ্ছিক)</label><textarea name="note" class="form-control" rows="2"></textarea></div>
                    <button type="submit" class="btn btn-primary btn-block" id="submitBtn" disabled><i class="bi bi-save"></i> কোটেশন সংরক্ষণ করুন</button>
                </div>
            </div>
        </div>
    </form>
    <script>
    const PRODUCTS = <?= json_encode($products, JSON_UNESCAPED_UNICODE) ?>;
    const SERVICES = <?= json_encode($services, JSON_UNESCAPED_UNICODE) ?>;
    const CUSTOMERS = <?= json_encode($customers, JSON_UNESCAPED_UNICODE) ?>;
    let cart = [];

    function renderGrid(query) {
        const grid = document.getElementById('itemGrid');
        grid.innerHTML = '';
        const q = (query || '').toLowerCase();
        const all = [
            ...PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q) || (p.barcode||'').includes(q)).map(p => ({...p, _type:'product', _price: p.sale_price})),
            ...SERVICES.filter(s => !q || s.name.toLowerCase().includes(q)).map(s => ({...s, _type:'service', _price: s.price})),
        ].slice(0, 60);
        all.forEach(it => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cssText = 'padding:8px;cursor:pointer;text-align:center;font-size:12.5px;';
            card.innerHTML = `<div style="font-weight:600;">${escHtml(it.name)}</div><div style="color:var(--text-secondary);">৳${Number(it._price).toFixed(2)}</div>`;
            card.onclick = () => addToCart(it._type, it.id, it.name, it.unit, it._price);
            grid.appendChild(card);
        });
    }
    document.getElementById('itemSearch').addEventListener('input', e => renderGrid(e.target.value));
    renderGrid('');

    function addToCart(type, id, name, unit, price) {
        cart.push({type, id, name, unit, price: Number(price), qty: 1, desc: name});
        renderCart();
    }
    function updateQty(idx, val) { cart[idx].qty = Math.max(1, parseInt(val) || 1); renderCart(); }
    function updatePrice(idx, val) { cart[idx].price = Math.max(0, parseFloat(val) || 0); renderCart(); }
    function removeItem(idx) { cart.splice(idx, 1); renderCart(); }

    function renderCart() {
        const wrap = document.getElementById('cartRows');
        wrap.innerHTML = '';
        if (cart.length === 0) {
            wrap.innerHTML = '<div class="empty-state" style="padding:20px;"><i class="bi bi-cart"></i>এখনো কিছু যোগ হয়নি।</div>';
        }
        let subtotal = 0;
        cart.forEach((item, idx) => {
            subtotal += item.qty * item.price;
            const row = document.createElement('div');
            row.className = 'pos-cart-row';
            row.innerHTML = `
                <div style="flex:1;">
                    <div style="font-size:13px;font-weight:600;">${escHtml(item.name)}</div>
                    <input type="number" step="0.01" min="0" class="form-control" style="width:90px;display:inline-block;margin-top:4px;" value="${item.price}" onchange="updatePrice(${idx}, this.value)">
                </div>
                <input type="number" min="1" class="form-control qty-input" value="${item.qty}" onchange="updateQty(${idx}, this.value)">
                <button type="button" class="btn btn-sm btn-light" onclick="removeItem(${idx})"><i class="bi bi-x"></i></button>
                <input type="hidden" name="item_type[]" value="${escHtml(item.type)}">
                <input type="hidden" name="item_id[]" value="${item.id}">
                <input type="hidden" name="item_qty[]" value="${item.qty}">
                <input type="hidden" name="item_price[]" value="${item.price}">
                <input type="hidden" name="item_desc[]" value="${escHtml(item.desc)}">
            `;
            wrap.appendChild(row);
        });
        const discountType = document.getElementById('discountTypeInput').value;
        let discountValue = Math.max(0, parseFloat(document.getElementById('discountInput').value) || 0);
        let discount = discountType === 'percent' ? subtotal * Math.min(100, discountValue) / 100 : Math.min(subtotal, discountValue);
        const total = Math.max(0, subtotal - discount);
        document.getElementById('subtotalDisplay').textContent = '৳' + subtotal.toFixed(2);
        document.getElementById('totalDisplay').textContent = '৳' + total.toFixed(2);
        document.getElementById('submitBtn').disabled = cart.length === 0;
    }

    document.getElementById('customerName').addEventListener('input', function () {
        const q = this.value.trim().toLowerCase();
        const box = document.getElementById('customerResults');
        document.getElementById('customerId').value = '';
        if (!q) { box.style.display = 'none'; return; }
        const matches = CUSTOMERS.filter(c => c.name.toLowerCase().includes(q) || (c.mobile||'').includes(q)).slice(0, 8);
        if (!matches.length) { box.style.display = 'none'; return; }
        box.innerHTML = '';
        matches.forEach(c => {
            const el = document.createElement('div');
            el.className = 'search-result-item';
            el.textContent = c.name + (c.mobile ? ' — ' + c.mobile : '');
            el.addEventListener('click', function () {
                document.getElementById('customerName').value = c.name;
                document.getElementById('customerMobile').value = c.mobile || '';
                document.getElementById('customerId').value = c.id;
                box.style.display = 'none';
            });
            box.appendChild(el);
        });
        box.style.display = 'block';
    });
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#customerName') && !e.target.closest('#customerResults')) {
            document.getElementById('customerResults').style.display = 'none';
        }
    });
    </script>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: একটি কোটেশন দেখা / প্রিন্ট ----------
if ($view === 'show') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM quotations WHERE id=?");
    $stmt->execute([$id]);
    $quote = $stmt->fetch();
    if (!$quote) { flash_set('কোটেশন খুঁজে পাওয়া যায়নি।', 'danger'); redirect('quotation.php'); }
    $itemsStmt = $pdo->prepare("SELECT * FROM quotation_items WHERE quotation_id=?");
    $itemsStmt->execute([$id]);
    $qItems = $itemsStmt->fetchAll();
    $paymentMethods = $pdo->query("SELECT * FROM payment_methods WHERE is_active=1 ORDER BY sort_order")->fetchAll();

    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head no-print">
        <a href="quotation.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> তালিকায় ফিরুন</a>
        <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-light btn-sm" onclick="window.print()"><i class="bi bi-printer"></i> প্রিন্ট / PDF</button>
            <?php if ($quote['status'] === 'pending'): ?>
                <button type="button" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#convertModal"><i class="bi bi-arrow-repeat"></i> সেলে রূপান্তর</button>
                <form method="POST" style="display:inline;" onsubmit="return confirm('এই কোটেশনটি প্রত্যাখ্যাত হিসেবে চিহ্নিত করবেন?');">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="set_status">
                    <input type="hidden" name="id" value="<?= (int)$quote['id'] ?>">
                    <input type="hidden" name="status" value="rejected">
                    <button class="btn btn-light btn-sm text-danger">প্রত্যাখ্যান</button>
                </form>
            <?php endif; ?>
        </div>
    </div>

    <div style="text-align:center;margin-bottom:16px;">
        <h2 style="margin:0;"><?= e($settings['shop_name'] ?? '') ?></h2>
        <?php if (!empty($settings['address'])): ?><div style="font-size:13px;color:var(--text-secondary);"><?= e($settings['address']) ?></div><?php endif; ?>
        <?php if (!empty($settings['mobile'])): ?><div style="font-size:13px;color:var(--text-secondary);">ফোনঃ <?= e($settings['mobile']) ?></div><?php endif; ?>
        <h3 style="margin:14px 0 4px;">মূল্য প্রস্তাব (কোটেশন)</h3>
    </div>

    <div class="row" style="margin-bottom:14px;">
        <div class="col-md-6">
            <strong>কোটেশন নং:</strong> <?= e($quote['quotation_no']) ?><br>
            <strong>তারিখ:</strong> <?= e(date('d M Y', strtotime($quote['quote_date']))) ?><br>
            <?php if ($quote['valid_until']): ?><strong>মেয়াদ শেষ:</strong> <?= e(date('d M Y', strtotime($quote['valid_until']))) ?><br><?php endif; ?>
            <strong>অবস্থা:</strong>
            <?php $statusLabel = ['pending'=>'অপেক্ষমান','converted'=>'রূপান্তরিত','rejected'=>'প্রত্যাখ্যাত','expired'=>'মেয়াদোত্তীর্ণ']; ?>
            <span class="badge badge-<?= $quote['status']==='converted'?'success':($quote['status']==='rejected'?'danger':'warning') ?>"><?= e($statusLabel[$quote['status']] ?? $quote['status']) ?></span>
        </div>
        <div class="col-md-6" style="text-align:right;">
            <?php if ($quote['customer_name']): ?><strong>কাস্টমার:</strong> <?= e($quote['customer_name']) ?><br><?php endif; ?>
            <?php if ($quote['customer_mobile']): ?><?= e($quote['customer_mobile']) ?><br><?php endif; ?>
        </div>
    </div>

    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>#</th><th>বিবরণ</th><th class="num">পরিমাণ</th><th class="num">দর</th><th class="num">সাবটোটাল</th></tr></thead>
            <tbody>
            <?php foreach ($qItems as $i => $it): ?>
                <tr>
                    <td><?= $i + 1 ?></td>
                    <td><?= e($it['description']) ?></td>
                    <td class="num"><?= (int)$it['qty'] ?></td>
                    <td class="num">৳<?= money($it['unit_price']) ?></td>
                    <td class="num">৳<?= money($it['subtotal']) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
            <tfoot>
                <tr><th colspan="4" style="text-align:right;">সাবটোটাল</th><th class="num">৳<?= money($quote['subtotal']) ?></th></tr>
                <?php if ($quote['discount'] > 0): ?><tr><th colspan="4" style="text-align:right;">ডিসকাউন্ট</th><th class="num">− ৳<?= money($quote['discount']) ?></th></tr><?php endif; ?>
                <tr><th colspan="4" style="text-align:right;">মোট</th><th class="num">৳<?= money($quote['total_amount']) ?></th></tr>
            </tfoot>
        </table>
    </div>
    <?php if ($quote['note']): ?><div style="margin-top:10px;font-size:13px;color:var(--text-secondary);"><strong>নোট:</strong> <?= e($quote['note']) ?></div><?php endif; ?>

    <?php if ($quote['status'] === 'pending'): ?>
    <div class="modal fade" id="convertModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="POST">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="convert">
                    <input type="hidden" name="id" value="<?= (int)$quote['id'] ?>">
                    <div class="modal-header"><h5 class="modal-title">সেলে রূপান্তর করুন</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">
                        <p>এই কোটেশনটি একটি বিক্রয় ইনভয়েসে রূপান্তরিত হবে এবং স্টক থেকে পণ্য বাদ যাবে।</p>
                        <div class="form-group"><label>মোট</label><input type="text" class="form-control" value="৳<?= money($quote['total_amount']) ?>" disabled></div>
                        <div class="form-group"><label>এখন কত টাকা পরিশোধ হয়েছে</label><input type="number" step="0.01" min="0" name="paid_amount" class="form-control" value="<?= e($quote['total_amount']) ?>"></div>
                        <div class="form-group">
                            <label>পেমেন্ট মেথড</label>
                            <select name="payment_method" class="form-control">
                                <?php foreach ($paymentMethods as $pm): ?><option value="<?= e($pm['method_key']) ?>"><?= e($pm['method_name']) ?></option><?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary">রূপান্তর নিশ্চিত করুন</button></div>
                </form>
            </div>
        </div>
    </div>
    <?php endif; ?>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: তালিকা ----------
$statusFilter = $_GET['status'] ?? 'all';
$where = '';
$params = [];
if ($statusFilter !== 'all' && in_array($statusFilter, ['pending','converted','rejected','expired'], true)) {
    $where = 'WHERE status = ?';
    $params[] = $statusFilter;
}
$stmt = $pdo->prepare("SELECT * FROM quotations $where ORDER BY created_at DESC LIMIT 400");
$stmt->execute($params);
$quotations = $stmt->fetchAll();

require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <div class="gap-tabs" style="border:none;margin:0;">
        <a href="quotation.php?status=all" class="<?= $statusFilter==='all'?'active':'' ?>">সব</a>
        <a href="quotation.php?status=pending" class="<?= $statusFilter==='pending'?'active':'' ?>">অপেক্ষমান</a>
        <a href="quotation.php?status=converted" class="<?= $statusFilter==='converted'?'active':'' ?>">রূপান্তরিত</a>
        <a href="quotation.php?status=rejected" class="<?= $statusFilter==='rejected'?'active':'' ?>">প্রত্যাখ্যাত</a>
    </div>
    <a href="quotation.php?view=create" class="btn btn-primary"><i class="bi bi-plus-lg"></i> নতুন কোটেশন</a>
</div>
<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th>কোটেশন নং</th><th>তারিখ</th><th>কাস্টমার</th><th class="num">মোট</th><th>অবস্থা</th><th></th></tr></thead>
        <tbody>
        <?php if (empty($quotations)): ?>
            <tr><td colspan="6"><div class="empty-state"><i class="bi bi-file-earmark-text"></i>এখনো কোনো কোটেশন তৈরি হয়নি।</div></td></tr>
        <?php endif; ?>
        <?php $statusLabel = ['pending'=>'অপেক্ষমান','converted'=>'রূপান্তরিত','rejected'=>'প্রত্যাখ্যাত','expired'=>'মেয়াদোত্তীর্ণ']; ?>
        <?php foreach ($quotations as $q): ?>
            <tr>
                <td><a href="quotation.php?view=show&id=<?= (int)$q['id'] ?>"><?= e($q['quotation_no']) ?></a></td>
                <td><?= e(date('d M Y', strtotime($q['quote_date']))) ?></td>
                <td><?= e($q['customer_name'] ?: '—') ?></td>
                <td class="num">৳<?= money($q['total_amount']) ?></td>
                <td><span class="badge badge-<?= $q['status']==='converted'?'success':($q['status']==='rejected'?'danger':'warning') ?>"><?= e($statusLabel[$q['status']] ?? $q['status']) ?></span></td>
                <td><a href="quotation.php?view=show&id=<?= (int)$q['id'] ?>" class="btn btn-sm btn-light"><i class="bi bi-eye"></i> দেখুন</a></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
