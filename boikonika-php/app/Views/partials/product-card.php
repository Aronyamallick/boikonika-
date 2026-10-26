<?php
use App\Services\Catalog;

/** @var array $p */
$href = Catalog::productUrl($p);
$hasCompare = !empty($p['compare_price']) && \App\Core\Money::toPoisha($p['compare_price']) > \App\Core\Money::toPoisha($p['min_price']);
?>
<article class="product-card">
  <div class="cover<?= $p['type'] === 'general' ? ' contain' : '' ?>">
    <?php if ($p['cover_path']): ?>
      <img src="<?= e(upload_url($p['cover_path'])) ?>" alt="" loading="lazy" width="300" height="400">
    <?php else: ?>
      <div class="cover-placeholder" aria-hidden="true"><?= e(mb_substr($p['title'], 0, 40)) ?></div>
    <?php endif; ?>
  </div>
  <div class="flags">
    <?php if ((int) $p['max_discount_percent'] > 0): ?><span class="badge badge-accent"><?= e(t('catalog.percentOff', ['percent' => num((int) $p['max_discount_percent'])])) ?></span><?php endif; ?>
    <?php if ((int) $p['has_used'] === 1): ?><span class="badge badge-teal"><?= __('catalog.usedAvailable') ?></span><?php endif; ?>
  </div>
  <div class="body">
    <a class="title" href="<?= e($href) ?>"><?= e($p['title']) ?></a>
    <?php if (!empty($p['author_names'])): ?><div class="byline"><?= e($p['author_names']) ?></div><?php endif; ?>
    <?php if ((int) $p['rating_count'] > 0): ?>
      <div class="rating" aria-label="<?= e(t('catalog.ratingLabel', ['rating' => digits(number_format((float) $p['rating_avg'], 1)), 'count' => num((int) $p['rating_count'])])) ?>"><?= icon('star', 'icon icon-fill') ?><span><?= e(digits(number_format((float) $p['rating_avg'], 1))) ?></span><span class="count">(<?= e(num((int) $p['rating_count'])) ?>)</span></div>
    <?php endif; ?>
    <div class="price-row">
      <?php if ($p['min_price'] !== null): ?>
        <span class="price"><?php if ((int) $p['offer_count'] > 1): ?><span class="small muted"><?= __('common.from') ?></span> <?php endif; ?><?= e(money($p['min_price'])) ?></span>
        <?php if ($hasCompare): ?><span class="price-old"><span class="sr-only"><?= __('catalog.regularPrice') ?></span><?= e(money($p['compare_price'])) ?></span><?php endif; ?>
      <?php else: ?>
        <span class="small muted"><?= __('catalog.unavailable') ?></span>
      <?php endif; ?>
    </div>
  </div>
</article>
