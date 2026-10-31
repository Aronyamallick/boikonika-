<?php
use App\Core\DB;

$footerPages = DB::all("SELECT slug, title_bn, title_en, footer_group FROM pages WHERE is_published = 1 AND footer_group <> 'none' ORDER BY position, id");
$groups = ['company' => [], 'support' => [], 'policies' => []];
foreach ($footerPages as $p) {
    $groups[$p['footer_group']][] = $p;
}
$email = setting('site.email');
$phone = setting('site.phone');
?>
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="about">
        <a class="brand" href="<?= e(url()) ?>"><img src="<?= e(asset('img/logo.svg')) ?>" alt="" width="32" height="32"><span><?= e(site_name()) ?></span></a>
        <p class="muted mt-1"><?= __('footer.about') ?></p>
        <?php if ($email || $phone): ?>
        <ul>
          <?php if ($phone): ?><li><a href="tel:<?= e($phone) ?>"><?= icon('phone', 'icon icon-sm') ?> <?= e(digits($phone)) ?></a></li><?php endif; ?>
          <?php if ($email): ?><li><a href="mailto:<?= e($email) ?>"><?= icon('mail', 'icon icon-sm') ?> <?= e($email) ?></a></li><?php endif; ?>
        </ul>
        <?php endif; ?>
        <div class="pay-badges" aria-label="<?= __('footer.weAccept') ?>"><span><?= __('status.method.cod') ?></span><span><?= __('status.method.bkash') ?></span><span>Nagad</span><span>Rocket</span><span>Visa</span><span>Mastercard</span></div>
      </div>
      <div>
        <h2><?= __('footer.shop') ?></h2>
        <ul>
          <li><a href="<?= e(url('books')) ?>"><?= __('nav.books') ?></a></li>
          <li><a href="<?= e(url('categories')) ?>"><?= __('nav.categories') ?></a></li>
          <li><a href="<?= e(url('authors')) ?>"><?= __('nav.authors') ?></a></li>
          <li><a href="<?= e(url('publishers')) ?>"><?= __('nav.publishers') ?></a></li>
          <li><a href="<?= e(url('products')) ?>"><?= __('nav.products') ?></a></li>
          <li><a href="<?= e(url('sell')) ?>"><?= __('nav.sell') ?></a></li>
        </ul>
      </div>
      <div>
        <h2><?= __('footer.company') ?></h2>
        <ul>
          <?php foreach (array_merge($groups['company'], $groups['support']) as $p): ?><li><a href="<?= e(url('pages/' . $p['slug'])) ?>"><?= e(lf($p, 'title')) ?></a></li><?php endforeach; ?>
          <li><a href="<?= e(url('contact')) ?>"><?= __('nav.contact') ?></a></li>
        </ul>
      </div>
      <div>
        <h2><?= __('footer.policies') ?></h2>
        <ul>
          <?php foreach ($groups['policies'] as $p): ?><li><a href="<?= e(url('pages/' . $p['slug'])) ?>"><?= e(lf($p, 'title')) ?></a></li><?php endforeach; ?>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span><?= e(t('footer.rights', ['year' => digits(date('Y')), 'site' => site_name()])) ?></span>
      <span><?= __('common.developedBy') ?></span>
    </div>
  </div>
</footer>
