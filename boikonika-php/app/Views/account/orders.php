<h1><?= __('nav.orders') ?></h1>
<?php if (!$orders): ?>
  <div class="card empty-state"><?= icon('package') ?><h2><?= __('account.noOrders') ?></h2><p><a class="btn btn-primary" href="<?= e(url('books')) ?>"><?= __('cart.browse') ?></a></p></div>
<?php else: ?>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('orders.number') ?></th><th><?= __('common.date') ?></th><th><?= __('common.status') ?></th><th><?= __('orders.payment') ?></th><th class="num"><?= __('common.total') ?></th></tr></thead>
  <tbody><?php foreach ($orders as $o): ?><?= partial('partials/order-row', ['o' => $o]) ?><?php endforeach; ?></tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
<?php endif; ?>
