<?php $u = auth_user(); ?>
<h1><?= e(t('account.hello', ['name' => $u['name']])) ?></h1>
<?php foreach ($awaiting as $a): ?>
  <div class="alert alert-warning"><?= icon('alert') ?><div><?= e(t('account.awaitingPayment', ['number' => $a['number'], 'amount' => money($a['total'])])) ?> <a href="<?= e(url('account/orders/' . $a['number'])) ?>"><?= __('account.payNow') ?></a></div></div>
<?php endforeach; ?>
<div class="stats">
  <div class="stat"><p class="label"><?= __('account.ordersTotal') ?></p><p class="value"><?= e(num((int) $stats['orders'])) ?></p></div>
  <div class="stat"><p class="label"><?= __('account.ordersOpen') ?></p><p class="value"><?= e(num((int) $stats['open'])) ?></p></div>
  <div class="stat"><p class="label"><?= __('account.ordersDone') ?></p><p class="value"><?= e(num((int) $stats['completed'])) ?></p></div>
  <div class="stat"><p class="label"><?= __('nav.wishlist') ?></p><p class="value"><a href="<?= e(url('account/wishlist')) ?>"><?= e(num($wish)) ?></a></p></div>
</div>
<section class="card">
  <div class="card-head"><h2><?= __('account.recentOrders') ?></h2><a href="<?= e(url('account/orders')) ?>"><?= __('common.viewAll') ?></a></div>
  <?php if (!$orders): ?>
    <p class="muted"><?= __('account.noOrders') ?> <a href="<?= e(url('books')) ?>"><?= __('cart.browse') ?></a></p>
  <?php else: ?>
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('orders.number') ?></th><th><?= __('common.date') ?></th><th><?= __('common.status') ?></th><th><?= __('orders.payment') ?></th><th class="num"><?= __('common.total') ?></th></tr></thead>
    <tbody><?php foreach ($orders as $o): ?><?= partial('partials/order-row', ['o' => $o]) ?><?php endforeach; ?></tbody>
  </table></div>
  <?php endif; ?>
</section>
<?php if (!\App\Core\Auth::seller()): ?>
<section class="card">
  <h2><?= __('account.sellTitle') ?></h2>
  <p class="muted"><?= __('account.sellText') ?></p>
  <a class="btn btn-secondary" href="<?= e(url('sell')) ?>"><?= __('nav.sell') ?></a>
</section>
<?php endif; ?>
