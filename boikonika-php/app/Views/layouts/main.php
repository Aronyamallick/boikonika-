<?php
use App\Core\App;

$req = App::$request;
$pathNoSlash = ltrim($req->path, '/');
$pageNo = (int) ($_GET['page'] ?? 1);
$pageQuery = $pageNo > 1 ? ['page' => $pageNo] : [];
$canonical = $canonical ?? abs_url($pathNoSlash, $pageQuery);
$siteName = site_name();
$fullTitle = !empty($title) ? $title . ' · ' . $siteName : $siteName . ' — ' . setting('site.tagline_' . locale());
$metaDescription = $description ?? t('home.metaDescription');
$noindex = ($robots ?? '') === 'noindex' || setting('site.indexing') !== '1';
?><!doctype html>
<html lang="<?= e(locale()) ?>" data-base="<?= e($req->basePath) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($fullTitle) ?></title>
<meta name="description" content="<?= e($metaDescription) ?>">
<?php if ($noindex): ?><meta name="robots" content="noindex, nofollow">
<?php else: ?><link rel="canonical" href="<?= e($canonical) ?>">
<link rel="alternate" hreflang="bn" href="<?= e(abs_url($pathNoSlash, $pageQuery, 'bn')) ?>">
<link rel="alternate" hreflang="en" href="<?= e(abs_url($pathNoSlash, $pageQuery, 'en')) ?>">
<link rel="alternate" hreflang="x-default" href="<?= e(abs_url($pathNoSlash, $pageQuery, 'bn')) ?>">
<?php endif; ?>
<meta property="og:site_name" content="<?= e($siteName) ?>">
<meta property="og:title" content="<?= e($title ?? $siteName) ?>">
<meta property="og:description" content="<?= e($metaDescription) ?>">
<meta property="og:type" content="<?= e($ogType ?? 'website') ?>">
<meta property="og:url" content="<?= e($canonical) ?>">
<meta property="og:locale" content="<?= locale() === 'bn' ? 'bn_BD' : 'en_US' ?>">
<?php if (!empty($ogImage)): ?><meta property="og:image" content="<?= e($ogImage) ?>">
<?php endif; ?>
<meta name="theme-color" content="#2563EB">
<link rel="icon" href="<?= e(asset('img/logo.svg')) ?>" type="image/svg+xml">
<link rel="apple-touch-icon" href="<?= e(asset('img/icons/apple-touch-icon.png')) ?>">
<link rel="manifest" href="<?= e(url('manifest.webmanifest')) ?>">
<?php if (locale() === 'bn'): ?><link rel="preload" href="<?= e($req->basePath) ?>/assets/fonts/noto-sans-bengali-bengali-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<?php endif; ?>
<link rel="stylesheet" href="<?= e(asset('css/app.css')) ?>">
<script nonce="<?= e(nonce()) ?>">try{var t=localStorage.getItem('bk-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<?php if (!empty($jsonLd)): ?><script type="application/ld+json" nonce="<?= e(nonce()) ?>"><?= json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
<?php endif; ?>
<script src="<?= e(asset('js/app.js')) ?>" defer></script>
</head>
<body>
<a class="skip-link" href="#main"><?= __('common.skipToContent') ?></a>
<?= partial('partials/icons') ?>
<?= partial('partials/header', ['searchQuery' => $searchQuery ?? '']) ?>
<main id="main" tabindex="-1">
<?= partial('partials/flash') ?>
<?= $content ?>
</main>
<?= partial('partials/footer') ?>
</body>
</html>
