<?php /** @var list<array{0:string,1:?string}> $items label, url */ ?>
<nav class="breadcrumbs" aria-label="<?= __('catalog.breadcrumbs') ?>">
  <ol>
    <li><a href="<?= e(url()) ?>"><?= __('nav.home') ?></a></li>
    <?php foreach ($items as $i => [$label, $href]): ?>
      <li><?php if ($href && $i < count($items) - 1): ?><a href="<?= e($href) ?>"><?= e($label) ?></a><?php else: ?><span aria-current="page"><?= e($label) ?></span><?php endif; ?></li>
    <?php endforeach; ?>
  </ol>
</nav>
