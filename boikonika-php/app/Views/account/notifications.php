<div class="row-between mb-2">
  <h1 class="mb-0"><?= __('nav.notifications') ?></h1>
  <?php if ($unread): ?><form method="post" action="<?= e(url('account/notifications/read')) ?>"><?= csrf_field() ?><button class="btn btn-outline btn-sm" type="submit"><?= icon('check') ?><?= __('account.markAllRead') ?></button></form><?php endif; ?>
</div>
<?php if (!$rows): ?>
  <div class="card empty-state"><?= icon('bell') ?><h2><?= __('account.noNotifications') ?></h2></div>
<?php else: ?>
<div class="card card-flush">
  <?php foreach ($rows as $n): ?>
  <div class="notice-row<?= $n['read_at'] ? '' : ' unread' ?>">
    <div class="row-between"><strong><?php if ($n['link']): ?><a href="<?= e(url($n['link'])) ?>"><?= e($n['title']) ?></a><?php else: ?><?= e($n['title']) ?><?php endif; ?></strong><span class="small subtle nowrap"><?= e(ago($n['created_at'])) ?></span></div>
    <?php if ($n['body']): ?><p class="small muted mb-0"><?= e($n['body']) ?></p><?php endif; ?>
  </div>
  <?php endforeach; ?>
</div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
<?php endif; ?>
