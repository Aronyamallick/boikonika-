<p class="small mb-1"><a href="<?= e(url('seller/listings')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('seller.listings') ?></a></p>
<h1><?= e($l['title']) ?></h1>
<?php if ($l['status'] === 'suspended'): ?><div class="alert alert-error"><?= icon('alert') ?><div><?= __('seller.suspendedListing') ?><?php if ($l['suspended_reason']): ?> <?= e($l['suspended_reason']) ?><?php endif; ?></div></div><?php endif; ?>
<?php if ($l['product_status'] === 'rejected'): ?><div class="alert alert-warning"><?= icon('alert') ?><div><strong><?= __('status.product.rejected') ?>:</strong> <?= e($l['review_note'] ?? '') ?></div></div>
<?php elseif ($l['product_status'] === 'pending'): ?><div class="alert alert-info"><?= icon('info') ?><div><?= __('seller.waitingReview') ?></div></div>
<?php elseif ($l['product_status'] === 'active'): ?><p><a href="<?= e(url(($l['type'] === 'general' ? 'products/' : 'books/') . $l['slug'])) ?>"><?= __('seller.viewOnSite') ?> <?= icon('external', 'icon icon-sm') ?></a></p><?php endif; ?>
<form method="post" action="<?= e(url('seller/listings/' . $l['id'])) ?>" enctype="multipart/form-data" class="card form">
  <?= csrf_field() ?>
  <?php if ($productEditable): ?>
  <fieldset class="fieldset">
    <legend><?= __('seller.productDetails') ?></legend>
    <?= form_input('p_title', t('seller.bookTitle'), ['value' => $l['title'], 'required' => true]) ?>
    <?= form_input('p_subtitle', t('seller.subtitle'), ['value' => $l['subtitle'] ?? '', 'optional' => true]) ?>
    <?= form_textarea('p_description', t('seller.description'), ['value' => $l['description'] ?? '', 'optional' => true, 'rows' => 5]) ?>
    <?= form_file('p_cover', t('seller.cover'), ['optional' => true, 'preview' => true]) ?>
    <p class="small muted"><?= __('seller.resubmitNote') ?></p>
  </fieldset>
  <?php endif; ?>
  <?= partial('partials/offer-fields', ['l' => $l, 'general' => $l['type'] === 'general']) ?>
  <?php if ($images): ?>
    <div class="thumb-grid mb-2"><?php foreach ($images as $img): ?><figure><img src="<?= e(upload_url($img['path'])) ?>" alt=""><button class="link-btn danger small" type="submit" form="del-<?= (int) $img['id'] ?>"><?= __('common.remove') ?></button></figure><?php endforeach; ?></div>
  <?php endif; ?>
  <?php if ($l['status'] !== 'suspended'): ?>
  <?= form_select('status', t('common.status'), ['active' => t('status.listing.active'), 'paused' => t('status.listing.paused')], ['value' => $l['status']]) ?>
  <?php endif; ?>
  <?= submit_button(t('common.saveChanges')) ?>
</form>
<?php foreach ($images as $img): ?><form id="del-<?= (int) $img['id'] ?>" method="post" action="<?= e(url('seller/listings/' . $l['id'] . '/images/' . $img['id'] . '/delete')) ?>" class="hidden"><?= csrf_field() ?></form><?php endforeach; ?>
