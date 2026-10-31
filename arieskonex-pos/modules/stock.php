<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
if (!is_owner() && !is_salesman()) {
    flash_set('আপনার এই কাজের অনুমতি নেই।', 'danger');
    redirect('dashboard.php');
}

$canManageStock = is_owner();
$canAddProduct = $canManageStock || has_permission(current_user(), 'add_product');
$canViewPurchasePrice = can_view_purchase_price();

// ---------- POST অ্যাকশন ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if (in_array($action, ['add_category', 'add_company', 'adjust_stock'], true) && !$canManageStock) {
        flash_set('এই কাজের অনুমতি আপনার নেই।', 'danger');
        redirect('stock.php');
    }
    if ($action === 'save_product' && !$canManageStock) {
        // অনুমতিপ্রাপ্ত সেলসম্যান শুধু নতুন পণ্য যুক্ত করতে পারবে, বিদ্যমান পণ্য সম্পাদনা নয়
        if (!$canAddProduct || !empty($_POST['id'])) {
            flash_set('এই কাজের অনুমতি আপনার নেই।', 'danger');
            redirect('stock.php');
        }
    }

    if ($action === 'save_product') {
        $id = (int)($_POST['id'] ?? 0);
        // মালিক ছাড়া অন্য কেউ (অনুমতিপ্রাপ্ত সেলসম্যান) নতুন পণ্য যুক্ত করলে
        // সেটি সরাসরি সক্রিয় হবে না — মালিকের অনুমোদনের অপেক্ষায় থাকবে (pending)
        $needsApproval = !$id && !$canManageStock;
        $data = [
            'category_id' => $_POST['category_id'] ?: null,
            'company_id' => $_POST['company_id'] ?: null,
            'name' => trim($_POST['name']),
            'barcode' => trim($_POST['barcode']) ?: null,
            'unit' => trim($_POST['unit']) ?: t('unit_piece', 'পিস'),
            'cost_price' => (float)$_POST['cost_price'],
            'sale_price' => (float)$_POST['sale_price'],
            'wholesale_price' => (float)($_POST['wholesale_price'] ?? 0),
            'stock_qty' => (int)$_POST['stock_qty'],
            'low_stock_threshold' => (int)($_POST['low_stock_threshold'] ?: 5),
            'author' => trim($_POST['author']) ?: null,
            'publisher' => trim($_POST['publisher']) ?: null,
            'edition' => trim($_POST['edition']) ?: null,
        ];
        if ($needsApproval) {
            $data['status'] = 'pending';
            $data['created_by'] = current_user()['id'] ?? null;
        }
        try {
            if ($id) {
                $stmt = $pdo->prepare("UPDATE products SET category_id=?, company_id=?, name=?, barcode=?, unit=?, cost_price=?, sale_price=?, wholesale_price=?, stock_qty=?, low_stock_threshold=?, author=?, publisher=?, edition=?, updated_at=NOW() WHERE id=?");
                $stmt->execute(array_merge(array_values($data), [$id]));
                flash_set(t('product_updated', 'পণ্যটি হালনাগাদ হয়েছে।'));
                log_activity($pdo, t('log_product_updated', 'পণ্য হালনাগাদ') . ': ' . $data['name']);
            } else {
                // প্রতিটি নতুন পণ্যের জন্য স্বয়ংক্রিয়/ক্রমিকভাবে আইটেম কোড তৈরি হয় — ম্যানুয়ালি দেওয়ার প্রয়োজন নেই
                $data = array_merge(['item_code' => generate_item_code($pdo)], $data);
                $cols = implode(',', array_keys($data));
                $ph = implode(',', array_fill(0, count($data), '?'));
                $stmt = $pdo->prepare("INSERT INTO products ($cols) VALUES ($ph)");
                $stmt->execute(array_values($data));
                if ($needsApproval) {
                    flash_set(t('product_pending_approval', 'পণ্যটি যুক্ত হয়েছে, তবে মালিকের অনুমোদনের আগে বিক্রয়ে দেখাবে না।'));
                    log_activity($pdo, t('log_product_pending', 'নতুন পণ্য (অনুমোদনের অপেক্ষায়)') . ': ' . $data['name']);
                } else {
                    flash_set(t('product_added', 'নতুন পণ্য যুক্ত হয়েছে।'));
                    log_activity($pdo, t('log_product_new', 'নতুন পণ্য') . ': ' . $data['name']);
                }
            }
        } catch (PDOException $ex) {
            flash_set(t('product_save_failed', 'সংরক্ষণ ব্যর্থ হয়েছে — বারকোড হয়তো আগে থেকেই ব্যবহৃত হচ্ছে।'), 'danger');
        }
        redirect('stock.php');
    }

    if ($action === 'toggle_status') {
        $id = (int)$_POST['id'];
        $stmt = $pdo->prepare("UPDATE products SET status = IF(status='active','inactive','active') WHERE id=?");
        $stmt->execute([$id]);
        flash_set(t('product_status_changed', 'পণ্যের অবস্থা পরিবর্তন হয়েছে।'));
        redirect('stock.php');
    }

    if ($action === 'approve_product') {
        if (!$canManageStock) {
            flash_set('এই কাজের অনুমতি আপনার নেই।', 'danger');
            redirect('stock.php');
        }
        $id = (int)$_POST['id'];
        $stmt = $pdo->prepare("UPDATE products SET status='active', rejected_reason=NULL WHERE id=? AND status='pending'");
        $stmt->execute([$id]);
        flash_set(t('product_approved', 'পণ্যটি অনুমোদিত হয়েছে — এখন বিক্রয়ে দেখাবে।'));
        log_activity($pdo, t('log_product_approved', 'পণ্য অনুমোদন') . ' #' . $id);
        redirect('stock.php?status=pending');
    }

    if ($action === 'reject_product') {
        if (!$canManageStock) {
            flash_set('এই কাজের অনুমতি আপনার নেই।', 'danger');
            redirect('stock.php');
        }
        $id = (int)$_POST['id'];
        $reason = trim($_POST['reject_reason'] ?? '') ?: null;
        $stmt = $pdo->prepare("UPDATE products SET status='inactive', rejected_reason=? WHERE id=? AND status='pending'");
        $stmt->execute([$reason, $id]);
        flash_set(t('product_rejected', 'পণ্যটি প্রত্যাখ্যান করা হয়েছে।'));
        log_activity($pdo, t('log_product_rejected', 'পণ্য প্রত্যাখ্যান') . ' #' . $id);
        redirect('stock.php?status=pending');
    }

    if ($action === 'add_category') {
        $stmt = $pdo->prepare("INSERT INTO categories (name, type) VALUES (?, ?)");
        $stmt->execute([trim($_POST['cat_name']), $_POST['cat_type']]);
        flash_set(t('category_added', 'নতুন ক্যাটাগরি যুক্ত হয়েছে।'));
        redirect('stock.php');
    }

    if ($action === 'add_company') {
        $companyName = trim($_POST['company_name'] ?? '');
        if ($companyName !== '') {
            $stmt = $pdo->prepare("INSERT INTO companies (name) VALUES (?)");
            $stmt->execute([$companyName]);
            flash_set(t('company_added', 'নতুন কোম্পানি যুক্ত হয়েছে।'));
        }
        redirect('stock.php');
    }

    if ($action === 'adjust_stock') {
        $id = (int)$_POST['id'];
        $qty = (int)$_POST['adjust_qty'];
        $stmt = $pdo->prepare("UPDATE products SET stock_qty = GREATEST(0, stock_qty + ?) WHERE id=?");
        $stmt->execute([$qty, $id]);
        flash_set(t('stock_adjusted', 'স্টক সমন্বয় করা হয়েছে।'));
        log_activity($pdo, t('log_stock_adjust', 'স্টক সমন্বয়') . ' #' . $id . ' (' . ($qty > 0 ? '+' : '') . $qty . ')');
        redirect('stock.php');
    }
}

// ---------- ভিউ: কোম্পানি অনুসারে স্টক সারাংশ ----------
if (($_GET['view'] ?? '') === 'by_company') {
    $rows = $pdo->query("
        SELECT co.id, co.name,
               COUNT(p.id) AS product_count,
               COALESCE(SUM(p.stock_qty), 0) AS total_qty,
               COALESCE(SUM(p.stock_qty * p.cost_price), 0) AS stock_value
        FROM companies co
        LEFT JOIN products p ON p.company_id = co.id AND p.status = 'active'
        GROUP BY co.id ORDER BY co.name")->fetchAll();
    $noCompany = $pdo->query("SELECT COUNT(*) c, COALESCE(SUM(stock_qty),0) q FROM products WHERE company_id IS NULL AND status='active'")->fetch();

    $pageTitle = t('stock_by_company', 'কোম্পানি অনুসারে স্টক');
    $activeNav = 'stock';
    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head">
        <a href="stock.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> <?= e(t('back_to_stock', 'স্টক তালিকায় ফিরুন')) ?></a>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th><?= e(t('company', 'কোম্পানি')) ?></th><th class="num"><?= e(t('product_types', 'পণ্যের ধরন')) ?></th><th class="num"><?= e(t('total_stock_qty', 'মোট স্টক (পরিমাণ)')) ?></th><?php if ($canViewPurchasePrice): ?><th class="num"><?= e(t('stock_cost_value', 'স্টকের ক্রয়মূল্য')) ?></th><?php endif; ?><th></th></tr></thead>
            <tbody>
            <?php if (empty($rows)): ?><tr><td colspan="5"><div class="empty-state"><i class="bi bi-building"></i><?= e(t('no_companies', 'এখনো কোনো কোম্পানি যুক্ত হয়নি।')) ?></div></td></tr><?php endif; ?>
            <?php foreach ($rows as $r): ?>
                <tr>
                    <td><?= e($r['name']) ?></td>
                    <td class="num"><?= (int)$r['product_count'] ?></td>
                    <td class="num"><?= (int)$r['total_qty'] ?></td>
                    <?php if ($canViewPurchasePrice): ?><td class="num">৳<?= money($r['stock_value']) ?></td><?php endif; ?>
                    <td><a href="stock.php?company=<?= $r['id'] ?>" class="btn btn-sm btn-light"><?= e(t('view_products', 'পণ্য দেখুন')) ?></a></td>
                </tr>
            <?php endforeach; ?>
            <?php if ($noCompany['c'] > 0): ?>
                <tr>
                    <td><em style="color:var(--text-secondary);"><?= e(t('no_company_assigned', 'কোম্পানি নির্ধারণ করা হয়নি')) ?></em></td>
                    <td class="num"><?= (int)$noCompany['c'] ?></td>
                    <td class="num"><?= (int)$noCompany['q'] ?></td>
                    <?php if ($canViewPurchasePrice): ?><td class="num">—</td><?php endif; ?>
                    <td></td>
                </tr>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ফিল্টার ও লিস্ট ----------
$search = trim($_GET['q'] ?? '');
$catFilter = (int)($_GET['category'] ?? 0);
$companyFilter = (int)($_GET['company'] ?? 0);
$statusFilter = $_GET['status'] ?? 'active';

$where = [];
$params = [];
if ($search !== '') {
    $where[] = "(p.name LIKE ? OR p.item_code LIKE ? OR p.barcode LIKE ? OR p.author LIKE ? OR p.publisher LIKE ?)";
    $like = "%$search%";
    array_push($params, $like, $like, $like, $like, $like);
}
if ($catFilter) { $where[] = "p.category_id = ?"; $params[] = $catFilter; }
if ($companyFilter) { $where[] = "p.company_id = ?"; $params[] = $companyFilter; }
if ($statusFilter !== 'all') { $where[] = "p.status = ?"; $params[] = $statusFilter; }
$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = $pdo->prepare("SELECT p.*, c.name AS category_name, c.type AS category_type, co.name AS company_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN companies co ON p.company_id = co.id $whereSql ORDER BY p.name ASC LIMIT 300");
$stmt->execute($params);
$products = $stmt->fetchAll();

$categories = $pdo->query("SELECT * FROM categories ORDER BY name")->fetchAll();
$companies = $pdo->query("SELECT * FROM companies ORDER BY name")->fetchAll();

$lowStockCount = $pdo->query("SELECT COUNT(*) c FROM products WHERE status='active' AND stock_qty <= low_stock_threshold")->fetch()['c'];
$pendingCount = $canManageStock ? (int)$pdo->query("SELECT COUNT(*) c FROM products WHERE status='pending'")->fetch()['c'] : 0;

$pageTitle = t('nav_stock');
$activeNav = 'stock';
require_once __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <div class="gap-tabs" style="border:none;margin:0;">
        <?php if ($lowStockCount > 0): ?>
            <span class="badge badge-danger"><i class="bi bi-exclamation-triangle"></i> <?= $lowStockCount ?><?= e(t('low_stock_count_suffix', 'টি পণ্যের স্টক কম')) ?></span>
        <?php endif; ?>
        <?php if ($pendingCount > 0): ?>
            <a href="stock.php?status=pending" class="badge badge-warning" style="text-decoration:none;"><i class="bi bi-hourglass-split"></i> <?= $pendingCount ?><?= e(t('pending_approval_suffix', 'টি পণ্য অনুমোদনের অপেক্ষায়')) ?></a>
        <?php endif; ?>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="stock.php?view=by_company" class="btn btn-light"><i class="bi bi-building"></i> <?= e(t('stock_by_company', 'কোম্পানি অনুসারে স্টক')) ?></a>
        <a href="barcode.php" class="btn btn-light"><i class="bi bi-upc-scan"></i> বারকোড/QR লেবেল</a>
        <?php if ($canManageStock): ?>
        <button class="btn btn-light" data-bs-toggle="modal" data-bs-target="#categoryModal"><i class="bi bi-tags"></i> <?= e(t('category', 'ক্যাটাগরি')) ?></button>
        <button class="btn btn-light" data-bs-toggle="modal" data-bs-target="#companyModal"><i class="bi bi-building-add"></i> <?= e(t('company', 'কোম্পানি')) ?></button>
        <?php endif; ?>
        <?php if ($canAddProduct): ?>
        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#productModal" onclick="openAddProduct()"><i class="bi bi-plus-lg"></i> <?= e(t('new_product', 'নতুন পণ্য')) ?></button>
        <?php endif; ?>
    </div>
</div>

<form method="GET" class="card" style="padding:14px 16px;margin-bottom:16px;">
    <div class="row g-2 align-items-end">
        <div class="col-md-3">
            <label><?= e(t('search', 'খুঁজুন')) ?></label>
            <input type="text" name="q" class="form-control" placeholder="<?= e(t('product_search_ph', 'নাম, বারকোড, লেখক বা প্রকাশনী')) ?>" value="<?= e($search) ?>">
        </div>
        <div class="col-md-3">
            <label><?= e(t('category', 'ক্যাটাগরি')) ?></label>
            <select name="category" class="form-control">
                <option value="0"><?= e(t('all_categories', 'সব ক্যাটাগরি')) ?></option>
                <?php foreach ($categories as $c): ?>
                    <option value="<?= $c['id'] ?>" <?= $catFilter == $c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-3">
            <label><?= e(t('company', 'কোম্পানি')) ?></label>
            <select name="company" class="form-control">
                <option value="0"><?= e(t('all_companies', 'সব কোম্পানি')) ?></option>
                <?php foreach ($companies as $co): ?>
                    <option value="<?= $co['id'] ?>" <?= $companyFilter == $co['id'] ? 'selected' : '' ?>><?= e($co['name']) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-2">
            <label><?= e(t('status', 'অবস্থা')) ?></label>
            <select name="status" class="form-control">
                <option value="active" <?= $statusFilter === 'active' ? 'selected' : '' ?>><?= e(t('active', 'সক্রিয়')) ?></option>
                <option value="inactive" <?= $statusFilter === 'inactive' ? 'selected' : '' ?>><?= e(t('inactive', 'নিষ্ক্রিয়')) ?></option>
                <?php if ($canManageStock): ?>
                <option value="pending" <?= $statusFilter === 'pending' ? 'selected' : '' ?>><?= e(t('pending_approval', 'অনুমোদনের অপেক্ষায়')) ?><?= $pendingCount > 0 ? ' (' . $pendingCount . ')' : '' ?></option>
                <?php endif; ?>
                <option value="all" <?= $statusFilter === 'all' ? 'selected' : '' ?>><?= e(t('all', 'সব')) ?></option>
            </select>
        </div>
        <div class="col-md-1">
            <button class="btn btn-outline btn-block"><?= e(t('search', 'খুঁজুন')) ?></button>
        </div>
    </div>
</form>

<div class="table-wrap">
    <table class="data-table" id="productsData">
        <thead>
            <tr>
                <th><?= e(t('product', 'পণ্য')) ?></th><th><?= e(t('category', 'ক্যাটাগরি')) ?></th><th><?= e(t('company', 'কোম্পানি')) ?></th><th><?= e(t('author_publisher', 'লেখক/প্রকাশনী')) ?></th>
                <?php if ($canViewPurchasePrice): ?><th class="num"><?= e(t('cost_price', 'ক্রয়মূল্য')) ?></th><?php endif; ?><th class="num"><?= e(t('retail', 'খুচরা')) ?></th><th class="num"><?= e(t('wholesale', 'পাইকারি')) ?></th><th class="num"><?= e(t('stock', 'স্টক')) ?></th><th><?= e(t('status', 'অবস্থা')) ?></th><th></th>
            </tr>
        </thead>
        <tbody>
        <?php if (empty($products)): ?>
            <tr><td colspan="10"><div class="empty-state"><i class="bi bi-box-seam"></i><?= e(t('no_products_found', 'কোনো পণ্য পাওয়া যায়নি।')) ?></div></td></tr>
        <?php endif; ?>
        <?php foreach ($products as $p): ?>
            <tr>
                <td>
                    <strong><?= e($p['name']) ?></strong>
                    <?php if (!empty($p['item_code'])): ?><div style="font-size:11.5px;color:var(--text-secondary);"><?= e(t('item_code', 'আইটেম কোড')) ?>: <?= e($p['item_code']) ?></div><?php endif; ?>
                    <?php if ($p['barcode']): ?><div style="font-size:11.5px;color:var(--text-secondary);"><?= e($p['barcode']) ?></div><?php endif; ?>
                </td>
                <td><?= e($p['category_name'] ?? '—') ?></td>
                <td><?= e($p['company_name'] ?? '—') ?></td>
                <td style="font-size:12.5px;color:var(--text-secondary);">
                    <?= $p['author'] ? e($p['author']) : '' ?><?= ($p['author'] && $p['publisher']) ? ' • ' : '' ?><?= $p['publisher'] ? e($p['publisher']) : '' ?>
                    <?= $p['edition'] ? '<br>' . e(t('edition', 'সংস্করণ')) . ': ' . e($p['edition']) : '' ?>
                </td>
                <?php if ($canViewPurchasePrice): ?><td class="num">৳<?= money($p['cost_price']) ?></td><?php endif; ?>
                <td class="num">৳<?= money($p['sale_price']) ?></td>
                <td class="num">৳<?= money($p['wholesale_price'] ?? 0) ?></td>
                <td class="num">
                    <?= (int)$p['stock_qty'] ?> <?= e($p['unit']) ?>
                    <?php if ($p['stock_qty'] <= $p['low_stock_threshold']): ?><br><span class="badge badge-danger"><?= e(t('low_stock_badge', 'কম স্টক')) ?></span><?php endif; ?>
                </td>
                <td>
                    <?php if ($p['status'] === 'pending'): ?>
                        <span class="badge badge-warning"><i class="bi bi-hourglass-split"></i> <?= e(t('pending_approval', 'অনুমোদনের অপেক্ষায়')) ?></span>
                    <?php elseif ($p['status'] === 'active'): ?>
                        <span class="badge badge-success"><?= e(t('active', 'সক্রিয়')) ?></span>
                    <?php else: ?>
                        <span class="badge badge-danger"><?= e(t('inactive', 'নিষ্ক্রিয়')) ?></span>
                        <?php if (!empty($p['rejected_reason'])): ?><div style="font-size:11px;color:var(--text-secondary);"><?= e($p['rejected_reason']) ?></div><?php endif; ?>
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ($canManageStock && $p['status'] === 'pending'): ?>
                    <div style="display:flex;gap:6px;">
                        <form method="POST" style="display:inline;">
                            <?= csrf_field() ?>
                            <input type="hidden" name="action" value="approve_product">
                            <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
                            <button class="btn btn-sm btn-success" title="<?= e(t('approve', 'অনুমোদন করুন')) ?>"><i class="bi bi-check-lg"></i> <?= e(t('approve', 'অনুমোদন')) ?></button>
                        </form>
                        <button class="btn btn-sm btn-danger" title="<?= e(t('reject', 'প্রত্যাখ্যান')) ?>" onclick='openReject(<?= (int)$p["id"] ?>, <?= json_encode($p["name"], JSON_UNESCAPED_UNICODE) ?>)'><i class="bi bi-x-lg"></i> <?= e(t('reject', 'প্রত্যাখ্যান')) ?></button>
                    </div>
                    <?php elseif ($canManageStock): ?>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-light" title="<?= e(t('adjust', 'সমন্বয়')) ?>" onclick='openAdjust(<?= (int)$p["id"] ?>, <?= json_encode($p["name"], JSON_UNESCAPED_UNICODE) ?>)'><i class="bi bi-sliders"></i></button>
                        <button class="btn btn-sm btn-light" title="<?= e(t('edit', 'সম্পাদনা')) ?>" onclick='openEditProduct(<?= json_encode($p, JSON_UNESCAPED_UNICODE) ?>)'><i class="bi bi-pencil"></i></button>
                        <form method="POST" style="display:inline;">
                            <?= csrf_field() ?>
                            <input type="hidden" name="action" value="toggle_status">
                            <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
                            <button class="btn btn-sm btn-light" title="<?= e(t('activate_deactivate', 'সক্রিয়/নিষ্ক্রিয়')) ?>" data-confirm="<?= e(t('are_you_sure', 'আপনি কি নিশ্চিত?')) ?>"><i class="bi bi-power"></i></button>
                        </form>
                    </div>
                    <?php else: ?>
                    <span style="color:var(--text-secondary);">—</span>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<!-- পণ্য মোডাল -->
<div class="modal fade" id="productModal" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <form method="POST">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_product">
        <input type="hidden" name="id" id="pid">
        <div class="modal-header">
          <h5 class="modal-title" id="productModalTitle"><?= e(t('new_product', 'নতুন পণ্য')) ?></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
            <div class="row" id="p_item_code_row" style="display:none;">
                <div class="col-md-12 form-group">
                    <label><?= e(t('item_code', 'আইটেম কোড')) ?></label>
                    <input type="text" id="p_item_code" class="form-control" readonly disabled style="background:var(--bg-light,#f5f5f7);">
                    <small style="color:var(--text-secondary);"><?= e(t('item_code_auto_note', 'এই কোড প্রতিটি পণ্যের জন্য স্বয়ংক্রিয়ভাবে তৈরি হয় — পরিবর্তনযোগ্য নয়।')) ?></small>
                </div>
            </div>
            <div class="row">
                <div class="col-md-8 form-group">
                    <label><?= e(t('product_name', 'পণ্যের নাম')) ?></label>
                    <input type="text" name="name" id="p_name" class="form-control" required>
                </div>
                <div class="col-md-4 form-group">
                    <label><?= e(t('barcode', 'বারকোড')) ?></label>
                    <input type="text" name="barcode" id="p_barcode" class="form-control">
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 form-group">
                    <label><?= e(t('category', 'ক্যাটাগরি')) ?></label>
                    <select name="category_id" id="p_category" class="form-control">
                        <option value=""><?= e(t('select_dash', '— নির্বাচন করুন —')) ?></option>
                        <?php foreach ($categories as $c): ?>
                            <option value="<?= $c['id'] ?>"><?= e($c['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-md-6 form-group">
                    <label><?= e(t('company', 'কোম্পানি')) ?></label>
                    <select name="company_id" id="p_company" class="form-control">
                        <option value=""><?= e(t('select_dash', '— নির্বাচন করুন —')) ?></option>
                        <?php foreach ($companies as $co): ?>
                            <option value="<?= $co['id'] ?>"><?= e($co['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 form-group">
                    <label><?= e(t('unit', 'একক')) ?></label>
                    <input type="text" name="unit" id="p_unit" class="form-control" placeholder="পিস / টি" value="পিস">
                </div>
                <div class="col-md-6 form-group">
                    <label><?= e(t('low_stock_threshold', 'লো-স্টক থ্রেশহোল্ড')) ?></label>
                    <input type="number" name="low_stock_threshold" id="p_threshold" class="form-control" value="5">
                </div>
            </div>
            <div class="row">
                <div class="col-md-3 form-group">
                    <label><?= e(t('cost_price_bdt', 'ক্রয়মূল্য (৳)')) ?></label>
                    <input type="number" step="0.01" name="cost_price" id="p_cost" class="form-control" required>
                </div>
                <div class="col-md-3 form-group">
                    <label><?= e(t('retail_price_bdt', 'খুচরা মূল্য (৳)')) ?></label>
                    <input type="number" step="0.01" name="sale_price" id="p_sale" class="form-control" required>
                </div>
                <div class="col-md-3 form-group">
                    <label><?= e(t('wholesale_price_bdt', 'পাইকারি মূল্য (৳)')) ?></label>
                    <input type="number" step="0.01" name="wholesale_price" id="p_wholesale" class="form-control" placeholder="<?= e(t('optional', 'ঐচ্ছিক')) ?>">
                </div>
                <div class="col-md-3 form-group">
                    <label><?= e(t('current_stock', 'বর্তমান স্টক')) ?></label>
                    <input type="number" name="stock_qty" id="p_stock" class="form-control" required>
                </div>
            </div>
            <div class="form-hint" style="margin:0 0 10px;"><?= e(t('book_fields_hint', 'নিচের তথ্যগুলো শুধু বইয়ের ক্ষেত্রে প্রযোজ্য (ঐচ্ছিক)')) ?></div>
            <div class="row">
                <div class="col-md-4 form-group">
                    <label><?= e(t('author', 'লেখক')) ?></label>
                    <input type="text" name="author" id="p_author" class="form-control">
                </div>
                <div class="col-md-4 form-group">
                    <label><?= e(t('publisher', 'প্রকাশনী')) ?></label>
                    <input type="text" name="publisher" id="p_publisher" class="form-control">
                </div>
                <div class="col-md-4 form-group">
                    <label><?= e(t('edition', 'সংস্করণ')) ?></label>
                    <input type="text" name="edition" id="p_edition" class="form-control">
                </div>
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

<!-- ক্যাটাগরি মোডাল -->
<div class="modal fade" id="categoryModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header"><h5 class="modal-title"><?= e(t('category', 'ক্যাটাগরি')) ?></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <ul style="list-style:none;padding:0;margin:0 0 16px;">
          <?php foreach ($categories as $c): ?>
            <li style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:14px;">
                <?= e($c['name']) ?> <span class="badge badge-purple"><?= e($c['type']) ?></span>
            </li>
          <?php endforeach; ?>
        </ul>
        <form method="POST">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="add_category">
            <div class="row g-2">
                <div class="col-7"><input type="text" name="cat_name" class="form-control" placeholder="<?= e(t('new_category_name', 'নতুন ক্যাটাগরির নাম')) ?>" required></div>
                <div class="col-5">
                    <select name="cat_type" class="form-control">
                        <option value="stationery"><?= e(t('cat_stationery', 'স্টেশনারি')) ?></option>
                        <option value="book"><?= e(t('cat_book', 'বই')) ?></option>
                        <option value="print"><?= e(t('cat_print', 'প্রিন্ট/ফটোকপি')) ?></option>
                        <option value="other"><?= e(t('cat_other', 'অন্যান্য')) ?></option>
                    </select>
                </div>
            </div>
            <button class="btn btn-primary btn-block" style="margin-top:10px;"><?= e(t('add', 'যুক্ত করুন')) ?></button>
        </form>
      </div>
    </div>
  </div>
</div>

<!-- কোম্পানি মোডাল -->
<div class="modal fade" id="companyModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header"><h5 class="modal-title"><?= e(t('company', 'কোম্পানি')) ?></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <ul style="list-style:none;padding:0;margin:0 0 16px;">
          <?php if (empty($companies)): ?><li style="color:var(--text-secondary);font-size:13.5px;"><?= e(t('no_companies', 'এখনো কোনো কোম্পানি যুক্ত হয়নি।')) ?></li><?php endif; ?>
          <?php foreach ($companies as $co): ?>
            <li style="padding:7px 0;border-bottom:1px solid var(--border);font-size:14px;"><?= e($co['name']) ?></li>
          <?php endforeach; ?>
        </ul>
        <form method="POST">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="add_company">
            <div class="row g-2">
                <div class="col-8"><input type="text" name="company_name" class="form-control" placeholder="<?= e(t('new_company_name', 'নতুন কোম্পানি/প্রকাশনীর নাম')) ?>" required></div>
                <div class="col-4"><button class="btn btn-primary btn-block"><?= e(t('add', 'যুক্ত করুন')) ?></button></div>
            </div>
        </form>
      </div>
    </div>
  </div>
</div>

<!-- পণ্য প্রত্যাখ্যান মোডাল -->
<div class="modal fade" id="rejectModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <form method="POST">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="reject_product">
        <input type="hidden" name="id" id="rej_id">
        <div class="modal-header"><h5 class="modal-title"><?= e(t('reject_product_title', 'পণ্য প্রত্যাখ্যান')) ?> — <span id="rej_name"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
            <label><?= e(t('reject_reason_label', 'প্রত্যাখ্যানের কারণ (ঐচ্ছিক)')) ?></label>
            <input type="text" name="reject_reason" class="form-control" placeholder="<?= e(t('reject_reason_ph', 'যেমন: ভুল মূল্য / ইতিমধ্যে যুক্ত আছে')) ?>">
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-light" data-bs-dismiss="modal"><?= e(t('cancel', 'বাতিল')) ?></button>
          <button type="submit" class="btn btn-danger"><?= e(t('reject', 'প্রত্যাখ্যান')) ?></button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- স্টক সমন্বয় মোডাল -->
<div class="modal fade" id="adjustModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <form method="POST">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="adjust_stock">
        <input type="hidden" name="id" id="adj_id">
        <div class="modal-header"><h5 class="modal-title"><?= e(t('stock_adjust_title', 'স্টক সমন্বয়')) ?> — <span id="adj_name"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
            <label><?= e(t('adjust_qty_label', 'পরিমাণ যুক্ত/বিয়োগ করুন (যেমন: ১০ অথবা -৫)')) ?></label>
            <input type="number" name="adjust_qty" class="form-control" required>
            <div class="form-hint"><?= e(t('adjust_qty_hint', 'নষ্ট/হারানো পণ্য বাদ দিতে ঋণাত্মক সংখ্যা দিন।')) ?></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-light" data-bs-dismiss="modal"><?= e(t('cancel', 'বাতিল')) ?></button>
          <button type="submit" class="btn btn-primary"><?= e(t('adjust_confirm', 'সমন্বয় করুন')) ?></button>
        </div>
      </form>
    </div>
  </div>
</div>

<script>
const I18N_STOCK = {
    newProduct: <?= json_encode(t('new_product', 'নতুন পণ্য'), JSON_UNESCAPED_UNICODE) ?>,
    editProduct: <?= json_encode(t('edit_product', 'পণ্য সম্পাদনা'), JSON_UNESCAPED_UNICODE) ?>,
    unitPiece: <?= json_encode(t('unit_piece', 'পিস'), JSON_UNESCAPED_UNICODE) ?>
};
function openAddProduct() {
    document.getElementById('productModalTitle').textContent = I18N_STOCK.newProduct;
    document.getElementById('p_item_code_row').style.display = 'none';
    document.getElementById('p_item_code').value = '';
    ['pid','p_barcode','p_author','p_publisher','p_edition'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('p_name').value = '';
    document.getElementById('p_category').value = '';
    document.getElementById('p_company').value = '';
    document.getElementById('p_unit').value = I18N_STOCK.unitPiece;
    document.getElementById('p_threshold').value = 5;
    document.getElementById('p_cost').value = '';
    document.getElementById('p_sale').value = '';
    document.getElementById('p_wholesale').value = '';
    document.getElementById('p_stock').value = '';
}
function openEditProduct(p) {
    document.getElementById('productModalTitle').textContent = I18N_STOCK.editProduct;
    document.getElementById('pid').value = p.id;
    if (p.item_code) {
        document.getElementById('p_item_code_row').style.display = '';
        document.getElementById('p_item_code').value = p.item_code;
    } else {
        document.getElementById('p_item_code_row').style.display = 'none';
    }
    document.getElementById('p_name').value = p.name;
    document.getElementById('p_barcode').value = p.barcode || '';
    document.getElementById('p_category').value = p.category_id || '';
    document.getElementById('p_company').value = p.company_id || '';
    document.getElementById('p_unit').value = p.unit;
    document.getElementById('p_threshold').value = p.low_stock_threshold;
    document.getElementById('p_cost').value = p.cost_price;
    document.getElementById('p_sale').value = p.sale_price;
    document.getElementById('p_wholesale').value = p.wholesale_price || '';
    document.getElementById('p_stock').value = p.stock_qty;
    document.getElementById('p_author').value = p.author || '';
    document.getElementById('p_publisher').value = p.publisher || '';
    document.getElementById('p_edition').value = p.edition || '';
    new bootstrap.Modal(document.getElementById('productModal')).show();
}
function openReject(id, name) {
    document.getElementById('rej_id').value = id;
    document.getElementById('rej_name').textContent = name;
    new bootstrap.Modal(document.getElementById('rejectModal')).show();
}
function openAdjust(id, name) {
    document.getElementById('adj_id').value = id;
    document.getElementById('adj_name').textContent = name;
    new bootstrap.Modal(document.getElementById('adjustModal')).show();
}
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
