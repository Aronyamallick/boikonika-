<h1><?= __('nav.wishlist') ?></h1>
<?php if (!$products): ?>
  <div class="card empty-state"><?= icon('heart') ?><h2><?= __('account.wishlistEmpty') ?></h2><p><?= __('account.wishlistEmptyText') ?></p><p><a class="btn btn-primary" href="<?= e(url('books')) ?>"><?= __('cart.browse') ?></a></p></div>
<?php else: ?>
  <div class="product-grid cols-4"><?php foreach ($products as $p): ?><?= partial('partials/product-card', ['p' => $p]) ?><?php endforeach; ?></div>
<?php endif; ?>
