<?php $s = $seller; ?>
<h1><?= __('seller.storeSettings') ?></h1>
<form method="post" action="<?= e(url('seller/store')) ?>" enctype="multipart/form-data" class="card form">
  <?= csrf_field() ?>
  <?= form_input('store_name', t('sell.storeName'), ['value' => $s['store_name'], 'required' => true]) ?>
  <p class="small muted"><?= __('seller.shopAddress') ?> <span class="mono"><?= e(abs_url('stores/' . $s['slug'])) ?></span></p>
  <?= form_textarea('description', t('sell.description'), ['value' => $s['description'] ?? '', 'optional' => true, 'rows' => 4, 'hint' => t('seller.markdownHint')]) ?>
  <div class="grid-2">
    <?= form_input('phone', t('common.phone'), ['type' => 'tel', 'value' => $s['phone'], 'required' => true]) ?>
    <?= form_input('email', t('sell.storeEmail'), ['type' => 'email', 'value' => $s['email'] ?? '', 'optional' => true]) ?>
  </div>
  <?= form_select('district', t('addresses.district'), $districts, ['value' => $s['district'], 'required' => true]) ?>
  <?= form_textarea('address', t('sell.pickupAddress'), ['value' => $s['address'], 'required' => true, 'rows' => 2, 'hint' => t('sell.pickupHint')]) ?>
  <div class="grid-2">
    <div><?php if ($s['logo_path']): ?><img class="preview-img" src="<?= e(upload_url($s['logo_path'])) ?>" alt=""><?php endif; ?><?= form_file('logo', t('seller.logo'), ['optional' => true, 'hint' => t('seller.logoHint'), 'preview' => true]) ?></div>
    <div><?php if ($s['banner_path']): ?><img class="preview-img" src="<?= e(upload_url($s['banner_path'])) ?>" alt=""><?php endif; ?><?= form_file('banner', t('seller.banner'), ['optional' => true, 'hint' => t('seller.bannerHint'), 'preview' => true]) ?></div>
  </div>
  <?= submit_button(t('common.saveChanges')) ?>
</form>
