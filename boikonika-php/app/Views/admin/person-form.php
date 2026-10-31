<?php
$isAuthors = $kind === 'authors';
$text = $isAuthors ? ['bio_bn', 'bio_en'] : ['description_bn', 'description_en'];
$img = $isAuthors ? ($row['photo_path'] ?? null) : ($row['logo_path'] ?? null);
?>
<p class="small mb-1"><a href="<?= e(url('admin/' . $kind)) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= $isAuthors ? __('admin.authors') : __('admin.publishers') ?></a></p>
<h1><?= e($title) ?></h1>
<form method="post" action="<?= e(url('admin/' . $kind)) ?>" enctype="multipart/form-data" class="card form">
  <?= csrf_field() ?>
  <input type="hidden" name="id" value="<?= (int) ($row['id'] ?? 0) ?>">
  <div class="grid-2"><?= form_input('name_bn', t('admin.nameBn'), ['value' => $row['name_bn'] ?? '', 'required' => true]) ?><?= form_input('name_en', t('admin.nameEn'), ['value' => $row['name_en'] ?? '', 'optional' => true]) ?></div>
  <?= form_input('slug', t('admin.slug'), ['value' => $row['slug'] ?? '', 'optional' => true, 'hint' => t('admin.slugHint')]) ?>
  <?php if (!$isAuthors): ?><?= form_input('website', t('admin.website'), ['value' => $row['website'] ?? '', 'optional' => true, 'type' => 'url']) ?><?php endif; ?>
  <?= form_textarea($text[0], $isAuthors ? t('admin.bioBn') : t('admin.aboutBn'), ['value' => $row[$text[0]] ?? '', 'optional' => true, 'rows' => 5]) ?>
  <?= form_textarea($text[1], $isAuthors ? t('admin.bioEn') : t('admin.aboutEn'), ['value' => $row[$text[1]] ?? '', 'optional' => true, 'rows' => 5]) ?>
  <?php if ($img): ?><img class="preview-img" src="<?= e(upload_url($img)) ?>" alt=""><?php endif; ?>
  <?= form_file('image', $isAuthors ? t('admin.photo') : t('seller.logo'), ['optional' => true, 'preview' => true]) ?>
  <?= submit_button(t('common.saveChanges')) ?>
</form>
<?php if (!empty($row['slug'])): ?><p><a href="<?= e(url($kind . '/' . $row['slug'])) ?>"><?= __('seller.viewOnSite') ?> <?= icon('external', 'icon icon-sm') ?></a></p><?php endif; ?>
