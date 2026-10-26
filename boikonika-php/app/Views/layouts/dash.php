<?php
/** Account, seller and admin pages: side navigation + content, inside the main layout. */
$area = $area ?? 'account';
$inner = '<div class="container"><div class="dash">' . partial('partials/nav-' . $area, $__data) . '<div class="dash-main">' . $content . '</div></div></div>';
echo partial('layouts/main', ['content' => $inner, 'robots' => 'noindex'] + $__data);
