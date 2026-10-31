<?php
use App\Core\Auth;
use App\Core\Markdown;
use App\Core\Money;
use App\Services\Geo;

$authors = array_values(array_filter($p['authors'], static fn ($a) => $a['role'] === 'author'));
$others = array_values(array_filter($p['authors'], static fn ($a) => $a['role'] !== 'author'));
$crumbs = [];
foreach ($trail as $c) {
    $crumbs[] = [lf($c, 'name'), url('categories/' . $c['slug'])];
}
$crumbs[] = [$p['title'], null];
$langs = ['bn' => t('catalog.langBn'), 'en' => t('catalog.langEn'), 'ar' => t('catalog.langAr'), 'other' => t('catalog.langOther')];
$bindings = ['hardcover' => t('catalog.hardcover'), 'paperback' => t('catalog.paperback'), 'other' => t('catalog.otherBinding')];
$totalReviews = array_sum($dist);
$isBook = $p['type'] === 'book';
?>
<div class="container">
  <?= partial('partials/breadcrumbs', ['items' => $crumbs]) ?>
  <div class="product-layout">
    <div class="product-media">
      <div class="main-cover">
        <?php if ($p['cover_path']): ?><img src="<?= e(upload_url($p['cover_path'])) ?>" alt="<?= e(t('catalog.coverOf', ['title' => $p['title']])) ?>" width="380" height="506">
        <?php else: ?><div class="cover-placeholder"><?= e($p['title']) ?></div><?php endif; ?>
      </div>
      <?php if ($p['images']): ?>
      <div class="thumbs"><?php foreach ($p['images'] as $img): ?><a href="<?= e(upload_url($img['path'])) ?>" target="_blank" rel="noopener"><img src="<?= e(upload_url($img['path'])) ?>" alt="" loading="lazy"></a><?php endforeach; ?></div>
      <?php endif; ?>
    </div>

    <div class="product-info">
      <h1><?= e($p['title']) ?></h1>
      <?php if ($p['subtitle']): ?><p class="subtitle"><?= e($p['subtitle']) ?></p><?php endif; ?>
      <?php if ($authors): ?>
        <p class="byline-lg"><?= __('catalog.byAuthors') ?> <?php foreach ($authors as $i => $a): ?><?= $i ? ', ' : '' ?><a href="<?= e(url('authors/' . $a['slug'])) ?>"><?= e(lf($a, 'name')) ?></a><?php endforeach; ?></p>
      <?php endif; ?>
      <?php foreach ($others as $a): ?><p class="small muted mb-1"><?= __('catalog.role.' . $a['role']) ?>: <a href="<?= e(url('authors/' . $a['slug'])) ?>"><?= e(lf($a, 'name')) ?></a></p><?php endforeach; ?>
      <?php if ((int) $p['rating_count'] > 0): ?>
        <p class="row"><?= partial('partials/stars', ['rating' => $p['rating_avg']]) ?><a href="#reviews" class="small"><?= e(tn('catalog.reviewCount', (int) $p['rating_count'])) ?></a></p>
      <?php endif; ?>
      <dl class="facts">
        <?php if ($p['publisher_slug']): ?><dt><?= __('catalog.publisher') ?></dt><dd><a href="<?= e(url('publishers/' . $p['publisher_slug'])) ?>"><?= e(lf(['name_bn' => $p['publisher_name_bn'], 'name_en' => $p['publisher_name_en']], 'name')) ?></a></dd><?php endif; ?>
        <?php if ($p['isbn']): ?><dt>ISBN</dt><dd class="mono"><?= e($p['isbn']) ?></dd><?php endif; ?>
        <?php if ($isBook): ?><dt><?= __('catalog.language') ?></dt><dd><?= e($langs[$p['language']] ?? $p['language']) ?></dd><?php endif; ?>
        <?php if ($p['edition']): ?><dt><?= __('catalog.edition') ?></dt><dd><?= e($p['edition']) ?></dd><?php endif; ?>
        <?php if ($p['pages']): ?><dt><?= __('catalog.pages') ?></dt><dd><?= e(num((int) $p['pages'])) ?></dd><?php endif; ?>
        <?php if ($p['binding']): ?><dt><?= __('catalog.binding') ?></dt><dd><?= e($bindings[$p['binding']] ?? '') ?></dd><?php endif; ?>
        <?php if ($p['published_year']): ?><dt><?= __('catalog.published') ?></dt><dd><?= e(digits((string) $p['published_year'])) ?></dd><?php endif; ?>
        <?php if ($p['brand']): ?><dt><?= __('catalog.brand') ?></dt><dd><?= e($p['brand']) ?></dd><?php endif; ?>
        <?php if ($trail): ?><dt><?= __('catalog.category') ?></dt><dd><a href="<?= e(url('categories/' . end($trail)['slug'])) ?>"><?= e(lf(end($trail), 'name')) ?></a></dd><?php endif; ?>
      </dl>
      <form method="post" action="<?= e(url('wishlist/' . $p['id'])) ?>" class="mb-2">
        <?= csrf_field() ?>
        <button class="btn btn-outline btn-sm" type="submit" aria-pressed="<?= $wished ? 'true' : 'false' ?>"><?= icon('heart', $wished ? 'icon icon-fill text-danger' : 'icon') ?><?= $wished ? __('catalog.inWishlist') : __('catalog.addToWishlist') ?></button>
      </form>
      <?php if ($p['description']): ?>
        <h2 class="mt-3"><?= $isBook ? __('catalog.aboutBook') : __('catalog.aboutProduct') ?></h2>
        <div class="prose"><?= Markdown::render($p['description']) ?></div>
      <?php endif; ?>
    </div>

    <aside class="buy-box" aria-labelledby="offers-h">
      <h2 id="offers-h" class="h3"><?= $p['offers'] ? e(tn('catalog.offersCount', count($p['offers']))) : __('catalog.unavailable') ?></h2>
      <?php if (!$p['offers']): ?>
        <p class="muted"><?= __('catalog.noOffersText') ?></p>
      <?php endif; ?>
      <?php foreach ($p['offers'] as $o): $own = Auth::isSeller() && (int) Auth::seller()['id'] === (int) $o['seller_id']; ?>
      <div class="offer">
        <div class="row-between">
          <span class="badge <?= $o['item_condition'] === 'new' ? 'badge-primary' : 'badge-teal' ?>"><?= __('status.condition.' . $o['item_condition']) ?></span>
          <span class="price price-lg"><?= e(money($o['price'])) ?></span>
        </div>
        <?php if ($o['compare_at_price'] && Money::toPoisha($o['compare_at_price']) > Money::toPoisha($o['price'])): ?>
          <p class="small mb-1 right"><span class="price-old"><?= e(money($o['compare_at_price'])) ?></span> <span class="badge badge-accent"><?= e(t('catalog.percentOff', ['percent' => num(intdiv((Money::toPoisha($o['compare_at_price']) - Money::toPoisha($o['price'])) * 100, Money::toPoisha($o['compare_at_price'])))])) ?></span></p>
        <?php endif; ?>
        <p class="small mb-1"><?= __('catalog.soldBy') ?> <a href="<?= e(url('stores/' . $o['store_slug'])) ?>"><?= e($o['store_name']) ?></a> · <?= e(Geo::districtName($o['store_district'])) ?></p>
        <?php if ($o['condition_note']): ?><p class="small muted mb-1"><?= e($o['condition_note']) ?></p><?php endif; ?>
        <?php if ($o['images']): ?><div class="thumbs mb-1"><?php foreach ($o['images'] as $img): ?><a href="<?= e(upload_url($img['path'])) ?>" target="_blank" rel="noopener"><img src="<?= e(upload_url($img['path'])) ?>" alt="<?= e(t('catalog.copyPhoto')) ?>" loading="lazy"></a><?php endforeach; ?></div><?php endif; ?>
        <p class="small mb-1 <?= (int) $o['stock'] <= 3 ? 'text-danger' : 'text-success' ?>"><?= (int) $o['stock'] <= 3 ? e(t('common.onlyLeft', ['count' => num((int) $o['stock'])])) : __('common.inStock') ?></p>
        <?php if ($own): ?>
          <p class="small muted"><?= __('catalog.yourOffer') ?> <a href="<?= e(url('seller/listings/' . $o['id'])) ?>"><?= __('common.edit') ?></a></p>
        <?php else: ?>
        <form method="post" action="<?= e(url('cart/add')) ?>" data-cart-form class="row">
          <?= csrf_field() ?>
          <input type="hidden" name="listing_id" value="<?= (int) $o['id'] ?>">
          <div class="qty" data-qty>
            <button type="button" data-step="-1" aria-label="<?= __('cart.decrease') ?>">−</button>
            <input type="number" name="quantity" value="1" min="1" max="<?= (int) min(20, (int) $o['stock']) ?>" aria-label="<?= __('common.quantity') ?>">
            <button type="button" data-step="1" aria-label="<?= __('cart.increase') ?>">+</button>
          </div>
          <button class="btn btn-primary grow" type="submit"><?= icon('cart') ?><?= __('cart.addToCart') ?></button>
          <button class="btn btn-accent btn-block" type="submit" name="buy_now" value="1"><?= __('cart.buyNow') ?></button>
        </form>
        <?php endif; ?>
      </div>
      <?php endforeach; ?>
      <p class="small muted mt-2 mb-0"><?= icon('shield', 'icon icon-sm') ?> <?= e(t('catalog.buyerPromise', ['days' => num(\App\Core\Settings::int('orders.return_window_days'))])) ?></p>
    </aside>
  </div>

  <section id="reviews" class="section" aria-labelledby="reviews-h">
    <h2 id="reviews-h"><?= __('catalog.reviews') ?></h2>
    <div class="grid-2 mt-2">
      <div>
        <?php if ($totalReviews): ?>
          <p class="row"><span class="price-lg"><?= e(digits(number_format((float) $p['rating_avg'], 1))) ?></span><?= partial('partials/stars', ['rating' => $p['rating_avg']]) ?><span class="muted small"><?= e(tn('catalog.reviewCount', $totalReviews)) ?></span></p>
          <div class="rating-bars">
            <?php for ($s = 5; $s >= 1; $s--): ?>
              <div class="bar-row"><span><?= e(num($s)) ?>★</span><meter min="0" max="<?= $totalReviews ?>" value="<?= $dist[$s] ?>" aria-label="<?= e(t('catalog.starsCount', ['stars' => num($s), 'count' => num($dist[$s])])) ?>"></meter><span class="muted"><?= e(num($dist[$s])) ?></span></div>
            <?php endfor; ?>
          </div>
        <?php else: ?>
          <p class="muted"><?= __('catalog.noReviews') ?></p>
        <?php endif; ?>
      </div>
      <div>
        <?php if ($canReview): ?>
        <form method="post" action="<?= e(url('books/' . $p['slug'] . '/reviews')) ?>" class="card">
          <?= csrf_field() ?>
          <h3><?= $myReview ? __('catalog.editReview') : __('catalog.writeReview') ?></h3>
          <fieldset class="fieldset">
            <legend><?= __('catalog.yourRating') ?></legend>
            <div class="stars-input">
              <?php for ($s = 5; $s >= 1; $s--): ?><input type="radio" id="star<?= $s ?>" name="rating" value="<?= $s ?>"<?= checked((int) ($myReview['rating'] ?? 0) === $s) ?> required><label for="star<?= $s ?>" title="<?= e(t('catalog.stars', ['rating' => num($s)])) ?>"><?= icon('star', 'icon icon-fill') ?><span class="sr-only"><?= e(t('catalog.stars', ['rating' => num($s)])) ?></span></label><?php endfor; ?>
            </div>
            <?php if (error_for('rating')): ?><p class="error"><?= e(error_for('rating')) ?></p><?php endif; ?>
          </fieldset>
          <?= form_textarea('body', t('catalog.reviewText'), ['value' => $myReview['body'] ?? '', 'optional' => true, 'rows' => 4, 'attrs' => ['maxlength' => 2000]]) ?>
          <?= submit_button($myReview ? t('common.update') : t('catalog.postReview')) ?>
        </form>
        <?php elseif (Auth::check()): ?>
          <p class="small muted"><?= __('catalog.reviewAfterDelivery') ?></p>
        <?php else: ?>
          <p class="small muted"><a href="<?= e(url('login')) ?>"><?= __('nav.login') ?></a> — <?= __('catalog.reviewAfterDelivery') ?></p>
        <?php endif; ?>
      </div>
    </div>
    <?php foreach ($reviews as $r): ?>
      <article class="review">
        <div class="row"><?= partial('partials/stars', ['rating' => $r['rating']]) ?><strong><?= e($r['name']) ?></strong><span class="badge badge-success"><?= __('catalog.verifiedPurchase') ?></span><span class="small subtle"><?= e(fdate($r['created_at'])) ?></span></div>
        <?php if ($r['body']): ?><p class="mt-1 mb-0"><?= nl2br(e($r['body'])) ?></p><?php endif; ?>
      </article>
    <?php endforeach; ?>
  </section>

  <?php foreach ([[t('catalog.moreByAuthor'), $more], [t('catalog.related'), $related]] as [$h, $items]): if (!$items) { continue; } ?>
  <section class="section"><h2><?= e($h) ?></h2><div class="scroller mt-2"><?php foreach ($items as $it): ?><?= partial('partials/product-card', ['p' => $it]) ?><?php endforeach; ?></div></section>
  <?php endforeach; ?>
</div>
