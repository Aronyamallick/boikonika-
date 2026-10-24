<?php
require_once __DIR__ . '/includes/bootstrap.php';

$lang = preg_replace('/[^a-z]/', '', strtolower($_GET['lang'] ?? 'bn'));
if (!is_file(APP_ROOT . '/lang/' . $lang . '.php')) {
    $lang = 'bn';
}
$_SESSION['lang'] = $lang;

$back = $_SERVER['HTTP_REFERER'] ?? (APP_BASE_PATH . '/modules/dashboard.php');
redirect($back);
