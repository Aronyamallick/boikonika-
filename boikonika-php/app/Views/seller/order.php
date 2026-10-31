<?php use App\Services\Geo; ?>
<p class="small mb-1"><a href="<?= e(url('seller/orders')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('seller.orders') ?></a></p>
<div class="row-between mb-2">
  <div><h1 class="mb-0"><?= e(t('seller.parcelTitle', ['number' => $p['number']])) ?></h1><p class="muted mb-0"><?= e(fdate($p['created_at'], 'datetime')) ?></p></div>
  <span class="badge badge-primary"><?= e(status_label('parcel', $p['status'])) ?></span>
</div>
<?php if ($collect !== null): ?><div class="alert alert-warning"><?= icon('banknote') ?><div><?= e(t('seller.collectCash', ['amount' => money($collect)])) ?></div></div><?php endif; ?>

<?php if ($next): ?>
<section class="card">
  <h2 class="h3"><?= __('seller.nextStep') ?></h2>
  <div class="stack">
  <?php foreach ($next as $to): if ($to === 'cancelled') { continue; } ?>
    <form method="post" action="<?= e(url('seller/orders/' . $p['number'] . '/status')) ?>" class="row" data-once>
      <?= csrf_field() ?>
      <input type="hidden" name="to" value="<?= e($to) ?>">
      <?php if ($to === 'shipped'): ?>
        <div class="field grow mb-0"><label for="courier"><?= __('seller.courier') ?></label><input id="courier" name="courier" required list="couriers" value="<?= e(old('courier')) ?>" maxlength="60"></div>
        <datalist id="couriers"><option value="Pathao"><option value="Steadfast"><option value="RedX"><option value="Paperfly"><option value="eCourier"><option value="Sundarban Courier"><option value="SA Paribahan"><option value="Janani Express"></datalist>
        <div class="field grow mb-0"><label for="tracking"><?= __('orders.tracking') ?></label><input id="tracking" name="tracking" value="<?= e(old('tracking')) ?>" maxlength="80"></div>
      <?php endif; ?>
      <button class="btn btn-primary" type="submit"><?= __('seller.markAs.' . $to) ?></button>
    </form>
  <?php endforeach; ?>
  </div>
  <?php if (in_array('cancelled', $next, true)): ?>
  <details class="disclosure mt-2">
    <summary><?= __('seller.cancelParcel') ?></summary>
    <form method="post" action="<?= e(url('seller/orders/' . $p['number'] . '/cancel')) ?>" class="row" data-confirm="<?= __('common.areYouSure') ?>">
      <?= csrf_field() ?>
      <label class="sr-only" for="creason"><?= __('common.reason') ?></label>
      <select id="creason" name="reason" class="grow"><?php foreach (['out_of_stock', 'cannot_deliver', 'buyer_request', 'other'] as $r): ?><option value="<?= $r ?>"><?= e(reason_label($r)) ?></option><?php endforeach; ?></select>
      <button class="btn btn-danger-outline" type="submit"><?= __('seller.cancelParcel') ?></button>
    </form>
    <p class="small muted mt-1"><?= __('seller.cancelHint') ?></p>
  </details>
  <?php endif; ?>
</section>
<?php endif; ?>

<?php if ($return && in_array($return['status'], ['requested', 'approved'], true)): ?>
<section class="card">
  <h2 class="h3"><?= icon('undo') ?> <?= __('seller.returnRequest') ?> — <?= e(status_label('return', $return['status'])) ?></h2>
  <p><strong><?= __('orders.returnReasons.' . $return['reason']) ?></strong><br><?= nl2br(e((string) $return['details'])) ?></p>
  <form method="post" action="<?= e(url('seller/returns/' . $return['id'])) ?>" class="form">
    <?= csrf_field() ?>
    <?= form_textarea('note', t('seller.returnNote'), ['rows' => 2, 'optional' => true, 'hint' => t('seller.returnNoteHint')]) ?>
    <?php if ($return['status'] === 'approved'): ?><label class="check mb-2"><input type="checkbox" name="restock" value="1" checked><span><?= __('seller.restock') ?></span></label><?php endif; ?>
    <div class="row">
      <?php if ($return['status'] === 'requested'): ?><button class="btn btn-primary" type="submit" name="action" value="approve"><?= __('seller.approveReturn') ?></button><?php endif; ?>
      <?php if ($return['status'] === 'approved'): ?><button class="btn btn-primary" type="submit" name="action" value="received"><?= __('seller.markReceived') ?></button><?php endif; ?>
      <button class="btn btn-danger-outline" type="submit" name="action" value="reject"><?= __('seller.rejectReturn') ?></button>
    </div>
  </form>
</section>
<?php endif; ?>

<div class="grid-2">
  <section class="card">
    <h2 class="h3"><?= __('seller.shipTo') ?></h2>
    <p class="mb-0"><strong><?= e($p['ship_name']) ?></strong><br><a href="tel:<?= e($p['ship_phone']) ?>"><?= e(digits($p['ship_phone'])) ?></a><br><?= e($p['ship_address']) ?>, <?= e($p['ship_area']) ?><br><?= e(Geo::districtName($p['ship_district'])) ?><?= $p['ship_postcode'] ? ' ' . e(digits($p['ship_postcode'])) : '' ?></p>
    <p class="small muted mt-1 mb-0"><?= e($p['shipping_method_name']) ?></p>
    <?php if ($p['note']): ?><p class="small mt-1 mb-0"><strong><?= __('common.note') ?>:</strong> <?= e($p['note']) ?></p><?php endif; ?>
  </section>
  <section class="card summary">
    <h2 class="h3"><?= __('seller.money') ?></h2>
    <dl>
      <dt><?= __('common.subtotal') ?></dt><dd><?= e(money($p['subtotal'])) ?></dd>
      <dt><?= __('common.shipping') ?></dt><dd><?= e(money($p['shipping_fee'])) ?></dd>
      <dt><?= e(t('seller.commission', ['percent' => num((string) (float) $p['commission_percent'])])) ?></dt><dd>−<?= e(money($p['commission_amount'])) ?></dd>
      <dt class="grand"><?= __('seller.earning') ?></dt><dd class="grand"><?= e(money($p['seller_earning'])) ?></dd>
    </dl>
    <p class="small muted mb-0"><?= __('status.method.' . $p['payment_method']) ?> · <?= e(status_label('payment', $p['payment_status'])) ?><?php if (\App\Core\Money::toPoisha($p['discount']) > 0): ?> · <?= e(t('seller.discountByPlatform', ['amount' => money($p['discount'])])) ?><?php endif; ?></p>
  </section>
</div>
<section class="card">
  <h2 class="h3"><?= __('seller.items') ?></h2>
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('seller.item') ?></th><th><?= __('catalog.condition') ?></th><th class="num"><?= __('common.quantity') ?></th><th class="num"><?= __('common.price') ?></th><th class="num"><?= __('common.total') ?></th></tr></thead>
    <tbody><?php foreach ($items as $i): ?><tr><td><?= e($i['title']) ?><?php if ($i['sku']): ?><br><span class="small subtle mono"><?= e($i['sku']) ?></span><?php endif; ?></td><td class="small"><?= __('status.condition.' . $i['item_condition']) ?></td><td class="num"><?= e(num((int) $i['quantity'])) ?></td><td class="num"><?= e(money($i['unit_price'])) ?></td><td class="num"><?= e(money($i['line_total'])) ?></td></tr><?php endforeach; ?></tbody>
  </table></div>
</section>
<section class="card">
  <h2 class="h3"><?= __('orders.history') ?></h2>
  <ul class="timeline"><?php foreach (array_reverse($events) as $ev): ?><li><strong><?= __('orders.events.' . $ev['type']) ?></strong> <span class="small subtle"><?= e(fdate($ev['created_at'], 'datetime')) ?></span><?php if ($ev['note'] && in_array($ev['type'], ['shipped', 'return_rejected', 'return_approved'], true)): ?><br><span class="small muted"><?= e($ev['note']) ?></span><?php endif; ?></li><?php endforeach; ?></ul>
</section>
