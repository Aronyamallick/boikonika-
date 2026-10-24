<?php
/**
 * ডাটাবেজ সংযোগ (PDO)
 */

if (!defined('APP_ROOT')) {
    define('APP_ROOT', dirname(__DIR__));
}

$configFile = APP_ROOT . '/config/config.php';

if (!file_exists($configFile)) {
    // এখনো ইনস্টল করা হয়নি — ইনস্টলারে পাঠানো হয়। আগে "/install/index.php" (ডোমেইন রুট)
    // ধরে নেওয়া হতো, ফলে সাবফোল্ডারে (যেমন example.com/pos/) আপলোড করলে ভুল পাতায় যেত।
    $scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    if (strpos($scriptName, '/install/') === false) {
        $scriptDir = rtrim(dirname($scriptName), '/');
        // modules/ ফোল্ডারের ভেতরের পাতা হলে এক ধাপ উপরে অ্যাপের রুট
        $appBase = preg_match('#/modules$#', $scriptDir) ? rtrim(dirname($scriptDir), '/') : $scriptDir;
        header('Location: ' . $appBase . '/install/index.php');
        exit;
    }
}

require_once $configFile;

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    die('<div style="font-family:sans-serif;padding:40px;text-align:center;color:#DC2626">
        <h2>ডাটাবেজ সংযোগ ব্যর্থ হয়েছে</h2>
        <p>অনুগ্রহ করে config/config.php ফাইলের তথ্য যাচাই করুন।</p>
        </div>');
}
