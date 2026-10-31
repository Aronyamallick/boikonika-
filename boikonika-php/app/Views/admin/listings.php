<h1><?= __('admin.listings') ?></h1>
<?= partial('partials/status-tabs', ['base' => 'admin/listings', 'tabs' => ['' => t('common.all'), 'active' => t('status.listing.active'), 'paused' => t('status.listing.paused'), 'suspended' => t('status.listing.suspended')], 'current' => $status, 'keep' => ['q' => $q]]) ?>
<form class="toolbar" method="get" action="<?= e(url('admin/listings')) ?>" role="search">
  <?php if ($status): ?><input type="hidden" name="status" value="<?= e($status) ?>"><?php endif; ?>
  <div class="field"><label class="sr-only" for="lq"><?= __('common.search') ?></label><input id="lq" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= __('admin.searchListings') ?>"></div>
  <button class="btn btn-outline" type="submit"><?= __('common.search') ?></button>
</form>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('seller.item') ?></th><th><?= __('admin.store') ?></th><th><?= __('catalog.condition') ?></th><th class="num"><?= __('common.price') ?></th><th class="num"><?= __('seller.stock') ?></th><th><?= __('common.status') ?></th><th></th></tr></thead>
  <tbody><?php foreach ($rows as $l): ?><tr>
    <td><a href="<?= e(url('admin/products/' . $l['product_id'])) ?>"><?= e($l['title']) ?></a></td>
    <td class="small"><a href="<?= e(url('admin/sellers/' . $l['seller_id'])) ?>"><?= e($l['store_name']) ?></a></td>
    <td class="small"><?= __('status.condition.' . $l['item_condition']) ?></td>
    <td class="num"><?= e(money($l['price'])) ?></td>
    <td class="num"><?= e(num((int) $l['stock'])) ?></td>
    <td><span class="badge<?= $l['status'] === 'suspended' ? ' badge-danger' : '' ?>"><?= e(status_label('listing', $l['status'])) ?></span><?php if ($l['suspended_reason']): ?><br><span class="small subtle"><?= e($l['suspended_reason']) ?></span><?php endif; ?></td>
    <td><form method="post" action="<?= e(url('admin/listings/' . $l['id'] . '/status')) ?>" class="row">
      <?= csrf_field() ?>
      <?php if ($l['status'] !== 'suspended'): ?><label class="sr-only" for="sr-<?= (int) $l['id'] ?>"><?= __('common.reason') ?></label><input id="sr-<?= (int) $l['id'] ?>" name="reason" placeholder="<?= __('common.reason') ?>" maxlength="255"><button class="btn btn-danger-outline btn-sm" type="submit" name="action" value="suspend"><?= __('admin.suspend') ?></button>
      <?php else: ?><button class="btn btn-outline btn-sm" type="submit" name="action" value="reinstate"><?= __('admin.reinstate') ?></button><?php endif; ?>
    </form></td>
  </tr><?php endforeach; ?></tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
