<?php
use App\Core\Crypto;

$b = $balance;
$methods = ['bkash' => t('status.payoutMethod.bkash'), 'nagad' => t('status.payoutMethod.nagad'), 'rocket' => t('status.payoutMethod.rocket'), 'bank' => t('status.payoutMethod.bank')];
$accountOptions = [];
foreach ($accounts as $a) {
    $accountOptions[(string) $a['id']] = t('status.payoutMethod.' . $a['method']) . ' ' . Crypto::mask($a['account_last4']) . ' — ' . $a['account_name'];
}
?>
<h1><?= __('seller.payouts') ?></h1>
<div class="stats">
  <div class="stat"><p class="label"><?= __('seller.withdrawable') ?></p><p class="value"><?= e(money($b['withdrawable'])) ?></p></div>
  <div class="stat"><p class="label"><?= __('seller.inReturnWindow') ?></p><p class="value"><?= e(money($b['pending'])) ?></p><p class="hint"><?= e(t('seller.returnWindowHint', ['days' => num($days)])) ?></p></div>
  <div class="stat"><p class="label"><?= __('seller.inProgress') ?></p><p class="value"><?= e(money($b['upcoming'])) ?></p><p class="hint"><?= __('seller.inProgressHint') ?></p></div>
  <div class="stat"><p class="label"><?= __('seller.paidOut') ?></p><p class="value"><?= e(money($b['paid'])) ?></p></div>
</div>
<div class="grid-2">
  <section class="card">
    <h2 class="h3"><?= __('seller.requestPayout') ?></h2>
    <?php if (!$accounts): ?><p class="muted"><?= __('seller.addAccountFirst') ?></p><?php else: ?>
    <form method="post" action="<?= e(url('seller/payouts')) ?>" data-once>
      <?= csrf_field() ?>
      <?= form_select('account_id', t('seller.payTo'), $accountOptions, ['required' => true]) ?>
      <?= form_input('amount', t('seller.amount'), ['value' => \App\Core\Money::toDecimal($b['withdrawable']), 'required' => true, 'hint' => t('seller.minPayout', ['min' => money($min)]), 'attrs' => ['inputmode' => 'decimal']]) ?>
      <?= submit_button(t('seller.requestPayout'), 'btn btn-primary', $b['withdrawable'] > 0 ? [] : ['disabled' => true]) ?>
    </form>
    <?php endif; ?>
  </section>
  <section class="card">
    <h2 class="h3"><?= __('seller.payoutAccounts') ?></h2>
    <?php foreach ($accounts as $a): ?>
      <div class="row-between mb-1"><span><?= e(t('status.payoutMethod.' . $a['method'])) ?> <span class="mono"><?= e(Crypto::mask($a['account_last4'])) ?></span> — <?= e($a['account_name']) ?><?= $a['bank_name'] ? ' · ' . e($a['bank_name']) : '' ?></span>
        <form method="post" action="<?= e(url('seller/payouts/accounts/' . $a['id'] . '/delete')) ?>" data-confirm="<?= __('common.areYouSure') ?>"><?= csrf_field() ?><button class="link-btn danger small" type="submit"><?= __('common.remove') ?></button></form></div>
    <?php endforeach; ?>
    <details class="disclosure mt-2"<?= $accounts ? '' : ' open' ?>>
      <summary><?= __('seller.addAccount') ?></summary>
      <form method="post" action="<?= e(url('seller/payouts/accounts')) ?>">
        <?= csrf_field() ?>
        <?= form_select('method', t('seller.method'), $methods, ['required' => true]) ?>
        <?= form_input('account_name', t('seller.accountName'), ['required' => true]) ?>
        <?= form_input('account_number', t('seller.accountNumber'), ['required' => true, 'hint' => t('seller.accountNumberHint'), 'attrs' => ['autocomplete' => 'off', 'inputmode' => 'numeric']]) ?>
        <?= form_input('bank_name', t('seller.bankName'), ['optional' => true, 'hint' => t('seller.bankOnly')]) ?>
        <div class="grid-2"><?= form_input('branch', t('seller.branch'), ['optional' => true]) ?><?= form_input('routing_number', t('seller.routing'), ['optional' => true]) ?></div>
        <p class="small muted"><?= icon('lock', 'icon icon-sm') ?> <?= __('seller.accountPrivacy') ?></p>
        <?= submit_button(t('common.save'), 'btn btn-outline') ?>
      </form>
    </details>
  </section>
</div>
<section class="card">
  <h2 class="h3"><?= __('seller.payoutHistory') ?></h2>
  <?php if (!$payouts): ?><p class="muted mb-0"><?= __('seller.noPayouts') ?></p><?php else: ?>
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('common.date') ?></th><th><?= __('seller.payTo') ?></th><th><?= __('common.status') ?></th><th><?= __('seller.reference') ?></th><th class="num"><?= __('seller.amount') ?></th></tr></thead>
    <tbody><?php foreach ($payouts as $po): ?><tr><td class="small nowrap"><?= e(fdate($po['requested_at'])) ?></td><td class="small"><?= e($po['method_snapshot']) ?></td><td><span class="badge<?= $po['status'] === 'paid' ? ' badge-success' : ($po['status'] === 'rejected' ? ' badge-danger' : '') ?>"><?= e(status_label('payout', $po['status'])) ?></span><?php if ($po['note']): ?><br><span class="small muted"><?= e($po['note']) ?></span><?php endif; ?></td><td class="small mono"><?= e((string) $po['reference']) ?></td><td class="num"><?= e(money($po['amount'])) ?></td></tr><?php endforeach; ?></tbody>
  </table></div>
  <?php endif; ?>
</section>
<section class="card">
  <h2 class="h3"><?= __('seller.recentEarnings') ?></h2>
  <?php if (!$earnings): ?><p class="muted mb-0"><?= __('seller.noEarnings') ?></p><?php else: ?>
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('orders.number') ?></th><th><?= __('status.parcel.delivered') ?></th><th class="num"><?= __('common.subtotal') ?></th><th class="num"><?= __('common.shipping') ?></th><th class="num"><?= __('seller.commissionShort') ?></th><th class="num"><?= __('seller.earning') ?></th></tr></thead>
    <tbody><?php foreach ($earnings as $er): ?><tr><td class="mono small"><a href="<?= e(url('seller/orders/' . $er['number'])) ?>"><?= e($er['number']) ?></a></td><td class="small"><?= e(fdate($er['delivered_at'])) ?></td><td class="num"><?= e(money($er['subtotal'])) ?></td><td class="num"><?= e(money($er['shipping_fee'])) ?></td><td class="num">−<?= e(money($er['commission_amount'])) ?></td><td class="num"><?= e(money($er['seller_earning'])) ?></td></tr><?php endforeach; ?></tbody>
  </table></div>
  <?php endif; ?>
</section>
