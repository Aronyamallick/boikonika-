<?php use App\Services\Geo; ?>
<div class="container">
  <?php if ($store['banner_path']): ?><div class="store-banner"><img src="<?= e(upload_url($store['banner_path'])) ?>" alt=""></div><?php endif; ?>
  <div class="store-head">
    <span class="store-logo"><?php if ($store['logo_path']): ?><img src="<?= e(upload_url($store['logo_path'])) ?>" alt=""><?php else: ?><?= e(mb_substr($store['store_name'], 0, 1)) ?><?php endif; ?></span>
    <div class="grow">
      <h1 class="mb-0"><?= e($store['store_name']) ?> <span class="badge badge-success"><?= icon('badge-check', 'icon icon-sm') ?><?= __('catalog.verifiedSeller') ?></span></h1>
      <p class="muted mb-0"><?= icon('map-pin', 'icon icon-sm') ?> <?= e(Geo::districtName($store['district'])) ?> · <?= e(t('catalog.sellingSince', ['date' => fdate($store['approved_at'] ?? $store['created_at'])])) ?> · <?= e(tn('catalog.deliveredOrders', (int) $stats['delivered'])) ?></p>
    </div>
    <form method="get" action="<?= e(url('stores/' . $store['slug'])) ?>" role="search" class="row">
      <label class="sr-only" for="sq"><?= __('catalog.searchStore') ?></label>
      <input id="sq" type="search" name="q" value="<?= e($_GET['q'] ?? '') ?>" placeholder="<?= __('catalog.searchStore') ?>">
      <button class="btn btn-outline" type="submit"><?= __('common.search') ?></button>
    </form>
  </div>
  <?php if ($store['description']): ?><div class="card prose mb-3"><?= \App\Core\Markdown::render($store['description']) ?></div><?php endif; ?>
  <?= partial('partials/product-grid', ['products' => $products]) ?>
  <?= partial('partials/pagination', ['pager' => $pager]) ?>
</div>
