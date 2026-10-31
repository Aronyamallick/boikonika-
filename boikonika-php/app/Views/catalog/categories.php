<div class="container">
  <?= partial('partials/breadcrumbs', ['items' => [[t('catalog.categoriesTitle'), null]]]) ?>
  <div class="page-head"><h1><?= __('catalog.categoriesTitle') ?></h1></div>
  <?php foreach ([[t('catalog.bookCategories'), $book], [t('catalog.generalCategories'), $general]] as [$label, $tree]): if (!$tree) { continue; } ?>
  <section class="section">
    <h2><?= e($label) ?></h2>
    <div class="cat-grid mt-2">
      <?php foreach ($tree as $c): ?>
        <div class="card card-tight">
          <h3 class="mb-1"><a href="<?= e(url('categories/' . $c['slug'])) ?>"><?= e(lf($c, 'name')) ?></a></h3>
          <?php if ($c['children']): ?><ul class="cat-list small"><?php foreach ($c['children'] as $ch): ?><li><a href="<?= e(url('categories/' . $ch['slug'])) ?>"><?= e(lf($ch, 'name')) ?></a></li><?php endforeach; ?></ul><?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endforeach; ?>
</div>
