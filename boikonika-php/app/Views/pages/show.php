<div class="container">
  <?= partial('partials/breadcrumbs', ['items' => [[lf($page, 'title'), null]]]) ?>
  <article class="card prose mt-2 mb-3">
    <h1><?= e(lf($page, 'title')) ?></h1>
    <p class="small subtle"><?= e(t('pages.updated', ['date' => fdate($page['updated_at'])])) ?></p>
    <?= $body ?>
  </article>
</div>
