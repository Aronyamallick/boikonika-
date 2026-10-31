<h1><?= __('nav.admin') ?></h1>
<?php foreach ($warnings as $w): ?><div class="alert alert-warning"><?= icon('alert') ?><div><?= __($w) ?></div></div><?php endforeach; ?>
<div class="stats">
  <div class="stat"><p class="label"><?= __('adminDash.ordersToday') ?></p><p class="value"><?= e(num($k['ordersToday'])) ?></p><p class="hint"><?= e(t('adminDash.last7', ['count' => num($k['orders7'])])) ?></p></div>
  <div class="stat"><p class="label"><?= __('adminDash.gmv30') ?></p><p class="value"><?= e(money($k['gmv30'])) ?></p></div>
  <div class="stat"><p class="label"><?= __('adminDash.commission30') ?></p><p class="value"><?= e(money($k['commission30'])) ?></p></div>
  <div class="stat"><p class="label"><?= __('adminDash.users') ?></p><p class="value"><?= e(num($k['users'])) ?></p><p class="hint"><?= e(t('adminDash.newUsers', ['count' => num($k['newUsers7'])])) ?></p></div>
</div>
<div class="stats">
  <div class="stat"><p class="label"><?= __('adminDash.sellers') ?></p><p class="value"><?= e(num($k['sellers'])) ?></p></div>
  <div class="stat"><p class="label"><?= __('adminDash.liveProducts') ?></p><p class="value"><?= e(num($k['liveProducts'])) ?></p></div>
</div>
<section class="card">
  <h2><?= __('adminDash.todo') ?></h2>
  <div class="stats mb-0">
  <?php foreach ($todo as [$href, $ic, $label, $n, $perm]): if (!can($perm)) { continue; } ?>
    <a class="stat" href="<?= e(url($href)) ?>"><p class="label"><?= icon($ic, 'icon icon-sm') ?> <?= __($label) ?></p><p class="value<?= $n ? ' text-danger' : '' ?>"><?= e(num($n)) ?></p></a>
  <?php endforeach; ?>
  </div>
</section>
<?php if ($daily): $max = max(array_map(static fn ($d) => (int) $d['n'], $daily)) ?: 1; ?>
<section class="card">
  <h2><?= __('adminDash.last14') ?></h2>
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('common.date') ?></th><th><?= __('admin.orders') ?></th><th class="num"><?= __('common.total') ?></th></tr></thead>
    <tbody><?php foreach (array_reverse($daily) as $d): ?><tr><td class="small"><?= e(fdate($d['d'])) ?></td><td><meter min="0" max="<?= $max ?>" value="<?= (int) $d['n'] ?>" aria-label="<?= e(num((int) $d['n'])) ?>"></meter> <?= e(num((int) $d['n'])) ?></td><td class="num"><?= e(money($d['amount'])) ?></td></tr><?php endforeach; ?></tbody>
  </table></div>
</section>
<?php endif; ?>
<?php if (can('orders.manage')): ?>
<section class="card">
  <div class="card-head"><h2><?= __('adminDash.recentOrders') ?></h2><a href="<?= e(url('admin/orders')) ?>"><?= __('common.viewAll') ?></a></div>
  <?= partial('admin/_orders-table', ['rows' => $recent]) ?>
</section>
<?php endif; ?>
