<?php
use App\Core\Auth;
use App\Core\DB;
use App\Services\Cart;

$user = Auth::user();
$cartCount = Cart::count();
$unread = $user ? (int) DB::val('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL', [$user['id']]) : 0;
$other = locale() === 'bn' ? 'en' : 'bn';
$initial = $user ? mb_strtoupper(mb_substr($user['name'], 0, 1)) : '';
?>
<header class="site-header">
  <div class="container">
    <div class="header-main">
      <button type="button" class="icon-btn menu-toggle" data-drawer-open aria-controls="drawer" aria-label="<?= __('common.openMenu') ?>"><?= icon('menu') ?></button>
      <a class="brand" href="<?= e(url()) ?>"><img src="<?= e(asset('img/logo.svg')) ?>" alt="" width="36" height="36"><span><?= e(site_name()) ?></span></a>
      <form class="header-search" role="search" action="<?= e(url('search')) ?>" method="get">
        <div class="search-field">
          <label class="sr-only" for="hq"><?= __('nav.searchLabel') ?></label>
          <input id="hq" type="search" name="q" value="<?= e($searchQuery ?? '') ?>" placeholder="<?= __('nav.searchPlaceholder') ?>" autocomplete="off" maxlength="120">
          <button type="submit" aria-label="<?= __('common.search') ?>"><?= icon('search') ?></button>
        </div>
      </form>
      <div class="header-actions">
        <a class="lang-link" href="<?= e(switch_locale_url($other)) ?>" hreflang="<?= $other ?>" lang="<?= $other ?>" aria-label="<?= __('common.switchToLabel') ?>"><?= $other === 'en' ? 'EN' : 'বাং' ?></a>
        <button type="button" class="icon-btn" data-theme-toggle aria-label="<?= __('common.themeToggle') ?>"><?= icon('moon') ?></button>
        <?php if ($user): ?>
        <a class="icon-btn" href="<?= e(url('account/notifications')) ?>" aria-label="<?= e(t('nav.notifications') . ($unread ? ' (' . num($unread) . ')' : '')) ?>"><?= icon('bell') ?><?php if ($unread): ?><span class="count" aria-hidden="true"><?= e(num(min($unread, 99))) ?></span><?php endif; ?></a>
        <?php endif; ?>
        <a class="icon-btn" href="<?= e(url('cart')) ?>" data-cart-link aria-label="<?= e(tn('nav.cartCount', $cartCount)) ?>"><?= icon('cart') ?><span class="count" data-cart-count aria-hidden="true"<?= $cartCount ? '' : ' hidden' ?>><?= e(num(min($cartCount, 99))) ?></span></a>
        <?php if ($user): ?>
        <details class="user-menu">
          <summary class="icon-btn" aria-label="<?= __('nav.userMenu') ?>"><span class="avatar"><?php if ($user['avatar_path']): ?><img src="<?= e(upload_url($user['avatar_path'])) ?>" alt=""><?php else: ?><?= e($initial) ?><?php endif; ?></span></summary>
          <div class="dropdown">
            <div class="dropdown-head"><strong><?= e($user['name']) ?></strong><div class="small subtle"><?= e($user['email'] ?? $user['phone'] ?? '') ?></div></div>
            <a href="<?= e(url('account')) ?>"><?= icon('user') ?><?= __('nav.account') ?></a>
            <a href="<?= e(url('account/orders')) ?>"><?= icon('package') ?><?= __('nav.orders') ?></a>
            <a href="<?= e(url('account/wishlist')) ?>"><?= icon('heart') ?><?= __('nav.wishlist') ?></a>
            <?php if (Auth::isSeller()): ?><a href="<?= e(url('seller')) ?>"><?= icon('store') ?><?= __('nav.sellerDashboard') ?></a>
            <?php else: ?><a href="<?= e(url('sell')) ?>"><?= icon('store') ?><?= __('nav.sell') ?></a><?php endif; ?>
            <?php if (Auth::isStaff()): ?><a href="<?= e(url('admin')) ?>"><?= icon('shield') ?><?= __('nav.admin') ?></a><?php endif; ?>
            <form method="post" action="<?= e(url('logout')) ?>"><?= csrf_field() ?><button type="submit"><?= icon('log-out') ?><?= __('nav.logout') ?></button></form>
          </div>
        </details>
        <?php else: ?>
        <a class="btn btn-primary btn-sm" href="<?= e(url('login')) ?>"><?= __('nav.login') ?></a>
        <?php endif; ?>
      </div>
    </div>
    <form class="mobile-search" role="search" action="<?= e(url('search')) ?>" method="get">
      <div class="search-field">
        <label class="sr-only" for="mq"><?= __('nav.searchLabel') ?></label>
        <input id="mq" type="search" name="q" value="<?= e($searchQuery ?? '') ?>" placeholder="<?= __('nav.searchPlaceholder') ?>" autocomplete="off" maxlength="120">
        <button type="submit" aria-label="<?= __('common.search') ?>"><?= icon('search') ?></button>
      </div>
    </form>
  </div>
  <nav class="header-nav" aria-label="<?= __('nav.mainMenu') ?>">
    <div class="container">
      <ul>
        <li><a href="<?= e(url()) ?>"<?= nav_active('/') ?>><?= __('nav.home') ?></a></li>
        <li><a href="<?= e(url('books')) ?>"<?= nav_active('books') ?>><?= __('nav.books') ?></a></li>
        <li><a href="<?= e(url('categories')) ?>"<?= nav_active('categories') ?>><?= __('nav.categories') ?></a></li>
        <li><a href="<?= e(url('authors')) ?>"<?= nav_active('authors') ?>><?= __('nav.authors') ?></a></li>
        <li><a href="<?= e(url('publishers')) ?>"<?= nav_active('publishers') ?>><?= __('nav.publishers') ?></a></li>
        <li><a href="<?= e(url('products')) ?>"<?= nav_active('products') ?>><?= __('nav.products') ?></a></li>
        <li><a href="<?= e(url('books', ['condition' => 'used'])) ?>"><?= __('home.usedBooks') ?></a></li>
        <li><a href="<?= e(url('sell')) ?>"<?= nav_active('sell') ?>><?= __('nav.sell') ?></a></li>
      </ul>
    </div>
  </nav>
</header>
<div class="drawer" id="drawer" hidden>
  <div class="drawer-backdrop" data-drawer-close></div>
  <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="<?= __('nav.mainMenu') ?>">
    <div class="row-between"><a class="brand" href="<?= e(url()) ?>"><img src="<?= e(asset('img/logo.svg')) ?>" alt="" width="32" height="32"><span><?= e(site_name()) ?></span></a><button type="button" class="icon-btn" data-drawer-close aria-label="<?= __('common.closeMenu') ?>"><?= icon('x') ?></button></div>
    <nav>
      <a href="<?= e(url()) ?>"><?= icon('home') ?><?= __('nav.home') ?></a>
      <a href="<?= e(url('books')) ?>"><?= icon('book') ?><?= __('nav.books') ?></a>
      <a href="<?= e(url('categories')) ?>"><?= icon('layers') ?><?= __('nav.categories') ?></a>
      <a href="<?= e(url('authors')) ?>"><?= icon('pen') ?><?= __('nav.authors') ?></a>
      <a href="<?= e(url('publishers')) ?>"><?= icon('building') ?><?= __('nav.publishers') ?></a>
      <a href="<?= e(url('products')) ?>"><?= icon('backpack') ?><?= __('nav.products') ?></a>
      <h2><?= __('nav.account') ?></h2>
      <?php if ($user): ?>
      <a href="<?= e(url('account')) ?>"><?= icon('user') ?><?= __('nav.account') ?></a>
      <a href="<?= e(url('account/orders')) ?>"><?= icon('package') ?><?= __('nav.orders') ?></a>
      <a href="<?= e(url('account/wishlist')) ?>"><?= icon('heart') ?><?= __('nav.wishlist') ?></a>
      <?php if (Auth::isSeller()): ?><a href="<?= e(url('seller')) ?>"><?= icon('store') ?><?= __('nav.sellerDashboard') ?></a><?php endif; ?>
      <?php if (Auth::isStaff()): ?><a href="<?= e(url('admin')) ?>"><?= icon('shield') ?><?= __('nav.admin') ?></a><?php endif; ?>
      <?php else: ?>
      <a href="<?= e(url('login')) ?>"><?= icon('user') ?><?= __('nav.login') ?></a>
      <a href="<?= e(url('register')) ?>"><?= icon('plus') ?><?= __('nav.register') ?></a>
      <?php endif; ?>
      <a href="<?= e(url('sell')) ?>"><?= icon('store') ?><?= __('nav.sell') ?></a>
      <a href="<?= e(url('contact')) ?>"><?= icon('message') ?><?= __('nav.contact') ?></a>
    </nav>
  </div>
</div>
