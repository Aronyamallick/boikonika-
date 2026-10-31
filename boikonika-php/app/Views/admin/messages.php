<h1><?= __('admin.messages') ?></h1>
<?= partial('partials/status-tabs', ['base' => 'admin/messages', 'tabs' => ['' => t('admin.open'), 'new' => t('status.message.new'), 'open' => t('status.message.open'), 'replied' => t('status.message.replied'), 'closed' => t('status.message.closed')], 'current' => $status]) ?>
<?php if (!$rows): ?><div class="card empty-state"><?= icon('check-circle') ?><h2><?= __('admin.nothingToDo') ?></h2></div><?php else: ?>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('contact.subject') ?></th><th><?= __('admin.from') ?></th><th><?= __('contact.topic') ?></th><th><?= __('common.date') ?></th><th><?= __('common.status') ?></th></tr></thead>
  <tbody><?php foreach ($rows as $m): ?><tr><td><a href="<?= e(url('admin/messages/' . $m['id'])) ?>"><?= e($m['subject']) ?></a></td><td class="small"><?= e($m['name']) ?><br><?= e($m['email']) ?></td><td class="small"><?= __('contact.topics.' . $m['topic']) ?></td><td class="small nowrap"><?= e(fdate($m['created_at'], 'datetime')) ?></td><td><span class="badge<?= $m['status'] === 'new' ? ' badge-warning' : '' ?>"><?= e(status_label('message', $m['status'])) ?></span></td></tr><?php endforeach; ?></tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
<?php endif; ?>
