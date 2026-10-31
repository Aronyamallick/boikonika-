<h1><?= __('admin.sellers') ?></h1>
<?= partial('partials/status-tabs', ['base' => 'admin/sellers', 'tabs' => ['' => t('common.all'), 'pending' => t('status.seller.pending'), 'approved' => t('status.seller.approved'), 'rejected' => t('status.seller.rejected'), 'suspended' => t('status.seller.suspended')], 'current' => $status, 'counts' => $counts, 'keep' => ['q' => $q]]) ?>
<form class="toolbar" method="get" action="<?= e(url('admin/sellers')) ?>" role="search">
  <?php if ($status): ?><input type="hidden" name="status" value="<?= e($status) ?>"><?php endif; ?>
  <div class="field"><label class="sr-only" for="sq"><?= __('common.search') ?></label><input id="sq" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= __('admin.searchSellers') ?>"></div>
  <button class="btn btn-outline" type="submit"><?= __('common.search') ?></button>
</form>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('admin.store') ?></th><th><?= __('admin.owner') ?></th><th><?= __('sell.businessType') ?></th><th><?= __('common.status') ?></th><th class="num"><?= __('seller.listings') ?></th><th><?= __('admin.updated') ?></th></tr></thead>
  <tbody><?php foreach ($rows as $s): ?><tr>
    <td><a href="<?= e(url('admin/sellers/' . $s['id'])) ?>"><?= e($s['store_name']) ?></a><br><span class="small subtle"><?= e(\App\Services\Geo::districtName($s['district'])) ?></span></td>
    <td class="small"><?= e($s['owner']) ?><br><?= e((string) $s['owner_email']) ?></td>
    <td class="small"><?= __('sell.types.' . $s['business_type']) ?></td>
    <td><span class="badge<?= $s['status'] === 'pending' ? ' badge-warning' : ($s['status'] === 'approved' ? ' badge-success' : ' badge-danger') ?>"><?= e(status_label('seller', $s['status'])) ?></span></td>
    <td class="num"><?= e(num((int) $s['listings'])) ?></td>
    <td class="small nowrap"><?= e(fdate($s['updated_at'])) ?></td>
  </tr><?php endforeach; ?></tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
