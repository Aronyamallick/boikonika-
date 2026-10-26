<?php
$isGeneral = $isGeneral ?? false;
$isSearch = $isSearch ?? false;
$crumbs = [];
if (!empty($trail)) {
    foreach ($trail as $c) {
        $crumbs[] = [lf($c, 'name'), url('categories/' . $c['slug'])];
    }
} else {
    $crumbs[] = [$heading, null];
}
$sortLabels = ['popular' => t('catalog.sortPopular'), 'newest' => t('catalog.sortNewest'), 'price_asc' => t('catalog.sortPriceAsc'), 'price_desc' => t('catalog.sortPriceDesc'), 'rating' => t('catalog.sortRating')];
if ($isSearch) {
    $sortLabels = ['relevance' => t('catalog.sortRelevance')] + $sortLabels;
}
$langs = ['bn' => t('catalog.langBn'), 'en' => t('catalog.langEn'), 'ar' => t('catalog.langAr'), 'other' => t('catalog.langOther')];
$hasFilters = $f['condition'] || $f['language'] || $f['min'] || $f['max'] || $f['discount'] || (!empty($activeCategory) && empty($fixedCategory));
?>
<div class="container">
  <?= partial('partials/breadcrumbs', ['items' => $crumbs]) ?>
  <div class="page-head">
    <h1><?= e($heading) ?></h1>
    <?php if ($intro): ?><p><?= e($intro) ?></p><?php endif; ?>
  </div>
  <?php if (!empty($children)): ?>
    <div class="chips mb-2"><?php foreach ($children as $c): ?><a class="chip" href="<?= e(url('categories/' . $c['slug'])) ?>"><?= e(lf($c, 'name')) ?></a><?php endforeach; ?></div>
  <?php endif; ?>
  <div class="catalog-layout">
    <aside>
      <details class="filters-toggle filters" open>
        <summary><span><?= icon('sliders') ?> <?= __('common.filters') ?></span><?= icon('chevron-down') ?></summary>
        <form id="filters-form" method="get" action="<?= e(url($baseUrl)) ?>" class="mt-2">
          <?php if ($isSearch): ?><input type="hidden" name="q" value="<?= e($f['q']) ?>"><?php endif; ?>
          <?php if (!$isSearch && empty($fixedCategory) && $tree): ?>
          <div class="field">
            <label for="f-category"><?= __('nav.categories') ?></label>
            <select id="f-category" name="category">
              <option value=""><?= __('common.all') ?></option>
              <?php foreach ($tree as $top): ?>
                <option value="<?= e($top['slug']) ?>"<?= selected($top['slug'], $activeCategory['slug'] ?? '') ?>><?= e(lf($top, 'name')) ?></option>
                <?php foreach ($top['children'] as $ch): ?><option value="<?= e($ch['slug']) ?>"<?= selected($ch['slug'], $activeCategory['slug'] ?? '') ?>>— <?= e(lf($ch, 'name')) ?></option><?php endforeach; ?>
              <?php endforeach; ?>
            </select>
          </div>
          <?php endif; ?>
          <?php if (!$isGeneral): ?>
          <fieldset class="fieldset">
            <legend><?= __('catalog.condition') ?></legend>
            <div class="stack-sm">
              <label class="check"><input type="radio" name="condition" value=""<?= checked($f['condition'] === '') ?>><span><?= __('common.all') ?></span></label>
              <label class="check"><input type="radio" name="condition" value="new"<?= checked($f['condition'] === 'new') ?>><span><?= __('catalog.newOnly') ?></span></label>
              <label class="check"><input type="radio" name="condition" value="used"<?= checked($f['condition'] === 'used') ?>><span><?= __('catalog.usedOnly') ?></span></label>
            </div>
          </fieldset>
          <div class="field">
            <label for="f-language"><?= __('catalog.language') ?></label>
            <select id="f-language" name="language"><option value=""><?= __('common.all') ?></option><?php foreach ($langs as $k => $v): ?><option value="<?= e($k) ?>"<?= selected($k, $f['language']) ?>><?= e($v) ?></option><?php endforeach; ?></select>
          </div>
          <?php endif; ?>
          <fieldset class="fieldset">
            <legend><?= __('catalog.priceRange') ?></legend>
            <div class="grid-2">
              <div class="field"><label class="small" for="f-min"><?= __('catalog.min') ?></label><input id="f-min" type="text" inputmode="decimal" name="min" value="<?= e($f['min']) ?>" placeholder="৳"></div>
              <div class="field"><label class="small" for="f-max"><?= __('catalog.max') ?></label><input id="f-max" type="text" inputmode="decimal" name="max" value="<?= e($f['max']) ?>" placeholder="৳"></div>
            </div>
          </fieldset>
          <div class="field"><label class="check"><input type="checkbox" name="discount" value="1"<?= checked($f['discount']) ?>><span><?= __('catalog.onSale') ?></span></label></div>
          <?php if ($f['sort']): ?><input type="hidden" name="sort" value="<?= e($f['sort']) ?>"><?php endif; ?>
          <div class="row"><button class="btn btn-primary btn-sm" type="submit"><?= __('common.apply') ?></button><?php if ($hasFilters): ?><a class="btn btn-ghost btn-sm" href="<?= e(url($baseUrl, $isSearch ? ['q' => $f['q']] : [])) ?>"><?= __('common.clearFilters') ?></a><?php endif; ?></div>
        </form>
      </details>
      <?php if ($tree && empty($isSearch)): ?>
      <nav class="filters mt-2" aria-label="<?= __('nav.categories') ?>">
        <h2><?= __('nav.categories') ?></h2>
        <ul class="cat-list">
          <?php foreach ($tree as $top): ?>
            <li><a href="<?= e(url('categories/' . $top['slug'])) ?>"<?= ($activeCategory['id'] ?? 0) == $top['id'] ? ' aria-current="page"' : '' ?>><?= e(lf($top, 'name')) ?></a>
              <?php if ($top['children'] && (($activeCategory['id'] ?? 0) == $top['id'] || ($activeCategory['parent_id'] ?? 0) == $top['id'])): ?>
                <ul><?php foreach ($top['children'] as $ch): ?><li><a href="<?= e(url('categories/' . $ch['slug'])) ?>"<?= ($activeCategory['id'] ?? 0) == $ch['id'] ? ' aria-current="page"' : '' ?>><?= e(lf($ch, 'name')) ?></a></li><?php endforeach; ?></ul>
              <?php endif; ?>
            </li>
          <?php endforeach; ?>
        </ul>
      </nav>
      <?php endif; ?>
    </aside>
    <div>
      <?php if (!empty($authors)): ?>
      <div class="card card-tight mb-2">
        <h2 class="small subtle mb-1"><?= __('nav.authors') ?></h2>
        <div class="chips mt-0"><?php foreach ($authors as $a): ?><a class="chip" href="<?= e(url('authors/' . $a['slug'])) ?>"><?= icon('pen', 'icon icon-sm') ?><?= e(lf($a, 'name')) ?></a><?php endforeach; ?></div>
      </div>
      <?php endif; ?>
      <div class="results-bar">
        <p class="muted mb-0" role="status"><?= e(tn('common.results', $pager->total)) ?></p>
        <div class="row">
          <label for="sort" class="small muted"><?= __('common.sort') ?></label>
          <select id="sort" name="sort" form="filters-form" data-autosubmit>
            <?php foreach ($sortLabels as $k => $v): ?><option value="<?= e($k) ?>"<?= selected($k, $f['sort'] ?: ($isSearch ? 'relevance' : 'popular')) ?>><?= e($v) ?></option><?php endforeach; ?>
          </select>
        </div>
      </div>
      <?= partial('partials/product-grid', ['products' => $products, 'cols4' => true, 'emptyText' => $isSearch ? t('catalog.noSearchResults') : null]) ?>
      <?= partial('partials/pagination', ['pager' => $pager]) ?>
    </div>
  </div>
</div>
