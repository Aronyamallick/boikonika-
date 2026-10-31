<h1><?= __('admin.refunds') ?></h1>
<?= partial('partials/status-tabs', ['base' => 'admin/refunds', 'tabs' => ['' => t('admin.open'), 'requested' => t('status.refund.requested'), 'processing' => t('status.refund.processing'), 'failed' => t('status.refund.failed'), 'completed' => t('status.refund.completed'), 'rejected' => t('status.refund.rejected')], 'current' => $status]) ?>
<p class="small muted"><?= __('admin.refundsHint') ?></p>
<?php if (!$rows): ?><div class="card empty-state"><?= icon('check-circle') ?><h2><?= __('admin.nothingToDo') ?></h2></div><?php endif; ?>
<?php foreach ($rows as $r): ?>
<section class="card">
  <div class="card-head">
    <div><h2 class="h3 mb-0"><?= e(money($r['amount'])) ?> · <a class="mono" href="<?= e(url('admin/orders/' . $r['number'])) ?>"><?= e($r['parcel_number'] ?: $r['number']) ?></a></h2>
    <p class="small muted mb-0"><?= e(reason_label($r['reason'])) ?> · <?= e(fdate($r['created_at'], 'datetime')) ?> · <?= __('status.method.' . $r['payment_method']) ?> · <?= e($r['ship_name']) ?> <?= e(digits($r['ship_phone'])) ?></p></div>
    <span class="badge<?= $r['status'] === 'failed' ? ' badge-danger' : '' ?>"><?= e(status_label('refund', $r['status'])) ?></span>
  </div>
  <?php if ($r['failure_reason']): ?><p class="small text-danger"><?= e($r['failure_reason']) ?></p><?php endif; ?>
  <?php if ($r['provider_refund_id'] || $r['reference']): ?><p class="small mono"><?= e((string) ($r['provider_refund_id'] ?: $r['reference'])) ?></p><?php endif; ?>
  <?php if (in_array($r['status'], ['requested', 'failed'], true)): ?>
  <form method="post" action="<?= e(url('admin/refunds/' . $r['id'])) ?>" class="toolbar" data-once>
    <?= csrf_field() ?>
    <div class="field"><label class="small" for="sd-<?= (int) $r['id'] ?>"><?= __('admin.sellerDebit') ?></label><input id="sd-<?= (int) $r['id'] ?>" name="seller_debit" inputmode="decimal" placeholder="0" value="0"></div>
    <?php if ($r['provider']): ?><button class="btn btn-primary" type="submit" name="action" value="gateway"><?= e(t('admin.refundVia', ['gateway' => $r['provider'] === 'bkash' ? 'bKash' : 'SSLCOMMERZ'])) ?></button><?php endif; ?>
    <div class="field"><label class="small" for="ref-<?= (int) $r['id'] ?>"><?= __('admin.manualReference') ?></label><input id="ref-<?= (int) $r['id'] ?>" name="reference" maxlength="120" placeholder="<?= __('admin.manualReferenceHint') ?>"></div>
    <button class="btn btn-outline" type="submit" name="action" value="manual"><?= __('admin.markRefundedManually') ?></button>
    <div class="field"><label class="small" for="rn-<?= (int) $r['id'] ?>"><?= __('common.note') ?></label><input id="rn-<?= (int) $r['id'] ?>" name="note" maxlength="255"></div>
    <button class="btn btn-danger-outline" type="submit" name="action" value="reject"><?= __('admin.reject') ?></button>
  </form>
  <p class="small muted mb-0"><?= __('admin.sellerDebitHint') ?></p>
  <?php elseif ($r['status'] === 'processing'): ?>
  <form method="post" action="<?= e(url('admin/refunds/' . $r['id'])) ?>"><?= csrf_field() ?><button class="btn btn-outline btn-sm" type="submit" name="action" value="complete"><?= __('admin.markSettled') ?></button></form>
  <?php endif; ?>
</section>
<?php endforeach; ?>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
