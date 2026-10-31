<?php
$isAuthor = $kind === 'author';
$img = $isAuthor ? $person['photo_path'] : $person['logo_path'];
$about = $isAuthor ? lf($person, 'bio') : lf($person, 'description');
?>
<div class="container">
  <?= partial('partials/breadcrumbs', ['items' => [[$isAuthor ? t('nav.authors') : t('nav.publishers'), url($isAuthor ? 'authors' : 'publishers')], [lf($person, 'name'), null]]]) ?>
  <div class="store-head">
    <span class="avatar avatar-lg"><?php if ($img): ?><img src="<?= e(upload_url($img)) ?>" alt=""><?php else: ?><?= e(mb_substr(lf($person, 'name'), 0, 1)) ?><?php endif; ?></span>
    <div class="grow">
      <h1 class="mb-0"><?= e(lf($person, 'name')) ?></h1>
      <p class="muted mb-0"><?= $isAuthor ? __('catalog.author') : __('catalog.publisher') ?> · <?= e(tn('common.books', $pager->total)) ?></p>
      <?php if (!$isAuthor && !empty($person['website'])): ?><p class="mb-0 small"><a href="<?= e($person['website']) ?>" rel="nofollow noopener" target="_blank"><?= e(preg_replace('#^https?://#', '', $person['website'])) ?> <?= icon('external', 'icon icon-sm') ?></a></p><?php endif; ?>
    </div>
  </div>
  <?php if ($about !== ''): ?><div class="card prose mb-3"><?= \App\Core\Markdown::render($about) ?></div><?php endif; ?>
  <?= partial('partials/product-grid', ['products' => $products]) ?>
  <?= partial('partials/pagination', ['pager' => $pager]) ?>
</div>
