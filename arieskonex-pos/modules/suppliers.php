<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_owner();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'save_supplier') {
        $id = (int)($_POST['id'] ?? 0);
        $data = [
            'name' => trim($_POST['name']),
            'company' => trim($_POST['company']) ?: null,
            'mobile' => trim($_POST['mobile']) ?: null,
            'address' => trim($_POST['address']) ?: null,
            'opening_balance' => (float)($_POST['opening_balance'] ?? 0),
        ];
        // একই মোবাইল নম্বরে একাধিক সাপ্লায়ার যুক্ত করা যাবে না
        if ($data['mobile'] !== null) {
            $dupStmt = $pdo->prepare("SELECT name FROM suppliers WHERE mobile = ? AND id != ? LIMIT 1");
            $dupStmt->execute([$data['mobile'], $id ?: 0]);
            $dup = $dupStmt->fetch();
            if ($dup) {
                flash_set('এই মোবাইল নম্বরে ইতিমধ্যে "' . $dup['name'] . '" নামে একজন সাপ্লায়ার যুক্ত আছে। একই নম্বর দুইজনের জন্য ব্যবহার করা যাবে না।', 'danger');
                redirect('suppliers.php');
            }
        }

        try {
            if ($id) {
                $stmt = $pdo->prepare("UPDATE suppliers SET name=?, company=?, mobile=?, address=?, opening_balance=? WHERE id=?");
                $stmt->execute(array_merge(array_values($data), [$id]));
                flash_set('সাপ্লায়ারের তথ্য হালনাগাদ হয়েছে।');
            } else {
                $cols = implode(',', array_keys($data));
                $ph = implode(',', array_fill(0, count($data), '?'));
                $stmt = $pdo->prepare("INSERT INTO suppliers ($cols) VALUES ($ph)");
                $stmt->execute(array_values($data));
                flash_set('নতুন সাপ্লায়ার যুক্ত হয়েছে।');
            }
        } catch (PDOException $ex) {
            flash_set('সংরক্ষণ ব্যর্থ — এই মোবাইল নম্বরে ইতিমধ্যে অন্য একজন সাপ্লায়ার যুক্ত আছে।', 'danger');
        }
        redirect('suppliers.php');
    }

    if ($action === 'add_payment') {
        $supplierId = (int)$_POST['supplier_id'];
        $amount = (float)$_POST['amount'];
        $type = ($_POST['type'] ?? 'payment') === 'receipt' ? 'receipt' : 'payment';
        $date = $_POST['payment_date'] ?: date('Y-m-d');
        $note = trim($_POST['note'] ?? '');
        if ($amount > 0) {
            $stmt = $pdo->prepare("INSERT INTO supplier_payments (supplier_id, amount, type, payment_date, note, created_by) VALUES (?,?,?,?,?,?)");
            $stmt->execute([$supplierId, $amount, $type, $date, $note, current_user()['id']]);

            if ($type === 'receipt') {
                // দোকানদার পাবে — সাপ্লায়ারের কাছ থেকে নগদ প্রাপ্তি। কোনো নির্দিষ্ট
                // ইনভয়েসের সাথে যুক্ত নয়, তাই সরাসরি শুরুর ব্যালেন্সে যোগ হয়
                // (এতে বকেয়া বাড়ে/প্রাপ্য কমে)
                $pdo->prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?")->execute([$amount, $supplierId]);
                log_activity($pdo, 'সাপ্লায়ারের কাছ থেকে নগদ প্রাপ্তি ৳' . money($amount));
                flash_set('প্রাপ্তি এন্ট্রি সংরক্ষণ করা হয়েছে।');
            } else {
                $remaining = $amount;

                // প্রথমে শুরুর বকেয়া (opening balance) থেকে সমন্বয় — এটি কোনো নির্দিষ্ট ইনভয়েসের সাথে যুক্ত নয়
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
                    $pay = min($remaining, $dp['due_amount']);
                    $upd = $pdo->prepare("UPDATE purchases SET due_amount = due_amount - ?, paid_amount = paid_amount + ? WHERE id = ?");
                    $upd->execute([$pay, $pay, $dp['id']]);
                    $remaining -= $pay;
                }

                // সব বকেয়া মিটে যাওয়ার পরও কিছু টাকা থেকে গেলে সেটি হারিয়ে যাবে না —
                // শুরুর ব্যালেন্স ঋণাত্মক করে সাপ্লায়ারের কাছে প্রাপ্য হিসেবে রাখা হয়
                if ($remaining > 0) {
                    $pdo->prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?")->execute([$remaining, $supplierId]);
                }

                log_activity($pdo, 'সাপ্লায়ার পেমেন্ট প্রদান ৳' . money($amount));
                flash_set('পেমেন্ট সংরক্ষণ করা হয়েছে।');
            }
        }
        redirect('suppliers.php?view=ledger&id=' . $supplierId);
    }
}

$view = $_GET['view'] ?? 'list';
$pageTitle = 'সাপ্লায়ার লেজার';
$activeNav = 'suppliers';

if ($view === 'ledger') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM suppliers WHERE id=?");
    $stmt->execute([$id]);
    $supplier = $stmt->fetch();
    if (!$supplier) { flash_set('সাপ্লায়ার খুঁজে পাওয়া যায়নি।', 'danger'); redirect('suppliers.php'); }

    $purStmt = $pdo->prepare("SELECT id, invoice_no, purchase_date, total_amount, paid_amount, due_amount FROM purchases WHERE supplier_id=? ORDER BY purchase_date DESC");
    $purStmt->execute([$id]);
    $purchases = $purStmt->fetchAll();

    $payStmt = $pdo->prepare("SELECT * FROM supplier_payments WHERE supplier_id=? ORDER BY payment_date DESC");
    $payStmt->execute([$id]);
    $payments = $payStmt->fetchAll();

    $totalDue = (float)$supplier['opening_balance'];
    foreach ($purchases as $p) { $totalDue += $p['due_amount']; }
    // দুটি কলাম: totalDue ধনাত্মক হলে সাপ্লায়ার পাবে, ঋণাত্মক হলে দোকানদার পাবে
    $supplierWillGet = $totalDue > 0 ? $totalDue : 0;
    $shopWillGet = $totalDue < 0 ? abs($totalDue) : 0;

    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head">
        <a href="suppliers.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> তালিকায় ফিরুন</a>
    </div>
    <div class="row g-3">
        <div class="col-lg-4">
            <div class="card" style="padding:20px;">
                <h3 style="margin-top:0;"><?= e($supplier['name']) ?></h3>
                <p style="color:var(--text-secondary);font-size:13.5px;margin-bottom:4px;"><?= e($supplier['company'] ?: '—') ?></p>
                <p style="color:var(--text-secondary);font-size:13.5px;margin-bottom:4px;"><i class="bi bi-telephone"></i> <?= e($supplier['mobile'] ?: '—') ?></p>
                <div class="row g-2" style="margin-top:14px;">
                    <div class="col-6">
                        <div class="stat-card c-magenta">
                            <div class="stat-label">সাপ্লায়ার পাবে</div>
                            <div class="stat-value num">৳<?= money($supplierWillGet) ?></div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="stat-card c-success">
                            <div class="stat-label">দোকানদার পাবে</div>
                            <div class="stat-value num">৳<?= money($shopWillGet) ?></div>
                        </div>
                    </div>
                </div>
                <form method="POST" style="margin-top:16px;">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="add_payment">
                    <input type="hidden" name="supplier_id" value="<?= $supplier['id'] ?>">
                    <input type="hidden" name="type" id="ce_type" value="payment">
                    <div class="form-group">
                        <label>নগদ লেনদেন</label>
                        <div class="btn-group" style="display:flex;gap:8px;">
                            <button type="button" id="ce_btn_payment" class="btn btn-primary btn-sm" style="flex:1;" onclick="setCashEntryType('payment')">সাপ্লায়ার পাবে</button>
                            <button type="button" id="ce_btn_receipt" class="btn btn-outline btn-sm" style="flex:1;" onclick="setCashEntryType('receipt')">দোকানদার পাবে</button>
                        </div>
                        <p class="form-hint" id="ce_hint">সাপ্লায়ারকে নগদ পরিশোধ — বকেয়া কমবে।</p>
                    </div>
                    <div class="form-group"><label>পরিমাণ (৳)</label><input type="number" step="0.01" min="0.01" name="amount" class="form-control" required></div>
                    <div class="form-group"><label>তারিখ</label><input type="date" name="payment_date" class="form-control" value="<?= date('Y-m-d') ?>"></div>
                    <div class="form-group"><label>নোট (ঐচ্ছিক)</label><input type="text" name="note" class="form-control"></div>
                    <button class="btn btn-primary btn-block" type="submit" id="ce_submit"><i class="bi bi-cash"></i> পরিশোধ সংরক্ষণ</button>
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
                        <?php if (empty($purchases)): ?><tr><td colspan="5"><div class="empty-state">কোনো লেনদেন নেই।</div></td></tr><?php endif; ?>
                        <?php foreach ($purchases as $p): ?>
                            <tr>
                                <td><a href="purchase.php?view=show&id=<?= $p['id'] ?>"><?= e($p['invoice_no']) ?></a></td>
                                <td><?= date('d M Y', strtotime($p['purchase_date'])) ?></td>
                                <td class="num">৳<?= money($p['total_amount']) ?></td>
                                <td class="num">৳<?= money($p['paid_amount']) ?></td>
                                <td class="num"><?= $p['due_amount'] > 0 ? '<span class="badge badge-danger">৳'.money($p['due_amount']).'</span>' : '৳০.০০' ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card" style="margin-top:16px;">
                <div class="card-header"><h3>নগদ লেনদেন (পেমেন্ট হিস্ট্রি)</h3></div>
                <div class="table-wrap" style="border:none;">
                    <table class="data-table">
                        <thead><tr><th>তারিখ</th><th>ধরন</th><th class="num">পরিমাণ</th><th>নোট</th></tr></thead>
                        <tbody>
                        <?php if (empty($payments)): ?><tr><td colspan="4"><div class="empty-state">কোনো পেমেন্ট নেই।</div></td></tr><?php endif; ?>
                        <?php foreach ($payments as $p): ?>
                            <?php
                                $ptype = $p['type'] ?? 'payment';
                                if ($ptype === 'receipt') {
                                    $badge = '<span class="badge badge-success">দোকানদার পেলেন</span>';
                                } else {
                                    $badge = '<span class="badge badge-warning">সাপ্লায়ার পেলেন</span>';
                                }
                            ?>
                            <tr>
                                <td><?= date('d M Y', strtotime($p['payment_date'])) ?></td>
                                <td><?= $badge ?></td>
                                <td class="num">৳<?= money($p['amount']) ?></td>
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
        document.getElementById('ce_btn_receipt').className = 'btn btn-sm ' + (isPayment ? 'btn-outline' : 'btn-primary');
        document.getElementById('ce_hint').textContent = isPayment
            ? 'সাপ্লায়ারকে নগদ পরিশোধ — বকেয়া কমবে।'
            : 'সাপ্লায়ারের কাছ থেকে নগদ প্রাপ্তি — বকেয়া বাড়বে/প্রাপ্য কমবে।';
        document.getElementById('ce_submit').innerHTML = isPayment
            ? '<i class="bi bi-cash"></i> পরিশোধ সংরক্ষণ'
            : '<i class="bi bi-cash"></i> প্রাপ্তি সংরক্ষণ';
    }
    </script>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

$search = trim($_GET['q'] ?? '');
$where = '';
$params = [];
if ($search !== '') {
    $where = "WHERE s.name LIKE ? OR s.company LIKE ? OR s.mobile LIKE ?";
    $params = ["%$search%", "%$search%", "%$search%"];
}
$stmt = $pdo->prepare("
    SELECT s.*, (s.opening_balance + COALESCE((SELECT SUM(due_amount) FROM purchases WHERE supplier_id=s.id), 0)) AS total_due
    FROM suppliers s $where ORDER BY s.name ASC LIMIT 400");
$stmt->execute($params);
$suppliers = $stmt->fetchAll();

require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <form method="GET"><input type="text" name="q" class="form-control" placeholder="নাম / কোম্পানি খুঁজুন..." value="<?= e($search) ?>"></form>
    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#supplierModal"><i class="bi bi-building-add"></i> নতুন সাপ্লায়ার</button>
</div>
<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th>নাম</th><th>কোম্পানি</th><th>মোবাইল</th><th class="num">মোট বকেয়া</th><th></th></tr></thead>
        <tbody>
        <?php if (empty($suppliers)): ?><tr><td colspan="5"><div class="empty-state"><i class="bi bi-building"></i>এখনো কোনো সাপ্লায়ার যুক্ত হয়নি।</div></td></tr><?php endif; ?>
        <?php foreach ($suppliers as $s): ?>
            <tr>
                <td><a href="suppliers.php?view=ledger&id=<?= $s['id'] ?>"><?= e($s['name']) ?></a></td>
                <td><?= e($s['company'] ?: '—') ?></td>
                <td><?= e($s['mobile'] ?: '—') ?></td>
                <td class="num"><?php if ($s['total_due'] > 0): ?><span class="badge badge-danger">৳<?= money($s['total_due']) ?></span><?php elseif ($s['total_due'] < 0): ?><span class="badge badge-success" title="সাপ্লায়ারের কাছে প্রাপ্য">প্রাপ্য ৳<?= money(abs($s['total_due'])) ?></span><?php else: ?>৳০.০০<?php endif; ?></td>
                <td><a href="suppliers.php?view=ledger&id=<?= $s['id'] ?>" class="btn btn-sm btn-light"><i class="bi bi-journal-text"></i> লেজার</a></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="modal fade" id="supplierModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_supplier">
                <div class="modal-header"><h5 class="modal-title">নতুন সাপ্লায়ার</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body">
                    <div class="form-group"><label>নাম</label><input type="text" name="name" class="form-control" required></div>
                    <div class="form-group"><label>কোম্পানি / প্রকাশনী</label><input type="text" name="company" class="form-control"></div>
                    <div class="form-group"><label>মোবাইল</label><input type="text" name="mobile" class="form-control"></div>
                    <div class="form-group"><label>ঠিকানা</label><input type="text" name="address" class="form-control"></div>
                    <div class="form-group"><label>শুরুর বকেয়া (৳)</label><input type="number" step="0.01" name="opening_balance" class="form-control" value="0"></div>
                </div>
                <div class="modal-footer"><button type="submit" class="btn btn-primary">সংরক্ষণ করুন</button></div>
            </form>
        </div>
    </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
