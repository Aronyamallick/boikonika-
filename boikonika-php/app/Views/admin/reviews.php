<h1><?= __('admin.reviews') ?></h1>
<?= partial('partials/status-tabs', ['base' => 'admin/reviews', 'tabs' => ['' => t('common.all'), 'published' => t('status.review.published'), 'hidden' => t('status.review.hidden')], 'current' => $status]) ?>
<?php foreach ($rows as $r): ?>
<article class="card card-tight">
  <div class="row-between"><div class="row"><?= partial('partials/stars', ['rating' => $r['rating']]) ?><strong><?= e($r['name']) ?></strong><span class="small subtle"><?= e(fdate($r['created_at'])) ?></span></div>
    <form method="post" action="<?= e(url('admin/reviews/' . $r['id'])) ?>"><?= csrf_field() ?><input type="hidden" name="status" value="<?= $r['status'] === 'published' ? 'hidden' : 'published' ?>"><button class="btn btn-outline btn-sm" type="submit"><?= $r['status'] === 'published' ? __('admin.hide') : __('admin.publish') ?></button></form></div>
  <p class="small mb-1"><a href="<?= e(\App\Services\Catalog::productUrl($r)) ?>"><?= e($r['title']) ?></a> · <span class="badge"><?= e(status_label('review', $r['status'])) ?></span></p>
  <?php if ($r['body']): ?><p class="mb-0"><?= nl2br(e($r['body'])) ?></p><?php endif; ?>
</article>
<?php endforeach; ?>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
