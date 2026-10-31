<?php
/**
 * Boikonika installer. Open https://your-site/install/ once, follow the steps, then delete this folder.
 */
declare(strict_types=1);

define('BK_INSTALLER', true);
require dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\Crypto;
use App\Core\DB;
use App\Core\Migrator;
use App\Core\Validator;

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; img-src 'self' data:; script-src 'none'; frame-ancestors 'none'; form-action 'self'");
header('Cache-Control: no-store');

session_name('bk_install');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => ($_SERVER['HTTPS'] ?? '') === 'on']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(16));

$root = BK_ROOT;
$base = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/install/index.php'))), '/');
$base = $base === '.' ? '' : $base;
$scheme = (($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') ? 'https' : 'http';
$detectedUrl = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $base;

function h(mixed $v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function field(string $name, string $label, string $value = '', string $type = 'text', string $hint = '', bool $required = true): string
{
    $id = 'f-' . $name;
    return '<div class="field"><label for="' . $id . '">' . $label . '</label><input id="' . $id . '" name="' . h($name) . '" type="' . h($type) . '" value="' . ($type === 'password' ? '' : h($value)) . '"' . ($required ? ' required' : '') . ' autocomplete="off">' . ($hint ? '<p class="hint">' . $hint . '</p>' : '') . '</div>';
}

$installed = is_file($root . '/storage/installed.lock');
$step = $installed ? 'done' : (string) ($_GET['step'] ?? 'check');
$errors = [];
$notice = '';

// ---------------------------------------------------------------- requirements
$checks = [
    ['PHP 8.1+', PHP_VERSION_ID >= 80100, PHP_VERSION],
    ['PDO MySQL', extension_loaded('pdo_mysql'), ''],
    ['mbstring', extension_loaded('mbstring'), ''],
    ['OpenSSL', extension_loaded('openssl') && in_array('aes-256-gcm', openssl_get_cipher_methods(), true), ''],
    ['GD (images)', extension_loaded('gd'), function_exists('imagewebp') ? 'WebP' : 'JPEG'],
    ['cURL (payments)', extension_loaded('curl'), ''],
    ['JSON', function_exists('json_encode'), ''],
    ['fileinfo', extension_loaded('fileinfo'), ''],
];
$writable = [
    'app/' => is_writable($root . '/app'),
    'storage/' => is_writable($root . '/storage'),
    'storage/logs/' => is_writable($root . '/storage/logs'),
    'storage/cache/' => is_writable($root . '/storage/cache'),
    'storage/private/' => is_writable($root . '/storage/private'),
    'uploads/' => is_writable($root . '/uploads'),
];
$allOk = !in_array(false, array_column($checks, 1), true) && !in_array(false, array_diff_key($writable, ['app/' => 0]), true);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$installed) {
    if (!hash_equals($_SESSION['csrf'], (string) ($_POST['csrf'] ?? ''))) {
        $errors[] = 'ফর্মের মেয়াদ শেষ, আবার চেষ্টা করুন। / The form expired, please try again.';
    } elseif ($step === 'database') {
        $db = [
            'host' => trim((string) ($_POST['host'] ?? 'localhost')) ?: 'localhost',
            'port' => (int) ($_POST['port'] ?? 3306) ?: 3306,
            'name' => trim((string) ($_POST['name'] ?? '')),
            'user' => trim((string) ($_POST['user'] ?? '')),
            'pass' => (string) ($_POST['pass'] ?? ''),
        ];
        if ($db['name'] === '' || $db['user'] === '') {
            $errors[] = 'ডাটাবেসের নাম ও ইউজার দিন। / Enter the database name and user.';
        } else {
            try {
                $pdo = DB::connect($db);
                $version = (string) $pdo->query('SELECT VERSION()')->fetchColumn();
                $isMaria = stripos($version, 'mariadb') !== false;
                $num = (string) preg_replace('/^(\d+\.\d+).*/', '$1', $version);
                if (($isMaria && version_compare($num, '10.3', '<')) || (!$isMaria && version_compare($num, '5.7', '<'))) {
                    $errors[] = 'MySQL 5.7+ বা MariaDB 10.3+ প্রয়োজন। পাওয়া গেছে: ' . h($version) . ' / MySQL 5.7+ or MariaDB 10.3+ is required.';
                } elseif ($pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn() !== false) {
                    $errors[] = 'এই ডাটাবেসে আগে থেকেই বইকণিকার টেবিল আছে। একটি খালি ডাটাবেস দিন। / This database already has Boikonika tables. Use an empty database.';
                } else {
                    $_SESSION['db'] = $db;
                    header('Location: ?step=site');
                    exit;
                }
            } catch (\PDOException $e) {
                $errors[] = 'ডাটাবেসে সংযোগ হয়নি — তথ্যগুলো যাচাই করুন। / Could not connect: ' . h(preg_replace('/\s*\(SQL: .*$/', '', $e->getMessage()));
            }
        }
    } elseif ($step === 'site' && isset($_SESSION['db'])) {
        $in = [
            'url' => rtrim(trim((string) ($_POST['url'] ?? '')), '/'),
            'name_bn' => trim((string) ($_POST['name_bn'] ?? 'বইকণিকা')),
            'name_en' => trim((string) ($_POST['name_en'] ?? 'Boikonika')),
            'site_email' => mb_strtolower(trim((string) ($_POST['site_email'] ?? ''))),
            'admin_name' => trim((string) ($_POST['admin_name'] ?? '')),
            'admin_email' => mb_strtolower(trim((string) ($_POST['admin_email'] ?? ''))),
            'admin_password' => (string) ($_POST['admin_password'] ?? ''),
            'admin_password_confirmation' => (string) ($_POST['admin_password_confirmation'] ?? ''),
        ];
        if (!preg_match('#^https?://[^\s/]+(/[^\s]*)?$#', $in['url'])) {
            $errors[] = 'সাইটের সঠিক ঠিকানা দিন (https:// সহ)। / Enter the site address including https://';
        }
        if ($in['name_bn'] === '' || $in['name_en'] === '') {
            $errors[] = 'সাইটের নাম দিন। / Enter the site name.';
        }
        if ($in['admin_name'] === '' || !filter_var($in['admin_email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'অ্যাডমিনের নাম ও সঠিক ইমেইল দিন। / Enter the admin’s name and a valid email.';
        }
        if ($in['site_email'] !== '' && !filter_var($in['site_email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'সাপোর্ট ইমেইল সঠিক নয়। / The support email isn’t valid.';
        }
        $pw = $in['admin_password'];
        if (mb_strlen($pw) < 10 || !preg_match('/\pL/u', $pw) || !preg_match('/\d/', $pw)) {
            $errors[] = 'অ্যাডমিন পাসওয়ার্ড কমপক্ষে ১০ অক্ষর, অক্ষর ও সংখ্যা মিলিয়ে দিন। / The admin password needs at least 10 characters with letters and numbers.';
        } elseif (!hash_equals($pw, $in['admin_password_confirmation'])) {
            $errors[] = 'পাসওয়ার্ড দুটি মেলেনি। / The passwords don’t match.';
        }
        if (!$errors) {
            $lock = fopen($root . '/storage/.installing', 'c');
            if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
                $errors[] = 'ইনস্টল চলছে… / Installation is already running…';
            } else {
                try {
                    $config = [
                        'url' => $in['url'],
                        'db' => $_SESSION['db'],
                        'app_key' => base64_encode(random_bytes(32)),
                        'cron_key' => bin2hex(random_bytes(16)),
                        'timezone' => 'Asia/Dhaka',
                        'debug' => false,
                        'trust_proxy' => false,
                    ];
                    App\Core\App::setConfig($config);
                    $pdo = DB::connect($config['db']);
                    DB::use($pdo);
                    (new Migrator($pdo))->migrate();
                    (require $root . '/database/seed/seed.php')($pdo);
                    $now = date('Y-m-d H:i:s');
                    $set = $pdo->prepare('UPDATE settings SET value = ?, updated_at = ? WHERE `key` = ?');
                    foreach (['site.name_bn' => $in['name_bn'], 'site.name_en' => $in['name_en'], 'site.email' => $in['site_email'], 'mail.from_email' => $in['site_email'], 'mail.from_name' => $in['name_en'], 'cron.last_run' => '0'] as $k => $v) {
                        $set->execute([$v, $now, $k]);
                    }
                    $pdo->prepare('INSERT INTO users (name, email, password_hash, locale, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
                        ->execute([$in['admin_name'], $in['admin_email'], Crypto::passwordHash($pw), 'bn', $now, $now, $now]);
                    $uid = (int) $pdo->lastInsertId();
                    $pdo->prepare('INSERT INTO user_roles (user_id, role, created_at) VALUES (?, ?, ?)')->execute([$uid, 'super_admin', $now]);
                    $pdo->prepare('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)')->execute([$uid, 'system.installed', 'system', BK_VERSION, substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45), $now]);

                    $php = "<?php\n// Boikonika configuration — written by the installer. Keep this file private and backed up:\n// app_key encrypts identity-document numbers, payout accounts and payment secrets.\nreturn " . var_export($config, true) . ";\n";
                    if (@file_put_contents($root . '/app/config.php', $php, LOCK_EX) === false) {
                        $_SESSION['config_text'] = $php;
                    } else {
                        @chmod($root . '/app/config.php', 0640);
                    }
                    file_put_contents($root . '/storage/installed.lock', date('c') . "\n");
                    $_SESSION['done'] = ['url' => $in['url'], 'email' => $in['admin_email'], 'cron' => $config['cron_key']];
                    unset($_SESSION['db']);
                    header('Location: ?step=done');
                    exit;
                } catch (\Throwable $e) {
                    App\Core\ErrorHandler::log('install', $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
                    $errors[] = 'ইনস্টল সম্পূর্ণ হয়নি: / Installation failed: ' . h($e->getMessage());
                } finally {
                    flock($lock, LOCK_UN);
                    fclose($lock);
                    @unlink($root . '/storage/.installing');
                }
            }
        }
    }
}
if ($step === 'site' && !isset($_SESSION['db']) && !$installed) {
    $step = 'database';
}
$steps = ['check' => '১. যাচাই / Check', 'database' => '২. ডাটাবেস / Database', 'site' => '৩. সাইট ও অ্যাডমিন / Site & admin', 'done' => '৪. সম্পন্ন / Done'];
?><!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>বইকণিকা ইনস্টল · Install Boikonika</title>
<link rel="stylesheet" href="../assets/css/app.css">
<link rel="icon" href="../assets/img/logo.svg" type="image/svg+xml">
</head>
<body>
<main id="main" class="container auth-wrap">
  <div class="auth-card install-card">
    <p class="center"><img src="../assets/img/logo.svg" alt="" width="56" height="56" class="mb-1 inline-block"></p>
    <h1 class="center">বইকণিকা ইনস্টল<br><span class="muted small">Install Boikonika</span></h1>
    <ol class="steps">
      <?php foreach ($steps as $k => $label): ?><li<?= $k === $step ? ' aria-current="step"' : '' ?>><?= h($label) ?></li><?php endforeach; ?>
    </ol>
    <?php foreach ($errors as $err): ?><div class="alert alert-error"><div><?= $err ?></div></div><?php endforeach; ?>
    <div class="card">
    <?php if ($step === 'check'): ?>
      <h2>প্রয়োজনীয়তা / Requirements</h2>
      <table class="table"><tbody>
        <?php foreach ($checks as [$label, $ok, $note]): ?><tr><td><?= h($label) ?></td><td class="right"><span class="badge <?= $ok ? 'badge-success' : 'badge-danger' ?>"><?= $ok ? 'OK' : '✗' ?></span> <span class="small subtle"><?= h($note) ?></span></td></tr><?php endforeach; ?>
        <?php foreach ($writable as $dir => $ok): ?><tr><td><?= h($dir) ?> <span class="small subtle">(writable)</span></td><td class="right"><span class="badge <?= $ok ? 'badge-success' : ($dir === 'app/' ? 'badge-warning' : 'badge-danger') ?>"><?= $ok ? 'OK' : '✗' ?></span></td></tr><?php endforeach; ?>
      </tbody></table>
      <?php if (!$writable['app/']): ?><p class="small muted">app/ লেখা যাচ্ছে না — শেষে config.php-এর লেখাটি দেখানো হবে, File Manager দিয়ে ফাইলটি বানিয়ে নেবেন। / app/ isn’t writable: at the end you’ll be shown the contents of config.php to create with File Manager.</p><?php endif; ?>
      <?php if ($allOk): ?>
        <p><a class="btn btn-primary btn-block" href="?step=database">এগিয়ে যান / Continue</a></p>
      <?php else: ?>
        <div class="alert alert-error"><div>লাল চিহ্নিত বিষয়গুলো ঠিক করুন (cPanel → Select PHP Version → Extensions, অথবা ফোল্ডারের permission 755/775)। / Fix the items marked red (cPanel → Select PHP Version → Extensions, or folder permissions 755/775), then reload.</div></div>
      <?php endif; ?>
    <?php elseif ($step === 'database'): ?>
      <h2>ডাটাবেস / Database</h2>
      <p class="small muted">cPanel → MySQL® Databases থেকে একটি নতুন ডাটাবেস ও ইউজার তৈরি করে ইউজারকে ALL PRIVILEGES দিন। / In cPanel → MySQL® Databases, create a new database and user and give the user ALL PRIVILEGES.</p>
      <form method="post" action="?step=database">
        <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
        <div class="grid-2"><?= field('host', 'হোস্ট / Host', (string) ($_POST['host'] ?? 'localhost')) ?><?= field('port', 'পোর্ট / Port', (string) ($_POST['port'] ?? '3306')) ?></div>
        <?= field('name', 'ডাটাবেসের নাম / Database name', (string) ($_POST['name'] ?? ''), 'text', 'যেমন / e.g. cpaneluser_boikonika') ?>
        <?= field('user', 'ডাটাবেস ইউজার / Database user', (string) ($_POST['user'] ?? '')) ?>
        <?= field('pass', 'ডাটাবেস পাসওয়ার্ড / Database password', '', 'password', '', false) ?>
        <button class="btn btn-primary btn-block" type="submit">সংযোগ যাচাই করুন / Test and continue</button>
      </form>
    <?php elseif ($step === 'site'): ?>
      <h2>সাইট ও অ্যাডমিন / Site & admin</h2>
      <form method="post" action="?step=site">
        <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
        <?= field('url', 'সাইটের ঠিকানা / Site address', (string) ($_POST['url'] ?? $detectedUrl), 'url', 'SSL চালু থাকলে https:// ব্যবহার করুন। / Use https:// once SSL is active (needed for online payments).') ?>
        <div class="grid-2"><?= field('name_bn', 'সাইটের নাম (বাংলা) / Name (Bangla)', (string) ($_POST['name_bn'] ?? 'বইকণিকা')) ?><?= field('name_en', 'সাইটের নাম (ইংরেজি) / Name (English)', (string) ($_POST['name_en'] ?? 'Boikonika')) ?></div>
        <?= field('site_email', 'সাপোর্ট ইমেইল / Support email', (string) ($_POST['site_email'] ?? ''), 'email', 'ইমেইল পাঠানোর ঠিকানাও এটি হবে। cPanel-এ এই ঠিকানার একটি ইমেইল অ্যাকাউন্ট রাখুন। / Also used as the sender address; create this mailbox in cPanel.', false) ?>
        <hr>
        <h3>প্রধান অ্যাডমিন / Super admin</h3>
        <?= field('admin_name', 'নাম / Name', (string) ($_POST['admin_name'] ?? '')) ?>
        <?= field('admin_email', 'ইমেইল / Email', (string) ($_POST['admin_email'] ?? ''), 'email') ?>
        <?= field('admin_password', 'পাসওয়ার্ড / Password', '', 'password', 'কমপক্ষে ১০ অক্ষর, অক্ষর ও সংখ্যা। / At least 10 characters with letters and numbers.') ?>
        <?= field('admin_password_confirmation', 'পাসওয়ার্ড আবার / Confirm password', '', 'password') ?>
        <button class="btn btn-primary btn-block btn-lg" type="submit">ইনস্টল করুন / Install</button>
      </form>
    <?php elseif (empty($_SESSION['done'])): ?>
      <h2>ইনস্টল করা আছে / Already installed</h2>
      <p>বইকণিকা আগেই ইনস্টল করা হয়েছে। নিরাপত্তার জন্য install ফোল্ডারটি মুছে ফেলুন। / Boikonika is already installed. For security, delete the install folder.</p>
      <p><a class="btn btn-primary btn-block" href="../">সাইটে যান / Go to the site</a></p>
    <?php else: $d = $_SESSION['done']; ?>
      <h2>সম্পন্ন! / All done!</h2>
      <?php if (!empty($_SESSION['config_text'])): ?>
        <div class="alert alert-warning"><div><strong>app/config.php তৈরি করুন / Create app/config.php</strong><br>File Manager দিয়ে app ফোল্ডারে config.php নামে ফাইল বানিয়ে নিচের লেখা পেস্ট করুন। / Using File Manager, create app/config.php with exactly this content:</div></div>
        <textarea readonly rows="14" class="mono small"><?= h($_SESSION['config_text']) ?></textarea>
      <?php endif; ?>
      <ol class="stack-sm">
        <li><strong>install ফোল্ডারটি মুছে ফেলুন।</strong> / <strong>Delete the install folder</strong> from your hosting now.</li>
        <li>cPanel → Cron Jobs-এ প্রতি ৫ মিনিটে চালাতে যোগ করুন / In cPanel → Cron Jobs, add (every 5 minutes):<br><code class="small">php <?= h($root) ?>/cron.php</code></li>
        <li>অ্যাডমিন → সেটিংস থেকে ইমেইল (SMTP), বিকাশ ও SSLCOMMERZ চালু করুন। / In Admin → Settings, set up email (SMTP), bKash and SSLCOMMERZ.</li>
        <li>অ্যাডমিন অ্যাকাউন্টে দুই ধাপের যাচাই চালু করুন। / Turn on two-step verification for the admin account.</li>
        <li>নীতিমালার পাতাগুলো পড়ে প্রয়োজনমতো সম্পাদনা করুন। / Review the policy pages in Admin → Pages.</li>
      </ol>
      <?php if ($d): ?><p class="small muted"><?= h($d['email']) ?></p><?php endif; ?>
      <p><a class="btn btn-primary btn-block" href="<?= h($d['url'] ?? '..') ?>/login">লগইন করুন / Log in</a></p>
    <?php endif; ?>
    </div>
    <p class="center small subtle mt-2">Boikonika <?= h(BK_VERSION) ?> · Arieskonex Technologies</p>
  </div>
</main>
</body>
</html>
