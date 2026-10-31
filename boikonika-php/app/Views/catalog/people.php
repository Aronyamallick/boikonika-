<?php $isAuthors = $kind === 'authors'; ?>
<div class="container">
  <?= partial('partials/breadcrumbs', ['items' => [[$heading, null]]]) ?>
  <div class="page-head row-between">
    <h1 class="mb-0"><?= e($heading) ?></h1>
    <form method="get" action="<?= e(url($kind)) ?>" role="search" class="row">
      <label class="sr-only" for="pq"><?= __('common.search') ?></label>
      <input id="pq" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= $isAuthors ? __('catalog.searchAuthors') : __('catalog.searchPublishers') ?>">
      <button class="btn btn-outline" type="submit"><?= __('common.search') ?></button>
    </form>
  </div>
  <?php if (!$rows): ?>
    <div class="empty-state card mt-2"><?= icon($isAuthors ? 'pen' : 'building') ?><h2><?= __('catalog.noResults') ?></h2></div>
  <?php else: ?>
  <div class="person-grid mt-2">
    <?php foreach ($rows as $r): $img = $isAuthors ? $r['photo_path'] : $r['logo_path']; ?>
      <a class="person" href="<?= e(url($kind . '/' . $r['slug'])) ?>">
        <span class="avatar avatar-lg"><?php if ($img): ?><img src="<?= e(upload_url($img)) ?>" alt=""><?php else: ?><?= e(mb_substr(lf($r, 'name'), 0, 1)) ?><?php endif; ?></span>
        <strong><?= e(lf($r, 'name')) ?></strong>
        <span class="small muted"><?= e(tn('common.books', (int) $r['books'])) ?></span>
      </a>
    <?php endforeach; ?>
  </div>
  <?= partial('partials/pagination', ['pager' => $pager]) ?>
  <?php endif; ?>
</div>
