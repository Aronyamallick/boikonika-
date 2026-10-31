<?php
/**
 * একাউন্টস / ক্যাশ লেজার (হিসাব খাতা) — শুধুমাত্র মালিকের জন্য।
 * বিক্রয়/ক্রয়/কাস্টমার-সাপ্লায়ার পেমেন্ট/খরচ — সবগুলো উৎস থেকে নগদ
 * লেনদেন একত্রিত করে একটি একক তালিকায় (running balance সহ) দেখানো হয়।
 * এখানে কোথাও বিদ্যমান sales/purchase/customers/expenses-এর হিসাব-লজিক
 * পরিবর্তন করা হয়নি — শুধু পড়ে (SELECT) একত্রিত করা হয়েছে।
 * এছাড়া বিক্রয়/ক্রয়ের বাইরের নগদ লেনদেন (বেতন, ভাড়া, মালিকের উত্তোলন
 * ইত্যাদি) হাতে এন্ট্রি করার জন্য account_transactions টেবিল ব্যবহৃত হয়।
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_owner();

// ---------- POST: নতুন ম্যানুয়াল এন্ট্রি ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_entry') {
    csrf_verify();
    $type = ($_POST['type'] ?? 'out') === 'in' ? 'in' : 'out';
    $category = trim($_POST['category'] ?? '');
    $amount = max(0, (float)($_POST['amount'] ?? 0));
    $txnDate = $_POST['txn_date'] ?: date('Y-m-d');
    $method = trim($_POST['method'] ?? 'cash');
    $note = trim($_POST['note'] ?? '');

    if ($category === '' || $amount <= 0) {
        flash_set('খাত ও পরিমাণ আবশ্যক।', 'danger');
        redirect('accounts.php');
    }
    $stmt = $pdo->prepare("INSERT INTO account_transactions (type, category, amount, txn_date, method, note, created_by) VALUES (?,?,?,?,?,?,?)");
    $stmt->execute([$type, $category, $amount, $txnDate, $method, $note, current_user()['id']]);
    log_activity($pdo, ($type === 'in' ? 'নগদ জমা' : 'নগদ খরচ') . ' এন্ট্রি: ' . $category . ' ৳' . money($amount));
    flash_set('এন্ট্রি সংরক্ষণ করা হয়েছে।');
    redirect('accounts.php?from=' . urlencode($_GET['from'] ?? date('Y-m-01')) . '&to=' . urlencode($_GET['to'] ?? date('Y-m-d')));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'delete_entry') {
    csrf_verify();
    $id = (int)($_POST['id'] ?? 0);
    $pdo->prepare("DELETE FROM account_transactions WHERE id=?")->execute([$id]);
    flash_set('এন্ট্রি মুছে ফেলা হয়েছে।');
    redirect('accounts.php');
}

$pageTitle = 'একাউন্টস / ক্যাশ লেজার';
$activeNav = 'accounts';

$from = $_GET['from'] ?? date('Y-m-01');
$to = $_GET['to'] ?? date('Y-m-d');

// ---------- সময়সীমার শুরুর আগের (ওপেনিং) ব্যালেন্স ----------
$sums = [];
$q1 = $pdo->prepare("SELECT COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE -amount END),0) v FROM account_transactions WHERE txn_date < ?");
$q1->execute([$from]); $sums[] = (float)$q1->fetch()['v'];
$q2 = $pdo->prepare("SELECT COALESCE(SUM(paid_amount),0) v FROM sales WHERE DATE(sale_date) < ?");
$q2->execute([$from]); $sums[] = (float)$q2->fetch()['v'];
$q3 = $pdo->prepare("SELECT COALESCE(SUM(paid_amount),0) v FROM purchases WHERE purchase_date < ?");
$q3->execute([$from]); $sums[] = -1 * (float)$q3->fetch()['v'];
$q4 = $pdo->prepare("SELECT COALESCE(SUM(CASE WHEN type='payment' THEN amount ELSE -amount END),0) v FROM customer_payments WHERE payment_date < ?");
$q4->execute([$from]); $sums[] = (float)$q4->fetch()['v'];
$q5 = $pdo->prepare("SELECT COALESCE(SUM(CASE WHEN type='payment' THEN -amount ELSE amount END),0) v FROM supplier_payments WHERE payment_date < ?");
$q5->execute([$from]); $sums[] = (float)$q5->fetch()['v'];
$q6 = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date < ?");
$q6->execute([$from]); $sums[] = -1 * (float)$q6->fetch()['v'];
$openingBalance = array_sum($sums);

// ---------- নির্বাচিত সময়সীমার লেনদেন ----------
$sql = "
    SELECT txn_date d, type t, category desc_text, amount amt, method m, note n, 'manual' src, id ref_id
    FROM account_transactions WHERE txn_date BETWEEN ? AND ?
    UNION ALL
    SELECT DATE(sale_date), 'in', CONCAT('বিক্রয় সংগ্রহ — ', invoice_no), paid_amount, payment_method, NULL, 'sale', id
    FROM sales WHERE DATE(sale_date) BETWEEN ? AND ? AND paid_amount > 0
    UNION ALL
    SELECT purchase_date, 'out', CONCAT('ক্রয় পরিশোধ', IF(invoice_no IS NOT NULL, CONCAT(' — ', invoice_no), '')), paid_amount, NULL, note, 'purchase', id
    FROM purchases WHERE purchase_date BETWEEN ? AND ? AND paid_amount > 0
    UNION ALL
    SELECT payment_date, IF(type='payment','in','out'), IF(type='payment','কাস্টমার পেমেন্ট গ্রহণ','কাস্টমারকে হাওলাত প্রদান'), amount, NULL, note, 'customer_payment', id
    FROM customer_payments WHERE payment_date BETWEEN ? AND ?
    UNION ALL
    SELECT payment_date, IF(type='payment','out','in'), IF(type='payment','সাপ্লায়ার পেমেন্ট প্রদান','সাপ্লায়ার থেকে ফেরত'), amount, NULL, note, 'supplier_payment', id
    FROM supplier_payments WHERE payment_date BETWEEN ? AND ?
    UNION ALL
    SELECT expense_date, 'out', CONCAT('খরচ — ', category), amount, NULL, note, 'expense', id
    FROM expenses WHERE expense_date BETWEEN ? AND ?
    ORDER BY d ASC, ref_id ASC
";
$stmt = $pdo->prepare($sql);
$stmt->execute([$from, $to, $from, $to, $from, $to, $from, $to, $from, $to, $from, $to]);
$rows = $stmt->fetchAll();

$totalIn = 0.0;
$totalOut = 0.0;
foreach ($rows as $r) {
    if ($r['t'] === 'in') $totalIn += (float)$r['amt']; else $totalOut += (float)$r['amt'];
}
$closingBalance = $openingBalance + $totalIn - $totalOut;

// ---------- CSV/Excel এক্সপোর্ট ----------
if (($_GET['export'] ?? '') === 'csv') {
    $csvRows = [];
    $running = $openingBalance;
    $csvRows[] = ['', $from . ' এর আগের ব্যালেন্স', '', '', money($openingBalance)];
    foreach ($rows as $r) {
        $running += $r['t'] === 'in' ? (float)$r['amt'] : -(float)$r['amt'];
        $csvRows[] = [
            date('d M Y', strtotime($r['d'])),
            $r['desc_text'],
            $r['t'] === 'in' ? money($r['amt']) : '',
            $r['t'] === 'out' ? money($r['amt']) : '',
            money($running),
        ];
    }
    export_csv('cash_ledger_' . $from . '_to_' . $to, ['তারিখ', 'বিবরণ', 'জমা (৳)', 'খরচ (৳)', 'ব্যালেন্স (৳)'], $csvRows);
}

require_once __DIR__ . '/../includes/header.php';
?>
<style>
@media print { .no-print { display:none !important; } }
</style>
<div class="page-head no-print">
    <form method="GET" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <label style="font-size:13px;color:var(--text-secondary);">থেকে</label>
        <input type="date" name="from" class="form-control" value="<?= e($from) ?>">
        <label style="font-size:13px;color:var(--text-secondary);">পর্যন্ত</label>
        <input type="date" name="to" class="form-control" value="<?= e($to) ?>">
        <button class="btn btn-light btn-sm"><i class="bi bi-funnel"></i> ফিল্টার</button>
        <a class="btn btn-light btn-sm" href="?<?= http_build_query(array_merge($_GET, ['export' => 'csv'])) ?>"><i class="bi bi-file-earmark-spreadsheet"></i> CSV/Excel</a>
        <button type="button" class="btn btn-light btn-sm" onclick="window.print()"><i class="bi bi-printer"></i> প্রিন্ট / PDF</button>
    </form>
    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#entryModal"><i class="bi bi-plus-lg"></i> নতুন এন্ট্রি</button>
</div>

<div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px;">
    <div class="stat-card sm"><div class="stat-label">শুরুর ব্যালেন্স</div><div class="stat-value num">৳<?= money($openingBalance) ?></div></div>
    <div class="stat-card sm c-success"><div class="stat-label">মোট জমা</div><div class="stat-value num">৳<?= money($totalIn) ?></div></div>
    <div class="stat-card sm c-danger"><div class="stat-label">মোট খরচ</div><div class="stat-value num">৳<?= money($totalOut) ?></div></div>
    <div class="stat-card sm"><div class="stat-label">শেষ ব্যালেন্স</div><div class="stat-value num">৳<?= money($closingBalance) ?></div></div>
</div>

<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th>তারিখ</th><th>বিবরণ</th><th class="num">জমা</th><th class="num">খরচ</th><th class="num">ব্যালেন্স</th><th class="no-print"></th></tr></thead>
        <tbody>
            <tr style="background:var(--surface-2,#f7f5fb);">
                <td colspan="4"><em><?= e(date('d M Y', strtotime($from))) ?>-এর আগের ব্যালেন্স</em></td>
                <td class="num">৳<?= money($openingBalance) ?></td>
                <td class="no-print"></td>
            </tr>
        <?php if (empty($rows)): ?>
            <tr><td colspan="6"><div class="empty-state"><i class="bi bi-journal-text"></i>এই সময়সীমায় কোনো লেনদেন নেই।</div></td></tr>
        <?php endif; ?>
        <?php $running = $openingBalance; foreach ($rows as $r):
            $running += $r['t'] === 'in' ? (float)$r['amt'] : -(float)$r['amt'];
        ?>
            <tr>
                <td><?= e(date('d M Y', strtotime($r['d']))) ?></td>
                <td><?= e($r['desc_text']) ?><?= $r['n'] ? '<div style="font-size:11.5px;color:var(--text-secondary);">' . e($r['n']) . '</div>' : '' ?></td>
                <td class="num"><?= $r['t'] === 'in' ? '৳' . money($r['amt']) : '—' ?></td>
                <td class="num"><?= $r['t'] === 'out' ? '৳' . money($r['amt']) : '—' ?></td>
                <td class="num">৳<?= money($running) ?></td>
                <td class="no-print">
                    <?php if ($r['src'] === 'manual'): ?>
                    <form method="POST" onsubmit="return confirm('এই এন্ট্রিটি মুছে ফেলতে চান?');" style="display:inline;">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="delete_entry">
                        <input type="hidden" name="id" value="<?= (int)$r['ref_id'] ?>">
                        <button class="btn btn-sm btn-light text-danger"><i class="bi bi-trash"></i></button>
                    </form>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="modal fade" id="entryModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_entry">
                <div class="modal-header"><h5 class="modal-title">নতুন লেজার এন্ট্রি</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>ধরন</label>
                        <select name="type" class="form-control">
                            <option value="out">খরচ / উত্তোলন (বাইরে যাচ্ছে)</option>
                            <option value="in">জমা / আয় (ভেতরে আসছে)</option>
                        </select>
                    </div>
                    <div class="form-group"><label>খাত</label><input type="text" name="category" class="form-control" placeholder="যেমনঃ দোকান ভাড়া, বেতন, মালিকের উত্তোলন, ব্যাংক জমা" required></div>
                    <div class="form-group"><label>পরিমাণ (৳)</label><input type="number" step="0.01" min="0" name="amount" class="form-control" required></div>
                    <div class="form-group"><label>তারিখ</label><input type="date" name="txn_date" class="form-control" value="<?= date('Y-m-d') ?>"></div>
                    <div class="form-group"><label>মাধ্যম</label>
                        <select name="method" class="form-control">
                            <option value="cash">ক্যাশ</option>
                            <option value="bank">ব্যাংক</option>
                            <option value="mobile_banking">মোবাইল ব্যাংকিং</option>
                        </select>
                    </div>
                    <div class="form-group"><label>নোট (ঐচ্ছিক)</label><textarea name="note" class="form-control" rows="2"></textarea></div>
                </div>
                <div class="modal-footer"><button type="submit" class="btn btn-primary">সংরক্ষণ করুন</button></div>
            </form>
        </div>
    </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
