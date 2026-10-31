<?php
$catIcons = ['fiction' => 'book', 'poetry' => 'feather', 'bangla-literature' => 'scroll', 'non-fiction' => 'globe', 'academic' => 'graduation', 'children' => 'smile', 'religion' => 'moon', 'research' => 'flask', 'stationery' => 'pen', 'school-supplies' => 'backpack', 'art-supplies' => 'palette', 'bags' => 'briefcase', 'office-products' => 'clipboard', 'study-accessories' => 'ruler', 'electronics' => 'cpu', 'educational-tools' => 'calculator'];
$sections = [
    ['featured', t('home.featured'), url('books'), $featured],
    ['new', t('home.newArrivals'), url('books', ['sort' => 'newest']), $newBooks],
    ['bestsellers', t('home.bestsellers'), url('books', ['sort' => 'popular']), $bestsellers],
    ['discounted', t('home.discounted'), url('books', ['discount' => '1']), $discounted],
    ['used', t('home.usedBooks'), url('books', ['condition' => 'used']), $used],
    ['general', t('home.studySupplies'), url('products'), $general],
];
?>
<section class="hero">
  <div class="container hero-inner">
    <div>
      <h1><?= __('home.heroTitle') ?></h1>
      <p class="lead"><?= __('home.heroText') ?></p>
      <form role="search" action="<?= e(url('search')) ?>" method="get">
        <div class="search-field">
          <label class="sr-only" for="hero-q"><?= __('nav.searchLabel') ?></label>
          <input id="hero-q" type="search" name="q" placeholder="<?= __('nav.searchPlaceholder') ?>" maxlength="120">
          <button type="submit" aria-label="<?= __('common.search') ?>"><?= icon('search') ?></button>
        </div>
      </form>
      <div class="chips" aria-label="<?= __('home.popularCategories') ?>">
        <?php foreach (array_slice($bookCategories, 0, 6) as $c): ?><a class="chip" href="<?= e(url('categories/' . $c['slug'])) ?>"><?= e(lf($c, 'name')) ?></a><?php endforeach; ?>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <svg viewBox="0 0 360 260" width="360" height="260" role="presentation">
        <rect class="shelf" x="20" y="210" width="320" height="14" rx="7"/>
        <rect class="b1" x="52" y="70" width="58" height="140" rx="8"/><rect class="l1" x="62" y="92" width="38" height="6" rx="3"/>
        <rect class="b2" x="116" y="96" width="52" height="114" rx="8"/><rect class="l2" x="125" y="116" width="34" height="6" rx="3"/>
        <rect class="b3" x="174" y="50" width="62" height="160" rx="8"/><rect class="l3" x="185" y="74" width="40" height="6" rx="3"/>
        <rect class="b4" x="242" y="110" width="50" height="100" rx="8"/><rect class="l4" x="250" y="128" width="34" height="6" rx="3"/>
        <circle class="sun" cx="300" cy="52" r="14"/>
      </svg>
    </div>
  </div>
</section>

<?php if ($banners): ?>
<section class="section"><div class="container banner-strip">
  <?php foreach ($banners as $b): ?>
  <a class="banner<?= $b['image_path'] ? '' : ' no-image' ?>" href="<?= e($b['link_url'] ?: url('books')) ?>">
    <?php if ($b['image_path']): ?><img src="<?= e(upload_url($b['image_path'])) ?>" alt=""><?php endif; ?>
    <div class="banner-text"><h3><?= e(lf($b, 'title')) ?></h3><?php if (lf($b, 'subtitle') !== ''): ?><p><?= e(lf($b, 'subtitle')) ?></p><?php endif; ?></div>
  </a>
  <?php endforeach; ?>
</div></section>
<?php endif; ?>

<section class="section"><div class="container">
  <div class="section-head"><h2><?= __('home.browseCategories') ?></h2><a href="<?= e(url('categories')) ?>"><?= __('common.viewAll') ?></a></div>
  <div class="cat-grid">
    <?php foreach (array_merge($bookCategories, array_slice($generalCategories, 0, 4)) as $c): ?>
      <a class="cat-tile" href="<?= e(url('categories/' . $c['slug'])) ?>"><?= icon($catIcons[$c['slug']] ?? ($c['kind'] === 'book' ? 'book' : 'package')) ?><span><?= e(lf($c, 'name')) ?></span></a>
    <?php endforeach; ?>
  </div>
</div></section>

<?php foreach ($sections as [$key, $heading, $more, $items]): if (!$items) { continue; } ?>
<section class="section" aria-labelledby="sec-<?= e($key) ?>"><div class="container">
  <div class="section-head"><h2 id="sec-<?= e($key) ?>"><?= e($heading) ?></h2><a href="<?= e($more) ?>"><?= __('common.viewAll') ?></a></div>
  <div class="scroller">
    <?php foreach ($items as $p): ?><?= partial('partials/product-card', ['p' => $p]) ?><?php endforeach; ?>
  </div>
</div></section>
<?php endforeach; ?>

<?php if (!$newBooks && !$bestsellers && !$general): ?>
<section class="section"><div class="container"><div class="card empty-state"><?= icon('store') ?><h2><?= __('home.emptyTitle') ?></h2><p><?= __('home.emptyText') ?></p><p><a class="btn btn-primary" href="<?= e(url('sell')) ?>"><?= __('nav.sell') ?></a></p></div></div></section>
<?php endif; ?>

<?php if ($sellers): ?>
<section class="section"><div class="container">
  <div class="section-head"><h2><?= __('home.sellers') ?></h2></div>
  <div class="person-grid">
    <?php foreach ($sellers as $s): ?>
      <a class="person" href="<?= e(url('stores/' . $s['slug'])) ?>">
        <span class="store-logo"><?php if ($s['logo_path']): ?><img src="<?= e(upload_url($s['logo_path'])) ?>" alt=""><?php else: ?><?= e(mb_substr($s['store_name'], 0, 1)) ?><?php endif; ?></span>
        <strong><?= e($s['store_name']) ?></strong>
        <span class="small muted"><?= e(\App\Services\Geo::districtName($s['district'])) ?> · <?= e(tn('home.offers', (int) $s['offers'])) ?></span>
      </a>
    <?php endforeach; ?>
  </div>
</div></section>
<?php endif; ?>

<section class="section"><div class="container">
  <h2><?= __('home.whyTitle') ?></h2>
  <div class="why-grid mt-2">
    <div class="card"><?= icon('badge-check') ?><h3><?= __('home.why1Title') ?></h3><p class="muted mb-0"><?= __('home.why1Text') ?></p></div>
    <div class="card"><?= icon('wallet') ?><h3><?= __('home.why2Title') ?></h3><p class="muted mb-0"><?= __('home.why2Text') ?></p></div>
    <div class="card"><?= icon('truck') ?><h3><?= __('home.why3Title') ?></h3><p class="muted mb-0"><?= __('home.why3Text') ?></p></div>
    <div class="card"><?= icon('undo') ?><h3><?= __('home.why4Title') ?></h3><p class="muted mb-0"><?= e(t('home.why4Text', ['days' => num(\App\Core\Settings::int('orders.return_window_days'))])) ?></p></div>
  </div>
</div></section>

<section class="section"><div class="container">
  <div class="cta-band">
    <div><h2><?= __('home.sellTitle') ?></h2><p><?= __('home.sellText') ?></p></div>
    <a class="btn btn-outline btn-lg" href="<?= e(url('sell')) ?>"><?= __('nav.sell') ?></a>
  </div>
</div></section>
