<?php
use App\Core\DB;

$c = DB::one("SELECT
    (SELECT COUNT(*) FROM sellers WHERE status = 'pending') AS sellers,
    (SELECT COUNT(*) FROM products WHERE status = 'pending') AS products,
    (SELECT COUNT(*) FROM refunds WHERE status IN ('requested', 'failed')) AS refunds,
    (SELECT COUNT(*) FROM returns WHERE status IN ('requested', 'approved', 'received')) AS returns_open,
    (SELECT COUNT(*) FROM payouts WHERE status = 'requested') AS payouts,
    (SELECT COUNT(*) FROM contact_messages WHERE status = 'new') AS messages");
$items = [
    [t('admin.groupOverview'), [['admin', 'chart', t('account.overview'), 'admin.access', null]]],
    [t('admin.groupMarket'), [
        ['admin/orders', 'package', t('admin.orders'), 'orders.manage', null],
        ['admin/refunds', 'undo', t('admin.refunds'), 'refunds.manage', $c['refunds']],
        ['admin/returns', 'refresh', t('admin.returns'), 'refunds.manage', $c['returns_open']],
        ['admin/payouts', 'wallet', t('admin.payouts'), 'payouts.manage', $c['payouts']],
        ['admin/sellers', 'store', t('admin.sellers'), 'sellers.review', $c['sellers']],
        ['admin/coupons', 'percent', t('admin.coupons'), 'coupons.manage', null],
        ['admin/shipping', 'truck', t('admin.shipping'), 'shipping.manage', null],
    ]],
    [t('admin.groupCatalog'), [
        ['admin/products', 'book', t('admin.products'), 'catalog.manage', $c['products']],
        ['admin/listings', 'tag', t('admin.listings'), 'catalog.manage', null],
        ['admin/categories', 'layers', t('admin.categories'), 'catalog.manage', null],
        ['admin/authors', 'pen', t('admin.authors'), 'catalog.manage', null],
        ['admin/publishers', 'building', t('admin.publishers'), 'catalog.manage', null],
        ['admin/reviews', 'star', t('admin.reviews'), 'reviews.moderate', null],
    ]],
    [t('admin.groupPeople'), [
        ['admin/users', 'users', t('admin.users'), 'users.view', null],
        ['admin/messages', 'message', t('admin.messages'), 'messages.manage', $c['messages']],
    ]],
    [t('admin.groupSite'), [
        ['admin/pages', 'file', t('admin.pages'), 'content.manage', null],
        ['admin/banners', 'image', t('admin.banners'), 'content.manage', null],
        ['admin/settings', 'sliders', t('admin.settings'), 'settings.manage', null],
        ['admin/system', 'server', t('admin.system'), 'settings.manage', null],
        ['admin/audit', 'history', t('admin.audit'), 'audit.view', null],
    ]],
];
$path = \App\Core\App::$request->path;
?>
<nav class="dash-nav" aria-label="<?= __('nav.admin') ?>">
<?php foreach ($items as [$group, $links]):
    $links = array_values(array_filter($links, static fn ($l) => can($l[3])));
    if (!$links) { continue; } ?>
  <h2><?= e($group) ?></h2>
  <ul>
  <?php foreach ($links as [$href, $ic, $label, , $count]): $active = $href === 'admin' ? $path === '/admin' : ($path === '/' . $href || str_starts_with($path, '/' . $href . '/')); ?>
    <li><a href="<?= e(url($href)) ?>"<?= $active ? ' aria-current="page"' : '' ?>><?= icon($ic) ?><?= e($label) ?><?php if ($count): ?><span class="count"><?= e(num((int) $count)) ?></span><?php endif; ?></a></li>
  <?php endforeach; ?>
  </ul>
<?php endforeach; ?>
</nav>
