<?php $tabs = ['' => t('common.all'), 'pending' => t('seller.toConfirm'), 'confirmed' => t('status.parcel.confirmed'), 'processing' => t('status.parcel.processing'), 'shipped' => t('status.parcel.shipped'), 'delivered' => t('status.parcel.delivered'), 'cancelled' => t('status.parcel.cancelled'), 'returned' => t('status.parcel.returned')]; ?>
<h1><?= __('seller.orders') ?></h1>
<div class="status-tabs"><?php foreach ($tabs as $k => $v): ?><a class="chip" href="<?= e(url('seller/orders', array_filter(['status' => $k]))) ?>"<?= $status === $k ? ' aria-current="page"' : '' ?>><?= e($v) ?><?php if ($k !== '' && !empty($counts[$k])): ?> <span class="badge"><?= e(num($counts[$k])) ?></span><?php endif; ?></a><?php endforeach; ?></div>
<form class="toolbar" method="get" action="<?= e(url('seller/orders')) ?>" role="search">
  <?php if ($status): ?><input type="hidden" name="status" value="<?= e($status) ?>"><?php endif; ?>
  <div class="field"><label class="sr-only" for="oq"><?= __('common.search') ?></label><input id="oq" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= __('seller.searchOrders') ?>"></div>
  <button class="btn btn-outline" type="submit"><?= __('common.search') ?></button>
</form>
<?php if (!$rows): ?><div class="card empty-state"><?= icon('package') ?><h2><?= __('seller.noOrders') ?></h2></div><?php else: ?>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('orders.number') ?></th><th><?= __('common.date') ?></th><th><?= __('seller.buyer') ?></th><th><?= __('orders.payment') ?></th><th><?= __('common.status') ?></th><th class="num"><?= __('common.total') ?></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $r): ?>
    <tr>
      <td><a class="mono" href="<?= e(url('seller/orders/' . $r['number'])) ?>"><?= e($r['number']) ?></a><br><span class="small subtle"><?= e(tn('common.items', (int) $r['items'])) ?></span></td>
      <td class="small nowrap"><?= e(fdate($r['created_at'], 'datetime')) ?></td>
      <td><?= e($r['ship_name']) ?><br><span class="small subtle"><?= e(\App\Services\Geo::districtName($r['ship_district'])) ?></span></td>
      <td class="small"><?= __('status.method.' . $r['payment_method']) ?><br><span class="subtle"><?= e(status_label('payment', $r['payment_status'])) ?></span></td>
      <td><span class="badge<?= $r['status'] === 'pending' ? ' badge-warning' : '' ?>"><?= e(status_label('parcel', $r['status'])) ?></span><?php if ($r['return_status'] && in_array($r['return_status'], ['requested', 'approved'], true)): ?><br><span class="badge badge-danger"><?= __('seller.returnOpen') ?></span><?php endif; ?></td>
      <td class="num"><?= e(money($r['total'])) ?></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
<?php endif; ?>
