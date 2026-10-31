<?php use App\Services\Geo; ?>
<h1><?= __('addresses.title') ?></h1>
<?php if (!$rows): ?><p class="muted"><?= __('addresses.none') ?></p><?php endif; ?>
<div class="grid-2">
  <?php foreach ($rows as $a): ?>
  <div class="card">
    <div class="row-between"><strong><?= e($a['name']) ?></strong><span class="row"><?php if ($a['label']): ?><span class="badge"><?= e($a['label']) ?></span><?php endif; ?><?php if ($a['is_default']): ?><span class="badge badge-primary"><?= __('addresses.default') ?></span><?php endif; ?></span></div>
    <p class="small muted mt-1"><?= e(digits($a['phone'])) ?><br><?= e($a['address_line']) ?>, <?= e($a['area']) ?><br><?= e(Geo::districtName($a['district'])) ?><?= $a['postcode'] ? ' ' . e(digits($a['postcode'])) : '' ?></p>
    <div class="row">
      <?php if (!$a['is_default']): ?><form method="post" action="<?= e(url('account/addresses/' . $a['id'] . '/default')) ?>"><?= csrf_field() ?><button class="btn btn-outline btn-sm" type="submit"><?= __('addresses.makeDefault') ?></button></form><?php endif; ?>
      <form method="post" action="<?= e(url('account/addresses/' . $a['id'] . '/delete')) ?>" data-confirm="<?= __('common.areYouSure') ?>"><?= csrf_field() ?><button class="btn btn-danger-outline btn-sm" type="submit"><?= __('common.delete') ?></button></form>
    </div>
  </div>
  <?php endforeach; ?>
</div>
<section class="card mt-3">
  <h2><?= __('checkout.addAddress') ?></h2>
  <form method="post" action="<?= e(url('account/addresses')) ?>" class="form">
    <?= csrf_field() ?>
    <div class="grid-2">
      <?= form_input('name', t('addresses.name'), ['required' => true, 'autocomplete' => 'name']) ?>
      <?= form_input('phone', t('addresses.phone'), ['type' => 'tel', 'required' => true, 'autocomplete' => 'tel']) ?>
    </div>
    <?= form_select('district', t('addresses.district'), $districts, ['placeholder' => t('common.select'), 'required' => true]) ?>
    <div class="grid-2">
      <?= form_input('area', t('addresses.area'), ['required' => true, 'hint' => t('addresses.areaHint')]) ?>
      <?= form_input('postcode', t('addresses.postcode'), ['optional' => true, 'attrs' => ['inputmode' => 'numeric']]) ?>
    </div>
    <?= form_input('address_line', t('addresses.line'), ['required' => true, 'hint' => t('addresses.lineHint'), 'autocomplete' => 'street-address']) ?>
    <?= form_input('label', t('addresses.label'), ['optional' => true, 'hint' => t('addresses.labelHint')]) ?>
    <?= submit_button(t('addresses.save')) ?>
  </form>
</section>
