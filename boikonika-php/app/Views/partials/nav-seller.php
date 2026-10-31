<?php
use App\Core\DB;

$sid = (int) \App\Core\Auth::seller()['id'];
$newOrders = (int) DB::val("SELECT COUNT(*) FROM seller_orders WHERE seller_id = ? AND status = 'pending'", [$sid]);
?>
<nav class="dash-nav" aria-label="<?= __('nav.sellerDashboard') ?>">
  <h2><?= e(\App\Core\Auth::seller()['store_name']) ?></h2>
  <ul>
    <li><a href="<?= e(url('seller')) ?>"<?= \App\Core\App::$request->path === '/seller' ? ' aria-current="page"' : '' ?>><?= icon('chart') ?><?= __('account.overview') ?></a></li>
    <li><a href="<?= e(url('seller/orders')) ?>"<?= nav_active('seller/orders') ?>><?= icon('package') ?><?= __('seller.orders') ?><?php if ($newOrders): ?><span class="count"><?= e(num($newOrders)) ?></span><?php endif; ?></a></li>
    <li><a href="<?= e(url('seller/listings')) ?>"<?= nav_active('seller/listings') ?>><?= icon('book') ?><?= __('seller.listings') ?></a></li>
    <li><a href="<?= e(url('seller/payouts')) ?>"<?= nav_active('seller/payouts') ?>><?= icon('wallet') ?><?= __('seller.payouts') ?></a></li>
    <li><a href="<?= e(url('seller/store')) ?>"<?= nav_active('seller/store') ?>><?= icon('store') ?><?= __('seller.storeSettings') ?></a></li>
    <li><a href="<?= e(url('stores/' . \App\Core\Auth::seller()['slug'])) ?>"><?= icon('external') ?><?= __('seller.viewShop') ?></a></li>
  </ul>
  <h2><?= __('nav.account') ?></h2>
  <ul><li><a href="<?= e(url('account')) ?>"><?= icon('user') ?><?= __('nav.account') ?></a></li></ul>
</nav>
