<?php
$s = $seller;
$docTypes = ['nid' => t('sell.docs.nid'), 'passport' => t('sell.docs.passport'), 'birth_certificate' => t('sell.docs.birth_certificate'), 'trade_license' => t('sell.docs.trade_license')];
$types = ['individual' => t('sell.types.individual'), 'business' => t('sell.types.business'), 'publisher' => t('sell.types.publisher')];
$canSubmit = !$s || $s['status'] === 'rejected';
?>
<div class="container">
  <div class="page-head"><h1><?= __('sell.applyTitle') ?></h1></div>
  <?php if ($s && $s['status'] === 'pending'): ?>
    <div class="card mt-2"><div class="alert alert-info mb-0"><?= icon('info') ?><div><strong><?= __('sell.pendingTitle') ?></strong><p class="mb-0"><?= e(t('sell.pendingText', ['store' => $s['store_name']])) ?></p></div></div></div>
  <?php elseif ($s && $s['status'] === 'suspended'): ?>
    <div class="card mt-2"><div class="alert alert-error mb-0"><?= icon('alert') ?><div><strong><?= __('sell.suspendedTitle') ?></strong><p class="mb-0"><?= e($s['review_note'] ?: t('sell.suspendedText')) ?></p></div></div></div>
  <?php endif; ?>
  <?php if ($s && $s['status'] === 'rejected'): ?>
    <div class="alert alert-warning mt-2"><?= icon('alert') ?><div><strong><?= __('sell.rejectedTitle') ?></strong><p class="mb-0"><?= e($s['review_note'] ?: t('sell.rejectedText')) ?></p></div></div>
  <?php endif; ?>
  <?php if ($canSubmit): ?>
  <form method="post" action="<?= e(url('seller/apply')) ?>" enctype="multipart/form-data" class="card form mt-2" data-once>
    <?= csrf_field() ?>
    <h2><?= __('sell.storeSection') ?></h2>
    <?= form_input('store_name', t('sell.storeName'), ['value' => $s['store_name'] ?? '', 'required' => true, 'hint' => t('sell.storeNameHint'), 'attrs' => ['maxlength' => 80]]) ?>
    <?= form_select('business_type', t('sell.businessType'), $types, ['value' => $s['business_type'] ?? 'individual', 'required' => true]) ?>
    <?= form_input('business_name', t('sell.businessName'), ['value' => $s['business_name'] ?? '', 'optional' => true, 'hint' => t('sell.businessNameHint')]) ?>
    <?= form_textarea('description', t('sell.description'), ['value' => $s['description'] ?? '', 'optional' => true, 'rows' => 3, 'hint' => t('sell.descriptionHint')]) ?>
    <div class="grid-2">
      <?= form_input('phone', t('common.phone'), ['type' => 'tel', 'value' => $s['phone'] ?? (auth_user()['phone'] ?? ''), 'required' => true]) ?>
      <?= form_input('email', t('sell.storeEmail'), ['type' => 'email', 'value' => $s['email'] ?? '', 'optional' => true]) ?>
    </div>
    <?= form_select('district', t('addresses.district'), $districts, ['value' => $s['district'] ?? '', 'placeholder' => t('common.select'), 'required' => true]) ?>
    <?= form_textarea('address', t('sell.pickupAddress'), ['value' => $s['address'] ?? '', 'required' => true, 'rows' => 2, 'hint' => t('sell.pickupHint')]) ?>

    <h2 class="mt-3"><?= __('sell.identitySection') ?></h2>
    <p class="small muted"><?= icon('lock', 'icon icon-sm') ?> <?= __('sell.identityPrivacy') ?></p>
    <div class="grid-2">
      <?= form_select('doc_type', t('sell.docType'), $docTypes, ['required' => true]) ?>
      <?= form_input('doc_number', t('sell.docNumber'), ['required' => true, 'attrs' => ['autocomplete' => 'off', 'maxlength' => 30]]) ?>
    </div>
    <?= form_file('doc_front', t('sell.docFront'), ['required' => true, 'hint' => t('sell.docHint'), 'preview' => true]) ?>
    <?= form_file('doc_back', t('sell.docBack'), ['hint' => t('sell.docBackHint'), 'preview' => true]) ?>
    <?= form_check('agree', '', false, ['html' => __('sell.agree') . ' <a href="' . e(url('pages/seller-policy')) . '" target="_blank">' . __('sell.policy') . '</a>']) ?>
    <?= submit_button(t('sell.submit'), 'btn btn-primary btn-lg', ['data-busy' => t('common.saving')]) ?>
  </form>
  <?php endif; ?>
</div>
