<?php
$isBook = ($p['type'] ?? 'book') === 'book';
$langs = ['bn' => t('catalog.langBn'), 'en' => t('catalog.langEn'), 'ar' => t('catalog.langAr'), 'other' => t('catalog.langOther')];
$bindings = ['paperback' => t('catalog.paperback'), 'hardcover' => t('catalog.hardcover'), 'other' => t('catalog.otherBinding')];
$statuses = ['pending' => t('status.product.pending'), 'active' => t('status.product.active'), 'rejected' => t('status.product.rejected'), 'archived' => t('status.product.archived')];
$id = $p['id'] ?? null;
?>
<p class="small mb-1"><a href="<?= e(url('admin/products')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('admin.products') ?></a></p>
<h1><?= e($id ? $p['title'] : t('admin.newProduct')) ?></h1>
<?php if ($id && $p['status'] === 'pending'): ?>
<section class="card">
  <h2 class="h3"><?= __('admin.reviewEntry') ?></h2>
  <form method="post" action="<?= e(url('admin/products/' . $id . '/review')) ?>" class="toolbar">
    <?= csrf_field() ?>
    <div class="field grow"><label class="small" for="rn"><?= __('admin.noteToSeller') ?></label><input id="rn" name="note" maxlength="500"></div>
    <button class="btn btn-primary" type="submit" name="action" value="approve"><?= __('admin.approve') ?></button>
    <button class="btn btn-danger-outline" type="submit" name="action" value="reject"><?= __('admin.reject') ?></button>
  </form>
</section>
<?php endif; ?>
<form method="post" action="<?= e($id ? url('admin/products/' . $id) : url('admin/products/new')) ?>" enctype="multipart/form-data" class="card form">
  <?= csrf_field() ?>
  <input type="hidden" name="type" value="<?= e($p['type'] ?? 'book') ?>">
  <?= form_input('title', t('seller.bookTitle'), ['value' => $p['title'] ?? '', 'required' => true]) ?>
  <?php if ($isBook): ?>
    <?= form_input('title_alt', t('seller.titleAlt'), ['value' => $p['title_alt'] ?? '', 'optional' => true]) ?>
    <?= form_input('subtitle', t('seller.subtitle'), ['value' => $p['subtitle'] ?? '', 'optional' => true]) ?>
    <div class="grid-2">
      <?= form_input('authors', t('seller.authors'), ['value' => $authorsText, 'required' => true, 'hint' => t('seller.namesHint')]) ?>
      <?= form_input('translators', t('seller.translators'), ['value' => $translatorsText, 'optional' => true]) ?>
    </div>
    <div class="grid-2">
      <?= form_input('publisher', t('catalog.publisher'), ['value' => $publisherName, 'optional' => true]) ?>
      <?= form_input('isbn', 'ISBN', ['value' => $p['isbn'] ?? '', 'optional' => true]) ?>
    </div>
    <div class="grid-3">
      <?= form_select('language', t('catalog.language'), $langs, ['value' => $p['language'] ?? 'bn']) ?>
      <?= form_input('edition', t('catalog.edition'), ['value' => $p['edition'] ?? '', 'optional' => true]) ?>
      <?= form_input('pages', t('catalog.pages'), ['value' => (string) ($p['pages'] ?? ''), 'optional' => true]) ?>
    </div>
    <div class="grid-2">
      <?= form_select('binding', t('catalog.binding'), $bindings, ['value' => $p['binding'] ?? '', 'placeholder' => t('common.select')]) ?>
      <?= form_input('published_year', t('catalog.published'), ['value' => (string) ($p['published_year'] ?? ''), 'optional' => true]) ?>
    </div>
  <?php else: ?>
    <?= form_input('brand', t('catalog.brand'), ['value' => $p['brand'] ?? '', 'optional' => true]) ?>
  <?php endif; ?>
  <div class="grid-2">
    <?= form_select('category_id', t('catalog.category'), $categories, ['value' => (string) ($p['category_id'] ?? ''), 'placeholder' => t('common.select'), 'required' => true]) ?>
    <?= form_select('status', t('common.status'), $statuses, ['value' => $p['status'] ?? 'active']) ?>
  </div>
  <?= form_input('slug', t('admin.slug'), ['value' => $p['slug'] ?? '', 'optional' => true, 'hint' => t('admin.slugHint')]) ?>
  <?= form_textarea('description', t('seller.description'), ['value' => $p['description'] ?? '', 'optional' => true, 'rows' => 8, 'hint' => t('seller.markdownHint')]) ?>
  <?php if (!empty($p['cover_path'])): ?><img class="preview-img" src="<?= e(upload_url($p['cover_path'])) ?>" alt=""><?php endif; ?>
  <?= form_file('cover', t('seller.cover'), ['optional' => true, 'preview' => true]) ?>
  <?php if ($images): ?><div class="thumb-grid mb-2"><?php foreach ($images as $img): ?><figure><img src="<?= e(upload_url($img['path'])) ?>" alt=""><label class="check small"><input type="checkbox" name="delete_images[]" value="<?= (int) $img['id'] ?>"><span><?= __('common.remove') ?></span></label></figure><?php endforeach; ?></div><?php endif; ?>
  <?= form_file('images', t('admin.moreImages'), ['optional' => true, 'multiple' => true, 'preview' => true]) ?>
  <?= form_check('is_featured', t('admin.featureOnHome'), (bool) ($p['is_featured'] ?? false)) ?>
  <?= submit_button(t('common.saveChanges')) ?>
</form>
<?php if (!empty($offers)): ?>
<section class="card"><h2 class="h3"><?= __('admin.offers') ?></h2>
  <div class="table-wrap"><table class="table"><tbody><?php foreach ($offers as $o): ?><tr><td><?= e($o['store_name']) ?></td><td class="small"><?= __('status.condition.' . $o['item_condition']) ?></td><td class="num"><?= e(money($o['price'])) ?></td><td class="num"><?= e(num((int) $o['stock'])) ?></td><td><?= e(status_label('listing', $o['status'])) ?></td></tr><?php endforeach; ?></tbody></table></div>
</section>
<?php endif; ?>
<?php if ($id && $p['status'] === 'active'): ?><p><a href="<?= e(\App\Services\Catalog::productUrl($p)) ?>"><?= __('seller.viewOnSite') ?> <?= icon('external', 'icon icon-sm') ?></a></p><?php endif; ?>
