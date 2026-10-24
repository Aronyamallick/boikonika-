<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
require_permission('customers');

// ---------- POST অ্যাকশন ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'save_customer') {
        $id = (int)($_POST['id'] ?? 0);
        $data = [
            'name' => trim($_POST['name'] ?? ''),
            'mobile' => trim($_POST['mobile'] ?? ''),
            'address' => trim($_POST['address'] ?? '') ?: null,
            'customer_type' => $_POST['customer_type'] ?? 'regular',
            'opening_balance' => (float)($_POST['opening_balance'] ?? 0),
        ];
        // আবশ্যক ফিল্ড যাচাই — নাম ও মোবাইল দুটোই লাগবে (POS/সাপ্লায়ার সার্চ, রিমাইন্ডার এসএমএস ইত্যাদির জন্য মোবাইল জরুরি)
        if ($data['name'] === '' || $data['mobile'] === '') {
            flash_set('নাম ও মোবাইল নম্বর — দুটোই আবশ্যক।', 'danger');
            redirect($id ? 'customers.php?view=ledger&id=' . $id . '&edit=1' : 'customers.php');
        }
        $data['mobile'] = $data['mobile'] ?: null;

        // একই মোবাইল নম্বরে একাধিক কাস্টমার যুক্ত করা যাবে না
        if ($data['mobile'] !== null) {
            $dupStmt = $pdo->prepare("SELECT name FROM customers WHERE mobile = ? AND id != ? LIMIT 1");
            $dupStmt->execute([$data['mobile'], $id ?: 0]);
            $dup = $dupStmt->fetch();
            if ($dup) {
                flash_set('এই মোবাইল নম্বরে ইতিমধ্যে "' . $dup['name'] . '" নামে একজন কাস্টমার যুক্ত আছে। একই নম্বর দুইজনের জন্য ব্যবহার করা যাবে না।', 'danger');
                redirect($id ? 'customers.php?view=ledger&id=' . $id . '&edit=1' : 'customers.php');
            }
        }

        try {
            if ($id) {
                $stmt = $pdo->prepare("UPDATE customers SET name=?, mobile=?, address=?, customer_type=?, opening_balance=? WHERE id=?");
                $stmt->execute(array_merge(array_values($data), [$id]));
                flash_set('কাস্টমারের তথ্য হালনাগাদ হয়েছে।');
            } else {
                $cols = implode(',', array_keys($data));
                $ph = implode(',', array_fill(0, count($data), '?'));
                $stmt = $pdo->prepare("INSERT INTO customers ($cols) VALUES ($ph)");
                $stmt->execute(array_values($data));
                flash_set('নতুন কাস্টমার যুক্ত হয়েছে।');
            }
        } catch (PDOException $ex) {
            flash_set('সংরক্ষণ ব্যর্থ — এই মোবাইল নম্বরে ইতিমধ্যে অন্য একজন কাস্টমার যুক্ত আছে।', 'danger');
        }
        redirect('customers.php');
    }

    if ($action === 'cash_entry') {
        $customerId = (int)$_POST['customer_id'];
        $amount = (float)$_POST['amount'];
        $type = ($_POST['type'] ?? 'payment') === 'loan' ? 'loan' : 'payment';
        $date = $_POST['payment_date'] ?: date('Y-m-d');
        $note = trim($_POST['note'] ?? '');

        if ($amount > 0) {
            $stmt = $pdo->prepare("INSERT INTO customer_payments (customer_id, amount, type, payment_date, note, created_by) VALUES (?,?,?,?,?,?)");
            $stmt->execute([$customerId, $amount, $type, $date, $note, current_user()['id']]);

            if ($type === 'loan') {
                // হাওলাত/নগদ প্রদান — কোনো নির্দিষ্ট ইনভয়েসের সাথে যুক্ত নয়, তাই সরাসরি
                // শুরুর ব্যালেন্সে যোগ হয় (এতে "দোকানদার পাবে" বেড়ে যায়)
                $pdo->prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?")->execute([$amount, $customerId]);
                log_activity($pdo, 'কাস্টমারকে নগদ হাওলাত প্রদান ৳' . money($amount));
                flash_set('হাওলাত এন্ট্রি সংরক্ষণ করা হয়েছে।');
            } else {
                $remaining = $amount;

                // প্রথমে শুরুর ব্যালেন্স (opening balance) থেকে সমন্বয় — এটি কোনো নির্দিষ্ট ইনভয়েসের সাথে যুক্ত নয়
                $obStmt = $pdo->prepare("SELECT opening_balance FROM customers WHERE id = ?");
                $obStmt->execute([$customerId]);
                $openingBalance = (float)$obStmt->fetchColumn();
                if ($openingBalance > 0 && $remaining > 0) {
                    $applyToOpening = min($remaining, $openingBalance);
                    $obUpd = $pdo->prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?");
                    $obUpd->execute([$applyToOpening, $customerId]);
                    $remaining -= $applyToOpening;
                }

                // এরপর সবচেয়ে পুরনো বাকি ইনভয়েস থেকে ক্রমান্বয়ে সমন্বয়
                $dueSales = $pdo->prepare("SELECT id, due_amount FROM sales WHERE customer_id = ? AND due_amount > 0 ORDER BY id ASC");
                $dueSales->execute([$customerId]);
                foreach ($dueSales->fetchAll() as $ds) {
                    if ($remaining <= 0) break;
                    $pay = min($remaining, $ds['due_amount']);
                    $upd = $pdo->prepare("UPDATE sales SET due_amount = due_amount - ?, paid_amount = paid_amount + ? WHERE id = ?");
                    $upd->execute([$pay, $pay, $ds['id']]);
                    $remaining -= $pay;
                }

                // সব বাকি মিটে যাওয়ার পরও কিছু টাকা থেকে গেলে সেটি হারিয়ে যাবে না —
                // শুরুর ব্যালেন্স ঋণাত্মক করে কাস্টমারের জমা/অগ্রিম হিসেবে রাখা হয়
                // (অর্থাৎ এখন "কাস্টমার পাবে" কলামে দেখাবে)
                if ($remaining > 0) {
                    $pdo->prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?")->execute([$remaining, $customerId]);
                }

                log_activity($pdo, 'কাস্টমার পেমেন্ট গ্রহণ ৳' . money($amount));
                flash_set('জমা এন্ট্রি সংরক্ষণ করা হয়েছে।');
            }
        }
        redirect('customers.php?view=ledger&id=' . $customerId);
    }

    if ($action === 'send_reminder') {
        $customerId = (int)$_POST['customer_id'];
        $stmt = $pdo->prepare("SELECT * FROM customers WHERE id=?");
        $stmt->execute([$customerId]);
        $cust = $stmt->fetch();
        $dueStmt = $pdo->prepare("SELECT COALESCE(SUM(due_amount),0) d FROM sales WHERE customer_id=?");
        $dueStmt->execute([$customerId]);
        $due = (float)$dueStmt->fetch()['d'] + (float)($cust['opening_balance'] ?? 0);
        if ($due <= 0) {
            flash_set('এই কাস্টমারের কোনো বাকি নেই — রিমাইন্ডারের প্রয়োজন নেই।', 'danger');
            redirect('customers.php?view=ledger&id=' . $customerId);
        }
        $settings = shop_settings($pdo);
        $msg = "প্রিয় {$cust['name']}, {$settings['shop_name']}-এ আপনার বাকি রয়েছে ৳" . money($due) . "। অনুগ্রহ করে পরিশোধ করুন। ধন্যবাদ।";
        if ($cust['mobile']) {
            $res = send_sms($pdo, $cust['mobile'], $msg);
            if ($res['ok']) {
                flash_set('রিমাইন্ডার এসএমএস পাঠানো হয়েছে।');
            } else {
                flash_set('এসএমএস পাঠানো যায়নি: ' . $res['error'], 'danger');
            }
        } else {
            flash_set('এই কাস্টমারের মোবাইল নম্বর নেই।', 'danger');
        }
        redirect('customers.php?view=ledger&id=' . $customerId);
    }
}

// ---------- বাকি তালিকা CSV/Excel এক্সপোর্ট ----------
// যেসব কাস্টমারের বাকি আছে (দোকানদার পাবে) তাদের নাম, মোবাইল, ঠিকানা ও বাকির
// পরিমাণ — সবগুলো একসাথে এক CSV ফাইলে (Excel-এ খোলা যায়) ডাউনলোড হয়।
// HTML আউটপুট শুরুর আগেই হ্যান্ডেল করতে হয় (header পাঠানোর জন্য)।
if (($_GET['export'] ?? '') === 'due_csv') {
    $dueStmt = $pdo->query("
        SELECT c.name, c.mobile, c.address,
               (c.opening_balance + COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id=c.id), 0)) AS total_due
        FROM customers c
        HAVING total_due > 0
        ORDER BY total_due DESC
    ");
    $dueRows = $dueStmt->fetchAll();
    $csvRows = [];
    foreach ($dueRows as $r) {
        $csvRows[] = [$r['name'], $r['mobile'] ?: '-', $r['address'] ?: '-', money($r['total_due'])];
    }
    export_csv('customer_due_list_' . date('Y-m-d'), ['নাম', 'মোবাইল নাম্বার', 'ঠিকানা', 'বাকির পরিমাণ (৳)'], $csvRows);
}

$view = $_GET['view'] ?? 'list';
$pageTitle = 'কাস্টমার লেজার';
$activeNav = 'customers';

// ---------- ভিউ: একজন কাস্টমারের লেজার ----------
if ($view === 'ledger') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM customers WHERE id=?");
    $stmt->execute([$id]);
    $customer = $stmt->fetch();
    if (!$customer) { flash_set('কাস্টমার খুঁজে পাওয়া যায়নি।', 'danger'); redirect('customers.php'); }

    $salesStmt = $pdo->prepare("SELECT id, invoice_no, sale_date, total_amount, paid_amount, due_amount FROM sales WHERE customer_id=? ORDER BY sale_date DESC");
    $salesStmt->execute([$id]);
    $sales = $salesStmt->fetchAll();

    $payStmt = $pdo->prepare("SELECT * FROM customer_payments WHERE customer_id=? ORDER BY payment_date DESC");
    $payStmt->execute([$id]);
    $payments = $payStmt->fetchAll();

    $totalDue = (float)$customer['opening_balance'];
    foreach ($sales as $s) { $totalDue += $s['due_amount']; }
    // দুটি কলাম: totalDue ধনাত্মক হলে দোকানদার পাবে, ঋণাত্মক হলে কাস্টমার পাবে
    $shopWillGet = $totalDue > 0 ? $totalDue : 0;
    $customerWillGet = $totalDue < 0 ? abs($totalDue) : 0;

    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head">
        <a href="customers.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> তালিকায় ফিরুন</a>
        <a href="customers.php?edit=<?= (int)$customer['id'] ?>" class="btn btn-outline btn-sm"><i class="bi bi-pencil"></i> কাস্টমার সম্পাদনা</a>
    </div>
    <div class="row g-3">
        <div class="col-lg-4">
            <div class="card" style="padding:20px;">
                <h3 style="margin-top:0;"><?= e($customer['name']) ?></h3>
                <p style="color:var(--text-secondary);font-size:13.5px;margin-bottom:4px;"><i class="bi bi-telephone"></i> <?= e($customer['mobile'] ?: '—') ?></p>
                <p style="color:var(--text-secondary);font-size:13.5px;"><i class="bi bi-geo-alt"></i> <?= e($customer['address'] ?: '—') ?></p>
                <div class="row g-2" style="margin-top:14px;">
                    <div class="col-6">
                        <div class="stat-card c-orange">
                            <div class="stat-label">দোকানদার পাবে</div>
                            <div class="stat-value num">৳<?= money($shopWillGet) ?></div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="stat-card c-success">
                            <div class="stat-label">কাস্টমার পাবে</div>
                            <div class="stat-value num">৳<?= money($customerWillGet) ?></div>
                        </div>
                    </div>
                </div>
                <form method="POST" style="margin-top:16px;">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="cash_entry">
                    <input type="hidden" name="customer_id" value="<?= $customer['id'] ?>">
                    <input type="hidden" name="type" id="ce_type" value="payment">
                    <div class="form-group">
                        <label>নগদ লেনদেন</label>
                        <div class="btn-group" style="display:flex;gap:8px;">
                            <button type="button" id="ce_btn_payment" class="btn btn-primary btn-sm" style="flex:1;" onclick="setCashEntryType('payment')">গ্রাহকের থেকে পেলেন</button>
                            <button type="button" id="ce_btn_loan" class="btn btn-outline btn-sm" style="flex:1;" onclick="setCashEntryType('loan')">গ্রাহককে হাওলাত দিলেন</button>
                        </div>
                        <p class="form-hint" id="ce_hint">কেনাকাটার বাকি বা জমা হিসেবে গ্রাহকের কাছ থেকে নগদ গ্রহণ — বাকি কমবে।</p>
                    </div>
                    <div class="form-group">
                        <label>পরিমাণ (৳)</label>
                        <input type="number" step="0.01" min="0.01" name="amount" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>তারিখ</label>
                        <input type="date" name="payment_date" class="form-control" value="<?= date('Y-m-d') ?>">
                    </div>
                    <div class="form-group">
                        <label>নোট (ঐচ্ছিক)</label>
                        <input type="text" name="note" class="form-control" placeholder="যেমন: ঈদের আগে হাওলাত">
                    </div>
                    <button class="btn btn-primary btn-block" type="submit" id="ce_submit"><i class="bi bi-cash"></i> এন্ট্রি সংরক্ষণ</button>
                </form>
                <form method="POST" style="margin-top:8px;">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="send_reminder">
                    <input type="hidden" name="customer_id" value="<?= $customer['id'] ?>">
                    <button class="btn btn-outline btn-block" type="submit"><i class="bi bi-chat-dots"></i> এসএমএস রিমাইন্ডার পাঠান</button>
                </form>
            </div>
        </div>
        <div class="col-lg-8">
            <div class="card">
                <div class="card-header"><h3>ক্রয়ের ইতিহাস</h3></div>
                <div class="table-wrap" style="border:none;">
                    <table class="data-table">
                        <thead><tr><th>ইনভয়েস</th><th>তারিখ</th><th class="num">মোট</th><th class="num">পরিশোধিত</th><th class="num">বাকি</th></tr></thead>
                        <tbody>
                        <?php if (empty($sales)): ?>
                            <tr><td colspan="5"><div class="empty-state">কোনো লেনদেন নেই।</div></td></tr>
                        <?php endif; ?>
                        <?php foreach ($sales as $s): ?>
                            <tr>
                                <td><a href="sales_list.php?view=show&id=<?= $s['id'] ?>"><?= e($s['invoice_no']) ?></a></td>
                                <td><?= date('d M Y', strtotime($s['sale_date'])) ?></td>
                                <td class="num">৳<?= money($s['total_amount']) ?></td>
                                <td class="num">৳<?= money($s['paid_amount']) ?></td>
                                <td class="num"><?= $s['due_amount'] > 0 ? '<span class="badge badge-danger">৳'.money($s['due_amount']).'</span>' : '৳০.০০' ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card" style="margin-top:16px;">
                <div class="card-header"><h3>নগদ লেনদেন (কেনাবেচার বাইরে)</h3></div>
                <div class="table-wrap" style="border:none;">
                    <table class="data-table">
                        <thead><tr><th>তারিখ</th><th>ধরন</th><th class="num">পরিমাণ</th><th>নোট</th></tr></thead>
                        <tbody>
                        <?php if (empty($payments)): ?>
                            <tr><td colspan="4"><div class="empty-state">কোনো নগদ লেনদেন নেই।</div></td></tr>
                        <?php endif; ?>
                        <?php foreach ($payments as $p): ?>
                            <?php
                                $isRefund = (float)$p['amount'] < 0;
                                $ptype = $p['type'] ?? 'payment';
                                if ($isRefund) {
                                    $badge = '<span class="badge badge-warning">রিফান্ড (ফেরত)</span>';
                                    $sign = '+';
                                } elseif ($ptype === 'loan') {
                                    $badge = '<span class="badge badge-warning">হাওলাত দিলেন</span>';
                                    $sign = '+';
                                } else {
                                    $badge = '<span class="badge badge-success">জমা পেলেন</span>';
                                    $sign = '−';
                                }
                            ?>
                            <tr>
                                <td><?= date('d M Y', strtotime($p['payment_date'])) ?></td>
                                <td><?= $badge ?></td>
                                <td class="num"><?= $sign ?>৳<?= money(abs($p['amount'])) ?></td>
                                <td><?= e($p['note']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    <script>
    function setCashEntryType(type) {
        document.getElementById('ce_type').value = type;
        const isPayment = type === 'payment';
        document.getElementById('ce_btn_payment').className = 'btn btn-sm ' + (isPayment ? 'btn-primary' : 'btn-outline');
        document.getElementById('ce_btn_loan').className = 'btn btn-sm ' + (isPayment ? 'btn-outline' : 'btn-primary');
        document.getElementById('ce_hint').textContent = isPayment
            ? 'কেনাকাটার বাকি বা জমা হিসেবে গ্রাহকের কাছ থেকে নগদ গ্রহণ — বাকি কমবে।'
            : 'গ্রাহককে নগদ হাওলাত/ধার প্রদান — এতে গ্রাহকের বাকি বাড়বে।';
        document.getElementById('ce_submit').innerHTML = isPayment
            ? '<i class="bi bi-cash"></i> জমা সংরক্ষণ'
            : '<i class="bi bi-cash"></i> হাওলাত সংরক্ষণ';
    }
    </script>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: সব কাস্টমারের বাকির তালিকা (প্রিন্ট/PDF) ----------
// নাম, মোবাইল, ঠিকানা ও বাকির পরিমাণ — যাদের বাকি আছে শুধু তাদের একসাথে
// একটি প্রিন্ট-বান্ধব পাতায় দেখানো হয়, যা ব্রাউজারের "প্রিন্ট > Save as PDF"
// দিয়ে PDF হিসেবে সংরক্ষণ করা যায়। CSV/Excel বাটন উপরের এক্সপোর্ট হ্যান্ডলার ব্যবহার করে।
if ($view === 'due_list') {
    $dueStmt = $pdo->query("
        SELECT c.id, c.name, c.mobile, c.address,
               (c.opening_balance + COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id=c.id), 0)) AS total_due
        FROM customers c
        HAVING total_due > 0
        ORDER BY total_due DESC
    ");
    $dueCustomers = $dueStmt->fetchAll();
    $grandTotalDue = array_sum(array_column($dueCustomers, 'total_due'));

    $pageTitle = 'বাকির তালিকা';
    require_once __DIR__ . '/../includes/header.php';
    ?>
    <style>
    .due-list-letterhead { text-align:center; margin-bottom:18px; }
    .due-list-letterhead h2 { margin:0 0 4px; }
    .due-list-letterhead .muted { color:var(--text-secondary); font-size:13.5px; }
    .due-list-letterhead h3 { margin:14px 0 4px; font-size:16px; }
    </style>
    <div class="page-head no-print">
        <a href="customers.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> কাস্টমার তালিকায় ফিরুন</a>
        <div style="display:flex;gap:8px;">
            <a class="btn btn-light btn-sm" href="customers.php?export=due_csv"><i class="bi bi-file-earmark-spreadsheet"></i> CSV/Excel</a>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.print()"><i class="bi bi-printer"></i> প্রিন্ট / PDF</button>
        </div>
    </div>
    <div class="due-list-letterhead">
        <h2><?= e($settings['shop_name'] ?? '') ?></h2>
        <?php if (!empty($settings['address'])): ?><div class="muted"><?= e($settings['address']) ?></div><?php endif; ?>
        <?php if (!empty($settings['mobile'])): ?><div class="muted">ফোনঃ <?= e($settings['mobile']) ?></div><?php endif; ?>
        <h3>কাস্টমার বাকির তালিকা</h3>
        <div class="muted">তারিখঃ <?= date('d M Y') ?></div>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>#</th><th>নাম</th><th>মোবাইল</th><th>ঠিকানা</th><th class="num">বাকির পরিমাণ</th></tr></thead>
            <tbody>
            <?php if (empty($dueCustomers)): ?>
                <tr><td colspan="5"><div class="empty-state"><i class="bi bi-emoji-smile"></i>কোনো কাস্টমারের বাকি নেই।</div></td></tr>
            <?php endif; ?>
            <?php foreach ($dueCustomers as $i => $c): ?>
                <tr>
                    <td><?= $i + 1 ?></td>
                    <td><?= e($c['name']) ?></td>
                    <td><?= e($c['mobile'] ?: '—') ?></td>
                    <td><?= e($c['address'] ?: '—') ?></td>
                    <td class="num">৳<?= money($c['total_due']) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
            <?php if (!empty($dueCustomers)): ?>
            <tfoot>
                <tr><th colspan="4" style="text-align:right;">সর্বমোট বাকি</th><th class="num">৳<?= money($grandTotalDue) ?></th></tr>
            </tfoot>
            <?php endif; ?>
        </table>
    </div>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: কাস্টমার তালিকা ----------
$search = trim($_GET['q'] ?? '');
$where = '';
$params = [];
if ($search !== '') {
    $where = "WHERE c.name LIKE ? OR c.mobile LIKE ?";
    $params = ["%$search%", "%$search%"];
}
$stmt = $pdo->prepare("
    SELECT c.*, (c.opening_balance + COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id=c.id), 0)) AS total_due
    FROM customers c $where ORDER BY c.name ASC LIMIT 400");
$stmt->execute($params);
$customers = $stmt->fetchAll();

// লেজার পাতা থেকে "সম্পাদনা" চাপলে সরাসরি সেই কাস্টমারের মোডাল খুলে যাবে
$editId = (int)($_GET['edit'] ?? 0);
$editCustomer = null;
if ($editId) {
    $es = $pdo->prepare("SELECT * FROM customers WHERE id = ?");
    $es->execute([$editId]);
    $editCustomer = $es->fetch();
}

require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <form method="GET"><input type="text" name="q" class="form-control" placeholder="নাম / মোবাইল খুঁজুন..." value="<?= e($search) ?>"></form>
    <div style="display:flex;gap:8px;">
        <a href="customers.php?view=due_list" class="btn btn-light"><i class="bi bi-file-earmark-text"></i> বাকির তালিকা (PDF/Excel)</a>
        <button class="btn btn-primary" onclick="openAddCustomer()" data-bs-toggle="modal" data-bs-target="#customerModal"><i class="bi bi-person-plus"></i> নতুন কাস্টমার</button>
    </div>
</div>
<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th>নাম</th><th>মোবাইল</th><th>ধরন</th><th class="num">কাস্টমার পাবে</th><th class="num">দোকানদার পাবে</th><th></th></tr></thead>
        <tbody>
        <?php if (empty($customers)): ?>
            <tr><td colspan="6"><div class="empty-state"><i class="bi bi-people"></i>এখনো কোনো কাস্টমার যুক্ত হয়নি।</div></td></tr>
        <?php endif; ?>
        <?php foreach ($customers as $c): ?>
            <tr>
                <td><a href="customers.php?view=ledger&id=<?= $c['id'] ?>"><?= e($c['name']) ?></a></td>
                <td><?= e($c['mobile'] ?: '—') ?></td>
                <td><?= ['regular'=>'নিয়মিত','wholesale'=>'পাইকারি','student'=>'ছাত্র/ছাত্রী'][$c['customer_type']] ?? $c['customer_type'] ?></td>
                <td class="num"><?= $c['total_due'] < 0 ? '<span class="badge badge-success">৳'.money(abs($c['total_due'])).'</span>' : '৳০.০০' ?></td>
                <td class="num"><?= $c['total_due'] > 0 ? '<span class="badge badge-danger">৳'.money($c['total_due']).'</span>' : '৳০.০০' ?></td>
                <td style="display:flex;gap:6px;">
                    <button type="button" class="btn btn-sm btn-light" title="সম্পাদনা" onclick='openEditCustomer(<?= json_encode($c, JSON_UNESCAPED_UNICODE) ?>)'><i class="bi bi-pencil"></i></button>
                    <a href="customers.php?view=ledger&id=<?= $c['id'] ?>" class="btn btn-sm btn-light"><i class="bi bi-journal-text"></i> লেজার</a>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="modal fade" id="customerModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_customer">
                <input type="hidden" name="id" id="c_id">
                <div class="modal-header"><h5 class="modal-title" id="c_modal_title">নতুন কাস্টমার</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body">
                    <div class="form-group"><label>নাম</label><input type="text" name="name" id="c_name" class="form-control" required></div>
                    <div class="form-group"><label>মোবাইল</label><input type="text" name="mobile" id="c_mobile" class="form-control" required></div>
                    <div class="form-group"><label>ঠিকানা</label><input type="text" name="address" id="c_address" class="form-control"></div>
                    <div class="form-group">
                        <label>ধরন</label>
                        <select name="customer_type" id="c_type" class="form-control">
                            <option value="regular">নিয়মিত</option>
                            <option value="wholesale">পাইকারি</option>
                            <option value="student">ছাত্র/ছাত্রী</option>
                        </select>
                    </div>
                    <div class="form-group"><label>শুরুর ব্যালেন্স / বাকি (৳)</label><input type="number" step="0.01" name="opening_balance" id="c_opening" class="form-control" value="0"></div>
                </div>
                <div class="modal-footer"><button type="submit" class="btn btn-primary">সংরক্ষণ করুন</button></div>
            </form>
        </div>
    </div>
</div>
<script>
function openAddCustomer() {
    document.getElementById('c_modal_title').textContent = 'নতুন কাস্টমার';
    document.getElementById('c_id').value = '';
    document.getElementById('c_name').value = '';
    document.getElementById('c_mobile').value = '';
    document.getElementById('c_address').value = '';
    document.getElementById('c_type').value = 'regular';
    document.getElementById('c_opening').value = '0';
}
function openEditCustomer(c) {
    document.getElementById('c_modal_title').textContent = 'কাস্টমার সম্পাদনা';
    document.getElementById('c_id').value = c.id;
    document.getElementById('c_name').value = c.name || '';
    document.getElementById('c_mobile').value = c.mobile || '';
    document.getElementById('c_address').value = c.address || '';
    document.getElementById('c_type').value = c.customer_type || 'regular';
    document.getElementById('c_opening').value = c.opening_balance || '0';
    new bootstrap.Modal(document.getElementById('customerModal')).show();
}
<?php if ($editCustomer): ?>
openEditCustomer(<?= json_encode($editCustomer, JSON_UNESCAPED_UNICODE) ?>);
<?php endif; ?>
</script>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
