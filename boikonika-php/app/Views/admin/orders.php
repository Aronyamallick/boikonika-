<h1><?= __('admin.orders') ?></h1>
<?= partial('partials/status-tabs', ['base' => 'admin/orders', 'tabs' => ['' => t('common.all'), 'awaiting_payment' => t('status.order.awaiting_payment'), 'placed' => t('status.order.placed'), 'completed' => t('status.order.completed'), 'cancelled' => t('status.order.cancelled')], 'current' => $status, 'keep' => ['q' => $q, 'payment' => $payment]]) ?>
<form class="toolbar" method="get" action="<?= e(url('admin/orders')) ?>" role="search">
  <?php if ($status): ?><input type="hidden" name="status" value="<?= e($status) ?>"><?php endif; ?>
  <div class="field"><label class="small" for="aq"><?= __('common.search') ?></label><input id="aq" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= __('admin.searchOrders') ?>"></div>
  <div class="field"><label class="small" for="ap"><?= __('orders.payment') ?></label><select id="ap" name="payment"><option value=""><?= __('common.all') ?></option><?php foreach (['unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled'] as $s): ?><option value="<?= $s ?>"<?= selected($s, $payment) ?>><?= e(status_label('payment', $s)) ?></option><?php endforeach; ?></select></div>
  <button class="btn btn-outline" type="submit"><?= __('common.filter') ?></button>
</form>
<?= partial('admin/_orders-table', ['rows' => $rows]) ?>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
