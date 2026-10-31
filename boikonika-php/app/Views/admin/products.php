<div class="row-between mb-2">
  <h1 class="mb-0"><?= __('admin.products') ?></h1>
  <div class="row"><a class="btn btn-outline" href="<?= e(url('admin/products/new', ['type' => 'general'])) ?>"><?= icon('plus') ?><?= __('admin.newGeneral') ?></a><a class="btn btn-primary" href="<?= e(url('admin/products/new')) ?>"><?= icon('plus') ?><?= __('admin.newBook') ?></a></div>
</div>
<?= partial('partials/status-tabs', ['base' => 'admin/products', 'tabs' => ['' => t('common.all'), 'pending' => t('status.product.pending'), 'active' => t('status.product.active'), 'rejected' => t('status.product.rejected'), 'archived' => t('status.product.archived')], 'current' => $status, 'counts' => $counts, 'keep' => ['q' => $q, 'type' => $type]]) ?>
<form class="toolbar" method="get" action="<?= e(url('admin/products')) ?>" role="search">
  <?php if ($status): ?><input type="hidden" name="status" value="<?= e($status) ?>"><?php endif; ?>
  <div class="field"><label class="sr-only" for="pq"><?= __('common.search') ?></label><input id="pq" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= __('seller.findPlaceholder') ?>"></div>
  <div class="field"><label class="sr-only" for="pt"><?= __('admin.type') ?></label><select id="pt" name="type"><option value=""><?= __('common.all') ?></option><option value="book"<?= selected('book', $type) ?>><?= __('nav.books') ?></option><option value="general"<?= selected('general', $type) ?>><?= __('nav.products') ?></option></select></div>
  <button class="btn btn-outline" type="submit"><?= __('common.filter') ?></button>
</form>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('seller.item') ?></th><th><?= __('admin.addedBy') ?></th><th><?= __('common.status') ?></th><th class="num"><?= __('admin.offers') ?></th><th class="num"><?= __('admin.from') ?></th><th></th></tr></thead>
  <tbody><?php foreach ($rows as $p): ?><tr>
    <td><a href="<?= e(url('admin/products/' . $p['id'])) ?>"><strong><?= e($p['title']) ?></strong></a><?= $p['is_featured'] ? ' <span class="badge badge-accent">' . __('admin.featured') . '</span>' : '' ?><br><span class="small subtle"><?= $p['type'] === 'book' ? __('nav.books') : __('nav.products') ?><?= $p['isbn'] ? ' · ' . e($p['isbn']) : '' ?></span></td>
    <td class="small"><?= e((string) ($p['store_name'] ?? t('admin.staff'))) ?></td>
    <td><span class="badge<?= $p['status'] === 'pending' ? ' badge-warning' : ($p['status'] === 'active' ? ' badge-success' : '') ?>"><?= e(status_label('product', $p['status'])) ?></span></td>
    <td class="num"><?= e(num((int) $p['offer_count'])) ?></td>
    <td class="num"><?= $p['min_price'] !== null ? e(money($p['min_price'])) : '—' ?></td>
    <td class="right"><?php if ($p['status'] === 'pending'): ?><form method="post" action="<?= e(url('admin/products/' . $p['id'] . '/review')) ?>" class="inline-form"><?= csrf_field() ?><button class="btn btn-primary btn-sm" type="submit" name="action" value="approve"><?= __('admin.approve') ?></button></form><?php endif; ?></td>
  </tr><?php endforeach; ?></tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
