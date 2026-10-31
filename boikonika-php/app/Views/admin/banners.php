<?php $b = $edit ?? []; $dt = static fn ($v) => $v ? str_replace(' ', 'T', substr((string) $v, 0, 16)) : ''; ?>
<h1><?= __('admin.banners') ?></h1>
<p class="muted"><?= __('admin.bannersHint') ?></p>
<div class="grid-2">
  <div>
  <?php foreach ($rows as $r): ?>
    <div class="card card-tight">
      <?php if ($r['image_path']): ?><img class="preview-img" src="<?= e(upload_url($r['image_path'])) ?>" alt=""><?php endif; ?>
      <p class="mb-1"><strong><?= e(lf($r, 'title')) ?></strong><?= $r['is_active'] ? '' : ' <span class="badge">' . __('common.inactive') . '</span>' ?></p>
      <p class="small muted mb-1"><?= e((string) $r['link_url']) ?></p>
      <div class="row"><a class="btn btn-outline btn-sm" href="<?= e(url('admin/banners', ['edit' => $r['id']])) ?>"><?= __('common.edit') ?></a><form method="post" action="<?= e(url('admin/banners/' . $r['id'] . '/delete')) ?>" data-confirm="<?= __('common.areYouSure') ?>"><?= csrf_field() ?><button class="link-btn danger small" type="submit"><?= __('common.delete') ?></button></form></div>
    </div>
  <?php endforeach; ?>
  </div>
  <form method="post" action="<?= e(url('admin/banners')) ?>" enctype="multipart/form-data" class="card">
    <?= csrf_field() ?>
    <h2 class="h3"><?= $b ? __('common.edit') : __('admin.newBanner') ?></h2>
    <input type="hidden" name="id" value="<?= (int) ($b['id'] ?? 0) ?>">
    <?= form_input('title_bn', t('admin.titleBn'), ['value' => $b['title_bn'] ?? '', 'required' => true]) ?>
    <?= form_input('title_en', t('admin.titleEn'), ['value' => $b['title_en'] ?? '', 'required' => true]) ?>
    <?= form_input('subtitle_bn', t('admin.subtitleBn'), ['value' => $b['subtitle_bn'] ?? '', 'optional' => true]) ?>
    <?= form_input('subtitle_en', t('admin.subtitleEn'), ['value' => $b['subtitle_en'] ?? '', 'optional' => true]) ?>
    <?= form_input('link_url', t('admin.link'), ['value' => $b['link_url'] ?? '', 'optional' => true, 'hint' => t('admin.linkFormat')]) ?>
    <?= form_file('image', t('common.image'), ['optional' => true, 'hint' => t('admin.bannerImageHint'), 'preview' => true]) ?>
    <div class="grid-2"><?= form_input('starts_at', t('admin.starts'), ['type' => 'datetime-local', 'value' => $dt($b['starts_at'] ?? null), 'optional' => true]) ?><?= form_input('ends_at', t('admin.ends'), ['type' => 'datetime-local', 'value' => $dt($b['ends_at'] ?? null), 'optional' => true]) ?></div>
    <?= form_input('position', t('common.position'), ['value' => (string) ($b['position'] ?? '0')]) ?>
    <?= form_check('is_active', t('common.active'), (bool) ($b['is_active'] ?? true)) ?>
    <div class="row"><?= submit_button(t('common.save')) ?><?php if ($b): ?><a class="btn btn-ghost" href="<?= e(url('admin/banners')) ?>"><?= __('common.cancel') ?></a><?php endif; ?></div>
  </form>
</div>
