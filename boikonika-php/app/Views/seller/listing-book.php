<?php
$langs = ['bn' => t('catalog.langBn'), 'en' => t('catalog.langEn'), 'ar' => t('catalog.langAr'), 'other' => t('catalog.langOther')];
$bindings = ['paperback' => t('catalog.paperback'), 'hardcover' => t('catalog.hardcover'), 'other' => t('catalog.otherBinding')];
?>
<p class="small mb-1"><a href="<?= e(url('seller/listings/new')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('common.back') ?></a></p>
<h1><?= __('seller.addBook') ?></h1>
<section class="card">
  <h2 class="h3"><?= __('seller.findFirst') ?></h2>
  <form method="get" action="<?= e(url('seller/listings/new/book')) ?>" class="row" role="search">
    <label class="sr-only" for="bq"><?= __('seller.findPlaceholder') ?></label>
    <input id="bq" class="grow" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= __('seller.findPlaceholder') ?>">
    <button class="btn btn-primary" type="submit"><?= icon('search') ?><?= __('common.search') ?></button>
  </form>
  <?php if ($searched): ?>
    <?php if ($results): ?>
    <div class="table-wrap mt-2"><table class="table">
      <tbody><?php foreach ($results as $r): ?><tr>
        <td><strong><?= e($r['title']) ?></strong><br><span class="small muted"><?= e($r['author_names'] ?? '') ?><?= $r['isbn'] ? ' · ISBN ' . e($r['isbn']) : '' ?><?= $r['edition'] ? ' · ' . e($r['edition']) : '' ?></span></td>
        <td class="right"><a class="btn btn-secondary btn-sm" href="<?= e(url('seller/listings/offer/' . $r['id'])) ?>"><?= __('seller.sellThis') ?></a></td>
      </tr><?php endforeach; ?></tbody>
    </table></div>
    <?php else: ?><p class="muted mt-2 mb-0"><?= __('seller.notFound') ?></p><?php endif; ?>
  <?php endif; ?>
</section>
<?php if ($searched || has_errors()): ?>
<form method="post" action="<?= e(url('seller/listings/new/book')) ?>" enctype="multipart/form-data" class="card form" data-once>
  <?= csrf_field() ?>
  <h2 class="h3"><?= __('seller.newBookTitle') ?></h2>
  <p class="small muted"><?= __('seller.newBookHint') ?></p>
  <?= form_input('title', t('seller.bookTitle'), ['required' => true, 'value' => \App\Core\Validator::isbn($q) ? '' : $q]) ?>
  <?= form_input('title_alt', t('seller.titleAlt'), ['optional' => true, 'hint' => t('seller.titleAltHint')]) ?>
  <?= form_input('subtitle', t('seller.subtitle'), ['optional' => true]) ?>
  <div class="grid-2">
    <?= form_input('authors', t('seller.authors'), ['required' => true, 'hint' => t('seller.namesHint')]) ?>
    <?= form_input('translators', t('seller.translators'), ['optional' => true, 'hint' => t('seller.namesHint')]) ?>
  </div>
  <div class="grid-2">
    <?= form_input('publisher', t('catalog.publisher'), ['optional' => true]) ?>
    <?= form_input('isbn', 'ISBN', ['optional' => true, 'value' => \App\Core\Validator::isbn($q) ?? '', 'hint' => t('seller.isbnHint')]) ?>
  </div>
  <div class="grid-2">
    <?= form_select('category_id', t('catalog.category'), $categories, ['placeholder' => t('common.select'), 'required' => true]) ?>
    <?= form_select('language', t('catalog.language'), $langs, ['value' => 'bn', 'required' => true]) ?>
  </div>
  <div class="grid-3">
    <?= form_input('edition', t('catalog.edition'), ['optional' => true]) ?>
    <?= form_input('pages', t('catalog.pages'), ['optional' => true, 'attrs' => ['inputmode' => 'numeric']]) ?>
    <?= form_input('published_year', t('catalog.published'), ['optional' => true, 'attrs' => ['inputmode' => 'numeric', 'maxlength' => 4]]) ?>
  </div>
  <?= form_select('binding', t('catalog.binding'), $bindings, ['placeholder' => t('common.select')]) ?>
  <?= form_textarea('description', t('seller.description'), ['optional' => true, 'rows' => 5, 'hint' => t('seller.markdownHint')]) ?>
  <?= form_file('cover', t('seller.cover'), ['optional' => true, 'hint' => t('seller.coverHint'), 'preview' => true]) ?>
  <?= partial('partials/offer-fields', []) ?>
  <?= form_check('genuine', t('seller.genuine')) ?>
  <?= submit_button(t('seller.saveListing'), 'btn btn-primary btn-lg') ?>
</form>
<?php endif; ?>
