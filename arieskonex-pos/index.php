<?php
define('APP_ROOT', __DIR__);

if (!file_exists(APP_ROOT . '/config/config.php')) {
    header('Location: install/index.php');
    exit;
}

require_once APP_ROOT . '/config/config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (empty($_SESSION['user'])) {
    header('Location: login.php');
} else {
    header('Location: modules/dashboard.php');
}
exit;
