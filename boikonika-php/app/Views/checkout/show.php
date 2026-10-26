<?php
use App\Core\Money;
use App\Services\Geo;

$q = $quote;
$showNew = !$addresses || isset($_GET['new']);
?>
<div class="container">
  <div class="page-head"><h1><?= __('checkout.title') ?></h1></div>
  <div class="cart-layout mt-2">
    <form id="checkout" method="post" action="<?= e(url('checkout')) ?>" data-once>
      <?= csrf_field() ?>
      <input type="hidden" name="key" value="<?= e($key) ?>">
      <input type="hidden" name="expected_total" value="<?= (int) $q['total'] ?>">
      <button type="submit" id="refresh" class="hidden" formaction="<?= e(url('checkout/refresh')) ?>" formnovalidate tabindex="-1" aria-hidden="true"></button>

      <section class="card" aria-labelledby="addr-h">
        <h2 id="addr-h"><?= icon('map-pin') ?> <?= __('checkout.address') ?></h2>
        <?php if ($addresses): ?>
        <div class="choice-list" role="radiogroup" aria-labelledby="addr-h">
          <?php foreach ($addresses as $a): ?>
          <label class="choice">
            <input type="radio" name="address_id" value="<?= (int) $a['id'] ?>"<?= checked((int) $a['id'] === (int) ($address['id'] ?? 0)) ?> data-refresh>
            <span class="choice-body">
              <strong><?= e($a['name']) ?></strong><?php if ($a['label']): ?> <span class="badge"><?= e($a['label']) ?></span><?php endif; ?>
              <span class="small muted"><?= e($a['address_line']) ?>, <?= e($a['area']) ?>, <?= e(Geo::districtName($a['district'])) ?> · <?= e(digits($a['phone'])) ?></span>
            </span>
          </label>
          <?php endforeach; ?>
        </div>
        <?php endif; ?>
        <details class="disclosure mt-2"<?= $showNew ? ' open' : '' ?>>
          <summary><?= __('checkout.addAddress') ?></summary>
          <p class="small muted"><?= __('checkout.addressHint') ?></p>
          <div class="grid-2">
            <?= form_input('name', t('addresses.name'), ['value' => $addresses ? '' : (auth_user()['name'] ?? ''), 'autocomplete' => 'name', 'attrs' => ['form' => 'addr-form']]) ?>
            <?= form_input('phone', t('addresses.phone'), ['type' => 'tel', 'value' => $addresses ? '' : (auth_user()['phone'] ?? ''), 'autocomplete' => 'tel', 'attrs' => ['form' => 'addr-form', 'inputmode' => 'tel']]) ?>
          </div>
          <?= form_select('district', t('addresses.district'), $districts, ['placeholder' => t('common.select'), 'attrs' => ['form' => 'addr-form']]) ?>
          <div class="grid-2">
            <?= form_input('area', t('addresses.area'), ['hint' => t('addresses.areaHint'), 'attrs' => ['form' => 'addr-form']]) ?>
            <?= form_input('postcode', t('addresses.postcode'), ['optional' => true, 'attrs' => ['form' => 'addr-form', 'inputmode' => 'numeric']]) ?>
          </div>
          <?= form_input('address_line', t('addresses.line'), ['hint' => t('addresses.lineHint'), 'autocomplete' => 'street-address', 'attrs' => ['form' => 'addr-form']]) ?>
          <?= form_input('label', t('addresses.label'), ['optional' => true, 'hint' => t('addresses.labelHint'), 'attrs' => ['form' => 'addr-form']]) ?>
          <button class="btn btn-outline" type="submit" form="addr-form"><?= __('addresses.save') ?></button>
        </details>
      </section>

      <section class="card" aria-labelledby="ship-h">
        <h2 id="ship-h"><?= icon('truck') ?> <?= __('checkout.delivery') ?></h2>
        <div class="choice-list">
          <?php foreach ($methods as $m): ?>
          <label class="choice">
            <input type="radio" name="shipping_method_id" value="<?= (int) $m['id'] ?>"<?= checked((int) $m['id'] === (int) ($method['id'] ?? 0)) ?> data-refresh>
            <span class="choice-body">
              <strong><?= e(lf($m, 'name')) ?></strong> <span class="small muted">· <?= e(t('checkout.days', ['min' => num((int) $m['min_days']), 'max' => num((int) $m['max_days'])])) ?></span>
              <span class="small muted block"><?= e(t('checkout.fees', ['inside' => money($m['inside_dhaka_fee']), 'outside' => money($m['outside_dhaka_fee'])])) ?><?php if ($m['free_threshold'] !== null): ?> · <?= e(t('checkout.freeAbove', ['amount' => money($m['free_threshold'])])) ?><?php endif; ?></span>
            </span>
          </label>
          <?php endforeach; ?>
        </div>
        <?php if (count($q['groups']) > 1): ?><p class="small muted mt-1 mb-0"><?= icon('info', 'icon icon-sm') ?> <?= __('checkout.perSeller') ?></p><?php endif; ?>
      </section>

      <section class="card" aria-labelledby="pay-h">
        <h2 id="pay-h"><?= icon('wallet') ?> <?= __('checkout.payment') ?></h2>
        <div class="choice-list">
          <?php foreach ($payments as $k => $pm): ?>
          <label class="choice">
            <input type="radio" name="payment_method" value="<?= e($k) ?>"<?= checked($k === $selectedPm) ?><?= $pm['available'] ? '' : ' disabled' ?> data-refresh>
            <span class="choice-body">
              <strong><?= __('status.method.' . $k) ?></strong>
              <span class="small muted block"><?= $pm['available'] ? __('checkout.hint.' . $k) : e(t($pm['reason'] ?? 'checkout.methodOff', ['max' => money(setting('orders.cod_max'))])) ?></span>
            </span>
          </label>
          <?php endforeach; ?>
        </div>
        <?php if ($selectedPm === ''): ?><p class="alert alert-warning mt-2"><?= icon('alert') ?> <?= __('checkout.noMethods') ?></p><?php endif; ?>
      </section>

      <section class="card" aria-labelledby="items-h">
        <h2 id="items-h"><?= icon('package') ?> <?= e(tn('cart.parcels', count($q['groups']))) ?></h2>
        <?php foreach ($q['groups'] as $g): ?>
          <div class="seller-group">
            <div class="seller-group-head"><strong><?= e($g['store_name']) ?></strong><span class="small"><?= __('common.shipping') ?>: <?= $g['shipping'] === 0 ? '<span class="text-success">' . __('common.free') . '</span>' : e(money($g['shipping'])) ?></span></div>
            <?php foreach ($g['lines'] as $l): ?>
              <div class="row-between small mt-1"><span><?= e($l['title']) ?> × <?= e(num((int) $l['quantity'])) ?> <span class="subtle">(<?= __('status.condition.' . $l['item_condition']) ?>)</span></span><span><?= e(money($l['line_total'])) ?></span></div>
            <?php endforeach; ?>
          </div>
        <?php endforeach; ?>
        <?= form_textarea('note', t('checkout.note'), ['value' => $note, 'optional' => true, 'rows' => 2, 'hint' => t('checkout.noteHint'), 'attrs' => ['maxlength' => 500]]) ?>
      </section>
    </form>
    <form id="addr-form" method="post" action="<?= e(url('checkout/address')) ?>" class="hidden"><?= csrf_field() ?><input type="hidden" name="return" value="checkout"></form>

    <aside class="card summary" aria-labelledby="sum-h">
      <h2 id="sum-h"><?= __('cart.summary') ?></h2>
      <div class="field">
        <label for="coupon"><?= __('checkout.coupon') ?></label>
        <div class="row">
          <input id="coupon" class="grow" type="text" name="coupon" form="checkout" value="<?= e($coupon) ?>" autocomplete="off" maxlength="40"<?= $q['coupon_error'] ? ' aria-invalid="true" aria-describedby="coupon-err"' : '' ?>>
          <button class="btn btn-outline" type="submit" form="checkout" formaction="<?= e(url('checkout/refresh')) ?>" formnovalidate><?= __('common.apply') ?></button>
        </div>
        <?php if ($q['coupon_error']): ?><p class="error" id="coupon-err"><?= icon('alert', 'icon icon-sm') ?><span><?= e(t($q['coupon_error'])) ?></span></p>
        <?php elseif ($q['coupon']): ?><p class="small text-success mt-1"><?= icon('check', 'icon icon-sm') ?> <?= e(t('checkout.couponApplied', ['code' => $q['coupon']['code']])) ?></p><?php endif; ?>
      </div>
      <dl>
        <dt><?= e(tn('common.items', $q['items'])) ?></dt><dd><?= e(money($q['subtotal'])) ?></dd>
        <dt><?= __('common.shipping') ?><?= $address ? '' : ' <span class="small muted">(' . __('checkout.chooseAddressFirst') . ')</span>' ?></dt><dd><?= $q['shipping'] === 0 && $address ? '<span class="text-success">' . __('common.free') . '</span>' : e(money($q['shipping'])) ?></dd>
        <?php if ($q['discount'] > 0): ?><dt><?= __('common.discount') ?></dt><dd class="text-success">−<?= e(money($q['discount'])) ?></dd><?php endif; ?>
        <dt class="grand"><?= __('common.total') ?></dt><dd class="grand"><?= e(money($q['total'])) ?></dd>
      </dl>
      <?= form_check('agree', '', false, ['html' => e(t('checkout.agree')) . ' <a href="' . e(url('pages/terms')) . '" target="_blank">' . __('checkout.terms') . '</a>, <a href="' . e(url('pages/return-policy')) . '" target="_blank">' . __('checkout.returns') . '</a>', 'attrs' => ['form' => 'checkout', 'required' => true]]) ?>
      <button class="btn btn-primary btn-block btn-lg" type="submit" form="checkout" data-busy="<?= __('checkout.placing') ?>"<?= $address && $method && $selectedPm !== '' ? '' : ' disabled' ?>><?= $selectedPm === 'cod' ? __('checkout.placeOrder') : __('checkout.placeAndPay') ?></button>
      <p class="small muted mt-2 mb-0"><?= icon('lock', 'icon icon-sm') ?> <?= __('checkout.noCardStored') ?></p>
    </aside>
  </div>
</div>
