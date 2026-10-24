<?php
require_once __DIR__ . '/includes/bootstrap.php';

if (!file_exists(APP_ROOT . '/config/config.php')) {
    redirect('install/index.php');
}

if (!empty($_SESSION['user'])) {
    redirect('modules/dashboard.php');
}

$token = $_GET['token'] ?? ($_POST['token'] ?? '');
$reset = password_reset_verify($pdo, $token);
$error = null;

if ($reset && $_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $newPassword = $_POST['new_password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';

    if (strlen($newPassword) < 6) {
        $error = t('err_password_too_short', 'পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।');
    } elseif ($newPassword !== $confirmPassword) {
        $error = t('err_password_mismatch', 'দুটি পাসওয়ার্ড মিলছে না।');
    } else {
        $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")
            ->execute([password_hash($newPassword, PASSWORD_DEFAULT), $reset['user_id']]);
        password_reset_consume($pdo, $reset['reset_id']);
        log_activity($pdo, 'পাসওয়ার্ড রিসেট সম্পন্ন হয়েছে: ' . $reset['username']);
        flash_set(t('reset_password_success', 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে — এখন লগইন করুন।'));
        redirect('login.php');
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
<title><?= e(t('reset_password_title', 'নতুন পাসওয়ার্ড সেট করুন')) ?> — <?= e($shopName) ?></title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;700;800&family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<link rel="stylesheet" href="assets/css/style.css?v=4.0.0">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#4F46E5">
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

        <?php if (!$reset): ?>
            <div class="alert alert-danger"><?= e(t('err_reset_token_invalid', 'লিংকটি অকার্যকর অথবা মেয়াদোত্তীর্ণ হয়ে গেছে। নতুন করে রিসেট লিংক চান।')) ?></div>
            <div style="text-align:center;margin-top:10px;">
                <a href="forgot_password.php" class="btn btn-primary btn-block"><?= e(t('request_new_link', 'নতুন রিসেট লিংক চান')) ?></a>
            </div>
        <?php else: ?>
            <h5 style="text-align:center;margin:6px 0 4px;"><?= e(t('reset_password_title', 'নতুন পাসওয়ার্ড সেট করুন')) ?></h5>
            <p style="font-size:13.5px;color:var(--text-secondary);text-align:center;margin-bottom:18px;"><?= e(t('reset_password_for', 'অ্যাকাউন্ট')) ?>: <strong><?= e($reset['name']) ?></strong> (<?= e($reset['username']) ?>)</p>

            <?php if ($error): ?>
                <div class="alert alert-danger"><?= e($error) ?></div>
            <?php endif; ?>

            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="token" value="<?= e($token) ?>">
                <div class="form-group">
                    <label><?= e(t('new_password', 'নতুন পাসওয়ার্ড')) ?></label>
                    <input type="password" name="new_password" class="form-control" required minlength="6" autofocus>
                </div>
                <div class="form-group">
                    <label><?= e(t('confirm_password', 'পাসওয়ার্ড আবার লিখুন')) ?></label>
                    <input type="password" name="confirm_password" class="form-control" required minlength="6">
                </div>
                <button type="submit" class="btn btn-primary btn-block"><?= e(t('reset_password_button', 'পাসওয়ার্ড সেভ করুন')) ?></button>
            </form>
        <?php endif; ?>
    </div>
</div>
</body>
</html>
