<?php use App\Core\Auth; ?>
<nav class="dash-nav" aria-label="<?= __('nav.account') ?>">
  <h2><?= __('nav.account') ?></h2>
  <ul>
    <li><a href="<?= e(url('account')) ?>"<?= \App\Core\App::$request->path === '/account' ? ' aria-current="page"' : '' ?>><?= icon('home') ?><?= __('account.overview') ?></a></li>
    <li><a href="<?= e(url('account/orders')) ?>"<?= nav_active('account/orders') ?>><?= icon('package') ?><?= __('nav.orders') ?></a></li>
    <li><a href="<?= e(url('account/wishlist')) ?>"<?= nav_active('account/wishlist') ?>><?= icon('heart') ?><?= __('nav.wishlist') ?></a></li>
    <li><a href="<?= e(url('account/addresses')) ?>"<?= nav_active('account/addresses') ?>><?= icon('map-pin') ?><?= __('addresses.title') ?></a></li>
    <li><a href="<?= e(url('account/notifications')) ?>"<?= nav_active('account/notifications') ?>><?= icon('bell') ?><?= __('nav.notifications') ?></a></li>
  </ul>
  <h2><?= __('account.settings') ?></h2>
  <ul>
    <li><a href="<?= e(url('account/profile')) ?>"<?= nav_active('account/profile') ?>><?= icon('user') ?><?= __('account.profile') ?></a></li>
    <li><a href="<?= e(url('account/security')) ?>"<?= nav_active('account/security') ?>><?= icon('lock') ?><?= __('security.title') ?></a></li>
    <li><a href="<?= e(url('account/privacy')) ?>"<?= nav_active('account/privacy') ?>><?= icon('shield') ?><?= __('privacy.title') ?></a></li>
  </ul>
  <?php if (Auth::isSeller() || Auth::isStaff()): ?>
  <h2><?= __('account.workspaces') ?></h2>
  <ul>
    <?php if (Auth::isSeller()): ?><li><a href="<?= e(url('seller')) ?>"><?= icon('store') ?><?= __('nav.sellerDashboard') ?></a></li><?php endif; ?>
    <?php if (Auth::isStaff()): ?><li><a href="<?= e(url('admin')) ?>"><?= icon('shield') ?><?= __('nav.admin') ?></a></li><?php endif; ?>
  </ul>
  <?php endif; ?>
</nav>
