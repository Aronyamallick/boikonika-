<?php if (!$products): ?>
<div class="empty-state card">
  <?= icon('book') ?>
  <h2><?= __('catalog.noResults') ?></h2>
  <p><?= e($emptyText ?? t('catalog.noResultsText')) ?></p>
</div>
<?php else: ?>
<div class="product-grid<?= !empty($cols4) ? ' cols-4' : '' ?>">
  <?php foreach ($products as $p): ?><?= partial('partials/product-card', ['p' => $p]) ?><?php endforeach; ?>
</div>
<?php endif; ?>
