<p class="small mb-1"><a href="<?= e(url('admin/payouts')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('admin.payouts') ?></a></p>
<h1><?= __('admin.payoutDetails') ?></h1>
<section class="card">
  <dl class="kv">
    <dt><?= __('admin.store') ?></dt><dd><?= e($p['store_name']) ?></dd>
    <dt><?= __('seller.amount') ?></dt><dd><strong><?= e(money($p['amount'])) ?></strong></dd>
    <dt><?= __('seller.method') ?></dt><dd><?= $p['method'] ? __('status.payoutMethod.' . $p['method']) : '—' ?></dd>
    <dt><?= __('seller.accountName') ?></dt><dd><?= e((string) $p['account_name']) ?></dd>
    <dt><?= __('seller.accountNumber') ?></dt><dd class="mono"><?= e((string) ($p['account_number'] ?? '—')) ?></dd>
    <?php if ($p['bank_name']): ?><dt><?= __('seller.bankName') ?></dt><dd><?= e($p['bank_name']) ?></dd><dt><?= __('seller.branch') ?></dt><dd><?= e((string) $p['branch']) ?></dd><dt><?= __('seller.routing') ?></dt><dd class="mono"><?= e((string) $p['routing_number']) ?></dd><?php endif; ?>
  </dl>
  <p class="small muted mt-2 mb-0"><?= icon('shield', 'icon icon-sm') ?> <?= __('admin.viewLogged') ?></p>
</section>
