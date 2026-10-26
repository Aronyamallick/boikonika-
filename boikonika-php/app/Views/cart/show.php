<?php use App\Core\Money; ?>
<div class="container">
  <div class="page-head"><h1><?= __('cart.title') ?></h1></div>
  <?php if (!$c['lines']): ?>
    <div class="card empty-state">
      <?= icon('cart') ?>
      <h2><?= __('cart.empty') ?></h2>
      <p><?= __('cart.emptyText') ?></p>
      <p><a class="btn btn-primary" href="<?= e(url('books')) ?>"><?= __('cart.browse') ?></a></p>
    </div>
  <?php else: ?>
  <div class="cart-layout mt-2">
    <div>
      <?php if ($c['problems']): ?><div class="alert alert-warning"><?= icon('alert') ?><div><?= __('cart.problems') ?></div></div><?php endif; ?>
      <?php foreach ($c['groups'] as $g): ?>
      <section class="card seller-group" aria-label="<?= e(t('cart.fromStore', ['store' => $g['store_name']])) ?>">
        <div class="seller-group-head">
          <strong><?= icon('store') ?> <a href="<?= e(url('stores/' . $g['store_slug'])) ?>"><?= e($g['store_name']) ?></a></strong>
          <span class="small muted"><?= __('cart.shipsSeparately') ?></span>
        </div>
        <?php foreach ($g['lines'] as $l): $href = url(($l['type'] === 'general' ? 'products/' : 'books/') . $l['slug']); ?>
        <div class="line-item">
          <div class="thumb"><?php if ($l['cover_path']): ?><img src="<?= e(upload_url($l['cover_path'])) ?>" alt=""><?php else: ?><div class="cover-placeholder"><?= e(mb_substr($l['title'], 0, 20)) ?></div><?php endif; ?></div>
          <div>
            <div class="row-between">
              <a href="<?= e($href) ?>"><strong><?= e($l['title']) ?></strong></a>
              <span class="price"><?= e(money($l['line_total'])) ?></span>
            </div>
            <p class="small muted mb-0"><?= __('status.condition.' . $l['item_condition']) ?> · <?= e(money($l['price'])) ?> <?= __('cart.each') ?></p>
            <?php if (!$l['available']): ?><p class="small text-danger mb-0"><?= __('cart.unavailable') ?></p>
            <?php elseif ($l['too_many']): ?><p class="small text-danger mb-0"><?= e(t('cart.onlyLeft', ['count' => num((int) $l['stock'])])) ?></p><?php endif; ?>
            <div class="line-controls">
              <?php if ($l['available']): ?>
              <form method="post" action="<?= e(url('cart/items/' . $l['item_id'])) ?>" class="row">
                <?= csrf_field() ?>
                <div class="qty" data-qty>
                  <button type="button" data-step="-1" aria-label="<?= __('cart.decrease') ?>">−</button>
                  <input type="number" name="quantity" value="<?= (int) min((int) $l['quantity'], max(1, (int) $l['stock'])) ?>" min="1" max="<?= (int) min(20, max(1, (int) $l['stock'])) ?>" aria-label="<?= e(t('cart.quantityOf', ['title' => $l['title']])) ?>" data-autosubmit>
                  <button type="button" data-step="1" aria-label="<?= __('cart.increase') ?>">+</button>
                </div>
                <noscript><button class="btn btn-outline btn-sm" type="submit"><?= __('common.update') ?></button></noscript>
              </form>
              <?php endif; ?>
              <form method="post" action="<?= e(url('cart/items/' . $l['item_id'] . '/remove')) ?>"><?= csrf_field() ?><button class="link-btn danger small" type="submit"><?= __('common.remove') ?><span class="sr-only"> <?= e($l['title']) ?></span></button></form>
            </div>
          </div>
        </div>
        <?php endforeach; ?>
      </section>
      <?php endforeach; ?>
    </div>
    <aside class="card summary" aria-labelledby="sum-h">
      <h2 id="sum-h"><?= __('cart.summary') ?></h2>
      <dl>
        <dt><?= e(tn('common.items', $c['items'])) ?></dt><dd><?= e(money($c['subtotal'])) ?></dd>
        <dt><?= __('common.shipping') ?></dt><dd class="muted"><?= __('cart.atCheckout') ?></dd>
      </dl>
      <p class="small muted"><?= e(tn('cart.parcels', count($c['groups']))) ?></p>
      <?php if ($c['items'] > 0): ?>
        <a class="btn btn-primary btn-block btn-lg" href="<?= e(url('checkout')) ?>"><?= __('cart.checkout') ?></a>
      <?php endif; ?>
      <p class="small muted mt-2 mb-0"><?= icon('lock', 'icon icon-sm') ?> <?= __('cart.secure') ?></p>
    </aside>
  </div>
  <?php endif; ?>
</div>
