<?php
use App\Core\Money;
use App\Services\Geo;
use App\Services\Orders;

$o = $order;
$badge = ['awaiting_payment' => 'badge-warning', 'placed' => 'badge-primary', 'completed' => 'badge-success', 'cancelled' => 'badge-danger'][$o['status']] ?? '';
$steps = Orders::STEPS;
$resultType = ['success' => 'success', 'failed' => 'error', 'cancelled' => 'warning', 'retry' => 'info', 'check' => 'info'];
?>
<p class="small mb-1"><a href="<?= e(url('account/orders')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('nav.orders') ?></a></p>
<div class="row-between mb-2">
  <div>
    <h1 class="mb-0"><?= e(t('orders.orderTitle', ['number' => $o['number']])) ?></h1>
    <p class="muted mb-0"><?= e(t('orders.placedOn', ['date' => fdate($o['created_at'], 'datetime')])) ?></p>
  </div>
  <div class="row"><span class="badge <?= $badge ?>"><?= e(status_label('order', $o['status'])) ?></span><span class="badge"><?= e(status_label('payment', $o['payment_status'])) ?></span></div>
</div>

<?php if ($paymentResult): ?>
  <div class="alert alert-<?= $resultType[$paymentResult] ?>" role="status"><?= icon($paymentResult === 'success' ? 'check-circle' : 'info') ?><div><?= __('payment.result.' . $paymentResult) ?></div></div>
<?php endif; ?>

<?php if ($o['status'] === 'awaiting_payment'): ?>
  <section class="card">
    <h2><?= __('orders.paymentNeeded') ?></h2>
    <p class="muted"><?= e(t('payment.dueBy', ['time' => fdate($o['payment_due_at'], 'datetime')])) ?></p>
    <form method="post" action="<?= e(url('orders/' . $o['number'] . '/pay')) ?>" data-once>
      <?= csrf_field() ?>
      <button class="btn btn-primary btn-lg" type="submit" data-busy="<?= __('checkout.placing') ?>"><?= e(t('payment.payNow', ['amount' => money($o['total'])])) ?> · <?= __('status.method.' . $o['payment_method']) ?></button>
    </form>
  </section>
<?php endif; ?>

<?php foreach ($parcels as $p): $stepIndex = array_search($p['status'], $steps, true); ?>
<section class="card" aria-labelledby="parcel-<?= (int) $p['id'] ?>">
  <div class="card-head">
    <div>
      <h2 id="parcel-<?= (int) $p['id'] ?>" class="h3 mb-0"><?= icon('package') ?> <?= e(t('orders.parcelFrom', ['store' => $p['store_name']])) ?></h2>
      <p class="small muted mb-0 mono"><?= e($p['number']) ?></p>
    </div>
    <span class="badge <?= in_array($p['status'], ['cancelled', 'returned'], true) ? 'badge-danger' : ($p['status'] === 'delivered' ? 'badge-success' : 'badge-primary') ?>"><?= e(status_label('parcel', $p['status'])) ?></span>
  </div>
  <?php if ($stepIndex !== false): ?>
    <div class="progress-track" aria-hidden="true"><?php foreach ($steps as $i => $s): ?><span class="<?= $i <= $stepIndex ? 'done' : '' ?>"></span><?php endforeach; ?></div>
    <div class="progress-labels" aria-hidden="true"><?php foreach ($steps as $s): ?><span><?= e(status_label('parcel', $s)) ?></span><?php endforeach; ?></div>
  <?php endif; ?>
  <?php if ($p['courier']): ?><p class="small mt-2"><?= icon('truck', 'icon icon-sm') ?> <?= e(t('orders.shippedWith', ['courier' => $p['courier']])) ?><?php if ($p['tracking_number']): ?> · <?= __('orders.tracking') ?>: <span class="mono"><?= e($p['tracking_number']) ?></span><?php endif; ?></p><?php endif; ?>
  <?php if ($p['cancel_reason'] && $p['status'] === 'cancelled'): ?><p class="small text-danger"><?= e(t('orders.cancelReason', ['reason' => reason_label($p['cancel_reason'])])) ?></p><?php endif; ?>
  <?php foreach ($p['items'] as $i): ?>
    <div class="line-item">
      <div class="thumb"><?php if ($i['cover_path']): ?><img src="<?= e(upload_url($i['cover_path'])) ?>" alt=""><?php else: ?><div class="cover-placeholder"><?= e(mb_substr($i['title'], 0, 20)) ?></div><?php endif; ?></div>
      <div>
        <div class="row-between"><strong><?php if ($i['slug']): ?><a href="<?= e(url(($i['type'] === 'general' ? 'products/' : 'books/') . $i['slug'])) ?>"><?= e($i['title']) ?></a><?php else: ?><?= e($i['title']) ?><?php endif; ?></strong><span><?= e(money($i['line_total'])) ?></span></div>
        <p class="small muted mb-0"><?= __('status.condition.' . $i['item_condition']) ?> · <?= e(num((int) $i['quantity'])) ?> × <?= e(money($i['unit_price'])) ?></p>
        <?php if ($p['status'] === 'delivered' && $i['slug'] && $i['product_id'] && !in_array((int) $i['product_id'], $reviewed, true)): ?><a class="small" href="<?= e(url('books/' . $i['slug']) . '#reviews') ?>"><?= icon('star', 'icon icon-sm') ?> <?= __('orders.writeReview') ?></a><?php endif; ?>
      </div>
    </div>
  <?php endforeach; ?>
  <?php if ($p['return']): ?>
    <div class="alert alert-info mt-2"><?= icon('undo') ?><div><strong><?= __('orders.returnStatus') ?>:</strong> <?= e(status_label('return', $p['return']['status'])) ?><?php if ($p['return']['response_note']): ?><br><span class="small"><?= e($p['return']['response_note']) ?></span><?php endif; ?></div></div>
  <?php endif; ?>
  <?php if (Orders::returnWindowOpen($p) && (!$p['return'] || in_array($p['return']['status'], ['rejected', 'cancelled'], true))): ?>
  <details class="disclosure mt-2">
    <summary><?= __('orders.requestReturn') ?></summary>
    <form method="post" action="<?= e(url('account/orders/' . $o['number'] . '/parcels/' . $p['id'] . '/return')) ?>" class="form">
      <?= csrf_field() ?>
      <p class="small muted"><?= e(t('orders.returnHint', ['days' => num((int) setting('orders.return_window_days'))])) ?></p>
      <?= form_select('reason', t('common.reason'), ['damaged' => t('orders.returnReasons.damaged'), 'wrong_item' => t('orders.returnReasons.wrong_item'), 'not_as_described' => t('orders.returnReasons.not_as_described'), 'missing_parts' => t('orders.returnReasons.missing_parts'), 'other' => t('orders.returnReasons.other')], ['required' => true]) ?>
      <?= form_textarea('details', t('orders.returnDetails'), ['required' => true, 'rows' => 3, 'attrs' => ['maxlength' => 1000]]) ?>
      <?= submit_button(t('orders.sendReturn'), 'btn btn-outline') ?>
    </form>
  </details>
  <?php endif; ?>
</section>
<?php endforeach; ?>

<div class="grid-2">
  <section class="card">
    <h2 class="h3"><?= __('orders.deliveryAddress') ?></h2>
    <p class="mb-0"><strong><?= e($o['ship_name']) ?></strong><br><?= e(digits($o['ship_phone'])) ?><br><?= e($o['ship_address']) ?>, <?= e($o['ship_area']) ?><br><?= e(Geo::districtName($o['ship_district'])) ?>, <?= e(Geo::divisionName($o['ship_division'])) ?><?= $o['ship_postcode'] ? ' ' . e(digits($o['ship_postcode'])) : '' ?></p>
    <p class="small muted mt-1 mb-0"><?= e($o['shipping_method_name']) ?></p>
    <?php if ($o['note']): ?><p class="small mt-1 mb-0"><?= __('common.note') ?>: <?= e($o['note']) ?></p><?php endif; ?>
  </section>
  <section class="card summary">
    <h2 class="h3"><?= __('orders.paymentSummary') ?></h2>
    <dl>
      <dt><?= __('common.subtotal') ?></dt><dd><?= e(money($o['subtotal'])) ?></dd>
      <dt><?= __('common.shipping') ?></dt><dd><?= Money::toPoisha($o['shipping_total']) === 0 ? __('common.free') : e(money($o['shipping_total'])) ?></dd>
      <?php if (Money::toPoisha($o['discount_total']) > 0): ?><dt><?= __('common.discount') ?><?= $o['coupon_code'] ? ' (' . e($o['coupon_code']) . ')' : '' ?></dt><dd>−<?= e(money($o['discount_total'])) ?></dd><?php endif; ?>
      <dt class="grand"><?= __('common.total') ?></dt><dd class="grand"><?= e(money($o['total'])) ?></dd>
      <?php if (Money::toPoisha($o['refunded_total']) > 0): ?><dt><?= __('orders.refunded') ?></dt><dd class="text-success"><?= e(money($o['refunded_total'])) ?></dd><?php endif; ?>
    </dl>
    <p class="small muted mb-0"><?= __('status.method.' . $o['payment_method']) ?> · <?= e(status_label('payment', $o['payment_status'])) ?></p>
  </section>
</div>

<?php if ($refunds): ?>
<section class="card">
  <h2 class="h3"><?= __('orders.refunds') ?></h2>
  <ul class="timeline"><?php foreach ($refunds as $r): ?><li><strong><?= e(money($r['amount'])) ?></strong> — <?= e(status_label('refund', $r['status'])) ?> <span class="small subtle"><?= e(fdate($r['created_at'])) ?></span></li><?php endforeach; ?></ul>
</section>
<?php endif; ?>

<section class="card">
  <h2 class="h3"><?= __('orders.history') ?></h2>
  <ul class="timeline">
    <?php foreach (array_reverse($events) as $ev): ?>
      <li><strong><?= __('orders.events.' . $ev['type']) ?></strong> <span class="small subtle"><?= e(fdate($ev['created_at'], 'datetime')) ?></span><?php if ($ev['type'] === 'shipped' && $ev['note']): ?><br><span class="small muted"><?= e($ev['note']) ?></span><?php endif; ?></li>
    <?php endforeach; ?>
  </ul>
</section>

<?php if ($canCancel): ?>
<section class="card">
  <h2 class="h3"><?= __('orders.cancelTitle') ?></h2>
  <p class="small muted"><?= in_array($o['payment_status'], ['paid', 'partially_refunded'], true) ? __('orders.cancelPaidHint') : __('orders.cancelHint') ?></p>
  <form method="post" action="<?= e(url('account/orders/' . $o['number'] . '/cancel')) ?>" data-confirm="<?= __('orders.cancelConfirm') ?>" class="row">
    <?= csrf_field() ?>
    <label class="sr-only" for="cancel-reason"><?= __('common.reason') ?></label>
    <select id="cancel-reason" name="reason" class="grow">
      <?php foreach (['changed_mind', 'found_cheaper', 'ordered_by_mistake', 'delivery_too_slow', 'other'] as $r): ?><option value="<?= $r ?>"><?= __('orders.reasons.' . $r) ?></option><?php endforeach; ?>
    </select>
    <button class="btn btn-danger-outline" type="submit"><?= __('orders.cancelButton') ?></button>
  </form>
</section>
<?php endif; ?>
<p class="small muted"><?= __('orders.help') ?> <a href="<?= e(url('contact', ['order' => $o['number']])) ?>"><?= __('nav.contact') ?></a></p>
