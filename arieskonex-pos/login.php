<?php
require_once __DIR__ . '/includes/bootstrap.php';

if (!file_exists(APP_ROOT . '/config/config.php')) {
    redirect('install/index.php');
}

if (!empty($_SESSION['user'])) {
    redirect('modules/dashboard.php');
}

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username === '' || $password === '') {
        $error = t('err_enter_credentials', 'ইউজারনেম ও পাসওয়ার্ড দিন।');
    } else {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? LIMIT 1");
        $stmt->execute([$username]);
        $u = $stmt->fetch();

        if (!$u || !password_verify($password, $u['password'])) {
            $error = t('err_bad_login', 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।');
        } elseif ($u['status'] !== 'active') {
            $error = t('err_inactive_account', 'আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা আছে। মালিকের সাথে যোগাযোগ করুন।');
        } else {
            // সেশন ফিক্সেশন প্রতিরোধ — লগইনের পর নতুন সেশন আইডি
            session_regenerate_id(true);
            $_SESSION['user'] = [
                'id' => $u['id'], 'name' => $u['name'], 'username' => $u['username'],
                'role' => $u['role'], 'mobile' => $u['mobile'], 'email' => $u['email'],
                'permissions' => user_permissions($u),
            ];
            log_activity($pdo, 'লগইন করেছেন');
            redirect('modules/dashboard.php');
        }
    }
}

$settings = shop_settings($pdo);
$shopName = $settings['shop_name'] ?? 'Mallik Book House & Computer';
?>
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e(t('login_title')) ?> — <?= e($shopName) ?></title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;700;800&family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<link rel="stylesheet" href="assets/css/style.css?v=4.1.0">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#4F46E5">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="<?= e(mb_substr($shopName, 0, 20)) ?>">
<link rel="icon" href="assets/img/favicon.ico">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
</head>
<body>
<div class="auth-shell">
    <div class="auth-card">
        <div class="brand-lockup">
            <div class="book-spine-mark lg"><span></span><span></span><span></span><span></span></div>
            <div class="shop-name"><?= e($shopName) ?><small>Powered by Arieskonex Technologies</small></div>
        </div>

        <?php if (!empty($_GET['existing']) && !$error): ?>
            <div class="alert alert-info"><?= e(t('existing_install_found', 'এই ডাটাবেজে আগের সব তথ্য পাওয়া গেছে এবং তা অক্ষত আছে — আগের ইউজারনেম ও পাসওয়ার্ড দিয়ে লগইন করুন।')) ?></div>
        <?php endif; ?>
        <?php if ($error): ?>
            <div class="alert alert-danger"><?= e($error) ?></div>
        <?php endif; ?>

        <form method="POST">
            <div class="form-group">
                <label><?= e(t('username')) ?></label>
                <input type="text" name="username" class="form-control" required autofocus value="<?= e($_POST['username'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label><?= e(t('password')) ?></label>
                <input type="password" name="password" class="form-control" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block"><?= e(t('login_button')) ?></button>
        </form>
        <div style="text-align:center;margin-top:14px;">
            <a href="forgot_password.php" style="font-size:13.5px;"><?= e(t('forgot_password')) ?></a>
        </div>
        <div class="auth-credit">Developed by <strong>Arieskonex Technologies</strong></div>
    </div>
</div>
<script>
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {});
    });
}
</script>
</body>
</html>
