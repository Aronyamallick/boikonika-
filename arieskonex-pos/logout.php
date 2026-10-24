<?php
require_once __DIR__ . '/includes/bootstrap.php';
if (!empty($_SESSION['user'])) {
    log_activity($pdo, 'লগআউট করেছেন');
}
$_SESSION = [];
session_destroy();
redirect('login.php');
