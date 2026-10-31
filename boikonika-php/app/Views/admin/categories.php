<?php $c = $edit ?? []; ?>
<h1><?= __('admin.categories') ?></h1>
<div class="grid-2">
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('common.name') ?></th><th class="num"><?= __('admin.products') ?></th><th></th></tr></thead>
    <tbody><?php foreach ($all as $row): ?><tr>
      <td><?= $row['parent_id'] ? '— ' : '<strong>' ?><?= e(lf($row, 'name')) ?><?= $row['parent_id'] ? '' : '</strong>' ?> <span class="small subtle mono"><?= e($row['slug']) ?></span><?= $row['is_active'] ? '' : ' <span class="badge">' . __('common.inactive') . '</span>' ?><br><span class="small subtle"><?= $row['kind'] === 'book' ? __('nav.books') : __('nav.products') ?></span></td>
      <td class="num"><?= e(num((int) $row['products'])) ?></td>
      <td class="right nowrap"><a class="btn btn-outline btn-sm" href="<?= e(url('admin/categories', ['edit' => $row['id']])) ?>"><?= __('common.edit') ?></a>
        <?php if (!(int) $row['products']): ?><form method="post" action="<?= e(url('admin/categories/' . $row['id'] . '/delete')) ?>" class="inline-form" data-confirm="<?= __('common.areYouSure') ?>"><?= csrf_field() ?><button class="link-btn danger small" type="submit"><?= __('common.delete') ?></button></form><?php endif; ?></td>
    </tr><?php endforeach; ?></tbody>
  </table></div>
  <form method="post" action="<?= e(url('admin/categories')) ?>" class="card">
    <?= csrf_field() ?>
    <h2 class="h3"><?= $c ? __('common.edit') : __('admin.newCategory') ?></h2>
    <input type="hidden" name="id" value="<?= (int) ($c['id'] ?? 0) ?>">
    <?= form_input('name_bn', t('admin.nameBn'), ['value' => $c['name_bn'] ?? '', 'required' => true]) ?>
    <?= form_input('name_en', t('admin.nameEn'), ['value' => $c['name_en'] ?? '', 'required' => true]) ?>
    <?= form_input('slug', t('admin.slug'), ['value' => $c['slug'] ?? '', 'optional' => true, 'hint' => t('admin.slugHint')]) ?>
    <?= form_select('kind', t('admin.type'), ['book' => t('nav.books'), 'general' => t('nav.products')], ['value' => $c['kind'] ?? 'book']) ?>
    <?php $opts = ['' => t('admin.topLevel')]; foreach ($parents as $pr) { $opts[(string) $pr['id']] = lf($pr, 'name') . ' (' . ($pr['kind'] === 'book' ? t('nav.books') : t('nav.products')) . ')'; } ?>
    <?= form_select('parent_id', t('admin.parent'), $opts, ['value' => (string) ($c['parent_id'] ?? '')]) ?>
    <div class="grid-2"><?= form_input('position', t('common.position'), ['value' => (string) ($c['position'] ?? '0')]) ?><?= form_input('icon', t('admin.icon'), ['value' => $c['icon'] ?? '', 'optional' => true]) ?></div>
    <?= form_check('is_active', t('common.active'), (bool) ($c['is_active'] ?? true)) ?>
    <div class="row"><?= submit_button(t('common.save')) ?><?php if ($c): ?><a class="btn btn-ghost" href="<?= e(url('admin/categories')) ?>"><?= __('common.cancel') ?></a><?php endif; ?></div>
  </form>
</div>
