<?php
/**
 * রিপোর্ট সেন্টার — ব্যবসার সমস্ত পরিসংখ্যান এক জায়গায়।
 * শুধুমাত্র মালিকের জন্য (require_owner) — যেহেতু এতে লাভ/ক্ষতি ও অন্যান্য
 * স্পর্শকাতর আর্থিক তথ্য থাকে। বিদ্যমান সেলস/পারচেজ/স্টক/কাস্টমার/সাপ্লায়ার/
 * এক্সপেন্স মডিউলের ডেটা ও হিসাব-পদ্ধতি অপরিবর্তিত রেখে সেগুলোর উপর ভিত্তি করেই
 * প্রতিটি রিপোর্ট তৈরি — কোথাও পৃথক/সাংঘর্ষিক হিসাব-লজিক তৈরি করা হয়নি।
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_owner();

// ---------- POST: নতুন খরচ যুক্ত করা (অপরিবর্তিত) ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_expense') {
    csrf_verify();
    $stmt = $pdo->prepare("INSERT INTO expenses (category, amount, expense_date, note, created_by) VALUES (?,?,?,?,?)");
    $stmt->execute([
        trim($_POST['category']),
        (float)$_POST['amount'],
        $_POST['expense_date'] ?: date('Y-m-d'),
        trim($_POST['note'] ?? ''),
        current_user()['id'],
    ]);
    log_activity($pdo, 'নতুন খরচ যুক্ত: ' . trim($_POST['category']));
    flash_set('খরচ সংরক্ষণ করা হয়েছে।');
    redirect('reports.php?tab=expenses');
}

$tab   = $_GET['tab'] ?? 'dashboard';
$today = date('Y-m-d');
$from  = $_GET['from'] ?? date('Y-m-01');
$to    = $_GET['to'] ?? $today;
if (strtotime($to) < strtotime($from)) { [$from, $to] = [$to, $from]; }
$export = $_GET['export'] ?? '';
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 50;

// অতিরিক্ত ফিল্টার (প্রযোজ্য ট্যাবগুলোতে ব্যবহৃত)
$fCustomer = (int)($_GET['customer_id'] ?? 0);
$fSupplier = (int)($_GET['supplier_id'] ?? 0);
$fUser     = (int)($_GET['user_id'] ?? 0);
$fProduct  = (int)($_GET['product_id'] ?? 0);
$fCategory = (int)($_GET['category_id'] ?? 0);
$fPayment  = trim($_GET['payment_method'] ?? '');

$tabs = [
    'dashboard'       => 'ড্যাশবোর্ড',
    'sales_report'    => 'বিক্রয় রিপোর্ট',
    'best_selling'    => 'বেস্ট সেলিং',
    'category_sales'  => 'ক্যাটাগরি বিক্রয়',
    'purchase_report' => 'ক্রয় রিপোর্ট',
    'stock_report'    => 'স্টক রিপোর্ট',
    'profit_loss'     => 'লাভ-ক্ষতি',
    'cash_report'     => 'ক্যাশ ও আর্থিক',
    'customer_report' => 'কাস্টমার রিপোর্ট',
    'supplier_report' => 'সাপ্লায়ার রিপোর্ট',
    'employee_report' => 'সেলসম্যান রিপোর্ট',
    'return_report'   => 'রিটার্ন রিপোর্ট',
    'expenses'        => 'আয়-ব্যয়',
    'payment_report'  => 'পেমেন্ট রিপোর্ট',
    'below_cost'      => 'লোকসানি বিক্রয়',
    'ai_insights'     => '🤖 AI বিশ্লেষণ',
    'audit_log'       => '🔐 অডিট লগ',
];
if (!isset($tabs[$tab])) { $tab = 'dashboard'; }

/* =====================================================================
   ছোট হেল্পার — এই পাতাতেই ব্যবহৃত (একাধিক জায়গা/এক্সপোর্ট থেকে কল হয়)
   ===================================================================== */

// বিক্রয় রিপোর্টের সারি (ফিল্টারসহ) — পেজিনেশন + CSV এক্সপোর্ট দুটোই এই একই ফাংশন ব্যবহার করে
function rpt_sales_rows($pdo, $from, $to, $fCustomer, $fUser, $fProduct, $fCategory, $fPayment, $limit = null, $offset = 0) {
    $where = "WHERE DATE(s.sale_date) BETWEEN ? AND ?";
    $params = [$from, $to];
    if ($fCustomer) { $where .= " AND s.customer_id = ?"; $params[] = $fCustomer; }
    if ($fUser) { $where .= " AND s.created_by = ?"; $params[] = $fUser; }
    if ($fPayment !== '') { $where .= " AND s.payment_method = ?"; $params[] = $fPayment; }
    if ($fProduct) { $where .= " AND EXISTS (SELECT 1 FROM sale_items si2 WHERE si2.sale_id = s.id AND si2.product_id = ?)"; $params[] = $fProduct; }
    if ($fCategory) { $where .= " AND EXISTS (SELECT 1 FROM sale_items si3 JOIN products p3 ON si3.product_id = p3.id WHERE si3.sale_id = s.id AND p3.category_id = ?)"; $params[] = $fCategory; }

    $countStmt = $pdo->prepare("SELECT COUNT(*) c FROM sales s $where");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetch()['c'];

    $sql = "SELECT s.id, s.invoice_no, s.sale_date, s.subtotal, s.discount, s.discount_type, s.discount_value,
                   s.total_amount, s.paid_amount, s.due_amount, s.payment_method, s.below_cost_approved,
                   c.name AS customer_name, u.name AS salesman_name,
                   COALESCE((SELECT SUM(si.unit_cost * si.qty) FROM sale_items si WHERE si.sale_id = s.id), 0) AS cost_total,
                   COALESCE((SELECT SUM(si.qty) FROM sale_items si WHERE si.sale_id = s.id), 0) AS item_qty
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN users u ON s.created_by = u.id
            $where
            ORDER BY s.sale_date DESC";
    if ($limit !== null) { $sql .= " LIMIT " . (int)$limit . " OFFSET " . (int)$offset; }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return [$stmt->fetchAll(), $total];
}

function rpt_purchase_rows($pdo, $from, $to, $fSupplier, $fProduct, $limit = null, $offset = 0) {
    $where = "WHERE p.purchase_date BETWEEN ? AND ?";
    $params = [$from, $to];
    if ($fSupplier) { $where .= " AND p.supplier_id = ?"; $params[] = $fSupplier; }
    if ($fProduct) { $where .= " AND EXISTS (SELECT 1 FROM purchase_items pi2 WHERE pi2.purchase_id = p.id AND pi2.product_id = ?)"; $params[] = $fProduct; }

    $countStmt = $pdo->prepare("SELECT COUNT(*) c FROM purchases p $where");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetch()['c'];

    $sql = "SELECT p.id, p.invoice_no, p.purchase_date, p.total_amount, p.paid_amount, p.due_amount, p.note,
                   s.name AS supplier_name, u.name AS created_by_name,
                   COALESCE((SELECT SUM(pi.qty) FROM purchase_items pi WHERE pi.purchase_id = p.id), 0) AS item_qty
            FROM purchases p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN users u ON p.created_by = u.id
            $where
            ORDER BY p.purchase_date DESC, p.id DESC";
    if ($limit !== null) { $sql .= " LIMIT " . (int)$limit . " OFFSET " . (int)$offset; }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return [$stmt->fetchAll(), $total];
}

// রিটার্ন রিপোর্টের সারি (সেলস রিটার্ন + পারচেজ রিটার্ন) — ট্যাব ও CSV এক্সপোর্ট দুটোই এই একই ফাংশন ব্যবহার করে
function rpt_return_rows($pdo, $from, $to, $fCustomer = 0, $fSupplier = 0) {
    $salesWhere = "WHERE DATE(r.return_date) BETWEEN ? AND ?";
    $salesParams = [$from, $to];
    if ($fCustomer) { $salesWhere .= " AND s.customer_id = ?"; $salesParams[] = $fCustomer; }
    $salesRet = $pdo->prepare("SELECT r.return_no, r.return_date, r.return_total, r.reason, s.invoice_no, c.name customer_name, u.name user_name
            FROM sales_returns r JOIN sales s ON r.sale_id=s.id LEFT JOIN customers c ON s.customer_id=c.id LEFT JOIN users u ON r.created_by=u.id
            $salesWhere ORDER BY r.return_date DESC LIMIT 500");
    $salesRet->execute($salesParams);
    $salesRet = $salesRet->fetchAll();

    $purchWhere = "WHERE DATE(r.return_date) BETWEEN ? AND ?";
    $purchParams = [$from, $to];
    if ($fSupplier) { $purchWhere .= " AND r.supplier_id = ?"; $purchParams[] = $fSupplier; }
    $purchRet = $pdo->prepare("SELECT r.return_no, r.return_date, r.total_amount, r.reason, s.name supplier_name, u.name user_name
            FROM purchase_returns r LEFT JOIN suppliers s ON r.supplier_id=s.id LEFT JOIN users u ON r.created_by=u.id
            $purchWhere ORDER BY r.return_date DESC LIMIT 500");
    $purchRet->execute($purchParams);
    $purchRet = $purchRet->fetchAll();

    return [$salesRet, $purchRet];
}

$customersList = $pdo->query("SELECT id, name FROM customers ORDER BY name LIMIT 1000")->fetchAll();
$suppliersList = $pdo->query("SELECT id, name FROM suppliers ORDER BY name LIMIT 1000")->fetchAll();
$usersList     = $pdo->query("SELECT id, name FROM users WHERE status='active' ORDER BY name")->fetchAll();
$productsList  = $pdo->query("SELECT id, name FROM products ORDER BY name LIMIT 1000")->fetchAll();
$categoriesList = $pdo->query("SELECT id, name FROM categories ORDER BY name")->fetchAll();
$activePaymentMethods = $pdo->query("SELECT * FROM payment_methods ORDER BY sort_order")->fetchAll();

/* =====================================================================
   CSV এক্সপোর্ট — HTML আউটপুটের আগেই হ্যান্ডেল করতে হয়
   ===================================================================== */
if ($export === 'csv') {
    if ($tab === 'sales_report') {
        [$rows] = rpt_sales_rows($pdo, $from, $to, $fCustomer, $fUser, $fProduct, $fCategory, $fPayment);
        $csvRows = [];
        foreach ($rows as $r) {
            $profit = (float)$r['total_amount'] - (float)$r['cost_total'];
            $csvRows[] = [$r['invoice_no'], $r['sale_date'], $r['customer_name'] ?: 'সাধারণ ক্রেতা', $r['salesman_name'] ?: '-', $r['item_qty'], money($r['subtotal']), money($r['discount']), money($r['total_amount']), money($r['paid_amount']), money($r['due_amount']), money($r['cost_total']), money($profit), $r['payment_method'], $r['below_cost_approved'] ? 'হ্যাঁ' : 'না'];
        }
        export_csv('sales_report_' . $from . '_to_' . $to, ['ইনভয়েস', 'তারিখ', 'কাস্টমার', 'বিক্রয়কারী', 'পরিমাণ', 'সাবটোটাল', 'ডিসকাউন্ট', 'মোট', 'পরিশোধিত', 'বাকি', 'ক্রয়মূল্য', 'লাভ', 'পেমেন্ট মেথড', 'লোকসানি বিক্রয়'], $csvRows);
    }
    if ($tab === 'purchase_report') {
        [$rows] = rpt_purchase_rows($pdo, $from, $to, $fSupplier, $fProduct);
        $csvRows = [];
        foreach ($rows as $r) {
            $csvRows[] = [$r['invoice_no'], $r['purchase_date'], $r['supplier_name'] ?: '-', $r['created_by_name'] ?: '-', $r['item_qty'], money($r['total_amount']), money($r['paid_amount']), money($r['due_amount']), $r['note']];
        }
        export_csv('purchase_report_' . $from . '_to_' . $to, ['ইনভয়েস', 'তারিখ', 'সাপ্লায়ার', 'যুক্তকারী', 'পরিমাণ', 'মোট', 'পরিশোধিত', 'বাকি', 'নোট'], $csvRows);
    }
    if ($tab === 'stock_report') {
        $rows = $pdo->query("SELECT p.item_code, p.name, p.unit, p.stock_qty, p.cost_price, p.sale_price, (p.stock_qty*p.cost_price) stock_value, c.name category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.status='active' ORDER BY p.name")->fetchAll();
        $csvRows = [];
        foreach ($rows as $r) {
            $csvRows[] = [$r['item_code'], $r['name'], $r['category_name'], $r['unit'], $r['stock_qty'], money($r['cost_price']), money($r['sale_price']), money($r['stock_value'])];
        }
        export_csv('stock_report_' . $today, ['কোড', 'নাম', 'ক্যাটাগরি', 'একক', 'স্টক', 'ক্রয়মূল্য', 'বিক্রয়মূল্য', 'স্টক ভ্যালু'], $csvRows);
    }
    if ($tab === 'customer_report') {
        $rows = $pdo->query("SELECT c.name, c.mobile, c.opening_balance,
                COALESCE((SELECT SUM(total_amount) FROM sales WHERE customer_id=c.id AND DATE(sale_date) BETWEEN " . $pdo->quote($from) . " AND " . $pdo->quote($to) . "),0) total_sales,
                COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id=c.id),0)+c.opening_balance AS current_due
                FROM customers c ORDER BY total_sales DESC")->fetchAll();
        $csvRows = [];
        foreach ($rows as $r) { $csvRows[] = [$r['name'], $r['mobile'], money($r['total_sales']), money($r['current_due'])]; }
        export_csv('customer_report_' . $from . '_to_' . $to, ['নাম', 'মোবাইল', 'বিক্রয় (সময়সীমায়)', 'বর্তমান বাকি'], $csvRows);
    }
    if ($tab === 'supplier_report') {
        $rows = $pdo->query("SELECT s.name, s.mobile, s.opening_balance,
                COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id=s.id AND purchase_date BETWEEN " . $pdo->quote($from) . " AND " . $pdo->quote($to) . "),0) total_purchase,
                COALESCE((SELECT SUM(due_amount) FROM purchases WHERE supplier_id=s.id),0)+s.opening_balance AS current_due
                FROM suppliers s ORDER BY total_purchase DESC")->fetchAll();
        $csvRows = [];
        foreach ($rows as $r) { $csvRows[] = [$r['name'], $r['mobile'], money($r['total_purchase']), money($r['current_due'])]; }
        export_csv('supplier_report_' . $from . '_to_' . $to, ['নাম', 'মোবাইল', 'ক্রয় (সময়সীমায়)', 'বর্তমান বাকি'], $csvRows);
    }
    if ($tab === 'employee_report') {
        $rows = $pdo->query("SELECT u.name,
                COUNT(s.id) invoices, COALESCE(SUM(s.total_amount),0) total_sales, COALESCE(SUM(s.paid_amount),0) collection,
                COALESCE(SUM(s.due_amount),0) due_sales, COALESCE(SUM(s.discount),0) discount_given,
                COALESCE((SELECT SUM(si.subtotal-si.unit_cost*si.qty) FROM sale_items si WHERE si.sale_id IN (SELECT id FROM sales WHERE created_by=u.id AND DATE(sale_date) BETWEEN " . $pdo->quote($from) . " AND " . $pdo->quote($to) . ")),0) profit_generated
                FROM users u LEFT JOIN sales s ON s.created_by=u.id AND DATE(s.sale_date) BETWEEN " . $pdo->quote($from) . " AND " . $pdo->quote($to) . "
                GROUP BY u.id ORDER BY total_sales DESC")->fetchAll();
        $csvRows = [];
        foreach ($rows as $r) {
            $avg = $r['invoices'] > 0 ? $r['total_sales'] / $r['invoices'] : 0;
            $csvRows[] = [$r['name'], $r['invoices'], money($r['total_sales']), money($r['collection']), money($r['due_sales']), money($r['discount_given']), money($r['profit_generated']), money($avg)];
        }
        export_csv('employee_report_' . $from . '_to_' . $to, ['নাম', 'ইনভয়েস', 'মোট বিক্রয়', 'কালেকশন', 'বাকি', 'ডিসকাউন্ট', 'লাভ', 'গড় ইনভয়েস'], $csvRows);
    }
    if ($tab === 'audit_log') {
        $where = "WHERE DATE(a.created_at) BETWEEN ? AND ?";
        $params = [$from, $to];
        if ($fUser) { $where .= " AND a.user_id = ?"; $params[] = $fUser; }
        $stmt = $pdo->prepare("SELECT a.created_at, u.name AS user_name, a.action FROM activity_log a LEFT JOIN users u ON a.user_id=u.id $where ORDER BY a.id DESC LIMIT 5000");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $csvRows = [];
        foreach ($rows as $r) { $csvRows[] = [$r['created_at'], $r['user_name'] ?: '-', $r['action']]; }
        export_csv('audit_log_' . $from . '_to_' . $to, ['সময়', 'ব্যবহারকারী', 'কার্যক্রম'], $csvRows);
    }
    if ($tab === 'return_report') {
        [$salesRet, $purchRet] = rpt_return_rows($pdo, $from, $to, $fCustomer, $fSupplier);
        $csvRows = [];
        foreach ($salesRet as $r) { $csvRows[] = ['বিক্রয় ফেরত', $r['return_no'], $r['invoice_no'], $r['return_date'], $r['customer_name'] ?: '-', $r['reason'], $r['user_name'] ?: '-', money($r['return_total'])]; }
        foreach ($purchRet as $r) { $csvRows[] = ['ক্রয় ফেরত', $r['return_no'], '-', $r['return_date'], $r['supplier_name'] ?: '-', $r['reason'], $r['user_name'] ?: '-', money($r['total_amount'])]; }
        export_csv('return_report_' . $from . '_to_' . $to, ['ধরন', 'রিটার্ন নং', 'মূল ইনভয়েস', 'তারিখ', 'কাস্টমার/সাপ্লায়ার', 'কারণ', 'ইউজার', 'পরিমাণ'], $csvRows);
    }
    if ($tab === 'payment_report') {
        $byMethod = $pdo->prepare("SELECT payment_method, COUNT(*) tx_count, COALESCE(SUM(paid_amount),0) collected FROM sales WHERE DATE(sale_date) BETWEEN ? AND ? GROUP BY payment_method ORDER BY collected DESC");
        $byMethod->execute([$from, $to]);
        $byMethod = $byMethod->fetchAll();
        $refundsByMethod = $pdo->prepare("SELECT refund_method, COALESCE(SUM(refund_amount),0) v FROM sales_returns WHERE DATE(return_date) BETWEEN ? AND ? AND refund_amount > 0 GROUP BY refund_method");
        $refundsByMethod->execute([$from, $to]);
        $refundMap = $refundsByMethod->fetchAll(PDO::FETCH_KEY_PAIR);
        $methodNames = [];
        foreach ($activePaymentMethods as $pm) { $methodNames[$pm['method_key']] = $pm['method_name']; }
        $csvRows = [];
        foreach ($byMethod as $m) {
            $refund = (float)($refundMap[$m['payment_method']] ?? 0);
            $csvRows[] = [$methodNames[$m['payment_method']] ?? $m['payment_method'], $m['tx_count'], money($m['collected']), money($refund), money($m['collected'] - $refund)];
        }
        export_csv('payment_report_' . $from . '_to_' . $to, ['পেমেন্ট মেথড', 'লেনদেন', 'মোট সংগ্রহ', 'রিফান্ড', 'নীট সংগ্রহ'], $csvRows);
    }
}

$pageTitle = 'রিপোর্ট';
$activeNav = 'reports';
require_once __DIR__ . '/../includes/header.php';
?>
<style>
.rpt-filter-bar{display:flex;gap:8px;margin:14px 0;flex-wrap:wrap;align-items:center;}
.rpt-filter-bar .form-control{width:auto;min-width:130px;}
.rpt-presets{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.rpt-presets a{font-size:12px;padding:5px 10px;border-radius:20px;background:var(--surface-2,#f3f0fa);color:var(--text-secondary);text-decoration:none;}
.rpt-presets a.active{background:var(--brand-purple);color:#fff;}
.trend-up{color:var(--success);font-weight:700;}
.trend-down{color:var(--danger);font-weight:700;}
.trend-flat{color:var(--text-secondary);font-weight:600;}
@media print { .no-print, .rpt-filter-bar, .rpt-presets { display:none !important; } }
</style>

<div class="gap-tabs">
    <?php foreach ($tabs as $k => $label): ?>
        <a href="reports.php?tab=<?= $k ?>&from=<?= e($from) ?>&to=<?= e($to) ?>" class="<?= $tab === $k ? 'active' : '' ?>"><?= $label ?></a>
    <?php endforeach; ?>
</div>

<?php if (in_array($tab, ['dashboard', 'ai_insights'], true)): ?>
<div class="no-print" style="display:flex;justify-content:flex-end;margin:10px 0;">
    <button type="button" class="btn btn-light btn-sm" onclick="window.print()"><i class="bi bi-printer"></i> প্রিন্ট / PDF</button>
</div>
<?php endif; ?>

<?php if (!in_array($tab, ['dashboard', 'ai_insights'], true)): ?>
<div class="rpt-presets no-print">
    <?php foreach (report_date_presets() as $pk => $p): ?>
        <a href="reports.php?tab=<?= $tab ?>&from=<?= $p['from'] ?>&to=<?= $p['to'] ?>" class="<?= ($from === $p['from'] && $to === $p['to']) ? 'active' : '' ?>"><?= $p['label'] ?></a>
    <?php endforeach; ?>
</div>
<form method="GET" class="rpt-filter-bar no-print">
    <input type="hidden" name="tab" value="<?= e($tab) ?>">
    <label style="font-size:13px;color:var(--text-secondary);">থেকে</label>
    <input type="date" name="from" class="form-control" value="<?= e($from) ?>">
    <label style="font-size:13px;color:var(--text-secondary);">পর্যন্ত</label>
    <input type="date" name="to" class="form-control" value="<?= e($to) ?>">

    <?php if ($tab === 'sales_report'): ?>
        <select name="customer_id" class="form-control"><option value="0">— সব কাস্টমার —</option><?php foreach ($customersList as $c): ?><option value="<?= $c['id'] ?>" <?= $fCustomer == $c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option><?php endforeach; ?></select>
        <select name="user_id" class="form-control"><option value="0">— সব বিক্রয়কারী —</option><?php foreach ($usersList as $u2): ?><option value="<?= $u2['id'] ?>" <?= $fUser == $u2['id'] ? 'selected' : '' ?>><?= e($u2['name']) ?></option><?php endforeach; ?></select>
        <select name="product_id" class="form-control"><option value="0">— সব পণ্য —</option><?php foreach ($productsList as $p2): ?><option value="<?= $p2['id'] ?>" <?= $fProduct == $p2['id'] ? 'selected' : '' ?>><?= e($p2['name']) ?></option><?php endforeach; ?></select>
        <select name="category_id" class="form-control"><option value="0">— সব ক্যাটাগরি —</option><?php foreach ($categoriesList as $cat): ?><option value="<?= $cat['id'] ?>" <?= $fCategory == $cat['id'] ? 'selected' : '' ?>><?= e($cat['name']) ?></option><?php endforeach; ?></select>
        <select name="payment_method" class="form-control"><option value="">— সব পেমেন্ট —</option><?php foreach ($activePaymentMethods as $pm): ?><option value="<?= e($pm['method_key']) ?>" <?= $fPayment === $pm['method_key'] ? 'selected' : '' ?>><?= e($pm['method_name']) ?></option><?php endforeach; ?></select>
    <?php elseif ($tab === 'purchase_report'): ?>
        <select name="supplier_id" class="form-control"><option value="0">— সব সাপ্লায়ার —</option><?php foreach ($suppliersList as $s2): ?><option value="<?= $s2['id'] ?>" <?= $fSupplier == $s2['id'] ? 'selected' : '' ?>><?= e($s2['name']) ?></option><?php endforeach; ?></select>
        <select name="product_id" class="form-control"><option value="0">— সব পণ্য —</option><?php foreach ($productsList as $p3): ?><option value="<?= $p3['id'] ?>" <?= $fProduct == $p3['id'] ? 'selected' : '' ?>><?= e($p3['name']) ?></option><?php endforeach; ?></select>
    <?php elseif ($tab === 'audit_log'): ?>
        <select name="user_id" class="form-control"><option value="0">— সব ব্যবহারকারী —</option><?php foreach ($usersList as $u3): ?><option value="<?= $u3['id'] ?>" <?= $fUser == $u3['id'] ? 'selected' : '' ?>><?= e($u3['name']) ?></option><?php endforeach; ?></select>
    <?php elseif ($tab === 'return_report'): ?>
        <select name="supplier_id" class="form-control"><option value="0">— সব সাপ্লায়ার —</option><?php foreach ($suppliersList as $s3): ?><option value="<?= $s3['id'] ?>" <?= $fSupplier == $s3['id'] ? 'selected' : '' ?>><?= e($s3['name']) ?></option><?php endforeach; ?></select>
        <select name="customer_id" class="form-control"><option value="0">— সব কাস্টমার —</option><?php foreach ($customersList as $c3): ?><option value="<?= $c3['id'] ?>" <?= $fCustomer == $c3['id'] ? 'selected' : '' ?>><?= e($c3['name']) ?></option><?php endforeach; ?></select>
    <?php endif; ?>

    <button class="btn btn-light btn-sm"><i class="bi bi-funnel"></i> ফিল্টার</button>
    <?php if (in_array($tab, ['sales_report', 'purchase_report', 'stock_report', 'customer_report', 'supplier_report', 'employee_report', 'audit_log', 'return_report', 'payment_report'], true)): ?>
        <a class="btn btn-light btn-sm" href="?<?= http_build_query(array_merge($_GET, ['export' => 'csv'])) ?>"><i class="bi bi-file-earmark-spreadsheet"></i> CSV/Excel</a>
    <?php endif; ?>
    <button type="button" class="btn btn-light btn-sm" onclick="window.print()"><i class="bi bi-printer"></i> প্রিন্ট / PDF</button>
</form>
<?php endif; ?>

<?php
/* =====================================================================
   ১) রিপোর্ট ড্যাশবোর্ড
   ===================================================================== */
if ($tab === 'dashboard'):
    $yesterday = date('Y-m-d', strtotime('-1 day'));
    $wk7From = date('Y-m-d', strtotime('-6 day'));
    $wk30From = date('Y-m-d', strtotime('-29 day'));
    $prevMonthFrom = date('Y-m-01', strtotime('-1 month'));
    $prevMonthTo = date('Y-m-t', strtotime('-1 month'));

    function rpt_period_totals($pdo, $from, $to) {
        $s1 = $pdo->prepare("SELECT COALESCE(SUM(total_amount),0) v FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?"); $s1->execute([$from, $to]); $sales = (float)$s1->fetch()['v'];
        $s2 = $pdo->prepare("SELECT COALESCE(SUM(total_amount),0) v FROM purchases WHERE purchase_date BETWEEN ? AND ?"); $s2->execute([$from, $to]); $purchase = (float)$s2->fetch()['v'];
        $s3 = $pdo->prepare("SELECT COALESCE(SUM(si.subtotal - si.unit_cost*si.qty),0) v FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE DATE(s.sale_date) BETWEEN ? AND ?"); $s3->execute([$from, $to]); $itemProfit = (float)$s3->fetch()['v'];
        $s4 = $pdo->prepare("SELECT COALESCE(SUM(discount),0) v FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?"); $s4->execute([$from, $to]); $disc = (float)$s4->fetch()['v'];
        $s5 = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date BETWEEN ? AND ?"); $s5->execute([$from, $to]); $exp = (float)$s5->fetch()['v'];
        $grossProfit = $itemProfit - $disc;
        $netProfit = $grossProfit - $exp;
        return ['sales' => $sales, 'purchase' => $purchase, 'gross_profit' => $grossProfit, 'net_profit' => $netProfit, 'expenses' => $exp];
    }

    $todayT = rpt_period_totals($pdo, $today, $today);
    $yestT  = rpt_period_totals($pdo, $yesterday, $yesterday);
    $wk7T   = rpt_period_totals($pdo, $wk7From, $today);
    $wk30T  = rpt_period_totals($pdo, $wk30From, $today);
    $thisMonthT = rpt_period_totals($pdo, date('Y-m-01'), $today);
    $prevMonthT = rpt_period_totals($pdo, $prevMonthFrom, $prevMonthTo);

    $todayInvoices = (int)$pdo->query("SELECT COUNT(*) c FROM sales WHERE DATE(sale_date)=CURDATE()")->fetch()['c'];
    $todayPurchases = (int)$pdo->query("SELECT COUNT(*) c FROM purchases WHERE purchase_date=CURDATE()")->fetch()['c'];
    $customerDue = (float)$pdo->query("SELECT COALESCE(SUM(opening_balance),0) v FROM customers")->fetch()['v'] + (float)$pdo->query("SELECT COALESCE(SUM(due_amount),0) v FROM sales")->fetch()['v'];
    $supplierDue = (float)$pdo->query("SELECT COALESCE(SUM(opening_balance),0) v FROM suppliers")->fetch()['v'] + (float)$pdo->query("SELECT COALESCE(SUM(due_amount),0) v FROM purchases")->fetch()['v'];
    $stockValue = (float)$pdo->query("SELECT COALESCE(SUM(stock_qty*cost_price),0) v FROM products WHERE status='active'")->fetch()['v'];
    $lowStockCount = (int)$pdo->query("SELECT COUNT(*) c FROM products WHERE status='active' AND stock_qty>0 AND stock_qty<=low_stock_threshold")->fetch()['c'];
    $outStockCount = (int)$pdo->query("SELECT COUNT(*) c FROM products WHERE status='active' AND stock_qty<=0")->fetch()['c'];

    $cashIn = (float)$pdo->query("SELECT COALESCE(SUM(paid_amount),0) v FROM sales WHERE payment_method='cash'")->fetch()['v']
            + (float)$pdo->query("SELECT COALESCE(SUM(amount),0) v FROM customer_payments WHERE type='payment'")->fetch()['v']
            + (float)$pdo->query("SELECT COALESCE(SUM(amount),0) v FROM supplier_payments WHERE type='receipt'")->fetch()['v'];
    $cashOut = (float)$pdo->query("SELECT COALESCE(SUM(paid_amount),0) v FROM purchases")->fetch()['v']
             + (float)$pdo->query("SELECT COALESCE(SUM(amount),0) v FROM expenses")->fetch()['v']
             + (float)$pdo->query("SELECT COALESCE(SUM(amount),0) v FROM customer_payments WHERE type='loan'")->fetch()['v']
             + (float)$pdo->query("SELECT COALESCE(SUM(amount),0) v FROM supplier_payments WHERE type='payment'")->fetch()['v']
             + (float)$pdo->query("SELECT COALESCE(SUM(refund_amount),0) v FROM sales_returns")->fetch()['v'];
    $cashBalance = $cashIn - $cashOut;

    function rpt_trend_badge($cur, $prev) {
        $p = report_trend_percent($cur, $prev);
        if ($p === null) return '<span class="trend-up">নতুন</span>';
        if ($p > 0) return '<span class="trend-up"><i class="bi bi-arrow-up-short"></i>' . $p . '%</span>';
        if ($p < 0) return '<span class="trend-down"><i class="bi bi-arrow-down-short"></i>' . abs($p) . '%</span>';
        return '<span class="trend-flat">০%</span>';
    }
    ?>
    <div class="row g-3">
        <div class="col-6 col-md-4 col-xl-3">
            <div class="stat-card sm c-purple"><div class="stat-icon"><i class="bi bi-cash-coin"></i></div>
                <div class="stat-label">আজকের বিক্রয়</div><div class="stat-value num">৳<?= money($todayT['sales']) ?></div>
                <div class="stat-sub">গতকালের তুলনায় <?= rpt_trend_badge($todayT['sales'], $yestT['sales']) ?></div></div>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <div class="stat-card sm c-magenta"><div class="stat-icon"><i class="bi bi-truck"></i></div>
                <div class="stat-label">আজকের ক্রয়</div><div class="stat-value num">৳<?= money($todayT['purchase']) ?></div>
                <div class="stat-sub">গতকালের তুলনায় <?= rpt_trend_badge($todayT['purchase'], $yestT['purchase']) ?></div></div>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <div class="stat-card sm c-success"><div class="stat-icon"><i class="bi bi-graph-up-arrow"></i></div>
                <div class="stat-label">আজকের গ্রস প্রফিট</div><div class="stat-value num">৳<?= money($todayT['gross_profit']) ?></div>
                <div class="stat-sub">গতকালের তুলনায় <?= rpt_trend_badge($todayT['gross_profit'], $yestT['gross_profit']) ?></div></div>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <div class="stat-card sm <?= $todayT['net_profit'] >= 0 ? 'c-success' : 'c-danger' ?>"><div class="stat-icon"><i class="bi bi-piggy-bank"></i></div>
                <div class="stat-label">আজকের নীট লাভ</div><div class="stat-value num">৳<?= money($todayT['net_profit']) ?></div>
                <div class="stat-sub">গতকালের তুলনায় <?= rpt_trend_badge($todayT['net_profit'], $yestT['net_profit']) ?></div></div>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <div class="stat-card sm c-orange"><div class="stat-icon"><i class="bi bi-wallet2"></i></div>
                <div class="stat-label">আজকের খরচ</div><div class="stat-value num">৳<?= money($todayT['expenses']) ?></div>
                <div class="stat-sub">গতকালের তুলনায় <?= rpt_trend_badge($todayT['expenses'], $yestT['expenses']) ?></div></div>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <a href="customers.php" class="stat-card-link"><div class="stat-card sm c-danger"><div class="stat-icon"><i class="bi bi-journal-text"></i></div>
                <div class="stat-label">কাস্টমার বাকি (মোট)</div><div class="stat-value num">৳<?= money($customerDue) ?></div>
                <div class="stat-sub">লাইভ</div></div></a>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <a href="suppliers.php" class="stat-card-link"><div class="stat-card sm c-danger"><div class="stat-icon"><i class="bi bi-building"></i></div>
                <div class="stat-label">সাপ্লায়ার বাকি (মোট)</div><div class="stat-value num">৳<?= money($supplierDue) ?></div>
                <div class="stat-sub">লাইভ</div></div></a>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <a href="reports.php?tab=cash_report" class="stat-card-link"><div class="stat-card sm <?= $cashBalance >= 0 ? 'c-success' : 'c-danger' ?>"><div class="stat-icon"><i class="bi bi-cash-stack"></i></div>
                <div class="stat-label">আনুমানিক ক্যাশ ব্যালেন্স</div><div class="stat-value num">৳<?= money($cashBalance) ?></div>
                <div class="stat-sub">সর্বমোট নগদ প্রবাহ (স্থাপনার শুরু থেকে)</div></div></a>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <a href="stock.php" class="stat-card-link"><div class="stat-card sm c-purple"><div class="stat-icon"><i class="bi bi-box-seam"></i></div>
                <div class="stat-label">মোট স্টক ভ্যালু</div><div class="stat-value num">৳<?= money($stockValue) ?></div>
                <div class="stat-sub">ক্রয়মূল্য অনুযায়ী</div></div></a>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <a href="stock.php" class="stat-card-link"><div class="stat-card sm c-yellow"><div class="stat-icon"><i class="bi bi-exclamation-triangle"></i></div>
                <div class="stat-label">লো স্টক</div><div class="stat-value num"><?= $lowStockCount ?></div>
                <div class="stat-sub">টি পণ্য</div></div></a>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <a href="stock.php" class="stat-card-link"><div class="stat-card sm c-danger"><div class="stat-icon"><i class="bi bi-x-octagon"></i></div>
                <div class="stat-label">স্টক আউট</div><div class="stat-value num"><?= $outStockCount ?></div>
                <div class="stat-sub">টি পণ্য</div></div></a>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
            <div class="stat-card sm c-magenta"><div class="stat-icon"><i class="bi bi-receipt"></i></div>
                <div class="stat-label">মোট লেনদেন (আজ)</div><div class="stat-value num"><?= $todayInvoices + $todayPurchases ?></div>
                <div class="stat-sub"><?= $todayInvoices ?> বিক্রয় · <?= $todayPurchases ?> ক্রয়</div></div>
        </div>
    </div>

    <div class="card" style="margin-top:20px;padding:18px;">
        <h3 style="font-size:15px;margin:0 0 12px;">তুলনামূলক সারাংশ</h3>
        <div class="table-wrap">
            <table class="data-table">
                <thead><tr><th>সময়কাল</th><th class="num">বিক্রয়</th><th class="num">ক্রয়</th><th class="num">গ্রস প্রফিট</th><th class="num">খরচ</th><th class="num">নীট লাভ</th></tr></thead>
                <tbody>
                    <tr><td>আজ</td><td class="num">৳<?= money($todayT['sales']) ?></td><td class="num">৳<?= money($todayT['purchase']) ?></td><td class="num">৳<?= money($todayT['gross_profit']) ?></td><td class="num">৳<?= money($todayT['expenses']) ?></td><td class="num">৳<?= money($todayT['net_profit']) ?></td></tr>
                    <tr><td>গতকাল</td><td class="num">৳<?= money($yestT['sales']) ?></td><td class="num">৳<?= money($yestT['purchase']) ?></td><td class="num">৳<?= money($yestT['gross_profit']) ?></td><td class="num">৳<?= money($yestT['expenses']) ?></td><td class="num">৳<?= money($yestT['net_profit']) ?></td></tr>
                    <tr><td>বিগত ৭ দিন</td><td class="num">৳<?= money($wk7T['sales']) ?></td><td class="num">৳<?= money($wk7T['purchase']) ?></td><td class="num">৳<?= money($wk7T['gross_profit']) ?></td><td class="num">৳<?= money($wk7T['expenses']) ?></td><td class="num">৳<?= money($wk7T['net_profit']) ?></td></tr>
                    <tr><td>বিগত ৩০ দিন</td><td class="num">৳<?= money($wk30T['sales']) ?></td><td class="num">৳<?= money($wk30T['purchase']) ?></td><td class="num">৳<?= money($wk30T['gross_profit']) ?></td><td class="num">৳<?= money($wk30T['expenses']) ?></td><td class="num">৳<?= money($wk30T['net_profit']) ?></td></tr>
                    <tr><td>এই মাস</td><td class="num">৳<?= money($thisMonthT['sales']) ?></td><td class="num">৳<?= money($thisMonthT['purchase']) ?></td><td class="num">৳<?= money($thisMonthT['gross_profit']) ?></td><td class="num">৳<?= money($thisMonthT['expenses']) ?></td><td class="num">৳<?= money($thisMonthT['net_profit']) ?></td></tr>
                    <tr><td>গত মাস</td><td class="num">৳<?= money($prevMonthT['sales']) ?></td><td class="num">৳<?= money($prevMonthT['purchase']) ?></td><td class="num">৳<?= money($prevMonthT['gross_profit']) ?></td><td class="num">৳<?= money($prevMonthT['expenses']) ?></td><td class="num">৳<?= money($prevMonthT['net_profit']) ?></td></tr>
                </tbody>
            </table>
        </div>
        <p style="font-size:11.5px;color:var(--text-secondary);margin-top:10px;">নোট: "আনুমানিক ক্যাশ ব্যালেন্স" ক্যাশ পেমেন্ট, কাস্টমার/সাপ্লায়ার লেনদেন, ক্রয় ও খরচের ভিত্তিতে হিসাব করা — এটি সরাসরি ক্যাশ-ড্রয়ার গণনার বিকল্প নয়।</p>
    </div>

<?php
/* =====================================================================
   ২) বিক্রয় রিপোর্ট
   ===================================================================== */
elseif ($tab === 'sales_report'):
    $offset = ($page - 1) * $perPage;
    [$rows, $totalRows] = rpt_sales_rows($pdo, $from, $to, $fCustomer, $fUser, $fProduct, $fCategory, $fPayment, $perPage, $offset);
    $totalPages = max(1, (int)ceil($totalRows / $perPage));
    $sumTotal = 0; $sumProfit = 0; $sumDue = 0;
    foreach ($rows as $r) { $sumTotal += (float)$r['total_amount']; $sumProfit += (float)$r['total_amount'] - (float)$r['cost_total']; $sumDue += (float)$r['due_amount']; }
    ?>
    <div class="row g-3" style="margin-bottom:6px;">
        <div class="col-4"><div class="stat-card sm c-purple"><div class="stat-label">এই পাতার মোট বিক্রয়</div><div class="stat-value num">৳<?= money($sumTotal) ?></div></div></div>
        <div class="col-4"><div class="stat-card sm c-success"><div class="stat-label">এই পাতার মোট লাভ</div><div class="stat-value num">৳<?= money($sumProfit) ?></div></div></div>
        <div class="col-4"><div class="stat-card sm c-danger"><div class="stat-label">এই পাতার মোট বাকি</div><div class="stat-value num">৳<?= money($sumDue) ?></div></div></div>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>ইনভয়েস</th><th>তারিখ</th><th>কাস্টমার</th><th>বিক্রয়কারী</th><th class="num">পরিমাণ</th><th class="num">মোট</th><th class="num">ক্রয়মূল্য</th><th class="num">লাভ</th><th class="num">মার্জিন</th><th class="num">বাকি</th><th>পেমেন্ট</th><th></th></tr></thead>
            <tbody>
            <?php if (empty($rows)): ?><tr><td colspan="12"><div class="empty-state">এই ফিল্টারে কোনো বিক্রয় নেই।</div></td></tr><?php endif; ?>
            <?php foreach ($rows as $r):
                $profit = (float)$r['total_amount'] - (float)$r['cost_total'];
                $margin = $r['total_amount'] > 0 ? round($profit / $r['total_amount'] * 100, 1) : 0;
            ?>
                <tr>
                    <td><a href="sales_list.php?view=show&id=<?= (int)$r['id'] ?>"><?= e($r['invoice_no']) ?></a> <?php if ($r['below_cost_approved']): ?><span class="badge badge-danger" title="ক্রয়মূল্যের নিচে বিক্রি">লোকসান</span><?php endif; ?></td>
                    <td><?= e(date('d M Y', strtotime($r['sale_date']))) ?></td>
                    <td><?= e($r['customer_name'] ?: 'সাধারণ ক্রেতা') ?></td>
                    <td><?= e($r['salesman_name'] ?: '-') ?></td>
                    <td class="num"><?= (int)$r['item_qty'] ?></td>
                    <td class="num">৳<?= money($r['total_amount']) ?></td>
                    <td class="num">৳<?= money($r['cost_total']) ?></td>
                    <td class="num" style="color:<?= $profit >= 0 ? 'var(--success)' : 'var(--danger)' ?>;">৳<?= money($profit) ?></td>
                    <td class="num"><?= $margin ?>%</td>
                    <td class="num"><?= $r['due_amount'] > 0 ? '৳' . money($r['due_amount']) : '-' ?></td>
                    <td><?= e($r['payment_method']) ?></td>
                    <td><a class="btn btn-sm btn-light" href="sales_list.php?view=show&id=<?= (int)$r['id'] ?>" title="ভিউ/প্রিন্ট"><i class="bi bi-eye"></i></a></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php if ($totalPages > 1): ?>
    <div class="no-print" style="display:flex;gap:6px;justify-content:center;margin-top:14px;">
        <?php for ($pg = 1; $pg <= $totalPages; $pg++): ?>
            <a class="btn btn-sm <?= $pg === $page ? 'btn-primary' : 'btn-light' ?>" href="?<?= http_build_query(array_merge($_GET, ['page' => $pg])) ?>"><?= $pg ?></a>
        <?php endfor; ?>
    </div>
    <?php endif; ?>

<?php
/* =====================================================================
   ৩) বেস্ট সেলিং (অপরিবর্তিত)
   ===================================================================== */
elseif ($tab === 'best_selling'):
    $stmt = $pdo->prepare("
        SELECT p.name, p.unit, c.name AS category_name, SUM(si.qty) total_qty, SUM(si.subtotal) total_amount
        FROM sale_items si JOIN sales s ON si.sale_id=s.id JOIN products p ON si.product_id=p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE DATE(s.sale_date) BETWEEN ? AND ?
        GROUP BY si.product_id ORDER BY total_qty DESC LIMIT 30");
    $stmt->execute([$from, $to]);
    $rows = $stmt->fetchAll();
    ?>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>#</th><th>পণ্য</th><th>ক্যাটাগরি</th><th class="num">বিক্রিত পরিমাণ</th><th class="num">মোট বিক্রয়</th></tr></thead>
            <tbody>
            <?php if (empty($rows)): ?><tr><td colspan="5"><div class="empty-state">এই সময়ে কোনো বিক্রয় নেই।</div></td></tr><?php endif; ?>
            <?php foreach ($rows as $i => $r): ?>
                <tr><td><?= $i+1 ?></td><td><?= e($r['name']) ?></td><td><?= e($r['category_name'] ?: '—') ?></td><td class="num"><?= (int)$r['total_qty'] ?> <?= e($r['unit']) ?></td><td class="num">৳<?= money($r['total_amount']) ?></td></tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>

<?php
/* =====================================================================
   ৪) ক্যাটাগরি অনুযায়ী বিক্রয় (অপরিবর্তিত)
   ===================================================================== */
elseif ($tab === 'category_sales'):
    $stmt = $pdo->prepare("
        SELECT COALESCE(c.name, 'সার্ভিস') AS category_name, SUM(si.subtotal) total_amount, SUM(si.qty) total_qty
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE DATE(s.sale_date) BETWEEN ? AND ?
        GROUP BY category_name ORDER BY total_amount DESC");
    $stmt->execute([$from, $to]);
    $rows = $stmt->fetchAll();
    $grand = array_sum(array_column($rows, 'total_amount'));
    ?>
    <div class="row g-3">
        <div class="col-lg-6">
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>ক্যাটাগরি</th><th class="num">পরিমাণ</th><th class="num">বিক্রয়</th><th class="num">শতাংশ</th></tr></thead>
                    <tbody>
                    <?php if (empty($rows)): ?><tr><td colspan="4"><div class="empty-state">এই সময়ে কোনো বিক্রয় নেই।</div></td></tr><?php endif; ?>
                    <?php foreach ($rows as $r): ?>
                        <tr><td><?= e($r['category_name']) ?></td><td class="num"><?= (int)$r['total_qty'] ?></td><td class="num">৳<?= money($r['total_amount']) ?></td><td class="num"><?= $grand > 0 ? round($r['total_amount']/$grand*100,1) : 0 ?>%</td></tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="col-lg-6">
            <div class="card" style="padding:18px;"><canvas id="catChart" height="220"></canvas></div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
    <script>
    new Chart(document.getElementById('catChart'), {
        type: 'doughnut',
        data: {
            labels: <?= json_encode(array_column($rows, 'category_name'), JSON_UNESCAPED_UNICODE) ?>,
            datasets: [{
                data: <?= json_encode(array_map('floatval', array_column($rows, 'total_amount'))) ?>,
                backgroundColor: ['#6D28D9','#C026D3','#F2650C','#F5A623','#2563EB','#16A34A','#DC2626']
            }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
    });
    </script>

<?php
/* =====================================================================
   ৫) ক্রয় রিপোর্ট
   ===================================================================== */
elseif ($tab === 'purchase_report'):
    $offset = ($page - 1) * $perPage;
    [$rows, $totalRows] = rpt_purchase_rows($pdo, $from, $to, $fSupplier, $fProduct, $perPage, $offset);
    $totalPages = max(1, (int)ceil($totalRows / $perPage));
    $sumTotal = array_sum(array_column($rows, 'total_amount'));
    $sumDue = array_sum(array_column($rows, 'due_amount'));

    $bySupplier = $pdo->prepare("SELECT s.name, COUNT(p.id) cnt, COALESCE(SUM(p.total_amount),0) total FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id WHERE p.purchase_date BETWEEN ? AND ? GROUP BY p.supplier_id ORDER BY total DESC LIMIT 10");
    $bySupplier->execute([$from, $to]);
    $supplierBreakdown = $bySupplier->fetchAll();
    ?>
    <div class="row g-3" style="margin-bottom:6px;">
        <div class="col-6"><div class="stat-card sm c-magenta"><div class="stat-label">এই পাতার মোট ক্রয়</div><div class="stat-value num">৳<?= money($sumTotal) ?></div></div></div>
        <div class="col-6"><div class="stat-card sm c-danger"><div class="stat-label">এই পাতার মোট বাকি</div><div class="stat-value num">৳<?= money($sumDue) ?></div></div></div>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>ইনভয়েস</th><th>তারিখ</th><th>সাপ্লায়ার</th><th>যুক্তকারী</th><th class="num">পরিমাণ</th><th class="num">মোট</th><th class="num">পরিশোধিত</th><th class="num">বাকি</th></tr></thead>
            <tbody>
            <?php if (empty($rows)): ?><tr><td colspan="8"><div class="empty-state">এই ফিল্টারে কোনো ক্রয় নেই।</div></td></tr><?php endif; ?>
            <?php foreach ($rows as $r): ?>
                <tr>
                    <td><a href="purchase.php?view=show&id=<?= (int)$r['id'] ?>"><?= e($r['invoice_no']) ?></a></td>
                    <td><?= e(date('d M Y', strtotime($r['purchase_date']))) ?></td>
                    <td><?= e($r['supplier_name'] ?: '-') ?></td>
                    <td><?= e($r['created_by_name'] ?: '-') ?></td>
                    <td class="num"><?= (int)$r['item_qty'] ?></td>
                    <td class="num">৳<?= money($r['total_amount']) ?></td>
                    <td class="num">৳<?= money($r['paid_amount']) ?></td>
                    <td class="num"><?= $r['due_amount'] > 0 ? '৳' . money($r['due_amount']) : '-' ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php if ($totalPages > 1): ?>
    <div class="no-print" style="display:flex;gap:6px;justify-content:center;margin-top:14px;">
        <?php for ($pg = 1; $pg <= $totalPages; $pg++): ?>
            <a class="btn btn-sm <?= $pg === $page ? 'btn-primary' : 'btn-light' ?>" href="?<?= http_build_query(array_merge($_GET, ['page' => $pg])) ?>"><?= $pg ?></a>
        <?php endfor; ?>
    </div>
    <?php endif; ?>
    <div class="card" style="margin-top:18px;padding:16px;">
        <h3 style="font-size:14px;margin:0 0 10px;">সাপ্লায়ার-ভিত্তিক (শীর্ষ ১০)</h3>
        <table class="data-table"><thead><tr><th>সাপ্লায়ার</th><th class="num">ইনভয়েস</th><th class="num">মোট ক্রয়</th></tr></thead><tbody>
        <?php foreach ($supplierBreakdown as $sb): ?><tr><td><?= e($sb['name'] ?: '-') ?></td><td class="num"><?= (int)$sb['cnt'] ?></td><td class="num">৳<?= money($sb['total']) ?></td></tr><?php endforeach; ?>
        </tbody></table>
    </div>

<?php
/* =====================================================================
   ৬) স্টক রিপোর্ট
   ===================================================================== */
elseif ($tab === 'stock_report'):
    $settings = shop_settings($pdo);
    $stagnantDays = (int)($settings['stagnant_stock_days'] ?? 60);
    $stockValue = (float)$pdo->query("SELECT COALESCE(SUM(stock_qty*cost_price),0) v FROM products WHERE status='active'")->fetch()['v'];
    $lowStock = $pdo->query("SELECT p.*, co.name company_name FROM products p LEFT JOIN companies co ON p.company_id=co.id WHERE p.status='active' AND p.stock_qty>0 AND p.stock_qty<=p.low_stock_threshold ORDER BY p.stock_qty ASC LIMIT 100")->fetchAll();
    $outStock = $pdo->query("SELECT p.*, co.name company_name FROM products p LEFT JOIN companies co ON p.company_id=co.id WHERE p.status='active' AND p.stock_qty<=0 ORDER BY p.name LIMIT 100")->fetchAll();
    $fastMoving = $pdo->prepare("SELECT p.name, p.unit, SUM(si.qty) total_qty FROM sale_items si JOIN sales s ON si.sale_id=s.id JOIN products p ON si.product_id=p.id WHERE s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY si.product_id ORDER BY total_qty DESC LIMIT 15");
    $fastMoving->execute();
    $fastMoving = $fastMoving->fetchAll();
    $deadStock = $pdo->prepare("
        SELECT p.name, p.unit, p.stock_qty, p.cost_price, (p.stock_qty*p.cost_price) value FROM products p
        WHERE p.status = 'active' AND p.stock_qty > 0
          AND p.created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND NOT EXISTS (SELECT 1 FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.product_id = p.id AND s.sale_date >= DATE_SUB(NOW(), INTERVAL ? DAY))
        ORDER BY value DESC LIMIT 30");
    $deadStock->execute([$stagnantDays, $stagnantDays]);
    $deadStock = $deadStock->fetchAll();
    ?>
    <div class="row g-3" style="margin-bottom:6px;">
        <div class="col-6 col-md-3"><div class="stat-card sm c-purple"><div class="stat-label">মোট স্টক ভ্যালু</div><div class="stat-value num">৳<?= money($stockValue) ?></div></div></div>
        <div class="col-6 col-md-3"><div class="stat-card sm c-yellow"><div class="stat-label">লো স্টক</div><div class="stat-value num"><?= count($lowStock) ?>+</div></div></div>
        <div class="col-6 col-md-3"><div class="stat-card sm c-danger"><div class="stat-label">স্টক আউট</div><div class="stat-value num"><?= count($outStock) ?>+</div></div></div>
        <div class="col-6 col-md-3"><div class="stat-card sm c-magenta"><div class="stat-label">স্থবির/ডেড স্টক (<?= $stagnantDays ?> দিন+)</div><div class="stat-value num"><?= count($deadStock) ?>+</div></div></div>
    </div>

    <div class="card" style="margin-top:14px;padding:16px;">
        <h3 style="font-size:14px;margin:0 0 10px;">লো স্টক</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>পণ্য</th><th>কোম্পানি</th><th class="num">স্টক</th><th class="num">থ্রেশহোল্ড</th></tr></thead><tbody>
        <?php if (empty($lowStock)): ?><tr><td colspan="4"><div class="empty-state">কোনো পণ্য লো স্টকে নেই।</div></td></tr><?php endif; ?>
        <?php foreach ($lowStock as $p): ?><tr><td><?= e($p['name']) ?></td><td><?= e($p['company_name'] ?: '-') ?></td><td class="num"><?= (int)$p['stock_qty'] ?></td><td class="num"><?= (int)$p['low_stock_threshold'] ?></td></tr><?php endforeach; ?>
        </tbody></table></div>
    </div>
    <div class="card" style="margin-top:14px;padding:16px;">
        <h3 style="font-size:14px;margin:0 0 10px;">স্টক আউট</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>পণ্য</th><th>কোম্পানি</th></tr></thead><tbody>
        <?php if (empty($outStock)): ?><tr><td colspan="2"><div class="empty-state">কোনো পণ্য স্টক আউট নেই।</div></td></tr><?php endif; ?>
        <?php foreach ($outStock as $p): ?><tr><td><?= e($p['name']) ?></td><td><?= e($p['company_name'] ?: '-') ?></td></tr><?php endforeach; ?>
        </tbody></table></div>
    </div>
    <div class="row g-3" style="margin-top:4px;">
        <div class="col-lg-6">
            <div class="card" style="padding:16px;">
                <h3 style="font-size:14px;margin:0 0 10px;">ফাস্ট মুভিং (বিগত ৩০ দিন)</h3>
                <table class="data-table"><thead><tr><th>পণ্য</th><th class="num">বিক্রিত পরিমাণ</th></tr></thead><tbody>
                <?php foreach ($fastMoving as $f): ?><tr><td><?= e($f['name']) ?></td><td class="num"><?= (int)$f['total_qty'] ?> <?= e($f['unit']) ?></td></tr><?php endforeach; ?>
                </tbody></table>
            </div>
        </div>
        <div class="col-lg-6">
            <div class="card" style="padding:16px;">
                <h3 style="font-size:14px;margin:0 0 10px;">স্থবির/ডেড স্টক</h3>
                <table class="data-table"><thead><tr><th>পণ্য</th><th class="num">স্টক</th><th class="num">আটকে থাকা মূল্য</th></tr></thead><tbody>
                <?php foreach ($deadStock as $d): ?><tr><td><?= e($d['name']) ?></td><td class="num"><?= (int)$d['stock_qty'] ?> <?= e($d['unit']) ?></td><td class="num">৳<?= money($d['value']) ?></td></tr><?php endforeach; ?>
                </tbody></table>
            </div>
        </div>
    </div>

<?php
/* =====================================================================
   ৭) লাভ-ক্ষতি (অপরিবর্তিত হিসাব-লজিক)
   ===================================================================== */
elseif ($tab === 'profit_loss'):
    $salesTotal = $pdo->prepare("SELECT COALESCE(SUM(subtotal),0) v FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?");
    $salesTotal->execute([$from, $to]);
    $revenue = $salesTotal->fetch()['v'];

    $discTotal = $pdo->prepare("SELECT COALESCE(SUM(discount),0) v FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?");
    $discTotal->execute([$from, $to]);
    $discount = $discTotal->fetch()['v'];

    $cogsStmt = $pdo->prepare("SELECT COALESCE(SUM(si.unit_cost * si.qty),0) v FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE DATE(s.sale_date) BETWEEN ? AND ?");
    $cogsStmt->execute([$from, $to]);
    $cogs = $cogsStmt->fetch()['v'];

    $sameSaleRetCogs = $pdo->prepare("SELECT COALESCE(SUM(ri.unit_cost * ri.qty),0) v
        FROM sales_return_items ri
        JOIN sales_returns r ON ri.return_id = r.id
        JOIN sales s ON r.sale_id = s.id
        WHERE DATE(r.return_date) BETWEEN ? AND ? AND DATE(s.sale_date) BETWEEN ? AND ?");
    $sameSaleRetCogs->execute([$from, $to, $from, $to]);
    $cogs = max(0, $cogs - (float)$sameSaleRetCogs->fetch()['v']);

    $crossPeriodStmt = $pdo->prepare("SELECT COALESCE(SUM(r.return_total),0) v
        FROM sales_returns r JOIN sales s ON r.sale_id = s.id
        WHERE DATE(r.return_date) BETWEEN ? AND ? AND NOT (DATE(s.sale_date) BETWEEN ? AND ?)");
    $crossPeriodStmt->execute([$from, $to, $from, $to]);
    $crossReturnsTotal = $crossPeriodStmt->fetch()['v'];

    $grossProfit = $revenue - $discount - $cogs - $crossReturnsTotal;

    $expStmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date BETWEEN ? AND ?");
    $expStmt->execute([$from, $to]);
    $expenses = $expStmt->fetch()['v'];

    $netProfit = $grossProfit - $expenses;
    $netMargin = $revenue > 0 ? round($netProfit / $revenue * 100, 1) : 0;
    ?>
    <div class="card" style="max-width:560px;padding:22px;">
        <div class="pl-line"><span>মোট বিক্রয় (আয়)</span><span class="num">৳<?= money($revenue) ?></span></div>
        <div class="pl-line"><span>বিয়োগ: ডিসকাউন্ট</span><span class="num">− ৳<?= money($discount) ?></span></div>
        <div class="pl-line"><span>নীট বিক্রয়</span><span class="num">৳<?= money($revenue - $discount) ?></span></div>
        <div class="pl-line"><span>বিয়োগ: পণ্যের ক্রয়মূল্য (COGS)</span><span class="num">− ৳<?= money($cogs) ?></span></div>
        <?php if ($crossReturnsTotal > 0): ?>
            <div class="pl-line"><span>বিয়োগ: বিক্রয় ফেরত (অন্য সময়ের বিক্রয়)</span><span class="num">− ৳<?= money($crossReturnsTotal) ?></span></div>
        <?php endif; ?>
        <div class="pl-line total"><span>গ্রস প্রফিট</span><span class="num">৳<?= money($grossProfit) ?></span></div>
        <div class="pl-line"><span>বিয়োগ: প্রাতিষ্ঠানিক খরচ</span><span class="num">− ৳<?= money($expenses) ?></span></div>
        <div class="pl-line grand"><span>নীট লাভ / ক্ষতি</span><span class="num" style="color:<?= $netProfit >= 0 ? 'var(--success)' : 'var(--danger)' ?>">৳<?= money($netProfit) ?></span></div>
        <div class="pl-line"><span>নীট মার্জিন</span><span class="num"><?= $netMargin ?>%</span></div>
    </div>
    <p style="font-size:11.5px;color:var(--text-secondary);max-width:560px;margin-top:10px;">নোট: বিক্রয় রাজস্ব = মোট বিক্রয় (নগদ ও বাকি উভয়ই); বাকি বিক্রয়ের টাকা এখনো নগদ পাওয়া যায়নি — "ক্যাশ ও আর্থিক" ট্যাবে শুধু প্রকৃত প্রাপ্ত নগদ দেখানো হয়।</p>

<?php
/* =====================================================================
   ৮) ক্যাশ ও আর্থিক রিপোর্ট
   ===================================================================== */
elseif ($tab === 'cash_report'):
    $cashSales = $pdo->prepare("SELECT COALESCE(SUM(paid_amount),0) v FROM sales WHERE payment_method='cash' AND DATE(sale_date) BETWEEN ? AND ?");
    $cashSales->execute([$from, $to]); $cashSales = (float)$cashSales->fetch()['v'];

    $otherSales = $pdo->prepare("SELECT COALESCE(SUM(paid_amount),0) v FROM sales WHERE payment_method != 'cash' AND DATE(sale_date) BETWEEN ? AND ?");
    $otherSales->execute([$from, $to]); $otherSales = (float)$otherSales->fetch()['v'];

    $custPay = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM customer_payments WHERE type='payment' AND payment_date BETWEEN ? AND ?");
    $custPay->execute([$from, $to]); $custPay = (float)$custPay->fetch()['v'];

    $custLoan = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM customer_payments WHERE type='loan' AND payment_date BETWEEN ? AND ?");
    $custLoan->execute([$from, $to]); $custLoan = (float)$custLoan->fetch()['v'];

    $supPay = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM supplier_payments WHERE type='payment' AND payment_date BETWEEN ? AND ?");
    $supPay->execute([$from, $to]); $supPay = (float)$supPay->fetch()['v'];

    $supReceipt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM supplier_payments WHERE type='receipt' AND payment_date BETWEEN ? AND ?");
    $supReceipt->execute([$from, $to]); $supReceipt = (float)$supReceipt->fetch()['v'];

    $purchasePaid = $pdo->prepare("SELECT COALESCE(SUM(paid_amount),0) v FROM purchases WHERE purchase_date BETWEEN ? AND ?");
    $purchasePaid->execute([$from, $to]); $purchasePaid = (float)$purchasePaid->fetch()['v'];

    $expenseTotal = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date BETWEEN ? AND ?");
    $expenseTotal->execute([$from, $to]); $expenseTotal = (float)$expenseTotal->fetch()['v'];

    $refunds = $pdo->prepare("SELECT COALESCE(SUM(refund_amount),0) v FROM sales_returns WHERE DATE(return_date) BETWEEN ? AND ?");
    $refunds->execute([$from, $to]); $refunds = (float)$refunds->fetch()['v'];

    $cashIn = $cashSales + $custPay + $supReceipt;
    $cashOut = $custLoan + $supPay + $purchasePaid + $expenseTotal + $refunds;
    $net = $cashIn - $cashOut;
    ?>
    <div class="card" style="max-width:600px;padding:22px;">
        <h3 style="font-size:14px;margin:0 0 4px;">নগদ প্রবাহ — <?= e($from) ?> থেকে <?= e($to) ?></h3>
        <p style="font-size:11.5px;color:var(--text-secondary);margin:0 0 14px;">অনুমান: সব ক্রয়-পরিশোধ ও খরচ নগদ হিসেবে ধরা হয়েছে (আলাদা পেমেন্ট-মেথড ট্র্যাকিং এই দুটির জন্য নেই)।</p>
        <div class="pl-line"><span>ক্যাশ বিক্রয় সংগ্রহ</span><span class="num">৳<?= money($cashSales) ?></span></div>
        <div class="pl-line"><span>কাস্টমার পেমেন্ট গ্রহণ</span><span class="num">৳<?= money($custPay) ?></span></div>
        <div class="pl-line"><span>সাপ্লায়ার থেকে প্রাপ্তি</span><span class="num">৳<?= money($supReceipt) ?></span></div>
        <div class="pl-line total"><span>মোট ক্যাশ ইন</span><span class="num">৳<?= money($cashIn) ?></span></div>
        <div class="pl-line" style="margin-top:10px;"><span>কাস্টমারকে হাওলাত/নগদ প্রদান</span><span class="num">− ৳<?= money($custLoan) ?></span></div>
        <div class="pl-line"><span>সাপ্লায়ারকে পরিশোধ</span><span class="num">− ৳<?= money($supPay) ?></span></div>
        <div class="pl-line"><span>ক্রয় বিল পরিশোধ</span><span class="num">− ৳<?= money($purchasePaid) ?></span></div>
        <div class="pl-line"><span>প্রাতিষ্ঠানিক খরচ</span><span class="num">− ৳<?= money($expenseTotal) ?></span></div>
        <div class="pl-line"><span>বিক্রয়-ফেরত রিফান্ড</span><span class="num">− ৳<?= money($refunds) ?></span></div>
        <div class="pl-line total"><span>মোট ক্যাশ আউট</span><span class="num">৳<?= money($cashOut) ?></span></div>
        <div class="pl-line grand"><span>নীট ক্যাশ ফ্লো (এই সময়ে)</span><span class="num" style="color:<?= $net >= 0 ? 'var(--success)' : 'var(--danger)' ?>">৳<?= money($net) ?></span></div>
        <div class="pl-line"><span>অন্যান্য মেথডে বিক্রয় সংগ্রহ (তথ্যের জন্য, উপরের হিসাবে যুক্ত নয়)</span><span class="num">৳<?= money($otherSales) ?></span></div>
    </div>

<?php
/* =====================================================================
   ৯) কাস্টমার রিপোর্ট
   ===================================================================== */
elseif ($tab === 'customer_report'):
    $totalCustomers = (int)$pdo->query("SELECT COUNT(*) c FROM customers")->fetch()['c'];
    $newCustomers = $pdo->prepare("SELECT COUNT(*) c FROM customers WHERE DATE(created_at) BETWEEN ? AND ?");
    $newCustomers->execute([$from, $to]); $newCustomers = (int)$newCustomers->fetch()['c'];
    $activeCustomers = $pdo->prepare("SELECT COUNT(DISTINCT customer_id) c FROM sales WHERE customer_id IS NOT NULL AND DATE(sale_date) BETWEEN ? AND ?");
    $activeCustomers->execute([$from, $to]); $activeCustomers = (int)$activeCustomers->fetch()['c'];

    $top = $pdo->prepare("SELECT c.id, c.name, c.mobile, COUNT(s.id) invoices, COALESCE(SUM(s.total_amount),0) total_sales,
            COALESCE((SELECT SUM(si.subtotal-si.unit_cost*si.qty) FROM sale_items si WHERE si.sale_id IN (SELECT id FROM sales WHERE customer_id=c.id AND DATE(sale_date) BETWEEN ? AND ?)),0) profit
            FROM customers c JOIN sales s ON s.customer_id=c.id AND DATE(s.sale_date) BETWEEN ? AND ?
            GROUP BY c.id ORDER BY total_sales DESC LIMIT 20");
    $top->execute([$from, $to, $from, $to]);
    $topCustomers = $top->fetchAll();

    // ডিউ এজিং — বাকি থাকা প্রতিটি ইনভয়েসের বয়স হিসাব করে বাকেটে ভাগ করা হয়
    $dueRows = $pdo->query("SELECT s.due_amount, s.sale_date, DATEDIFF(CURDATE(), s.sale_date) age, c.name customer_name, s.invoice_no
            FROM sales s JOIN customers c ON s.customer_id=c.id WHERE s.due_amount > 0 ORDER BY age DESC")->fetchAll();
    $buckets = ['0-30' => 0, '31-60' => 0, '61-90' => 0, '90+' => 0];
    foreach ($dueRows as $d) {
        $age = (int)$d['age'];
        if ($age <= 30) $buckets['0-30'] += $d['due_amount'];
        elseif ($age <= 60) $buckets['31-60'] += $d['due_amount'];
        elseif ($age <= 90) $buckets['61-90'] += $d['due_amount'];
        else $buckets['90+'] += $d['due_amount'];
    }
    ?>
    <div class="row g-3" style="margin-bottom:6px;">
        <div class="col-4"><div class="stat-card sm c-purple"><div class="stat-label">মোট কাস্টমার</div><div class="stat-value num"><?= $totalCustomers ?></div></div></div>
        <div class="col-4"><div class="stat-card sm c-success"><div class="stat-label">নতুন কাস্টমার (এই সময়ে)</div><div class="stat-value num"><?= $newCustomers ?></div></div></div>
        <div class="col-4"><div class="stat-card sm c-orange"><div class="stat-label">সক্রিয় কাস্টমার (এই সময়ে)</div><div class="stat-value num"><?= $activeCustomers ?></div></div></div>
    </div>
    <div class="card" style="margin-top:14px;padding:16px;">
        <h3 style="font-size:14px;margin:0 0 10px;">বাকি বয়স-ভিত্তিক (Due Aging)</h3>
        <div class="row g-2">
            <?php foreach ($buckets as $label => $val): ?>
                <div class="col-6 col-md-3"><div class="stat-card sm <?= $val > 0 ? 'c-danger' : 'c-success' ?>"><div class="stat-label"><?= $label ?> দিন</div><div class="stat-value num">৳<?= money($val) ?></div></div></div>
            <?php endforeach; ?>
        </div>
    </div>
    <div class="card" style="margin-top:14px;padding:16px;">
        <h3 style="font-size:14px;margin:0 0 10px;">শীর্ষ কাস্টমার (এই সময়ে)</h3>
        <table class="data-table"><thead><tr><th>নাম</th><th>মোবাইল</th><th class="num">ইনভয়েস</th><th class="num">মোট বিক্রয়</th><th class="num">লাভ</th></tr></thead><tbody>
        <?php if (empty($topCustomers)): ?><tr><td colspan="5"><div class="empty-state">এই সময়ে কোনো বিক্রয় নেই।</div></td></tr><?php endif; ?>
        <?php foreach ($topCustomers as $c): ?><tr><td><a href="customers.php?view=show&id=<?= (int)$c['id'] ?>"><?= e($c['name']) ?></a></td><td><?= e($c['mobile']) ?></td><td class="num"><?= (int)$c['invoices'] ?></td><td class="num">৳<?= money($c['total_sales']) ?></td><td class="num">৳<?= money($c['profit']) ?></td></tr><?php endforeach; ?>
        </tbody></table>
    </div>

<?php
/* =====================================================================
   ১০) সাপ্লায়ার রিপোর্ট
   ===================================================================== */
elseif ($tab === 'supplier_report'):
    $top = $pdo->prepare("SELECT s.id, s.name, s.mobile, COUNT(p.id) invoices, COALESCE(SUM(p.total_amount),0) total_purchase, COALESCE(SUM(p.due_amount),0) due
            FROM suppliers s JOIN purchases p ON p.supplier_id=s.id AND p.purchase_date BETWEEN ? AND ?
            GROUP BY s.id ORDER BY total_purchase DESC LIMIT 20");
    $top->execute([$from, $to]);
    $topSuppliers = $top->fetchAll();

    $dueRows = $pdo->query("SELECT p.due_amount, DATEDIFF(CURDATE(), p.purchase_date) age FROM purchases p WHERE p.due_amount > 0")->fetchAll();
    $buckets = ['0-30' => 0, '31-60' => 0, '61-90' => 0, '90+' => 0];
    foreach ($dueRows as $d) {
        $age = (int)$d['age'];
        if ($age <= 30) $buckets['0-30'] += $d['due_amount'];
        elseif ($age <= 60) $buckets['31-60'] += $d['due_amount'];
        elseif ($age <= 90) $buckets['61-90'] += $d['due_amount'];
        else $buckets['90+'] += $d['due_amount'];
    }
    ?>
    <div class="card" style="padding:16px;">
        <h3 style="font-size:14px;margin:0 0 10px;">সাপ্লায়ার বাকি — বয়স-ভিত্তিক (Due Aging)</h3>
        <div class="row g-2">
            <?php foreach ($buckets as $label => $val): ?>
                <div class="col-6 col-md-3"><div class="stat-card sm <?= $val > 0 ? 'c-danger' : 'c-success' ?>"><div class="stat-label"><?= $label ?> দিন</div><div class="stat-value num">৳<?= money($val) ?></div></div></div>
            <?php endforeach; ?>
        </div>
    </div>
    <div class="card" style="margin-top:14px;padding:16px;">
        <h3 style="font-size:14px;margin:0 0 10px;">শীর্ষ সাপ্লায়ার (এই সময়ে)</h3>
        <table class="data-table"><thead><tr><th>নাম</th><th>মোবাইল</th><th class="num">ইনভয়েস</th><th class="num">মোট ক্রয়</th><th class="num">বাকি</th></tr></thead><tbody>
        <?php if (empty($topSuppliers)): ?><tr><td colspan="5"><div class="empty-state">এই সময়ে কোনো ক্রয় নেই।</div></td></tr><?php endif; ?>
        <?php foreach ($topSuppliers as $s): ?><tr><td><a href="suppliers.php?view=show&id=<?= (int)$s['id'] ?>"><?= e($s['name']) ?></a></td><td><?= e($s['mobile']) ?></td><td class="num"><?= (int)$s['invoices'] ?></td><td class="num">৳<?= money($s['total_purchase']) ?></td><td class="num">৳<?= money($s['due']) ?></td></tr><?php endforeach; ?>
        </tbody></table>
    </div>

<?php
/* =====================================================================
   ১১) সেলসম্যান/এমপ্লয়ি রিপোর্ট
   ===================================================================== */
elseif ($tab === 'employee_report'):
    $rows = $pdo->prepare("SELECT u.id, u.name, u.role,
            COUNT(s.id) invoices, COALESCE(SUM(s.total_amount),0) total_sales, COALESCE(SUM(s.paid_amount),0) collection,
            COALESCE(SUM(s.due_amount),0) due_sales, COALESCE(SUM(s.discount),0) discount_given,
            COALESCE((SELECT SUM(si.subtotal-si.unit_cost*si.qty) FROM sale_items si WHERE si.sale_id IN (SELECT id FROM sales WHERE created_by=u.id AND DATE(sale_date) BETWEEN ? AND ?)),0) profit_generated
            FROM users u LEFT JOIN sales s ON s.created_by=u.id AND DATE(s.sale_date) BETWEEN ? AND ?
            GROUP BY u.id ORDER BY total_sales DESC");
    $rows->execute([$from, $to, $from, $to]);
    $rows = $rows->fetchAll();

    $retByUser = $pdo->prepare("SELECT s.created_by, COALESCE(SUM(r.return_total),0) v FROM sales_returns r JOIN sales s ON r.sale_id=s.id WHERE DATE(r.return_date) BETWEEN ? AND ? GROUP BY s.created_by");
    $retByUser->execute([$from, $to]);
    $retMap = $retByUser->fetchAll(PDO::FETCH_KEY_PAIR);

    $prodByUser = $pdo->query("SELECT created_by, status, COUNT(*) c FROM products WHERE created_by IS NOT NULL GROUP BY created_by, status")->fetchAll();
    $prodMap = [];
    foreach ($prodByUser as $pr) { $prodMap[$pr['created_by']][$pr['status']] = (int)$pr['c']; }
    ?>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>নাম</th><th>রোল</th><th class="num">ইনভয়েস</th><th class="num">মোট বিক্রয়</th><th class="num">কালেকশন</th><th class="num">বাকি বিক্রয়</th><th class="num">ডিসকাউন্ট</th><th class="num">রিটার্ন</th><th class="num">লাভ</th><th class="num">গড় ইনভয়েস</th><th>পণ্য অনুমোদন</th></tr></thead>
            <tbody>
            <?php foreach ($rows as $r):
                $avg = $r['invoices'] > 0 ? $r['total_sales'] / $r['invoices'] : 0;
                $ret = $retMap[$r['id']] ?? 0;
                $pend = $prodMap[$r['id']]['pending'] ?? 0;
                $act = $prodMap[$r['id']]['active'] ?? 0;
                $rej = $prodMap[$r['id']]['inactive'] ?? 0;
            ?>
                <tr>
                    <td><?= e($r['name']) ?></td>
                    <td><?= $r['role'] === 'owner' ? 'মালিক' : ($r['role'] === 'salesman' ? 'সেলসম্যান' : 'ক্যাশিয়ার') ?></td>
                    <td class="num"><?= (int)$r['invoices'] ?></td>
                    <td class="num">৳<?= money($r['total_sales']) ?></td>
                    <td class="num">৳<?= money($r['collection']) ?></td>
                    <td class="num">৳<?= money($r['due_sales']) ?></td>
                    <td class="num">৳<?= money($r['discount_given']) ?></td>
                    <td class="num">৳<?= money($ret) ?></td>
                    <td class="num" style="color:<?= $r['profit_generated'] >= 0 ? 'var(--success)' : 'var(--danger)' ?>;">৳<?= money($r['profit_generated']) ?></td>
                    <td class="num">৳<?= money($avg) ?></td>
                    <td style="font-size:11.5px;">অনুমোদিত <?= $act ?> · অপেক্ষমান <?= $pend ?> · বাতিল <?= $rej ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <p style="font-size:11.5px;color:var(--text-secondary);margin-top:10px;">নোট: টার্গেট-বনাম-অর্জন এখনো সিস্টেমে যুক্ত নেই (এর জন্য প্রতি সেলসম্যানের মাসিক টার্গেট সংরক্ষণের একটি নতুন সেটিং লাগবে) — ভবিষ্যতে যোগ করা যেতে পারে।</p>

<?php
/* =====================================================================
   ১২) রিটার্ন রিপোর্ট
   ===================================================================== */
elseif ($tab === 'return_report'):
    [$salesRet, $purchRet] = rpt_return_rows($pdo, $from, $to, $fCustomer, $fSupplier);
    $salesRetTotal = array_sum(array_column($salesRet, 'return_total'));
    $purchRetTotal = array_sum(array_column($purchRet, 'total_amount'));
    ?>
    <div class="row g-3" style="margin-bottom:6px;">
        <div class="col-6"><div class="stat-card sm c-danger"><div class="stat-label">মোট বিক্রয় ফেরত</div><div class="stat-value num">৳<?= money($salesRetTotal) ?></div></div></div>
        <div class="col-6"><div class="stat-card sm c-orange"><div class="stat-label">মোট ক্রয় ফেরত</div><div class="stat-value num">৳<?= money($purchRetTotal) ?></div></div></div>
    </div>
    <div class="card" style="margin-top:14px;padding:16px;">
        <h3 style="font-size:14px;margin:0 0 10px;">বিক্রয় ফেরত (Sales Return)</h3>
        <table class="data-table"><thead><tr><th>রিটার্ন নং</th><th>মূল ইনভয়েস</th><th>তারিখ</th><th>কাস্টমার</th><th>কারণ</th><th>ইউজার</th><th class="num">পরিমাণ</th></tr></thead><tbody>
        <?php if (empty($salesRet)): ?><tr><td colspan="7"><div class="empty-state">এই সময়ে কোনো বিক্রয় ফেরত নেই।</div></td></tr><?php endif; ?>
        <?php foreach ($salesRet as $r): ?><tr><td><?= e($r['return_no']) ?></td><td><?= e($r['invoice_no']) ?></td><td><?= e(date('d M Y', strtotime($r['return_date']))) ?></td><td><?= e($r['customer_name'] ?: '-') ?></td><td><?= e($r['reason'] ?: '-') ?></td><td><?= e($r['user_name'] ?: '-') ?></td><td class="num">৳<?= money($r['return_total']) ?></td></tr><?php endforeach; ?>
        </tbody></table>
    </div>
    <div class="card" style="margin-top:14px;padding:16px;">
        <h3 style="font-size:14px;margin:0 0 10px;">ক্রয় ফেরত (Purchase Return)</h3>
        <table class="data-table"><thead><tr><th>রিটার্ন নং</th><th>তারিখ</th><th>সাপ্লায়ার</th><th>কারণ</th><th>ইউজার</th><th class="num">পরিমাণ</th></tr></thead><tbody>
        <?php if (empty($purchRet)): ?><tr><td colspan="6"><div class="empty-state">এই সময়ে কোনো ক্রয় ফেরত নেই।</div></td></tr><?php endif; ?>
        <?php foreach ($purchRet as $r): ?><tr><td><?= e($r['return_no']) ?></td><td><?= e(date('d M Y', strtotime($r['return_date']))) ?></td><td><?= e($r['supplier_name'] ?: '-') ?></td><td><?= e($r['reason'] ?: '-') ?></td><td><?= e($r['user_name'] ?: '-') ?></td><td class="num">৳<?= money($r['total_amount']) ?></td></tr><?php endforeach; ?>
        </tbody></table>
    </div>

<?php
/* =====================================================================
   ১৩) আয়-ব্যয় (Expense) — অপরিবর্তিত ফর্ম + নতুন ক্যাটাগরি ব্রেকডাউন
   ===================================================================== */
elseif ($tab === 'expenses'):
    $expStmt = $pdo->prepare("SELECT * FROM expenses WHERE expense_date BETWEEN ? AND ? ORDER BY expense_date DESC");
    $expStmt->execute([$from, $to]);
    $expenseRows = $expStmt->fetchAll();
    $expTotal = array_sum(array_column($expenseRows, 'amount'));

    $catStmt = $pdo->prepare("SELECT category, COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY category ORDER BY v DESC");
    $catStmt->execute([$from, $to]);
    $catRows = $catStmt->fetchAll();

    $salesForRatio = $pdo->prepare("SELECT COALESCE(SUM(total_amount),0) v FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?");
    $salesForRatio->execute([$from, $to]);
    $salesForRatio = (float)$salesForRatio->fetch()['v'];
    ?>
    <div class="row g-3">
        <div class="col-lg-5">
            <div class="card" style="padding:18px;">
                <h3 style="font-size:15px;margin:0 0 12px;">নতুন খরচ যুক্ত করুন</h3>
                <form method="POST">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="save_expense">
                    <div class="form-group"><label>ক্যাটাগরি</label><input type="text" name="category" class="form-control" list="expCatList" required placeholder="যেমন: ভাড়া, বিদ্যুৎ, বেতন"></div>
                    <datalist id="expCatList"><?php foreach ($catRows as $c): ?><option value="<?= e($c['category']) ?>"><?php endforeach; ?></datalist>
                    <div class="form-group"><label>পরিমাণ (৳)</label><input type="number" step="0.01" name="amount" class="form-control" required></div>
                    <div class="form-group"><label>তারিখ</label><input type="date" name="expense_date" class="form-control" value="<?= date('Y-m-d') ?>"></div>
                    <div class="form-group"><label>নোট</label><input type="text" name="note" class="form-control" placeholder="ঐচ্ছিক"></div>
                    <button class="btn btn-primary btn-block">সংরক্ষণ করুন</button>
                </form>
            </div>
            <div class="card" style="padding:16px;margin-top:14px;">
                <h3 style="font-size:14px;margin:0 0 10px;">ক্যাটাগরি অনুযায়ী খরচ</h3>
                <table class="data-table"><thead><tr><th>ক্যাটাগরি</th><th class="num">মোট</th><th class="num">%</th></tr></thead><tbody>
                <?php foreach ($catRows as $c): ?><tr><td><?= e($c['category']) ?></td><td class="num">৳<?= money($c['v']) ?></td><td class="num"><?= $expTotal > 0 ? round($c['v']/$expTotal*100,1) : 0 ?>%</td></tr><?php endforeach; ?>
                </tbody></table>
                <div class="pl-line" style="margin-top:10px;"><span>মোট খরচ</span><span class="num">৳<?= money($expTotal) ?></span></div>
                <div class="pl-line"><span>খরচ vs বিক্রয়</span><span class="num"><?= $salesForRatio > 0 ? round($expTotal/$salesForRatio*100,1) : 0 ?>%</span></div>
            </div>
        </div>
        <div class="col-lg-7">
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>তারিখ</th><th>ক্যাটাগরি</th><th>নোট</th><th class="num">পরিমাণ</th></tr></thead>
                    <tbody>
                    <?php if (empty($expenseRows)): ?><tr><td colspan="4"><div class="empty-state">এই সময়ে কোনো খরচ নেই।</div></td></tr><?php endif; ?>
                    <?php foreach ($expenseRows as $ex): ?>
                        <tr><td><?= e(date('d M Y', strtotime($ex['expense_date']))) ?></td><td><?= e($ex['category']) ?></td><td><?= e($ex['note']) ?></td><td class="num">৳<?= money($ex['amount']) ?></td></tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

<?php
/* =====================================================================
   ১৪) পেমেন্ট মেথড রিপোর্ট
   ===================================================================== */
elseif ($tab === 'payment_report'):
    $byMethod = $pdo->prepare("SELECT payment_method, COUNT(*) tx_count, COALESCE(SUM(paid_amount),0) collected FROM sales WHERE DATE(sale_date) BETWEEN ? AND ? GROUP BY payment_method ORDER BY collected DESC");
    $byMethod->execute([$from, $to]);
    $byMethod = $byMethod->fetchAll();

    $refundsByMethod = $pdo->prepare("SELECT refund_method, COALESCE(SUM(refund_amount),0) v FROM sales_returns WHERE DATE(return_date) BETWEEN ? AND ? AND refund_amount > 0 GROUP BY refund_method");
    $refundsByMethod->execute([$from, $to]);
    $refundMap = $refundsByMethod->fetchAll(PDO::FETCH_KEY_PAIR);

    $methodNames = [];
    foreach ($activePaymentMethods as $pm) { $methodNames[$pm['method_key']] = $pm['method_name']; }
    ?>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>পেমেন্ট মেথড</th><th class="num">লেনদেন সংখ্যা</th><th class="num">মোট সংগ্রহ</th><th class="num">রিফান্ড</th><th class="num">নীট সংগ্রহ</th></tr></thead>
            <tbody>
            <?php if (empty($byMethod)): ?><tr><td colspan="5"><div class="empty-state">এই সময়ে কোনো লেনদেন নেই।</div></td></tr><?php endif; ?>
            <?php foreach ($byMethod as $m):
                $refund = (float)($refundMap[$m['payment_method']] ?? 0);
            ?>
                <tr>
                    <td><?= e($methodNames[$m['payment_method']] ?? $m['payment_method']) ?></td>
                    <td class="num"><?= (int)$m['tx_count'] ?></td>
                    <td class="num">৳<?= money($m['collected']) ?></td>
                    <td class="num">৳<?= money($refund) ?></td>
                    <td class="num">৳<?= money($m['collected'] - $refund) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <p style="font-size:11.5px;color:var(--text-secondary);margin-top:10px;">সেটিংসে (পেমেন্ট মেথড) যেসব মেথড যুক্ত/সক্রিয় করা আছে সেগুলোই এখানে দেখাবে — নতুন মেথড যোগ করলে এই রিপোর্টেও স্বয়ংক্রিয়ভাবে আসবে।</p>

<?php
/* =====================================================================
   ১৫) লোকসানি বিক্রয় (অপরিবর্তিত)
   ===================================================================== */
elseif ($tab === 'below_cost'):
    $stmt = $pdo->prepare("
        SELECT s.id, s.invoice_no, s.sale_date, s.total_amount, c.name AS customer_name, u.name AS cashier_name,
               COALESCE((SELECT SUM(si.unit_cost * si.qty) FROM sale_items si WHERE si.sale_id = s.id), 0) AS total_cost
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.below_cost_approved = 1 AND DATE(s.sale_date) BETWEEN ? AND ?
        ORDER BY s.sale_date DESC");
    $stmt->execute([$from, $to]);
    $rows = $stmt->fetchAll();
    $totalLoss = 0;
    foreach ($rows as $r) {
        $totalLoss += max(0, (float)$r['total_cost'] - (float)$r['total_amount']);
    }
    ?>
    <?php if (!empty($rows)): ?>
        <div class="alert alert-warning" style="max-width:560px;">এই সময়ে <?= count($rows) ?>টি বিক্রয় ক্রয়মূল্যের নিচে (লোকসানে) সম্পন্ন হয়েছে — মোট লোকসান <strong>৳<?= money($totalLoss) ?></strong>।</div>
    <?php endif; ?>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>ইনভয়েস</th><th>তারিখ</th><th>কাস্টমার</th><th>বিক্রয়কারী</th><th class="num">ক্রয়মূল্য</th><th class="num">বিক্রয়মূল্য</th><th class="num">লোকসান</th></tr></thead>
            <tbody>
            <?php if (empty($rows)): ?><tr><td colspan="7"><div class="empty-state">এই সময়ে ক্রয়মূল্যের নিচে কোনো বিক্রয় হয়নি।</div></td></tr><?php endif; ?>
            <?php foreach ($rows as $r):
                $loss = max(0, (float)$r['total_cost'] - (float)$r['total_amount']);
            ?>
                <tr>
                    <td><a href="sales_list.php?view=show&id=<?= (int)$r['id'] ?>"><?= e($r['invoice_no']) ?></a></td>
                    <td><?= e(date('d M Y', strtotime($r['sale_date']))) ?></td>
                    <td><?= e($r['customer_name'] ?: '—') ?></td>
                    <td><?= e($r['cashier_name'] ?: '—') ?></td>
                    <td class="num">৳<?= money($r['total_cost']) ?></td>
                    <td class="num">৳<?= money($r['total_amount']) ?></td>
                    <td class="num" style="color:var(--danger);font-weight:700;">− ৳<?= money($loss) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>

<?php
/* =====================================================================
   ১৬) AI বিজনেস ইনসাইটস — ডেটা-চালিত নিয়মভিত্তিক বিশ্লেষণ (কোনো সংখ্যা
   বানানো হয় না; প্রতিটি বাক্য সরাসরি ডাটাবেজের প্রকৃত হিসাব থেকে আসে)
   ===================================================================== */
elseif ($tab === 'ai_insights'):
    $curFrom = date('Y-m-01'); $curTo = $today;
    [$prevFrom, $prevTo] = report_previous_range($curFrom, $curTo);

    $s1 = $pdo->prepare("SELECT COALESCE(SUM(total_amount),0) v FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?"); $s1->execute([$curFrom, $curTo]); $curSales = (float)$s1->fetch()['v'];
    $s2 = $pdo->prepare("SELECT COALESCE(SUM(total_amount),0) v FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?"); $s2->execute([$prevFrom, $prevTo]); $prevSales = (float)$s2->fetch()['v'];
    $salesTrend = report_trend_percent($curSales, $prevSales);

    $topProducts = $pdo->prepare("SELECT p.name, SUM(si.qty) q FROM sale_items si JOIN sales s ON si.sale_id=s.id JOIN products p ON si.product_id=p.id WHERE DATE(s.sale_date) BETWEEN ? AND ? GROUP BY si.product_id ORDER BY q DESC LIMIT 3");
    $topProducts->execute([$curFrom, $curTo]);
    $topProducts = $topProducts->fetchAll();

    $noMoveProducts = $pdo->query("SELECT p.name FROM products p WHERE p.status='active' AND p.stock_qty > 0 AND NOT EXISTS (SELECT 1 FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE si.product_id=p.id AND s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) ORDER BY p.stock_qty*p.cost_price DESC LIMIT 5")->fetchAll();

    $restockNeeded = $pdo->query("SELECT name, stock_qty, low_stock_threshold FROM products WHERE status='active' AND stock_qty <= low_stock_threshold ORDER BY stock_qty ASC LIMIT 5")->fetchAll();

    $lowMarginProducts = $pdo->prepare("SELECT p.name,
            SUM(si.subtotal) revenue, SUM(si.unit_cost*si.qty) cost
            FROM sale_items si JOIN sales s ON si.sale_id=s.id JOIN products p ON si.product_id=p.id
            WHERE DATE(s.sale_date) BETWEEN ? AND ?
            GROUP BY si.product_id HAVING revenue > 0
            ORDER BY (SUM(si.subtotal)-SUM(si.unit_cost*si.qty))/SUM(si.subtotal) ASC LIMIT 5");
    $lowMarginProducts->execute([$curFrom, $curTo]);
    $lowMarginProducts = $lowMarginProducts->fetchAll();

    $highDueCustomers = $pdo->query("SELECT c.name, (c.opening_balance + COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id=c.id),0)) due FROM customers c HAVING due > 0 ORDER BY due DESC LIMIT 5")->fetchAll();

    $curExp = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date BETWEEN ? AND ?"); $curExp->execute([$curFrom, $curTo]); $curExp = (float)$curExp->fetch()['v'];
    $prevExp = $pdo->prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date BETWEEN ? AND ?"); $prevExp->execute([$prevFrom, $prevTo]); $prevExp = (float)$prevExp->fetch()['v'];
    $expTrend = report_trend_percent($curExp, $prevExp);

    $curCogs = $pdo->prepare("SELECT COALESCE(SUM(si.unit_cost*si.qty),0) v FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE DATE(s.sale_date) BETWEEN ? AND ?"); $curCogs->execute([$curFrom, $curTo]); $curCogs = (float)$curCogs->fetch()['v'];
    $curDisc = $pdo->prepare("SELECT COALESCE(SUM(discount),0) v FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?"); $curDisc->execute([$curFrom, $curTo]); $curDisc = (float)$curDisc->fetch()['v'];
    $curNetProfit = $curSales - $curDisc - $curCogs - $curExp;

    $health = 'সুস্থ'; $healthClass = 'c-success';
    if ($curNetProfit < 0) { $health = 'সংকটাপন্ন'; $healthClass = 'c-danger'; }
    elseif ($salesTrend !== null && $salesTrend < -10) { $health = 'নজর দরকার'; $healthClass = 'c-yellow'; }
    ?>
    <div class="row g-3" style="margin-bottom:10px;">
        <div class="col-12 col-md-4">
            <div class="stat-card <?= $healthClass ?>"><div class="stat-icon"><i class="bi bi-heart-pulse"></i></div>
                <div class="stat-label">ব্যবসার স্বাস্থ্য (এই মাস)</div><div class="stat-value"><?= $health ?></div>
                <div class="stat-sub">নীট লাভ ৳<?= money($curNetProfit) ?></div></div>
        </div>
    </div>
    <div class="card" style="padding:18px;">
        <h3 style="font-size:15px;margin:0 0 12px;">এই মাসের বিশ্লেষণ (গত মাসের সমান সময়ের সাথে তুলনা)</h3>
        <ul style="margin:0;padding-left:20px;line-height:1.9;font-size:14px;">
            <li>
                <?php if ($salesTrend === null): ?>এই মাসে বিক্রয় শুরু হয়েছে — তুলনা করার মতো আগের ডেটা নেই।
                <?php elseif ($salesTrend > 0): ?>বিক্রয় আগের সম-দৈর্ঘ্যের সময়ের তুলনায় <strong style="color:var(--success);"><?= $salesTrend ?>% বেড়েছে</strong> (৳<?= money($prevSales) ?> → ৳<?= money($curSales) ?>)।
                <?php elseif ($salesTrend < 0): ?>বিক্রয় আগের সম-দৈর্ঘ্যের সময়ের তুলনায় <strong style="color:var(--danger);"><?= abs($salesTrend) ?>% কমেছে</strong> (৳<?= money($prevSales) ?> → ৳<?= money($curSales) ?>)।
                <?php else: ?>বিক্রয় আগের সময়ের প্রায় সমান আছে।
                <?php endif; ?>
            </li>
            <?php if (!empty($topProducts)): ?>
            <li>সবচেয়ে দ্রুত বিক্রি হচ্ছে: <?php foreach ($topProducts as $i => $tp): ?><?= $i > 0 ? ', ' : '' ?><strong><?= e($tp['name']) ?></strong> (<?= (int)$tp['q'] ?>টি)<?php endforeach; ?>।</li>
            <?php endif; ?>
            <?php if (!empty($noMoveProducts)): ?>
            <li>বিগত ৩০ দিনে বিক্রি হয়নি এমন পণ্য: <?php foreach ($noMoveProducts as $i => $np): ?><?= $i > 0 ? ', ' : '' ?><?= e($np['name']) ?><?php endforeach; ?> — এগুলো নিয়ে প্রমোশন বা ছাড় বিবেচনা করা যেতে পারে।</li>
            <?php endif; ?>
            <?php if (!empty($restockNeeded)): ?>
            <li>স্টক শেষ হয়ে আসছে (রিস্টক দরকার): <?php foreach ($restockNeeded as $i => $rn): ?><?= $i > 0 ? ', ' : '' ?><?= e($rn['name']) ?> (মজুদ <?= (int)$rn['stock_qty'] ?>)<?php endforeach; ?>।</li>
            <?php endif; ?>
            <?php if (!empty($lowMarginProducts)): ?>
            <li>সবচেয়ে কম মার্জিনের পণ্য: <?php foreach ($lowMarginProducts as $i => $lm):
                $m = $lm['revenue'] > 0 ? round(($lm['revenue']-$lm['cost'])/$lm['revenue']*100, 1) : 0;
            ?><?= $i > 0 ? ', ' : '' ?><?= e($lm['name']) ?> (<?= $m ?>%)<?php endforeach; ?>।</li>
            <?php endif; ?>
            <?php if (!empty($highDueCustomers)): ?>
            <li>সবচেয়ে বেশি বাকি থাকা কাস্টমার: <?php foreach ($highDueCustomers as $i => $hd): ?><?= $i > 0 ? ', ' : '' ?><?= e($hd['name']) ?> (৳<?= money($hd['due']) ?>)<?php endforeach; ?>।</li>
            <?php endif; ?>
            <li>
                <?php if ($expTrend === null): ?>এই মাসের খরচ ৳<?= money($curExp) ?>।
                <?php elseif ($expTrend > 15): ?>খরচ আগের সময়ের তুলনায় <strong style="color:var(--danger);"><?= $expTrend ?>% উল্লেখযোগ্যভাবে বেড়েছে</strong> (৳<?= money($prevExp) ?> → ৳<?= money($curExp) ?>) — কারণ যাচাই করা ভালো।
                <?php else: ?>খরচ আগের সময়ের তুলনায় <?= $expTrend >= 0 ? $expTrend . '% বেড়েছে' : abs($expTrend) . '% কমেছে' ?> (৳<?= money($prevExp) ?> → ৳<?= money($curExp) ?>)।
                <?php endif; ?>
            </li>
        </ul>
    </div>
    <p style="font-size:11.5px;color:var(--text-secondary);margin-top:10px;max-width:640px;">এই বিশ্লেষণ সম্পূর্ণভাবে ডাটাবেজের প্রকৃত হিসাব থেকে স্বয়ংক্রিয়ভাবে তৈরি (কোনো সংখ্যা অনুমান/বানানো হয়নি) — এটি একটি সরল নিয়মভিত্তিক (rule-based) সারাংশ, কোনো এক্সটার্নাল AI মডেলে ডেটা পাঠানো হয় না।</p>

<?php
/* =====================================================================
   ১৭) অডিট ও অ্যাক্টিভিটি লগ
   ===================================================================== */
elseif ($tab === 'audit_log'):
    $where = "WHERE DATE(a.created_at) BETWEEN ? AND ?";
    $params = [$from, $to];
    if ($fUser) { $where .= " AND a.user_id = ?"; $params[] = $fUser; }

    $countStmt = $pdo->prepare("SELECT COUNT(*) c FROM activity_log a $where");
    $countStmt->execute($params);
    $totalRows = (int)$countStmt->fetch()['c'];
    $totalPages = max(1, (int)ceil($totalRows / $perPage));
    $offset = ($page - 1) * $perPage;

    $stmt = $pdo->prepare("SELECT a.created_at, u.name AS user_name, a.action FROM activity_log a LEFT JOIN users u ON a.user_id=u.id $where ORDER BY a.id DESC LIMIT $perPage OFFSET $offset");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    ?>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>সময়</th><th>ব্যবহারকারী</th><th>কার্যক্রম</th></tr></thead>
            <tbody>
            <?php if (empty($rows)): ?><tr><td colspan="3"><div class="empty-state">এই সময়ে কোনো কার্যক্রম রেকর্ড নেই।</div></td></tr><?php endif; ?>
            <?php foreach ($rows as $r): ?>
                <tr><td><?= e(date('d M Y, h:i A', strtotime($r['created_at']))) ?></td><td><?= e($r['user_name'] ?: 'সিস্টেম') ?></td><td><?= e($r['action']) ?></td></tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php if ($totalPages > 1): ?>
    <div class="no-print" style="display:flex;gap:6px;justify-content:center;margin-top:14px;">
        <?php for ($pg = 1; $pg <= $totalPages; $pg++): ?>
            <a class="btn btn-sm <?= $pg === $page ? 'btn-primary' : 'btn-light' ?>" href="?<?= http_build_query(array_merge($_GET, ['page' => $pg])) ?>"><?= $pg ?></a>
        <?php endfor; ?>
    </div>
    <?php endif; ?>
    <p style="font-size:11.5px;color:var(--text-secondary);margin-top:10px;">নোট: বর্তমান লগে শুধু কার্যক্রমের বিবরণ (টেক্সট) সংরক্ষিত হয় — কোনো ফিল্ডের আগের/পরের নির্দিষ্ট মান বা IP/ডিভাইসের তথ্য এখনো আলাদাভাবে রেকর্ড করা হয় না। বিক্রয়/ক্রয়ের মতো আর্থিক এন্ট্রি এই সিস্টেমে কখনো সরাসরি ডিলিট হয় না — ফেরত (রিটার্ন) বা বাতিলের মাধ্যমে সমন্বয় হয়, যা এই লগে থাকে।</p>

<?php endif; ?>
