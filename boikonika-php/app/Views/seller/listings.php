<?php $tabs = ['' => t('common.all'), 'active' => t('status.listing.active'), 'paused' => t('status.listing.paused'), 'empty' => t('common.outOfStock'), 'review' => t('seller.inReview'), 'suspended' => t('status.listing.suspended')]; ?>
<div class="row-between mb-2">
  <h1 class="mb-0"><?= __('seller.listings') ?></h1>
  <a class="btn btn-primary" href="<?= e(url('seller/listings/new')) ?>"><?= icon('plus') ?><?= __('seller.addListing') ?></a>
</div>
<div class="status-tabs"><?php foreach ($tabs as $k => $v): ?><a class="chip" href="<?= e(url('seller/listings', array_filter(['status' => $k, 'q' => $q]))) ?>"<?= $status === $k ? ' aria-current="page"' : '' ?>><?= e($v) ?></a><?php endforeach; ?></div>
<form class="toolbar" method="get" action="<?= e(url('seller/listings')) ?>" role="search">
  <?php if ($status): ?><input type="hidden" name="status" value="<?= e($status) ?>"><?php endif; ?>
  <div class="field"><label class="sr-only" for="lq"><?= __('common.search') ?></label><input id="lq" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= __('seller.searchListings') ?>"></div>
  <button class="btn btn-outline" type="submit"><?= __('common.search') ?></button>
</form>
<?php if (!$rows): ?>
  <div class="card empty-state"><?= icon('book') ?><h2><?= __('seller.noListings') ?></h2><p><a class="btn btn-primary" href="<?= e(url('seller/listings/new')) ?>"><?= __('seller.addListing') ?></a></p></div>
<?php else: ?>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('seller.item') ?></th><th><?= __('catalog.condition') ?></th><th class="num"><?= __('common.price') ?></th><th class="num"><?= __('seller.stock') ?></th><th><?= __('common.status') ?></th><th></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $l): ?>
    <tr>
      <td><strong><?= e($l['title']) ?></strong><?php if ($l['product_status'] !== 'active'): ?><br><span class="badge <?= $l['product_status'] === 'rejected' ? 'badge-danger' : 'badge-warning' ?>"><?= e(status_label('product', $l['product_status'])) ?></span><?php if ($l['review_note']): ?> <span class="small muted"><?= e($l['review_note']) ?></span><?php endif; ?><?php endif; ?><?php if ($l['sku']): ?><br><span class="small subtle mono"><?= e($l['sku']) ?></span><?php endif; ?></td>
      <td class="small"><?= __('status.condition.' . $l['item_condition']) ?></td>
      <td class="num"><?= e(money($l['price'])) ?></td>
      <td class="num<?= (int) $l['stock'] === 0 ? ' text-danger' : '' ?>"><?= e(num((int) $l['stock'])) ?></td>
      <td><span class="badge<?= $l['status'] === 'active' ? ' badge-success' : ($l['status'] === 'suspended' ? ' badge-danger' : '') ?>"><?= e(status_label('listing', $l['status'])) ?></span></td>
      <td class="right"><a class="btn btn-outline btn-sm" href="<?= e(url('seller/listings/' . $l['id'])) ?>"><?= __('common.edit') ?></a></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
<?php endif; ?>
