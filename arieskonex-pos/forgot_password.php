<?php
require_once __DIR__ . '/includes/bootstrap.php';

if (!file_exists(APP_ROOT . '/config/config.php')) {
    redirect('install/index.php');
}

if (!empty($_SESSION['user'])) {
    redirect('modules/dashboard.php');
}

$message = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $identifier = trim($_POST['identifier'] ?? '');

    if ($identifier !== '') {
        // ইউজারনেম অথবা ইমেইল — যেকোনো একটা দিয়ে খোঁজা হয়, শুধু সক্রিয় অ্যাকাউন্টের মধ্যে
        $stmt = $pdo->prepare("SELECT * FROM users WHERE (username = ? OR email = ?) AND status = 'active' LIMIT 1");
        $stmt->execute([$identifier, $identifier]);
        $user = $stmt->fetch();

        // নিরাপত্তার জন্য: অ্যাকাউন্ট পাওয়া গেল কিনা তা কখনো প্রকাশ করা হয় না (ইউজারনেম/ইমেইল
        // অনুমান করে যাচাই করা ঠেকাতে) — সবসময় একই সাধারণ বার্তা দেখানো হয়, নিচে।
        if ($user && !empty($user['email'])) {
            $settings = shop_settings($pdo);
            $shopName = $settings['shop_name'] ?? 'Mallik Book House & Computer';
            $resetUrl = password_reset_create($pdo, $user['id'], 60);

            $subject = t('reset_email_subject', 'পাসওয়ার্ড রিসেট অনুরোধ') . ' — ' . $shopName;
            $body = '
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#2C1650;margin-bottom:4px;">' . e($shopName) . '</h2>
                    <p>' . e(t('reset_email_greeting', 'প্রিয়')) . ' ' . e($user['name']) . ',</p>
                    <p>' . e(t('reset_email_body', 'আপনার অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার একটি অনুরোধ পাওয়া গেছে। নিচের বাটনে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন।')) . '</p>
                    <p style="margin:24px 0;">
                        <a href="' . e($resetUrl) . '" style="background:#5B2A9D;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;">' . e(t('reset_email_button', 'পাসওয়ার্ড রিসেট করুন')) . '</a>
                    </p>
                    <p style="font-size:13px;color:#777;">' . e(t('reset_email_expiry', 'এই লিংকটি ৬০ মিনিটের জন্য বৈধ থাকবে। আপনি যদি এই অনুরোধ না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন।')) . '</p>
                    <p style="font-size:12px;color:#999;word-break:break-all;">' . e($resetUrl) . '</p>
                </div>';
            send_email($pdo, $user['email'], $subject, $body, $user['name']);
            log_activity($pdo, 'পাসওয়ার্ড রিসেট অনুরোধ করা হয়েছে: ' . $user['username']);
        }
    }

    $message = t('forgot_password_generic_msg', 'এই তথ্যের সাথে মিলে যাওয়া কোনো সক্রিয় অ্যাকাউন্টে ইমেইল যুক্ত থাকলে, তাতে একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। ইনবক্স (এবং স্প্যাম ফোল্ডার) দেখুন।');
}

$settings = shop_settings($pdo);
$shopName = $settings['shop_name'] ?? 'Mallik Book House & Computer';
?>
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e(t('forgot_password_title', 'পাসওয়ার্ড রিসেট')) ?> — <?= e($shopName) ?></title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;700;800&family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<link rel="stylesheet" href="assets/css/style.css">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#2C1650">
<link rel="icon" href="assets/img/favicon.ico">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
</head>
<body>
<div class="auth-shell">
    <div class="auth-card">
        <div class="brand-lockup">
            <div class="book-spine-mark lg"><span></span><span></span><span></span><span></span></div>
            <div class="shop-name"><?= e($shopName) ?><small>Powered by Askurex Technologies</small></div>
        </div>

        <h5 style="text-align:center;margin:6px 0 10px;"><?= e(t('forgot_password_title', 'পাসওয়ার্ড রিসেট')) ?></h5>

        <?php if ($message): ?>
            <div class="alert alert-success"><?= e($message) ?></div>
            <div style="text-align:center;margin-top:10px;">
                <a href="login.php"><i class="bi bi-arrow-left"></i> <?= e(t('back_to_login', 'লগইনে ফিরে যান')) ?></a>
            </div>
        <?php else: ?>
            <p style="font-size:13.5px;color:var(--text-secondary);text-align:center;margin-bottom:18px;"><?= e(t('forgot_password_desc', 'আপনার ইউজারনেম অথবা ইমেইল দিন — যদি অ্যাকাউন্টে ইমেইল যুক্ত থাকে, তাহলে একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হবে।')) ?></p>
            <form method="POST">
                <?= csrf_field() ?>
                <div class="form-group">
                    <label><?= e(t('username_or_email', 'ইউজারনেম অথবা ইমেইল')) ?></label>
                    <input type="text" name="identifier" class="form-control" required autofocus value="<?= e($_POST['identifier'] ?? '') ?>">
                </div>
                <button type="submit" class="btn btn-primary btn-block"><?= e(t('send_reset_link', 'রিসেট লিংক পাঠান')) ?></button>
            </form>
            <div style="text-align:center;margin-top:14px;">
                <a href="login.php" style="font-size:13.5px;"><i class="bi bi-arrow-left"></i> <?= e(t('back_to_login', 'লগইনে ফিরে যান')) ?></a>
            </div>
        <?php endif; ?>
    </div>
</div>
</body>
</html>
