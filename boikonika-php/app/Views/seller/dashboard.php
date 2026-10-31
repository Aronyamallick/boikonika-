<div class="row-between mb-2">
  <h1 class="mb-0"><?= __('nav.sellerDashboard') ?></h1>
  <a class="btn btn-primary" href="<?= e(url('seller/listings/new')) ?>"><?= icon('plus') ?><?= __('seller.addListing') ?></a>
</div>
<?php if ((int) $todo['pending'] > 0): ?><div class="alert alert-warning"><?= icon('package') ?><div><?= e(tn('seller.newOrdersAlert', (int) $todo['pending'])) ?> <a href="<?= e(url('seller/orders', ['status' => 'pending'])) ?>"><?= __('seller.reviewNow') ?></a></div></div><?php endif; ?>
<?php if ($returns > 0): ?><div class="alert alert-info"><?= icon('undo') ?><div><?= e(tn('seller.returnsAlert', $returns)) ?></div></div><?php endif; ?>
<?php if ($pendingProducts > 0): ?><div class="alert alert-info"><?= icon('info') ?><div><?= e(tn('seller.pendingProducts', $pendingProducts)) ?></div></div><?php endif; ?>
<div class="stats">
  <div class="stat"><p class="label"><?= __('seller.withdrawable') ?></p><p class="value"><?= e(money($balance['withdrawable'])) ?></p><p class="hint"><a href="<?= e(url('seller/payouts')) ?>"><?= __('seller.requestPayout') ?></a></p></div>
  <div class="stat"><p class="label"><?= __('seller.pendingBalance') ?></p><p class="value"><?= e(money($balance['pending'] + $balance['upcoming'])) ?></p><p class="hint"><?= __('seller.pendingHint') ?></p></div>
  <div class="stat"><p class="label"><?= __('seller.sales30') ?></p><p class="value"><?= e(money($sales30['amount'])) ?></p><p class="hint"><?= e(tn('seller.parcelsDelivered', (int) $sales30['n'])) ?></p></div>
  <div class="stat"><p class="label"><?= __('seller.liveListings') ?></p><p class="value"><?= e(num((int) $listings['live'])) ?></p><p class="hint"><?= e(t('seller.lowStock', ['low' => num((int) $listings['low']), 'empty' => num((int) $listings['empty'])])) ?></p></div>
</div>
<div class="stats">
  <a class="stat" href="<?= e(url('seller/orders', ['status' => 'pending'])) ?>"><p class="label"><?= __('seller.toConfirm') ?></p><p class="value"><?= e(num((int) $todo['pending'])) ?></p></a>
  <a class="stat" href="<?= e(url('seller/orders', ['status' => 'confirmed'])) ?>"><p class="label"><?= __('seller.toShip') ?></p><p class="value"><?= e(num((int) $todo['packing'])) ?></p></a>
  <a class="stat" href="<?= e(url('seller/orders', ['status' => 'shipped'])) ?>"><p class="label"><?= __('seller.onTheWay') ?></p><p class="value"><?= e(num((int) $todo['shipped'])) ?></p></a>
  <div class="stat"><p class="label"><?= __('seller.paidOut') ?></p><p class="value"><?= e(money($balance['paid'])) ?></p></div>
</div>
<section class="card">
  <div class="card-head"><h2><?= __('seller.recentOrders') ?></h2><a href="<?= e(url('seller/orders')) ?>"><?= __('common.viewAll') ?></a></div>
  <?php if (!$recent): ?><p class="muted mb-0"><?= __('seller.noOrders') ?></p><?php else: ?>
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('orders.number') ?></th><th><?= __('common.date') ?></th><th><?= __('seller.buyer') ?></th><th><?= __('common.status') ?></th><th class="num"><?= __('seller.earning') ?></th></tr></thead>
    <tbody><?php foreach ($recent as $r): ?><tr><td><a class="mono" href="<?= e(url('seller/orders/' . $r['number'])) ?>"><?= e($r['number']) ?></a></td><td class="nowrap small"><?= e(fdate($r['created_at'])) ?></td><td><?= e($r['ship_name']) ?></td><td><span class="badge"><?= e(status_label('parcel', $r['status'])) ?></span></td><td class="num"><?= e(money($r['seller_earning'])) ?></td></tr><?php endforeach; ?></tbody>
  </table></div>
  <?php endif; ?>
</section>
