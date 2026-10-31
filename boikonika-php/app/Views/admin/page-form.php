<p class="small mb-1"><a href="<?= e(url('admin/pages')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('admin.pages') ?></a></p>
<h1><?= e($title) ?></h1>
<form method="post" action="<?= e(url('admin/pages')) ?>" class="card form form-wide">
  <?= csrf_field() ?>
  <input type="hidden" name="id" value="<?= (int) ($p['id'] ?? 0) ?>">
  <div class="grid-3">
    <?= form_input('slug', t('admin.slug'), ['value' => $p['slug'] ?? '', 'required' => true]) ?>
    <?= form_select('footer_group', t('admin.footer'), ['none' => t('admin.footerGroup.none'), 'company' => t('admin.footerGroup.company'), 'support' => t('admin.footerGroup.support'), 'policies' => t('admin.footerGroup.policies')], ['value' => $p['footer_group'] ?? 'none']) ?>
    <?= form_input('position', t('common.position'), ['value' => (string) ($p['position'] ?? '0')]) ?>
  </div>
  <div class="grid-2">
    <div><?= form_input('title_bn', t('admin.titleBn'), ['value' => $p['title_bn'] ?? '', 'required' => true]) ?><?= form_textarea('body_bn', t('admin.bodyBn'), ['value' => $p['body_bn'] ?? '', 'rows' => 20, 'hint' => t('admin.markdownFull')]) ?></div>
    <div><?= form_input('title_en', t('admin.titleEn'), ['value' => $p['title_en'] ?? '', 'required' => true]) ?><?= form_textarea('body_en', t('admin.bodyEn'), ['value' => $p['body_en'] ?? '', 'rows' => 20]) ?></div>
  </div>
  <?= form_check('is_published', t('admin.published'), (bool) ($p['is_published'] ?? true)) ?>
  <div class="row"><?= submit_button(t('common.saveChanges')) ?><?php if (!empty($p['slug'])): ?><a class="btn btn-ghost" href="<?= e(url('pages/' . $p['slug'])) ?>" target="_blank"><?= __('seller.viewOnSite') ?></a><?php endif; ?></div>
</form>
