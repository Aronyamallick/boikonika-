<?php
use App\Core\Money;
use App\Services\Geo;
use App\Services\Orders;
?>
<p class="small mb-1"><a href="<?= e(url('admin/orders')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('admin.orders') ?></a></p>
<div class="row-between mb-2">
  <div><h1 class="mb-0"><?= e(t('orders.orderTitle', ['number' => $o['number']])) ?></h1><p class="muted mb-0"><?= e(fdate($o['created_at'], 'datetime')) ?> · <?= e($o['locale'] === 'en' ? 'English' : 'বাংলা') ?> · IP <span class="mono"><?= e((string) $o['ip']) ?></span></p></div>
  <div class="row"><span class="badge badge-primary"><?= e(status_label('order', $o['status'])) ?></span><span class="badge"><?= e(status_label('payment', $o['payment_status'])) ?></span></div>
</div>
<div class="grid-2">
  <section class="card">
    <h2 class="h3"><?= __('seller.buyer') ?></h2>
    <p class="mb-0"><a href="<?= e(url('admin/users/' . $o['user_id'])) ?>"><?= e($o['buyer']) ?></a><br><span class="small"><?= e((string) $o['buyer_email']) ?> · <?= e(digits((string) $o['buyer_phone'])) ?></span></p>
    <h3 class="h3 mt-2"><?= __('orders.deliveryAddress') ?></h3>
    <p class="mb-0"><?= e($o['ship_name']) ?> · <?= e(digits($o['ship_phone'])) ?><br><?= e($o['ship_address']) ?>, <?= e($o['ship_area']) ?>, <?= e(Geo::districtName($o['ship_district'])) ?><?= $o['ship_postcode'] ? ' ' . e($o['ship_postcode']) : '' ?></p>
    <p class="small muted mb-0"><?= e($o['shipping_method_name']) ?> · <?= $o['inside_dhaka'] ? __('admin.insideDhaka') : __('admin.outsideDhaka') ?></p>
    <?php if ($o['note']): ?><p class="small mt-1 mb-0"><strong><?= __('common.note') ?>:</strong> <?= e($o['note']) ?></p><?php endif; ?>
  </section>
  <section class="card summary">
    <h2 class="h3"><?= __('orders.paymentSummary') ?></h2>
    <dl>
      <dt><?= __('common.subtotal') ?></dt><dd><?= e(money($o['subtotal'])) ?></dd>
      <dt><?= __('common.shipping') ?></dt><dd><?= e(money($o['shipping_total'])) ?></dd>
      <?php if (Money::toPoisha($o['discount_total']) > 0): ?><dt><?= __('common.discount') ?> (<?= e((string) $o['coupon_code']) ?>)</dt><dd>−<?= e(money($o['discount_total'])) ?></dd><?php endif; ?>
      <dt class="grand"><?= __('common.total') ?></dt><dd class="grand"><?= e(money($o['total'])) ?></dd>
      <dt><?= __('orders.refunded') ?></dt><dd><?= e(money($o['refunded_total'])) ?></dd>
    </dl>
    <p class="small muted mb-0"><?= __('status.method.' . $o['payment_method']) ?><?= $o['paid_at'] ? ' · ' . e(fdate($o['paid_at'], 'datetime')) : '' ?><?= $o['payment_due_at'] ? ' · ' . e(t('admin.dueBy', ['time' => fdate($o['payment_due_at'], 'datetime')])) : '' ?></p>
  </section>
</div>

<?php if ($payments): ?>
<section class="card">
  <h2 class="h3"><?= __('admin.paymentAttempts') ?></h2>
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('common.date') ?></th><th><?= __('admin.gateway') ?></th><th><?= __('admin.reference') ?></th><th><?= __('admin.transaction') ?></th><th><?= __('common.status') ?></th><th class="num"><?= __('seller.amount') ?></th><th></th></tr></thead>
    <tbody><?php foreach ($payments as $pm): ?><tr>
      <td class="small nowrap"><?= e(fdate($pm['created_at'], 'datetime')) ?></td><td><?= e($pm['provider'] === 'bkash' ? 'bKash' : 'SSLCOMMERZ') ?></td><td class="mono small"><?= e($pm['reference']) ?></td><td class="mono small"><?= e((string) $pm['transaction_id']) ?></td>
      <td><span class="badge"><?= e(status_label('attempt', $pm['status'])) ?></span><?php if ($pm['failure_reason']): ?><br><span class="small subtle"><?= e($pm['failure_reason']) ?></span><?php endif; ?></td><td class="num"><?= e(money($pm['amount'])) ?></td>
      <td><?php if (in_array($pm['status'], ['initiated', 'pending'], true)): ?><form method="post" action="<?= e(url('admin/orders/' . $o['number'] . '/payments/' . $pm['id'] . '/check')) ?>"><?= csrf_field() ?><button class="btn btn-outline btn-sm" type="submit"><?= __('admin.checkGateway') ?></button></form><?php endif; ?></td>
    </tr><?php endforeach; ?></tbody>
  </table></div>
</section>
<?php endif; ?>

<?php foreach ($parcels as $p): $next = Orders::TRANSITIONS[$p['status']] ?? []; ?>
<section class="card">
  <div class="card-head">
    <div><h2 class="h3 mb-0"><?= e($p['store_name']) ?> · <span class="mono"><?= e($p['number']) ?></span></h2><p class="small muted mb-0"><?= e(t('seller.commission', ['percent' => num((string) (float) $p['commission_percent'])])) ?>: <?= e(money($p['commission_amount'])) ?> · <?= __('seller.earning') ?>: <?= e(money($p['seller_earning'])) ?></p></div>
    <span class="badge badge-primary"><?= e(status_label('parcel', $p['status'])) ?></span>
  </div>
  <?php foreach ($p['items'] as $i): ?><div class="row-between small"><span><?= e($i['title']) ?> (<?= __('status.condition.' . $i['item_condition']) ?>) × <?= e(num((int) $i['quantity'])) ?></span><span><?= e(money($i['line_total'])) ?></span></div><?php endforeach; ?>
  <?php if ($p['courier']): ?><p class="small mt-1 mb-0"><?= icon('truck', 'icon icon-sm') ?> <?= e($p['courier']) ?> <?= e((string) $p['tracking_number']) ?></p><?php endif; ?>
  <?php if ($p['return']): ?><p class="small mt-1 mb-0"><?= icon('undo', 'icon icon-sm') ?> <?= __('orders.returnStatus') ?>: <?= e(status_label('return', $p['return']['status'])) ?> — <?= __('orders.returnReasons.' . $p['return']['reason']) ?></p><?php endif; ?>
  <?php if ($next): ?>
  <details class="disclosure mt-2">
    <summary><?= __('admin.changeParcel') ?></summary>
    <form method="post" action="<?= e(url('admin/orders/' . $o['number'] . '/parcels/' . $p['id'] . '/status')) ?>" class="toolbar">
      <?= csrf_field() ?>
      <div class="field"><label class="small" for="to-<?= (int) $p['id'] ?>"><?= __('common.status') ?></label><select id="to-<?= (int) $p['id'] ?>" name="to"><?php foreach ($next as $n): ?><option value="<?= e($n) ?>"><?= e(status_label('parcel', $n)) ?></option><?php endforeach; ?></select></div>
      <div class="field"><label class="small" for="c-<?= (int) $p['id'] ?>"><?= __('seller.courier') ?></label><input id="c-<?= (int) $p['id'] ?>" name="courier" maxlength="60"></div>
      <div class="field"><label class="small" for="t-<?= (int) $p['id'] ?>"><?= __('orders.tracking') ?></label><input id="t-<?= (int) $p['id'] ?>" name="tracking" maxlength="80"></div>
      <div class="field"><label class="small" for="r-<?= (int) $p['id'] ?>"><?= __('common.reason') ?></label><select id="r-<?= (int) $p['id'] ?>" name="reason"><?php foreach (['out_of_stock', 'cannot_deliver', 'buyer_request', 'fraud_suspected', 'other'] as $r): ?><option value="<?= $r ?>"><?= e(reason_label($r)) ?></option><?php endforeach; ?></select></div>
      <button class="btn btn-outline" type="submit"><?= __('common.update') ?></button>
    </form>
  </details>
  <?php endif; ?>
</section>
<?php endforeach; ?>

<div class="grid-2">
  <?php if (can('refunds.manage') && in_array($o['payment_status'], ['paid', 'partially_refunded'], true)): ?>
  <section class="card">
    <h2 class="h3"><?= __('admin.newRefund') ?></h2>
    <form method="post" action="<?= e(url('admin/orders/' . $o['number'] . '/refunds')) ?>">
      <?= csrf_field() ?>
      <?= form_input('amount', t('seller.amount'), ['required' => true, 'attrs' => ['inputmode' => 'decimal']]) ?>
      <?= form_select('seller_order_id', t('admin.parcel'), ['' => t('admin.wholeOrder')] + array_column(array_map(static fn ($p) => ['id' => (string) $p['id'], 'l' => $p['number'] . ' · ' . $p['store_name']], $parcels), 'l', 'id')) ?>
      <?= form_input('reason', t('common.reason'), ['required' => true, 'attrs' => ['maxlength' => 200]]) ?>
      <?= submit_button(t('admin.createRefund'), 'btn btn-outline') ?>
    </form>
  </section>
  <?php endif; ?>
  <?php if (!in_array($o['status'], ['cancelled', 'completed'], true)): ?>
  <section class="card">
    <h2 class="h3"><?= __('orders.cancelTitle') ?></h2>
    <p class="small muted"><?= __('admin.cancelHint') ?></p>
    <form method="post" action="<?= e(url('admin/orders/' . $o['number'] . '/cancel')) ?>" class="row" data-confirm="<?= __('orders.cancelConfirm') ?>">
      <?= csrf_field() ?>
      <label class="sr-only" for="acr"><?= __('common.reason') ?></label>
      <select id="acr" name="reason" class="grow"><?php foreach (['buyer_request', 'out_of_stock', 'cannot_deliver', 'fraud_suspected', 'other'] as $r): ?><option value="<?= $r ?>"><?= e(reason_label($r)) ?></option><?php endforeach; ?></select>
      <button class="btn btn-danger-outline" type="submit"><?= __('orders.cancelButton') ?></button>
    </form>
  </section>
  <?php endif; ?>
</div>

<?php if ($refunds): ?>
<section class="card"><h2 class="h3"><?= __('orders.refunds') ?></h2>
  <ul class="timeline"><?php foreach ($refunds as $r): ?><li><strong><?= e(money($r['amount'])) ?></strong> — <?= e(status_label('refund', $r['status'])) ?> · <?= e(reason_label($r['reason'])) ?> <span class="small subtle"><?= e(fdate($r['created_at'])) ?></span><?php if ($r['reference'] || $r['provider_refund_id']): ?> <span class="small mono"><?= e((string) ($r['reference'] ?: $r['provider_refund_id'])) ?></span><?php endif; ?></li><?php endforeach; ?></ul>
  <p class="mb-0"><a href="<?= e(url('admin/refunds')) ?>"><?= __('admin.refunds') ?></a></p>
</section>
<?php endif; ?>
<section class="card"><h2 class="h3"><?= __('orders.history') ?></h2>
  <ul class="timeline"><?php foreach (array_reverse($events) as $ev): ?><li><strong><?= __('orders.events.' . $ev['type']) ?></strong> <span class="small subtle"><?= e(fdate($ev['created_at'], 'datetime')) ?><?= $ev['actor'] ? ' · ' . e($ev['actor']) : '' ?></span><?php if ($ev['note']): ?><br><span class="small muted"><?= e($ev['note']) ?></span><?php endif; ?></li><?php endforeach; ?></ul>
</section>
