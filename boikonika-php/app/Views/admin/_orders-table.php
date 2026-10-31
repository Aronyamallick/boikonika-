<?php if (!$rows): ?><p class="muted mb-0"><?= __('common.empty') ?></p><?php else: ?>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('orders.number') ?></th><th><?= __('common.date') ?></th><th><?= __('seller.buyer') ?></th><th><?= __('common.status') ?></th><th><?= __('orders.payment') ?></th><th class="num"><?= __('common.total') ?></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $o): ?>
    <tr>
      <td><a class="mono" href="<?= e(url('admin/orders/' . $o['number'])) ?>"><?= e($o['number']) ?></a></td>
      <td class="small nowrap"><?= e(fdate($o['created_at'], 'datetime')) ?></td>
      <td><?= e($o['buyer']) ?><br><span class="small subtle"><?= e(\App\Services\Geo::districtName($o['ship_district'])) ?></span></td>
      <td><span class="badge"><?= e(status_label('order', $o['status'])) ?></span></td>
      <td class="small"><?= __('status.method.' . $o['payment_method']) ?><br><span class="subtle"><?= e(status_label('payment', $o['payment_status'])) ?></span></td>
      <td class="num"><?= e(money($o['total'])) ?></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table></div>
<?php endif; ?>
