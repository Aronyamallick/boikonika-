<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();

$user = current_user();
$isOwner = is_owner();
$canSeeStockInsights = has_permission($user, 'stock_insights');
$settings = shop_settings($pdo);
$stagnantDays = (int)($settings['stagnant_stock_days'] ?? 60);

// --- আজকের বিক্রয় / ইনভয়েস / বাকি (সব রোলের জন্য) ---
$todaySales   = $pdo->query("SELECT COALESCE(SUM(total_amount),0) v FROM sales WHERE DATE(sale_date) = CURDATE()")->fetch()['v'];
$todayInvoices= $pdo->query("SELECT COUNT(*) v FROM sales WHERE DATE(sale_date) = CURDATE()")->fetch()['v'];
$todayDue     = $pdo->query("SELECT COALESCE(SUM(due_amount),0) v FROM sales WHERE DATE(sale_date) = CURDATE()")->fetch()['v'];
$todayDueCustomers = $pdo->query("SELECT COUNT(DISTINCT customer_id) v FROM sales WHERE DATE(sale_date) = CURDATE() AND due_amount > 0 AND customer_id IS NOT NULL")->fetch()['v'];

$todayPurchase = 0; $todayProfit = 0; $stagnantItems = []; $bestSelling = []; $graphLabels = []; $graphData = [];
$companies = []; $lowStockItems = []; $lowStockTotalCount = 0; $lowCompanyFilter = (int)($_GET['low_company'] ?? 0);

if ($isOwner) {
    $todayPurchase = $pdo->query("SELECT COALESCE(SUM(total_amount),0) v FROM purchases WHERE purchase_date = CURDATE()")->fetch()['v'];
    $todayPurchaseCount = $pdo->query("SELECT COUNT(*) v FROM purchases WHERE purchase_date = CURDATE()")->fetch()['v'];

    $itemProfit = $pdo->query("
        SELECT COALESCE(SUM(si.subtotal - (si.unit_cost * si.qty)),0) v
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.sale_date) = CURDATE()")->fetch()['v'];
    $todayDiscount = $pdo->query("SELECT COALESCE(SUM(discount),0) v FROM sales WHERE DATE(sale_date) = CURDATE()")->fetch()['v'];
    $todayGrossProfit = $itemProfit - $todayDiscount;
    $returnProfit = $pdo->query("
        SELECT COALESCE(SUM(ri.subtotal - (ri.unit_cost * ri.qty)),0) v
        FROM sales_return_items ri
        JOIN sales_returns r ON ri.return_id = r.id
        WHERE DATE(r.return_date) = CURDATE()")->fetch()['v'];
    $todayProfit = $itemProfit - $todayDiscount - $returnProfit;

    // আজকের খরচ ও আজকের সাপ্লায়ার বাকি (সাপ্লায়ারকে আজকের ক্রয়ের যত টাকা এখনো দেওয়া বাকি)
    $todayExpense = (float)$pdo->query("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date = CURDATE()")->fetch()['v'];
    $todaySupplierDue = (float)$pdo->query("SELECT COALESCE(SUM(due_amount),0) v FROM purchases WHERE purchase_date = CURDATE()")->fetch()['v'];

    // কম স্টক সতর্কতা (কোম্পানি অনুসারে ফিল্টারযোগ্য)
    $companies = $pdo->query("SELECT * FROM companies ORDER BY name")->fetchAll();
    $lowWhere = "WHERE p.status='active' AND p.stock_qty <= p.low_stock_threshold";
    $lowParams = [];
    if ($lowCompanyFilter) { $lowWhere .= " AND p.company_id = ?"; $lowParams[] = $lowCompanyFilter; }
    $stmt = $pdo->prepare("SELECT p.*, co.name AS company_name FROM products p LEFT JOIN companies co ON p.company_id = co.id $lowWhere ORDER BY p.stock_qty ASC LIMIT 10");
    $stmt->execute($lowParams);
    $lowStockItems = $stmt->fetchAll();
    $lowStockTotalCount = $pdo->query("SELECT COUNT(*) c FROM products WHERE status='active' AND stock_qty <= low_stock_threshold")->fetch()['c'];

    // স্থবির স্টক সতর্কতা (মেয়াদোত্তীর্ণ ঔষধের বদলে — বই/স্টেশনারির জন্য প্রাসঙ্গিক রূপান্তর)
    $stmt = $pdo->prepare("
        SELECT p.* FROM products p
        WHERE p.status = 'active' AND p.stock_qty > 0
          AND p.created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND NOT EXISTS (
              SELECT 1 FROM sale_items si JOIN sales s ON si.sale_id = s.id
              WHERE si.product_id = p.id AND s.sale_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
          )
        ORDER BY p.created_at ASC LIMIT 8");
    $stmt->execute([$stagnantDays, $stagnantDays]);
    $stagnantItems = $stmt->fetchAll();

    // বেস্ট সেলিং পণ্য (বিগত ৩০ দিন)
    $bestSelling = $pdo->query("
        SELECT p.name, p.unit, SUM(si.qty) total_qty, SUM(si.subtotal) total_amount
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY si.product_id ORDER BY total_qty DESC LIMIT 6")->fetchAll();

    // বিগত ৩০ দিনের বিক্রয় গ্রাফ
    $raw = $pdo->query("
        SELECT DATE(sale_date) d, SUM(total_amount) total
        FROM sales WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE(sale_date)")->fetchAll(PDO::FETCH_KEY_PAIR);
    for ($i = 29; $i >= 0; $i--) {
        $d = date('Y-m-d', strtotime("-$i day"));
        $graphLabels[] = date('d M', strtotime($d));
        $graphData[] = isset($raw[$d]) ? round($raw[$d], 2) : 0;
    }
}

if ($canSeeStockInsights) {
    $companies = $pdo->query("SELECT * FROM companies ORDER BY name")->fetchAll();
    $lowWhere = "WHERE p.status='active' AND p.stock_qty <= p.low_stock_threshold";
    $lowParams = [];
    if ($lowCompanyFilter) { $lowWhere .= " AND p.company_id = ?"; $lowParams[] = $lowCompanyFilter; }
    $stmt = $pdo->prepare("SELECT p.*, co.name AS company_name FROM products p LEFT JOIN companies co ON p.company_id = co.id $lowWhere ORDER BY p.stock_qty ASC LIMIT 10");
    $stmt->execute($lowParams);
    $lowStockItems = $stmt->fetchAll();
    $lowStockTotalCount = $pdo->query("SELECT COUNT(*) c FROM products WHERE status='active' AND stock_qty <= low_stock_threshold")->fetch()['c'];

    $stmt = $pdo->prepare("
        SELECT p.* FROM products p
        WHERE p.status = 'active' AND p.stock_qty > 0
          AND p.created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND NOT EXISTS (
              SELECT 1 FROM sale_items si JOIN sales s ON si.sale_id = s.id
              WHERE si.product_id = p.id AND s.sale_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
          )
        ORDER BY p.created_at ASC LIMIT 8");
    $stmt->execute([$stagnantDays, $stagnantDays]);
    $stagnantItems = $stmt->fetchAll();

    $bestSelling = $pdo->query("
        SELECT p.name, p.unit, SUM(si.qty) total_qty, SUM(si.subtotal) total_amount
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY si.product_id ORDER BY total_qty DESC LIMIT 6")->fetchAll();
}

$pageTitle = t('nav_dashboard');
$activeNav = 'dashboard';
require_once __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <div>
        <h2 style="margin:0 0 2px;font-size:20px;"><?= e(t('welcome')) ?>, <?= e($user['name']) ?> 👋</h2>
        <div style="color:var(--text-secondary);font-size:13.5px;"><?= date('d F Y, l') ?></div>
    </div>
    <a href="sales_pos.php" class="btn btn-primary"><i class="bi bi-cart-plus"></i> <?= e(t('new_sale')) ?></a>
</div>

<div class="row g-3">
    <div class="col-6 col-md-4 col-xl-<?= $isOwner ? '3' : '4' ?>">
        <a href="sales_list.php?from=<?= date('Y-m-d') ?>&to=<?= date('Y-m-d') ?>" class="stat-card-link">
        <div class="stat-card c-purple">
            <div class="stat-icon"><i class="bi bi-cash-coin"></i></div>
            <div class="stat-label"><?= e(t('today_sales')) ?></div>
            <div class="stat-value num">৳<?= money($todaySales) ?></div>
            <div class="stat-sub"><?php if ($todayInvoices > 0): ?><?= (int)$todayInvoices ?> <?= e(t('invoice_count_suffix', 'টি ইনভয়েস')) ?><?php else: ?><?= e(t('no_sales_today', 'আজ এখনো কোনো বিক্রি হয়নি')) ?><?php endif; ?></div>
        </div>
        </a>
    </div>

    <?php if ($isOwner): ?>
    <div class="col-6 col-md-4 col-xl-3">
        <a href="purchase.php" class="stat-card-link">
        <div class="stat-card c-magenta">
            <div class="stat-icon"><i class="bi bi-truck"></i></div>
            <div class="stat-label"><?= e(t('today_purchase')) ?></div>
            <div class="stat-value num">৳<?= money($todayPurchase) ?></div>
            <div class="stat-sub"><?= (int)$todayPurchaseCount ?> <?= e(t('purchase_order_suffix', 'টি সাপ্লাই অর্ডার')) ?></div>
        </div>
        </a>
    </div>
    <div class="col-6 col-md-4 col-xl-3">
        <a href="reports.php?tab=profit_loss&from=<?= date('Y-m-d') ?>&to=<?= date('Y-m-d') ?>" class="stat-card-link">
        <div class="stat-card c-success">
            <div class="stat-icon"><i class="bi bi-graph-up-arrow"></i></div>
            <div class="stat-label"><?= e(t('today_profit')) ?></div>
            <div class="stat-value num">৳<?= money($todayProfit) ?></div>
            <div class="stat-sub"><?= $todaySales > 0 ? round(($todayProfit / $todaySales) * 100, 1) : 0 ?>% <?= e(t('margin', 'মার্জিন')) ?></div>
        </div>
        </a>
    </div>
    <div class="col-6 col-md-4 col-xl-3">
        <a href="reports.php?tab=profit_loss&from=<?= date('Y-m-d') ?>&to=<?= date('Y-m-d') ?>" class="stat-card-link">
        <div class="stat-card c-purple">
            <div class="stat-icon"><i class="bi bi-graph-up-arrow"></i></div>
            <div class="stat-label"><?= e(t('today_gross_profit', 'আজকের গ্রস প্রফিট')) ?></div>
            <div class="stat-value num">৳<?= money($todayGrossProfit) ?></div>
            <div class="stat-sub"><?= e(t('before_expenses', 'খরচ বাদ দেওয়ার আগে')) ?></div>
        </div>
        </a>
    </div>
    <div class="col-6 col-md-4 col-xl-3">
        <a href="reports.php?tab=expenses" class="stat-card-link">
        <div class="stat-card c-orange">
            <div class="stat-icon"><i class="bi bi-wallet2"></i></div>
            <div class="stat-label"><?= e(t('today_expense', 'আজকের খরচ')) ?></div>
            <div class="stat-value num">৳<?= money($todayExpense) ?></div>
            <div class="stat-sub"><?= e(t('live_report', 'লাইভ রিপোর্ট')) ?></div>
        </div>
        </a>
    </div>
    <div class="col-6 col-md-4 col-xl-3">
        <a href="suppliers.php" class="stat-card-link">
        <div class="stat-card c-danger">
            <div class="stat-icon"><i class="bi bi-building"></i></div>
            <div class="stat-label"><?= e(t('today_supplier_due', 'আজকের সাপ্লায়ার বাকি')) ?></div>
            <div class="stat-value num">৳<?= money($todaySupplierDue) ?></div>
            <div class="stat-sub"><?= e(t('todays_purchase_unpaid', 'আজকের ক্রয়ের অপরিশোধিত অংশ')) ?></div>
        </div>
        </a>
    </div>
    <?php endif; ?>

    <div class="col-6 col-md-4 col-xl-<?= $isOwner ? '3' : '4' ?>">
        <a href="customers.php" class="stat-card-link">
        <div class="stat-card c-orange">
            <div class="stat-icon"><i class="bi bi-journal-text"></i></div>
            <div class="stat-label"><?= e(t('today_due')) ?></div>
            <div class="stat-value num">৳<?= money($todayDue) ?></div>
            <div class="stat-sub"><?= (int)$todayDueCustomers ?> <?= e(t('due_customers_suffix', 'জন কাস্টমার')) ?></div>
        </div>
        </a>
    </div>
    <div class="col-6 col-md-4 col-xl-<?= $isOwner ? '3' : '4' ?>">
        <a href="sales_list.php?from=<?= date('Y-m-d') ?>&to=<?= date('Y-m-d') ?>" class="stat-card-link">
        <div class="stat-card c-yellow">
            <div class="stat-icon"><i class="bi bi-receipt"></i></div>
            <div class="stat-label"><?= e(t('today_invoices')) ?></div>
            <div class="stat-value num"><?= (int)$todayInvoices ?></div>
            <div class="stat-sub"><?= e(t('live_report', 'লাইভ রিপোর্ট')) ?></div>
        </div>
        </a>
    </div>
</div>

<?php if ($canSeeStockInsights): ?>
<div class="card" style="margin-top:18px;">
    <div class="card-header">
        <h3><i class="bi bi-exclamation-triangle" style="color:var(--danger);"></i> <?= e(t('low_stock_alert')) ?> <?php if ($lowStockTotalCount > 0): ?><span class="badge badge-danger"><?= (int)$lowStockTotalCount ?><?= e(t('count_suffix')) ?></span><?php endif; ?></h3>
        <form method="GET" style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:12.5px;color:var(--text-secondary);margin:0;"><?= e(t('company')) ?>:</label>
            <select name="low_company" class="form-control" style="width:auto;font-size:13px;padding:5px 10px;" onchange="this.form.submit()">
                <option value="0"><?= e(t('all_companies')) ?></option>
                <?php foreach ($companies as $co): ?>
                    <option value="<?= $co['id'] ?>" <?= $lowCompanyFilter == $co['id'] ? 'selected' : '' ?>><?= e($co['name']) ?></option>
                <?php endforeach; ?>
            </select>
        </form>
    </div>
    <div class="card-body" style="padding:8px 0;">
        <?php if (empty($lowStockItems)): ?>
            <div class="empty-state" style="padding:24px;"><i class="bi bi-emoji-smile"></i><?= e(t('no_low_stock')) ?></div>
        <?php else: ?>
            <?php foreach ($lowStockItems as $it): ?>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 18px;border-bottom:1px solid var(--border);">
                    <span style="font-size:13.5px;"><?= e($it['name']) ?> <?php if ($it['company_name']): ?><span style="color:var(--text-secondary);font-size:11.5px;">— <?= e($it['company_name']) ?></span><?php endif; ?></span>
                    <span class="badge badge-danger num"><?= (int)$it['stock_qty'] ?> / <?= (int)$it['low_stock_threshold'] ?> <?= e($it['unit']) ?></span>
                </div>
            <?php endforeach; ?>
            <div style="padding:10px 18px 0;"><a href="stock.php" style="font-size:13px;"><?= e(t('view_full_stock')) ?></a></div>
        <?php endif; ?>
    </div>
</div>
<?php endif; ?>

<?php if ($canSeeStockInsights): ?>
<div class="row g-3" style="margin-top:2px;">
    <div class="col-lg-7">
        <div class="card" style="margin-top:18px;">
            <div class="card-header">
                <h3><?= e(t('sales_last_30_days')) ?></h3>
            </div>
            <div class="card-body">
                <canvas id="salesChart" height="130"></canvas>
            </div>
        </div>
    </div>
    <div class="col-lg-5">
        <div class="card" style="margin-top:18px;">
            <div class="card-header">
                <h3><?= e(t('stagnant_stock_alert')) ?></h3>
                <span class="badge badge-warning"><?= $stagnantDays ?> <?= e(t('days')) ?></span>
            </div>
            <div class="card-body" style="padding:8px 0;">
                <?php if (empty($stagnantItems)): ?>
                    <div class="empty-state" style="padding:24px;"><i class="bi bi-emoji-smile"></i><?= e(t('no_stagnant_stock')) ?></div>
                <?php else: ?>
                    <?php foreach ($stagnantItems as $it): ?>
                        <div style="display:flex;justify-content:space-between;padding:9px 18px;border-bottom:1px solid var(--border);">
                            <span style="font-size:13.5px;"><?= e($it['name']) ?></span>
                            <span class="badge badge-danger num"><?= (int)$it['stock_qty'] ?> <?= e($it['unit']) ?></span>
                        </div>
                    <?php endforeach; ?>
                    <div style="padding:10px 18px 0;"><a href="stock.php" style="font-size:13px;"><?= e(t('view_full_stock')) ?></a></div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<div class="card" style="margin-top:18px;">
    <div class="card-header">
        <h3><?= e(t('best_selling_30_days')) ?></h3>
        <?php if ($isOwner): ?><a href="reports.php?tab=best_selling" style="font-size:13px;"><?= e(t('view_all')) ?></a><?php endif; ?>
    </div>
    <div class="table-wrap" style="border:none;border-radius:0;">
        <?php if (empty($bestSelling)): ?>
            <div class="empty-state"><i class="bi bi-bar-chart"></i><?= e(t('no_sales_this_month')) ?></div>
        <?php else: ?>
        <table class="data-table">
            <thead><tr><th><?= e(t('product')) ?></th><th class="num"><?= e(t('qty_sold')) ?></th><th class="num"><?= e(t('total_sales')) ?></th></tr></thead>
            <tbody>
                <?php foreach ($bestSelling as $b): ?>
                <tr>
                    <td><?= e($b['name']) ?></td>
                    <td class="num"><?= (int)$b['total_qty'] ?> <?= e($b['unit']) ?></td>
                    <td class="num">৳<?= money($b['total_amount']) ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>
</div>
<?php endif; ?>

<?php
$extraScripts = '';
if ($canSeeStockInsights && $isOwner) {
    $extraScripts = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script><script>
    const ctx = document.getElementById("salesChart");
    new Chart(ctx, {
        type: "line",
        data: {
            labels: ' . json_encode($graphLabels, JSON_UNESCAPED_UNICODE) . ',
            datasets: [{
                label: ' . json_encode(t('sales_chart_label'), JSON_UNESCAPED_UNICODE) . ',
                data: ' . json_encode($graphData) . ',
                borderColor: "#C026D3",
                backgroundColor: "rgba(192,38,212,.10)",
                pointBackgroundColor: "#6D28D9",
                tension: .35, fill: true, borderWidth: 2.5, pointRadius: 2
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: "#EFEAF7" } }, x: { grid: { display: false } } }
        }
    });
    </script>';
}
require_once __DIR__ . '/../includes/footer.php';
?>