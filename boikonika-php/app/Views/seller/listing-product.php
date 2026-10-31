<p class="small mb-1"><a href="<?= e(url('seller/listings/new')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('common.back') ?></a></p>
<h1><?= __('seller.addProduct') ?></h1>
<form method="post" action="<?= e(url('seller/listings/new/product')) ?>" enctype="multipart/form-data" class="card form" data-once>
  <?= csrf_field() ?>
  <?= form_input('title', t('seller.productName'), ['required' => true, 'attrs' => ['maxlength' => 255]]) ?>
  <div class="grid-2">
    <?= form_input('brand', t('catalog.brand'), ['optional' => true]) ?>
    <?= form_select('category_id', t('catalog.category'), $categories, ['placeholder' => t('common.select'), 'required' => true]) ?>
  </div>
  <?= form_textarea('description', t('seller.description'), ['required' => true, 'rows' => 5, 'hint' => t('seller.productDescriptionHint')]) ?>
  <?= form_file('images', t('seller.productImages'), ['multiple' => true, 'required' => true, 'hint' => t('seller.productImagesHint'), 'preview' => true]) ?>
  <?= partial('partials/offer-fields', ['general' => true]) ?>
  <?= form_check('genuine', t('seller.genuineProduct')) ?>
  <?= submit_button(t('seller.saveListing'), 'btn btn-primary btn-lg') ?>
</form>
