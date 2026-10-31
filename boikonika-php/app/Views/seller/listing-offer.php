<p class="small mb-1"><a href="<?= e(url('seller/listings/new/book')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('common.back') ?></a></p>
<h1><?= __('seller.sellThis') ?></h1>
<div class="card row mb-2">
  <?php if ($product['cover_path']): ?><img class="preview-img" src="<?= e(upload_url($product['cover_path'])) ?>" alt=""><?php endif; ?>
  <div><strong><?= e($product['title']) ?></strong><?php if ($product['isbn']): ?><br><span class="small muted">ISBN <?= e($product['isbn']) ?></span><?php endif; ?></div>
</div>
<form method="post" action="<?= e(url('seller/listings/offer/' . $product['id'])) ?>" enctype="multipart/form-data" class="card form" data-once>
  <?= csrf_field() ?>
  <?= partial('partials/offer-fields', ['general' => $product['type'] === 'general']) ?>
  <?= form_check('genuine', t('seller.genuine')) ?>
  <?= submit_button(t('seller.saveListing'), 'btn btn-primary btn-lg') ?>
</form>
