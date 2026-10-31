<?php $dec = static fn ($v) => $v === null || $v === '' ? '' : \App\Core\Money::toDecimal(\App\Core\Money::toPoisha($v)); ?>
<h1><?= __('admin.shipping') ?></h1>
<p class="muted"><?= __('admin.shippingHint') ?></p>
<?php foreach (array_merge($rows, [[]]) as $m): ?>
<form method="post" action="<?= e(url('admin/shipping')) ?>" class="card">
  <?= csrf_field() ?>
  <input type="hidden" name="id" value="<?= (int) ($m['id'] ?? 0) ?>">
  <h2 class="h3"><?= $m ? e(lf($m, 'name')) : __('admin.newShipping') ?></h2>
  <div class="grid-3">
    <?= form_input('code', t('admin.code'), ['value' => $m['code'] ?? '', 'required' => true, 'id' => 'code-' . ($m['id'] ?? 'new')]) ?>
    <?= form_input('name_bn', t('admin.nameBn'), ['value' => $m['name_bn'] ?? '', 'required' => true, 'id' => 'nbn-' . ($m['id'] ?? 'new')]) ?>
    <?= form_input('name_en', t('admin.nameEn'), ['value' => $m['name_en'] ?? '', 'required' => true, 'id' => 'nen-' . ($m['id'] ?? 'new')]) ?>
  </div>
  <div class="grid-3">
    <?= form_input('inside_dhaka_fee', t('admin.insideFee'), ['value' => $dec($m['inside_dhaka_fee'] ?? ''), 'required' => true, 'id' => 'in-' . ($m['id'] ?? 'new')]) ?>
    <?= form_input('outside_dhaka_fee', t('admin.outsideFee'), ['value' => $dec($m['outside_dhaka_fee'] ?? ''), 'required' => true, 'id' => 'out-' . ($m['id'] ?? 'new')]) ?>
    <?= form_input('free_threshold', t('admin.freeFrom'), ['value' => $dec($m['free_threshold'] ?? null), 'optional' => true, 'id' => 'free-' . ($m['id'] ?? 'new')]) ?>
  </div>
  <div class="grid-3">
    <?= form_input('min_days', t('admin.minDays'), ['value' => (string) ($m['min_days'] ?? '2'), 'required' => true, 'id' => 'min-' . ($m['id'] ?? 'new')]) ?>
    <?= form_input('max_days', t('admin.maxDays'), ['value' => (string) ($m['max_days'] ?? '5'), 'required' => true, 'id' => 'max-' . ($m['id'] ?? 'new')]) ?>
    <?= form_input('position', t('common.position'), ['value' => (string) ($m['position'] ?? '0'), 'id' => 'pos-' . ($m['id'] ?? 'new')]) ?>
  </div>
  <?= form_check('is_active', t('common.active'), (bool) ($m['is_active'] ?? true), ['id' => 'act-' . ($m['id'] ?? 'new')]) ?>
  <?= submit_button(t('common.save'), 'btn btn-outline') ?>
</form>
<?php endforeach; ?>
