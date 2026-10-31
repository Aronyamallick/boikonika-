<div class="row-between mb-2"><h1 class="mb-0"><?= __('admin.pages') ?></h1><a class="btn btn-primary" href="<?= e(url('admin/pages/new')) ?>"><?= icon('plus') ?><?= __('admin.newPage') ?></a></div>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('admin.title') ?></th><th><?= __('admin.slug') ?></th><th><?= __('admin.footer') ?></th><th><?= __('admin.updated') ?></th><th></th></tr></thead>
  <tbody><?php foreach ($rows as $p): ?><tr><td><?= e(lf($p, 'title')) ?><?= $p['is_published'] ? '' : ' <span class="badge">' . __('admin.draft') . '</span>' ?></td><td class="mono small"><?= e($p['slug']) ?></td><td class="small"><?= __('admin.footerGroup.' . $p['footer_group']) ?></td><td class="small"><?= e(fdate($p['updated_at'])) ?></td><td class="right"><a class="btn btn-outline btn-sm" href="<?= e(url('admin/pages/' . $p['id'])) ?>"><?= __('common.edit') ?></a></td></tr><?php endforeach; ?></tbody>
</table></div>
