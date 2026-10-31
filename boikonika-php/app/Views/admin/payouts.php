<h1><?= __('admin.payouts') ?></h1>
<?= partial('partials/status-tabs', ['base' => 'admin/payouts', 'tabs' => ['' => t('admin.open'), 'requested' => t('status.payout.requested'), 'processing' => t('status.payout.processing'), 'paid' => t('status.payout.paid'), 'rejected' => t('status.payout.rejected')], 'current' => $status]) ?>
<?php if (!$rows): ?><div class="card empty-state"><?= icon('check-circle') ?><h2><?= __('admin.nothingToDo') ?></h2></div><?php endif; ?>
<?php foreach ($rows as $p): ?>
<section class="card">
  <div class="card-head">
    <div><h2 class="h3 mb-0"><?= e(money($p['amount'])) ?> · <a href="<?= e(url('admin/sellers/' . $p['sid'])) ?>"><?= e($p['store_name']) ?></a></h2><p class="small muted mb-0"><?= e($p['method_snapshot']) ?> · <?= e(fdate($p['requested_at'], 'datetime')) ?></p></div>
    <span class="badge"><?= e(status_label('payout', $p['status'])) ?></span>
  </div>
  <?php if ($p['reference']): ?><p class="small mono"><?= e($p['reference']) ?></p><?php endif; ?>
  <?php if (in_array($p['status'], ['requested', 'processing'], true)): ?>
  <p><a class="btn btn-outline btn-sm" href="<?= e(url('admin/payouts/' . $p['id'] . '/account')) ?>"><?= icon('eye') ?><?= __('admin.showAccount') ?></a></p>
  <form method="post" action="<?= e(url('admin/payouts/' . $p['id'])) ?>" class="toolbar" data-once>
    <?= csrf_field() ?>
    <?php if ($p['status'] === 'requested'): ?><button class="btn btn-outline" type="submit" name="action" value="processing"><?= __('admin.markProcessing') ?></button><?php endif; ?>
    <div class="field"><label class="small" for="pr-<?= (int) $p['id'] ?>"><?= __('admin.transactionId') ?></label><input id="pr-<?= (int) $p['id'] ?>" name="reference" maxlength="120"></div>
    <button class="btn btn-primary" type="submit" name="action" value="paid"><?= __('admin.markPaid') ?></button>
    <div class="field"><label class="small" for="pn-<?= (int) $p['id'] ?>"><?= __('common.reason') ?></label><input id="pn-<?= (int) $p['id'] ?>" name="note" maxlength="500"></div>
    <button class="btn btn-danger-outline" type="submit" name="action" value="reject"><?= __('admin.reject') ?></button>
  </form>
  <?php endif; ?>
</section>
<?php endforeach; ?>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
