<?php
/**
 * ইনস্টলার ধাপ ২: দোকানের তথ্য ও মালিকের অ্যাডমিন অ্যাকাউন্ট
 */
define('APP_ROOT', dirname(__DIR__));
$configFile = APP_ROOT . '/config/config.php';

if (!file_exists($configFile)) {
    header('Location: index.php');
    exit;
}
require_once $configFile;

if (session_status() === PHP_SESSION_NONE) session_start();

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    header('Location: index.php');
    exit;
}

$already = $pdo->query("SELECT COUNT(*) c FROM shop_settings")->fetch();
if ($already['c'] > 0) {
    header('Location: ../login.php');
    exit;
}

function e2($s) { return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8'); }

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $shopName   = trim($_POST['shop_name'] ?? '');
    $ownerName  = trim($_POST['owner_name'] ?? '');
    $address    = trim($_POST['address'] ?? '');
    $mobile     = trim($_POST['mobile'] ?? '');
    $email      = trim($_POST['email'] ?? '');
    $username   = trim($_POST['username'] ?? '');
    $password   = $_POST['password'] ?? '';
    $password2  = $_POST['password2'] ?? '';

    if ($shopName === '' || $ownerName === '' || $username === '' || $password === '') {
        $error = 'দোকানের নাম, মালিকের নাম, ইউজারনেম ও পাসওয়ার্ড আবশ্যক।';
    } elseif (strlen($password) < 6) {
        $error = 'পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।';
    } elseif ($password !== $password2) {
        $error = 'পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড মিলছে না।';
    } else {
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO shop_settings (shop_name, owner_name, address, mobile, email) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$shopName, $ownerName, $address, $mobile, $email]);

            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO users (name, username, password, role, mobile, email, status) VALUES (?, ?, ?, 'owner', ?, ?, 'active')");
            $stmt->execute([$ownerName, $username, $hash, $mobile, $email]);

            $pdo->commit();
            $_SESSION['install_done'] = true;
            header('Location: finish.php');
            exit;
        } catch (PDOException $e) {
            $pdo->rollBack();
            if ($e->getCode() == 23000) {
                $error = 'এই ইউজারনেমটি আগে থেকেই ব্যবহৃত হচ্ছে।';
            } else {
                $error = 'সংরক্ষণ ব্যর্থ হয়েছে: ' . $e->getMessage();
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
<title>ইনস্টলেশন — দোকানের তথ্য</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;700;800&family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<link rel="stylesheet" href="../assets/css/style.css?v=4.1.0">
</head>
<body>
<div class="auth-shell">
    <div class="auth-card wide">
        <div class="brand-lockup">
            <div class="book-spine-mark lg"><span></span><span></span><span></span><span></span></div>
            <div class="shop-name">Mallik Book House &amp; Computer<small>Powered by Arieskonex Technologies</small></div>
        </div>

        <div class="install-steps">
            <div class="step done"></div>
            <div class="step active"></div>
        </div>
        <p style="text-align:center;color:var(--text-secondary);font-size:13.5px;margin-top:-14px;margin-bottom:20px;">ধাপ ২ / ২ — দোকান ও অ্যাডমিন প্রোফাইল</p>

        <?php if ($error): ?>
            <div class="alert alert-danger"><?= e2($error) ?></div>
        <?php endif; ?>

        <form method="POST">
            <h3 style="font-size:15px;margin-bottom:14px;">দোকানের তথ্য</h3>
            <div class="row">
                <div class="col-md-6 form-group">
                    <label>দোকানের নাম</label>
                    <input type="text" name="shop_name" class="form-control" value="<?= e2($_POST['shop_name'] ?? 'মল্লিক বুক হাউজ এন্ড কম্পিউটার') ?>" required>
                </div>
                <div class="col-md-6 form-group">
                    <label>মালিকের নাম</label>
                    <input type="text" name="owner_name" class="form-control" value="<?= e2($_POST['owner_name'] ?? '') ?>" required>
                </div>
            </div>
            <div class="form-group">
                <label>ঠিকানা</label>
                <input type="text" name="address" class="form-control" value="<?= e2($_POST['address'] ?? '') ?>">
            </div>
            <div class="row">
                <div class="col-md-6 form-group">
                    <label>মোবাইল নং</label>
                    <input type="text" name="mobile" class="form-control" value="<?= e2($_POST['mobile'] ?? '') ?>">
                </div>
                <div class="col-md-6 form-group">
                    <label>ইমেইল</label>
                    <input type="email" name="email" class="form-control" value="<?= e2($_POST['email'] ?? '') ?>">
                </div>
            </div>

            <hr style="margin:20px 0;">
            <h3 style="font-size:15px;margin-bottom:14px;">মালিকের লগইন অ্যাকাউন্ট</h3>
            <div class="row">
                <div class="col-md-6 form-group">
                    <label>ইউজারনেম</label>
                    <input type="text" name="username" class="form-control" value="<?= e2($_POST['username'] ?? '') ?>" required>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 form-group">
                    <label>পাসওয়ার্ড</label>
                    <input type="password" name="password" class="form-control" required>
                </div>
                <div class="col-md-6 form-group">
                    <label>পাসওয়ার্ড আবার লিখুন</label>
                    <input type="password" name="password2" class="form-control" required>
                </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block">ইনস্টলেশন সম্পন্ন করুন <i class="bi bi-check2-circle"></i></button>
        </form>
    </div>
</div>
</body>
</html>
