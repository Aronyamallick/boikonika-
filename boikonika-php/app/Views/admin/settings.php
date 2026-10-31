<?php
$tabs = ['general' => t('admin.tabGeneral'), 'orders' => t('admin.tabOrders'), 'payments' => t('admin.tabPayments'), 'email' => t('admin.tabEmail')];
$f = static fn (string $k): string => str_replace('.', '__', $k);
$in = static function (string $k, string $label, array $o = []) use ($v, $f): string {
    return form_input($f($k), $label, $o + ['value' => $v[$k] ?? '']);
};
$secret = static function (string $k, string $label) use ($secretsSet, $f): string {
    $set = $secretsSet[$k] ?? false;
    return form_input($f($k), $label, ['type' => 'password', 'optional' => true, 'autocomplete' => 'off', 'hint' => $set ? t('admin.secretSet') : t('admin.secretEmpty')])
        . ($set ? '<label class="check small mb-2"><input type="checkbox" name="clear[]" value="' . e($k) . '"><span>' . __('admin.clearSecret') . '</span></label>' : '');
};
$check = static fn (string $k, string $label, string $hint = ''): string => form_check($f($k), $label, ($v[$k] ?? '') === '1', ['hint' => $hint]);
?>
<h1><?= __('admin.settings') ?></h1>
<nav class="tabs mt-0" aria-label="<?= __('admin.settings') ?>"><?php foreach ($tabs as $k => $l): ?><a href="<?= e(url('admin/settings', ['tab' => $k])) ?>"<?= $tab === $k ? ' aria-current="page"' : '' ?>><?= e($l) ?></a><?php endforeach; ?></nav>
<form method="post" action="<?= e(url('admin/settings')) ?>" class="card form" autocomplete="off">
  <?= csrf_field() ?>
  <input type="hidden" name="tab" value="<?= e($tab) ?>">
  <?php if ($tab === 'general'): ?>
    <div class="grid-2"><?= $in('site.name_bn', t('admin.siteNameBn'), ['required' => true]) ?><?= $in('site.name_en', t('admin.siteNameEn'), ['required' => true]) ?></div>
    <div class="grid-2"><?= $in('site.tagline_bn', t('admin.taglineBn')) ?><?= $in('site.tagline_en', t('admin.taglineEn')) ?></div>
    <div class="grid-2"><?= $in('site.email', t('admin.supportEmail'), ['type' => 'email']) ?><?= $in('site.phone', t('admin.supportPhone')) ?></div>
    <?= form_textarea($f('site.address'), t('admin.officeAddress'), ['value' => $v['site.address'] ?? '', 'rows' => 2, 'optional' => true]) ?>
    <div class="grid-2"><?= $in('site.facebook', 'Facebook', ['type' => 'url', 'optional' => true]) ?><?= $in('site.youtube', 'YouTube', ['type' => 'url', 'optional' => true]) ?></div>
    <?= $check('site.indexing', t('admin.allowIndexing'), t('admin.allowIndexingHint')) ?>
  <?php elseif ($tab === 'orders'): ?>
    <div class="grid-2"><?= $in('orders.commission_percent', t('admin.commissionDefault'), ['required' => true, 'hint' => t('admin.commissionHint')]) ?><?= $in('orders.min_payout', t('admin.minPayout'), ['required' => true]) ?></div>
    <div class="grid-2"><?= $in('orders.payment_window_minutes', t('admin.paymentWindow'), ['required' => true, 'hint' => t('admin.paymentWindowHint')]) ?><?= $in('orders.return_window_days', t('admin.returnWindow'), ['required' => true]) ?></div>
    <?= $check('orders.cod_enabled', t('admin.codEnabled')) ?>
    <?= $in('orders.cod_max', t('admin.codMax'), ['required' => true]) ?>
    <?= $check('catalog.review_new_products', t('admin.reviewNew'), t('admin.reviewNewHint')) ?>
  <?php elseif ($tab === 'payments'): ?>
    <fieldset class="fieldset">
      <legend>bKash</legend>
      <p class="small muted"><?= __('admin.bkashHint') ?></p>
      <?= $check('payments.bkash.enabled', t('admin.enable')) ?>
      <?= $check('payments.bkash.sandbox', t('admin.sandbox'), t('admin.sandboxHint')) ?>
      <div class="grid-2"><?= $in('payments.bkash.username', t('admin.bkashUsername')) ?><?= $secret('payments.bkash.password', t('admin.bkashPassword')) ?></div>
      <div class="grid-2"><?= $in('payments.bkash.app_key', 'App key') ?><?= $secret('payments.bkash.app_secret', 'App secret') ?></div>
    </fieldset>
    <fieldset class="fieldset">
      <legend>SSLCOMMERZ</legend>
      <p class="small muted"><?= __('admin.sslHint') ?></p>
      <?= $check('payments.ssl.enabled', t('admin.enable')) ?>
      <?= $check('payments.ssl.sandbox', t('admin.sandbox'), t('admin.sandboxHint')) ?>
      <div class="grid-2"><?= $in('payments.ssl.store_id', 'Store ID') ?><?= $secret('payments.ssl.store_password', 'Store password') ?></div>
      <p class="small"><?= __('admin.ipnUrl') ?> <span class="mono"><?= e($urls['ssl_ipn']) ?></span></p>
    </fieldset>
    <p class="small muted"><?= icon('lock', 'icon icon-sm') ?> <?= __('admin.secretsEncrypted') ?></p>
  <?php else: ?>
    <?= form_select($f('mail.driver'), t('admin.mailDriver'), ['mail' => t('admin.mailPhp'), 'smtp' => 'SMTP', 'log' => t('admin.mailLog')], ['value' => $v['mail.driver'] ?? 'mail', 'hint' => t('admin.mailDriverHint')]) ?>
    <div class="grid-2"><?= $in('mail.from_email', t('admin.fromEmail'), ['type' => 'email', 'hint' => t('admin.fromEmailHint')]) ?><?= $in('mail.from_name', t('admin.fromName')) ?></div>
    <div class="grid-3"><?= $in('mail.smtp_host', t('admin.smtpHost')) ?><?= $in('mail.smtp_port', t('admin.smtpPort')) ?><?= form_select($f('mail.smtp_encryption'), t('admin.smtpEncryption'), ['tls' => 'STARTTLS (587)', 'ssl' => 'SSL (465)', 'none' => t('common.none')], ['value' => $v['mail.smtp_encryption'] ?? 'tls']) ?></div>
    <div class="grid-2"><?= $in('mail.smtp_username', t('admin.smtpUser')) ?><?= $secret('mail.smtp_password', t('admin.smtpPassword')) ?></div>
  <?php endif; ?>
  <?= submit_button(t('common.saveChanges')) ?>
</form>
<?php if ($tab === 'email'): ?>
<form method="post" action="<?= e(url('admin/settings/test-mail')) ?>" class="card"><?= csrf_field() ?><p class="muted"><?= e(t('admin.testMailHint', ['email' => (string) auth_user()['email']])) ?></p><button class="btn btn-outline" type="submit"><?= icon('mail') ?><?= __('admin.sendTest') ?></button></form>
<?php endif; ?>
