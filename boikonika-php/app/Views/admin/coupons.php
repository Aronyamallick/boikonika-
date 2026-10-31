<?php
$c = $edit ?? [];
$dt = static fn ($v) => $v ? str_replace(' ', 'T', substr((string) $v, 0, 16)) : '';
$dec = static fn ($v) => $v === null || $v === '' ? '' : \App\Core\Money::toDecimal(\App\Core\Money::toPoisha($v));
?>
<h1><?= __('admin.coupons') ?></h1>
<div class="grid-2">
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('admin.code') ?></th><th><?= __('admin.value') ?></th><th><?= __('admin.used') ?></th><th></th></tr></thead>
    <tbody><?php foreach ($rows as $r): ?><tr>
      <td><strong class="mono"><?= e($r['code']) ?></strong><?= $r['is_active'] ? '' : ' <span class="badge">' . __('common.inactive') . '</span>' ?><?php if ($r['ends_at']): ?><br><span class="small subtle"><?= e(t('admin.until', ['date' => fdate($r['ends_at'])])) ?></span><?php endif; ?></td>
      <td><?= $r['type'] === 'percent' ? e(num((string) (float) $r['value'])) . '%' : e(money($r['value'])) ?><?php if ($r['min_order']): ?><br><span class="small subtle"><?= e(t('admin.minOrder', ['amount' => money($r['min_order'])])) ?></span><?php endif; ?></td>
      <td class="small"><?= e(num((int) $r['used_count'])) ?><?= $r['usage_limit'] ? ' / ' . e(num((int) $r['usage_limit'])) : '' ?><br><span class="subtle"><?= e(money($r['given'])) ?></span></td>
      <td class="right"><a class="btn btn-outline btn-sm" href="<?= e(url('admin/coupons', ['edit' => $r['id']])) ?>"><?= __('common.edit') ?></a></td>
    </tr><?php endforeach; ?></tbody>
  </table></div>
  <form method="post" action="<?= e(url('admin/coupons')) ?>" class="card">
    <?= csrf_field() ?>
    <h2 class="h3"><?= $c ? __('common.edit') : __('admin.newCoupon') ?></h2>
    <input type="hidden" name="id" value="<?= (int) ($c['id'] ?? 0) ?>">
    <?= form_input('code', t('admin.code'), ['value' => $c['code'] ?? '', 'required' => true, 'hint' => t('admin.codeFormat')]) ?>
    <?= form_input('description', t('admin.description'), ['value' => $c['description'] ?? '', 'optional' => true]) ?>
    <div class="grid-2">
      <?= form_select('type', t('admin.type'), ['percent' => t('admin.percentOff'), 'fixed' => t('admin.fixedOff')], ['value' => $c['type'] ?? 'percent']) ?>
      <?= form_input('value', t('admin.value'), ['value' => $dec($c['value'] ?? ''), 'required' => true]) ?>
    </div>
    <div class="grid-2">
      <?= form_input('max_discount', t('admin.maxDiscount'), ['value' => $dec($c['max_discount'] ?? null), 'optional' => true]) ?>
      <?= form_input('min_order', t('admin.minOrderLabel'), ['value' => $dec($c['min_order'] ?? null), 'optional' => true]) ?>
    </div>
    <div class="grid-2">
      <?= form_input('starts_at', t('admin.starts'), ['type' => 'datetime-local', 'value' => $dt($c['starts_at'] ?? null), 'optional' => true]) ?>
      <?= form_input('ends_at', t('admin.ends'), ['type' => 'datetime-local', 'value' => $dt($c['ends_at'] ?? null), 'optional' => true]) ?>
    </div>
    <div class="grid-2">
      <?= form_input('usage_limit', t('admin.usageLimit'), ['value' => (string) ($c['usage_limit'] ?? ''), 'optional' => true]) ?>
      <?= form_input('per_user_limit', t('admin.perUserLimit'), ['value' => (string) ($c['per_user_limit'] ?? '1'), 'optional' => true]) ?>
    </div>
    <?= form_check('is_active', t('common.active'), (bool) ($c['is_active'] ?? true)) ?>
    <p class="small muted"><?= __('admin.couponCost') ?></p>
    <div class="row"><?= submit_button(t('common.save')) ?><?php if ($c): ?><a class="btn btn-ghost" href="<?= e(url('admin/coupons')) ?>"><?= __('common.cancel') ?></a><?php endif; ?></div>
  </form>
</div>
