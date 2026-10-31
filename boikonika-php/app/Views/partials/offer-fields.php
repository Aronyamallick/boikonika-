<?php
/** Price, stock and condition fields shared by the listing forms. $l = existing listing or [] */
$l = $l ?? [];
$general = $general ?? false;
$conditions = ['new' => t('status.condition.new'), 'like_new' => t('status.condition.like_new'), 'good' => t('status.condition.good'), 'acceptable' => t('status.condition.acceptable')];
?>
<fieldset class="fieldset">
  <legend><?= __('seller.yourOffer') ?></legend>
  <?= form_select('item_condition', t('catalog.condition'), $conditions, ['value' => $l['item_condition'] ?? 'new', 'required' => true]) ?>
  <?= form_input('condition_note', t('seller.conditionNote'), ['value' => $l['condition_note'] ?? '', 'optional' => true, 'hint' => t('seller.conditionNoteHint'), 'attrs' => ['maxlength' => 255]]) ?>
  <div class="grid-3">
    <?= form_input('price', t('seller.price'), ['value' => isset($l['price']) ? \App\Core\Money::toDecimal(\App\Core\Money::toPoisha($l['price'])) : '', 'required' => true, 'attrs' => ['inputmode' => 'decimal']]) ?>
    <?= form_input('compare_at_price', t('seller.comparePrice'), ['value' => isset($l['compare_at_price']) && $l['compare_at_price'] !== null ? \App\Core\Money::toDecimal(\App\Core\Money::toPoisha($l['compare_at_price'])) : '', 'optional' => true, 'hint' => t('seller.comparePriceHint'), 'attrs' => ['inputmode' => 'decimal']]) ?>
    <?= form_input('stock', t('seller.stock'), ['value' => (string) ($l['stock'] ?? '1'), 'required' => true, 'attrs' => ['inputmode' => 'numeric']]) ?>
  </div>
  <?= form_input('sku', t('seller.sku'), ['value' => $l['sku'] ?? '', 'optional' => true, 'hint' => t('seller.skuHint'), 'attrs' => ['maxlength' => 60]]) ?>
  <?php if (!$general): ?><?= form_file('photos', t('seller.copyPhotos'), ['multiple' => true, 'hint' => t('seller.copyPhotosHint'), 'preview' => true]) ?><?php endif; ?>
  <p class="small muted"><?= e(t('seller.commissionNote', ['percent' => num((string) (float) \App\Services\Checkout::commissionPercent((int) \App\Core\Auth::seller()['id']))])) ?></p>
</fieldset>
