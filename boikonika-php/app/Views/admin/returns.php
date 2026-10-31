<h1><?= __('admin.returns') ?></h1>
<?= partial('partials/status-tabs', ['base' => 'admin/returns', 'tabs' => ['' => t('admin.open'), 'requested' => t('status.return.requested'), 'approved' => t('status.return.approved'), 'received' => t('status.return.received'), 'refunded' => t('status.return.refunded'), 'rejected' => t('status.return.rejected')], 'current' => $status]) ?>
<?php if (!$rows): ?><div class="card empty-state"><?= icon('check-circle') ?><h2><?= __('admin.nothingToDo') ?></h2></div><?php endif; ?>
<?php foreach ($rows as $r): ?>
<section class="card">
  <div class="card-head">
    <div><h2 class="h3 mb-0"><a class="mono" href="<?= e(url('admin/orders/' . $r['order_number'])) ?>"><?= e($r['number']) ?></a> · <?= e($r['store_name']) ?></h2><p class="small muted mb-0"><?= e($r['buyer']) ?> · <?= e(fdate($r['created_at'], 'datetime')) ?> · <?= e(money($r['total'])) ?></p></div>
    <span class="badge"><?= e(status_label('return', $r['status'])) ?></span>
  </div>
  <p><strong><?= __('orders.returnReasons.' . $r['reason']) ?></strong><br><?= nl2br(e((string) $r['details'])) ?></p>
  <?php if ($r['response_note']): ?><p class="small muted"><?= __('admin.reply') ?>: <?= e($r['response_note']) ?></p><?php endif; ?>
  <?php if (in_array($r['status'], ['requested', 'approved'], true)): ?>
  <form method="post" action="<?= e(url('admin/returns/' . $r['id'])) ?>" class="toolbar">
    <?= csrf_field() ?>
    <div class="field grow"><label class="small" for="n-<?= (int) $r['id'] ?>"><?= __('seller.returnNote') ?></label><input id="n-<?= (int) $r['id'] ?>" name="note" maxlength="500"></div>
    <?php if ($r['status'] === 'requested'): ?><button class="btn btn-primary" type="submit" name="action" value="approve"><?= __('seller.approveReturn') ?></button><?php endif; ?>
    <?php if ($r['status'] === 'approved'): ?><label class="check"><input type="checkbox" name="restock" value="1" checked><span class="small"><?= __('seller.restock') ?></span></label><button class="btn btn-primary" type="submit" name="action" value="received"><?= __('admin.markReturned') ?></button><?php endif; ?>
    <button class="btn btn-danger-outline" type="submit" name="action" value="reject"><?= __('seller.rejectReturn') ?></button>
  </form>
  <?php endif; ?>
</section>
<?php endforeach; ?>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
