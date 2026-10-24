<?php
/**
 * শেয়ার্ড হেডার — প্রতিটি মডিউল পাতা থেকে include হয়।
 * প্রত্যাশিত ভেরিয়েবল: $pageTitle, $activeNav
 */
$settings = shop_settings($pdo);
$shopName = $settings['shop_name'] ?? 'Mallik Book House & Computer';
$user = current_user();
$pageTitle = $pageTitle ?? 'ড্যাশবোর্ড';
$activeNav = $activeNav ?? '';

$navItems = [
    ['key' => 'dashboard',   'label' => t('nav_dashboard'),   'icon' => 'bi-speedometer2',  'href' => 'dashboard.php',      'roles' => ['owner','cashier','salesman'], 'permission' => 'dashboard'],
    ['key' => 'stock',       'label' => t('nav_stock'),       'icon' => 'bi-box-seam',       'href' => 'stock.php',          'roles' => ['owner','salesman']],
    ['key' => 'purchase',    'label' => t('nav_purchase'),    'icon' => 'bi-truck',          'href' => 'purchase.php',       'roles' => ['owner'], 'permission' => 'purchase'],
    ['key' => 'purchase_return', 'label' => t('nav_purchase_return', 'ক্রয় ফেরত'), 'icon' => 'bi-arrow-return-left', 'href' => 'purchase_return.php', 'roles' => ['owner'], 'permission' => 'purchase'],
    ['key' => 'services',    'label' => t('nav_services'),    'icon' => 'bi-printer',        'href' => 'services.php',       'roles' => ['owner']],
    ['key' => 'sales',       'label' => t('nav_sales'),       'icon' => 'bi-cart-check',     'href' => 'sales_pos.php',      'roles' => ['owner','cashier','salesman'], 'permission' => 'sales'],
    ['key' => 'sales_list',  'label' => t('nav_sales_list'),  'icon' => 'bi-receipt',        'href' => 'sales_list.php',     'roles' => ['owner','cashier','salesman'], 'permission' => 'sales_list'],
    ['key' => 'sales_return', 'label' => t('nav_sales_return'), 'icon' => 'bi-arrow-counterclockwise', 'href' => 'sales_return.php', 'roles' => ['owner','cashier','salesman'], 'permission' => 'sales_return'],
    ['key' => 'quotation',   'label' => t('nav_quotation', 'কোটেশন'), 'icon' => 'bi-file-earmark-text', 'href' => 'quotation.php', 'roles' => ['owner','cashier','salesman'], 'permission' => 'sales'],
    ['key' => 'customers',   'label' => t('nav_customers'),   'icon' => 'bi-people',         'href' => 'customers.php',      'roles' => ['owner','cashier','salesman'], 'permission' => 'customers'],
    ['key' => 'suppliers',   'label' => t('nav_suppliers'),   'icon' => 'bi-building',       'href' => 'suppliers.php',      'roles' => ['owner']],
    ['key' => 'coupons',     'label' => t('nav_coupons', 'কুপন / ডিসকাউন্ট'), 'icon' => 'bi-ticket-perforated', 'href' => 'coupons.php', 'roles' => ['owner']],
    ['key' => 'barcode',     'label' => t('nav_barcode', 'বারকোড / QR'), 'icon' => 'bi-upc-scan', 'href' => 'barcode.php', 'roles' => ['owner','salesman']],
    ['key' => 'stock_transfer', 'label' => t('nav_stock_transfer', 'শাখা / স্টক ট্রান্সফার'), 'icon' => 'bi-arrow-left-right', 'href' => 'stock_transfer.php', 'roles' => ['owner','salesman']],
    ['key' => 'accounts',    'label' => t('nav_accounts', 'একাউন্টস'),   'icon' => 'bi-journal-text',   'href' => 'accounts.php',       'roles' => ['owner']],
    ['key' => 'reports',     'label' => t('nav_reports'),     'icon' => 'bi-graph-up-arrow', 'href' => 'reports.php',        'roles' => ['owner']],
    ['key' => 'users',       'label' => t('nav_users'),       'icon' => 'bi-person-gear',    'href' => 'users.php',          'roles' => ['owner']],
    ['key' => 'payment_api', 'label' => t('nav_payment_api'), 'icon' => 'bi-credit-card',    'href' => 'payment_api.php',    'roles' => ['owner']],
    ['key' => 'backup',      'label' => t('nav_backup'),      'icon' => 'bi-cloud-arrow-down','href' => 'backup.php',       'roles' => ['owner']],
];

$availableLangs = [];
foreach (glob(APP_ROOT . '/lang/*.php') as $lf) {
    $availableLangs[] = basename($lf, '.php');
}
$langNames = ['bn' => 'বাংলা', 'en' => 'English'];
?>
<!DOCTYPE html>
<html lang="<?= e($GLOBALS['ACTIVE_LANG'] ?? 'bn') ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($pageTitle) ?> — <?= e($shopName) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@500;600;700;800&family=Hind+Siliguri:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
<link rel="manifest" href="<?= BASE_URL ?>/manifest.json">
<meta name="theme-color" content="#FFFFFF">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="মল্লিক বুক হাউজ">
<link rel="icon" href="<?= BASE_URL ?>/assets/img/favicon.ico">
<link rel="apple-touch-icon" href="<?= BASE_URL ?>/assets/img/apple-touch-icon.png">
<script>window.APP_BASE_URL = "<?= addslashes(BASE_URL) ?>";</script>
<script src="<?= BASE_URL ?>/assets/js/app.js?v=3"></script>
</head>
<body>
<div class="app-shell">
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <a href="dashboard.php" class="brand-link" title="<?= e(t('go_to_dashboard', 'Go to dashboard')) ?>">
                <div class="brand-lockup">
                    <div class="book-spine-mark"><span></span><span></span><span></span><span></span></div>
                    <div class="shop-name"><?= e($shopName) ?><small>Powered by Askurex Technologies</small></div>
                </div>
            </a>
        </div>
        <nav class="sidebar-nav">
            <?php foreach ($navItems as $item): ?>
                <?php $isAllowed = !empty($item['permission']) ? has_permission($user, $item['permission']) : user_has_role($user, $item['roles']); ?>
                <?php if (!$isAllowed) continue; ?>
                <a href="<?= e($item['href']) ?>" class="nav-link <?= $activeNav === $item['key'] ? 'active' : '' ?>">
                    <i class="bi <?= e($item['icon']) ?>"></i> <span><?= e($item['label']) ?></span>
                </a>
            <?php endforeach; ?>
        </nav>
        <div class="sidebar-footer">
            &copy; <?= date('Y') ?> <?= e($shopName) ?><br>
            Developed by <a href="#" onclick="return false;">Askurex Technologies</a>
        </div>
    </aside>

    <div class="main-wrap">
        <header class="topbar">
            <div style="display:flex;align-items:center;gap:14px;">
                <button class="sidebar-toggle-btn" aria-label="<?= e(t('menu')) ?>"><i class="bi bi-list"></i></button>
                <h1 class="page-title"><?= e($pageTitle) ?></h1>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <button id="installAppBtn" class="install-app-btn" type="button" style="display:none;"><i class="bi bi-cloud-arrow-down"></i> <?= e(t('install_app', 'Install app')) ?></button>
                <div class="topbar-user dropdown">
                <a href="#" class="dropdown-toggle" data-bs-toggle="dropdown" style="display:flex;align-items:center;gap:10px;color:var(--text-primary);">
                    <div class="avatar"><?= e(mb_substr($user['name'] ?? 'U', 0, 1)) ?></div>
                    <div style="text-align:right;line-height:1.2;">
                        <div style="font-size:13.5px;font-weight:600;"><?= e($user['name'] ?? '') ?></div>
                        <div style="font-size:11.5px;color:var(--text-secondary);">
                            <?= (($user['role'] ?? '') === 'owner') ? e(t('owner')) : (($user['role'] ?? '') === 'salesman' ? e(t('salesman')) : e(t('cashier'))) ?>
                        </div>
                    </div>
                </a>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item" href="users.php?profile=1"><i class="bi bi-person"></i> <?= e(t('profile')) ?></a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><h6 class="dropdown-header"><?= e(t('language')) ?></h6></li>
                    <?php foreach ($availableLangs as $lc): ?>
                        <li><a class="dropdown-item <?= $GLOBALS['ACTIVE_LANG'] === $lc ? 'active' : '' ?>" href="<?= BASE_URL ?>/set_language.php?lang=<?= e($lc) ?>"><?= e($langNames[$lc] ?? strtoupper($lc)) ?></a></li>
                    <?php endforeach; ?>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item text-danger" href="<?= BASE_URL ?>/logout.php"><i class="bi bi-box-arrow-right"></i> <?= e(t('logout')) ?></a></li>
                </ul>
            </div>
        </header>
        <main class="content">
            <?php $flash = flash_get(); ?>
            <?php if ($flash): ?>
                <div class="alert alert-<?= e($flash['type']) ?>" data-autohide><?= e($flash['message']) ?></div>
            <?php endif; ?>