<?php
/**
 * ইনস্টলার ধাপ ১: ডাটাবেজ কনফিগারেশন
 */
define('APP_ROOT', dirname(__DIR__));
$configFile = APP_ROOT . '/config/config.php';

if (!function_exists('e')) {
    function e($s) { return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8'); }
}

// ইতিমধ্যে ইনস্টল করা থাকলে যাচাই করুন সম্পূর্ণ কিনা
if (file_exists($configFile)) {
    require_once $configFile;
    try {
        $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        if ($pdo->query("SHOW TABLES LIKE 'shop_settings'")->fetch()) {
            // দোকানের তথ্য থাকলে লগইনে, না থাকলে (ধাপ ১ শেষ, ধাপ ২ বাকি) সরাসরি ধাপ ২-এ।
            // আগের কোড একই ফলাফল দুবার fetch() করত — দ্বিতীয়বার সবসময় খালি আসায় ধাপ ২-এর বদলে
            // আবার ধাপ ১ দেখাত, আর ধাপ ১ আবার জমা দিলে ডিফল্ট ডাটা দ্বিতীয়বার ঢোকাতে গিয়ে
            // "Duplicate entry 'cash' for key 'method_key'" এরর হতো।
            $shopCount = (int)$pdo->query("SELECT COUNT(*) FROM shop_settings")->fetchColumn();
            header('Location: ' . ($shopCount > 0 ? '../login.php' : 'step2.php'));
            exit;
        }
    } catch (Exception $e) {
        // কনফিগ ভুল থাকলে আবার ধাপ ১ দেখানো হবে
    }
}

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $host = trim($_POST['db_host'] ?? 'localhost');
    $name = trim($_POST['db_name'] ?? '');
    $user = trim($_POST['db_user'] ?? '');
    $pass = $_POST['db_pass'] ?? '';
    $baseUrl = rtrim(trim($_POST['base_url'] ?? ''), '/');

    if ($baseUrl === '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host2 = $_SERVER['HTTP_HOST'] ?? 'localhost';
        // /install/index.php থেকে দুই ধাপ উপরে গেলে অ্যাপের রুট ফোল্ডার পাওয়া যায়
        $scriptDir = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/install/index.php')), '/');
        $baseUrl = $scheme . '://' . $host2 . $scriptDir;
    }

    if ($name === '' || $user === '') {
        $error = 'ডাটাবেজ নাম ও ইউজারনেম আবশ্যক।';
    } else {
        $testPdo = null;
        try {
            $testPdo = new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
        } catch (PDOException $e) {
            $error = 'ডাটাবেজ সংযোগ ব্যর্থ হয়েছে: ' . $e->getMessage();
        }

        if ($testPdo) {
            try {
                // schema.sql ইম্পোর্ট করুন
                // (কমেন্ট লাইন আগে বাদ দিয়ে তারপর ';' দিয়ে ভাগ করা হচ্ছে — আগে কমেন্ট-হেডারের
                //  ঠিক পরে থাকা CREATE TABLE স্টেটমেন্টগুলো ভুলবশত বাদ পড়ে যেত, ফলে categories,
                //  products, companies-এর মতো গুরুত্বপূর্ণ টেবিল তৈরিই হতো না)
                $sql = file_get_contents(__DIR__ . '/schema.sql');
                $sqlLines = explode("\n", $sql);
                $sqlLines = array_filter($sqlLines, function ($line) {
                    return strpos(trim($line), '--') !== 0;
                });
                $cleanSql = implode("\n", $sqlLines);
                $statements = array_filter(array_map('trim', explode(';', $cleanSql)));
                foreach ($statements as $st) {
                    if ($st === '') continue;
                    // ডিফল্ট ডাটা (পেমেন্ট মেথড, ক্যাটাগরি, সার্ভিস, শাখা) শুধু খালি টেবিলেই বসানো হয়।
                    // ডাটাবেজে আগের ইনস্টল বা অসম্পূর্ণ চেষ্টার ডাটা থাকলে তা অক্ষত থাকে — ফলে ইনস্টলার
                    // আবার চালালেও "Duplicate entry" এরর হয় না, আর কোনো ডাটা মুছে যায় না।
                    if (preg_match('/^INSERT\s+INTO\s+`?(\w+)`?/i', $st, $m)) {
                        try {
                            if (!$testPdo->query('SELECT 1 FROM `' . $m[1] . '` LIMIT 1')->fetchColumn()) {
                                $testPdo->exec($st);
                            }
                        } catch (PDOException $seedError) {
                            // পুরোনো সংস্করণের টেবিলে কলাম না মিললে ডিফল্ট ডাটা বাদ যায় — প্রথম লগইনে
                            // includes/bootstrap.php টেবিলগুলো স্বয়ংক্রিয়ভাবে হালনাগাদ করে নেয়
                        }
                        continue;
                    }
                    $testPdo->exec($st);
                }
                // এই ডাটাবেজে আগে থেকেই দোকান সেটআপ করা থাকলে (যেমন ফাইল নতুন করে আপলোড করা হয়েছে)
                // ধাপ ২ লাগবে না — আগের ইউজারনেম/পাসওয়ার্ড দিয়েই লগইন করা যাবে
                $existingShop = (int)$testPdo->query("SELECT COUNT(*) FROM shop_settings")->fetchColumn() > 0;

                // config.php লিখুন
                @mkdir(APP_ROOT . '/config', 0755, true);
                $configContent = "<?php\n"
                    . "define('DB_HOST', " . var_export($host, true) . ");\n"
                    . "define('DB_NAME', " . var_export($name, true) . ");\n"
                    . "define('DB_USER', " . var_export($user, true) . ");\n"
                    . "define('DB_PASS', " . var_export($pass, true) . ");\n"
                    . "define('BASE_URL', " . var_export($baseUrl, true) . ");\n"
                    . "define('APP_NAME', 'Mallik Book House & Computer');\n"
                    . "define('APP_DEVELOPER', 'Arieskonex Technologies');\n"
                    . "define('APP_SECRET', " . var_export(bin2hex(random_bytes(32)), true) . ");\n";

                if (!file_put_contents($configFile, $configContent)) {
                    $error = 'config.php ফাইল লেখা যায়নি। ফোল্ডার পারমিশন যাচাই করুন (config ফোল্ডারে 755/775 পারমিশন দিন)।';
                } else {
                    header('Location: ' . ($existingShop ? '../login.php?existing=1' : 'step2.php'));
                    exit;
                }
            } catch (PDOException $e) {
                $error = 'ডাটাবেজের টেবিল তৈরি করা যায়নি: ' . $e->getMessage();
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ইনস্টলেশন — Mallik Book House & Computer</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;700;800&family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<link rel="stylesheet" href="../assets/css/style.css?v=4.0.0">
</head>
<body>
<div class="auth-shell">
    <div class="auth-card wide">
        <div class="brand-lockup">
            <div class="book-spine-mark lg"><span></span><span></span><span></span><span></span></div>
            <div class="shop-name">Mallik Book House &amp; Computer<small>Powered by Arieskonex Technologies</small></div>
        </div>

        <div class="install-steps">
            <div class="step active"></div>
            <div class="step"></div>
        </div>
        <p style="text-align:center;color:var(--text-secondary);font-size:13.5px;margin-top:-14px;margin-bottom:20px;">ধাপ ১ / ২ — ডাটাবেজ কনফিগারেশন</p>

        <?php if ($error): ?>
            <div class="alert alert-danger"><?= e($error) ?></div>
        <?php endif; ?>

        <div class="alert alert-info">
            শুরু করার আগে cPanel-এর <strong>MySQL Databases</strong> অপশন থেকে একটি ডাটাবেজ, একটি ইউজার তৈরি করে সেই ইউজারকে ডাটাবেজে <strong>All Privileges</strong> দিয়ে যুক্ত করে নিন।
        </div>

        <form method="POST">
            <div class="form-group">
                <label>ডাটাবেজ হোস্ট</label>
                <input type="text" name="db_host" class="form-control" value="<?= e($_POST['db_host'] ?? 'localhost') ?>" required>
            </div>
            <div class="form-group">
                <label>ডাটাবেজ নাম</label>
                <input type="text" name="db_name" class="form-control" value="<?= e($_POST['db_name'] ?? '') ?>" placeholder="cpaneluser_mallikbook" required>
            </div>
            <div class="form-group">
                <label>ডাটাবেজ ইউজারনেম</label>
                <input type="text" name="db_user" class="form-control" value="<?= e($_POST['db_user'] ?? '') ?>" placeholder="cpaneluser_dbuser" required>
            </div>
            <div class="form-group">
                <label>ডাটাবেজ পাসওয়ার্ড</label>
                <input type="password" name="db_pass" class="form-control">
            </div>
            <div class="form-group">
                <label>সাইটের URL (ঐচ্ছিক)</label>
                <input type="text" name="base_url" class="form-control" value="<?= e($_POST['base_url'] ?? '') ?>" placeholder="https://yourdomain.com">
                <div class="form-hint">খালি রাখলে স্বয়ংক্রিয়ভাবে সনাক্ত করা হবে।</div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">সংযোগ পরীক্ষা করে পরবর্তী ধাপে যান <i class="bi bi-arrow-left" style="transform:scaleX(-1);"></i></button>
        </form>
    </div>
</div>
</body>
</html>
