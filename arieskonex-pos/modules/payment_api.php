<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_owner();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'save_method') {
        $id = (int)$_POST['id'];
        $stmt = $pdo->prepare("UPDATE payment_methods SET merchant_number=?, api_key=?, api_secret=?, is_active=? WHERE id=?");
        $stmt->execute([
            trim($_POST['merchant_number'] ?? ''),
            trim($_POST['api_key'] ?? ''),
            trim($_POST['api_secret'] ?? ''),
            isset($_POST['is_active']) ? 1 : 0,
            $id,
        ]);
        flash_set('পেমেন্ট মেথড হালনাগাদ হয়েছে।');
        redirect('payment_api.php');
    }

    if ($action === 'save_sms') {
        $exists = $pdo->query("SELECT id FROM sms_settings ORDER BY id DESC LIMIT 1")->fetch();
        $data = [
            trim($_POST['provider_name'] ?? ''),
            trim($_POST['api_url'] ?? ''),
            trim($_POST['api_key'] ?? ''),
            trim($_POST['sender_id'] ?? ''),
            trim($_POST['message_template'] ?? ''),
            isset($_POST['sms_active']) ? 1 : 0,
        ];
        if ($exists) {
            $stmt = $pdo->prepare("UPDATE sms_settings SET provider_name=?, api_url=?, api_key=?, sender_id=?, message_template=?, is_active=? WHERE id=?");
            $stmt->execute(array_merge($data, [$exists['id']]));
        } else {
            $stmt = $pdo->prepare("INSERT INTO sms_settings (provider_name, api_url, api_key, sender_id, message_template, is_active) VALUES (?,?,?,?,?,?)");
            $stmt->execute($data);
        }
        flash_set('এসএমএস গেটওয়ে সেটিংস হালনাগাদ হয়েছে।');
        redirect('payment_api.php');
    }

    if ($action === 'save_email') {
        $exists = $pdo->query("SELECT id FROM email_settings ORDER BY id DESC LIMIT 1")->fetch();
        $newPassword = $_POST['smtp_password'] ?? '';
        $data = [
            trim($_POST['provider_name'] ?? ''),
            trim($_POST['smtp_host'] ?? ''),
            (int)($_POST['smtp_port'] ?: 587),
            trim($_POST['smtp_username'] ?? ''),
            trim($_POST['smtp_encryption'] ?? 'tls'),
            trim($_POST['from_email'] ?? ''),
            trim($_POST['from_name'] ?? ''),
            isset($_POST['email_active']) ? 1 : 0,
        ];
        if ($exists) {
            // পাসওয়ার্ড খালি রাখলে আগের পাসওয়ার্ড অপরিবর্তিত থাকবে (বারবার রিটাইপ করা লাগবে না)
            if ($newPassword !== '') {
                $stmt = $pdo->prepare("UPDATE email_settings SET provider_name=?, smtp_host=?, smtp_port=?, smtp_username=?, smtp_password=?, smtp_encryption=?, from_email=?, from_name=?, is_active=? WHERE id=?");
                $stmt->execute([$data[0], $data[1], $data[2], $data[3], $newPassword, $data[4], $data[5], $data[6], $data[7], $exists['id']]);
            } else {
                $stmt = $pdo->prepare("UPDATE email_settings SET provider_name=?, smtp_host=?, smtp_port=?, smtp_username=?, smtp_encryption=?, from_email=?, from_name=?, is_active=? WHERE id=?");
                $stmt->execute([$data[0], $data[1], $data[2], $data[3], $data[4], $data[5], $data[6], $data[7], $exists['id']]);
            }
        } else {
            $stmt = $pdo->prepare("INSERT INTO email_settings (provider_name, smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption, from_email, from_name, is_active) VALUES (?,?,?,?,?,?,?,?,?)");
            $stmt->execute([$data[0], $data[1], $data[2], $data[3], $newPassword, $data[4], $data[5], $data[6], $data[7]]);
        }
        flash_set('ইমেইল গেটওয়ে সেটিংস হালনাগাদ হয়েছে।');
        redirect('payment_api.php');
    }

    if ($action === 'send_test_email') {
        $testEmail = trim($_POST['test_email'] ?? '');
        if ($testEmail === '') {
            flash_set('টেস্ট ইমেইল পাঠাতে একটি ইমেইল ঠিকানা দিন।', 'danger');
        } else {
            $settingsForTest = shop_settings($pdo);
            $shopNameForTest = $settingsForTest['shop_name'] ?? 'Mallik Book House & Computer';
            $body = '<p>এটি ' . e($shopNameForTest) . ' থেকে পাঠানো একটি টেস্ট ইমেইল।</p><p>আপনি যদি এই ইমেইলটি পেয়ে থাকেন, তাহলে আপনার ইমেইল গেটওয়ে (SMTP) সঠিকভাবে কাজ করছে।</p>';
            $res = send_email($pdo, $testEmail, 'টেস্ট ইমেইল — ' . $shopNameForTest, $body);
            if ($res['ok']) {
                flash_set('টেস্ট ইমেইল সফলভাবে পাঠানো হয়েছে — ইনবক্স চেক করুন।');
            } else {
                flash_set('টেস্ট ইমেইল পাঠানো যায়নি: ' . $res['error'], 'danger');
            }
        }
        redirect('payment_api.php');
    }
}

$methods = $pdo->query("SELECT * FROM payment_methods ORDER BY sort_order")->fetchAll();
$sms = $pdo->query("SELECT * FROM sms_settings ORDER BY id DESC LIMIT 1")->fetch() ?: [];
$email = $pdo->query("SELECT * FROM email_settings ORDER BY id DESC LIMIT 1")->fetch() ?: [];

$pageTitle = 'পেমেন্ট মেথড এপিআই';
$activeNav = 'payment_api';
require_once __DIR__ . '/../includes/header.php';
?>
<div class="alert alert-info">
    <strong>নোট:</strong> এখানে আপনার বিকাশ/নগদ/রকেট মার্চেন্ট নম্বর ও এপিআই কী সংরক্ষণ করলে POS-এ পেমেন্ট মেথড হিসেবে দেখাবে এবং প্রতিটি বিক্রয়ে
    পেমেন্ট রেফারেন্স/ট্রানজেকশন আইডি রেকর্ড রাখা যাবে। লাইভ গেটওয়ে থেকে স্বয়ংক্রিয় পেমেন্ট ভেরিফিকেশনের জন্য সংশ্লিষ্ট প্রোভাইডার
    (বিকাশ পিজিডব্লিউ / এসএসএলকমার্জ / শিওরজোপে ইত্যাদি) থেকে মার্চেন্ট অ্যাকাউন্ট নিয়ে ডেভেলপারের মাধ্যমে যুক্ত করাতে হবে।
</div>

<div class="row g-3">
    <?php foreach ($methods as $m): ?>
    <div class="col-md-6">
        <div class="card" style="padding:18px;">
            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_method">
                <input type="hidden" name="id" value="<?= $m['id'] ?>">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h3 style="margin:0;font-size:15.5px;"><?= e($m['method_name']) ?></h3>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" name="is_active" <?= $m['is_active'] ? 'checked' : '' ?>>
                    </div>
                </div>
                <?php if ($m['method_key'] !== 'cash'): ?>
                <div class="form-group"><label>মার্চেন্ট / নম্বর</label><input type="text" name="merchant_number" class="form-control" value="<?= e($m['merchant_number']) ?>"></div>
                <div class="form-group"><label>API Key</label><input type="text" name="api_key" class="form-control" value="<?= e($m['api_key']) ?>"></div>
                <div class="form-group"><label>API Secret</label><input type="password" name="api_secret" class="form-control" value="<?= e($m['api_secret']) ?>"></div>
                <?php else: ?>
                    <p class="form-hint">নগদ টাকার লেনদেনের জন্য অতিরিক্ত কনফিগারেশনের প্রয়োজন নেই।</p>
                <?php endif; ?>
                <button class="btn btn-light btn-sm" type="submit">সংরক্ষণ করুন</button>
            </form>
        </div>
    </div>
    <?php endforeach; ?>
</div>

<div class="card" style="margin-top:18px;padding:20px;">
    <h3 style="margin-top:0;">এসএমএস গেটওয়ে (বাকি রিমাইন্ডারের জন্য)</h3>
    <form method="POST">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_sms">
        <div class="row">
            <div class="col-md-6 form-group"><label>প্রোভাইডারের নাম</label><input type="text" name="provider_name" class="form-control" value="<?= e($sms['provider_name'] ?? '') ?>" placeholder="যেমনঃ আপনার বাল্ক এসএমএস প্রোভাইডার"></div>
            <div class="col-md-6 form-group"><label>সেন্ডার আইডি</label><input type="text" name="sender_id" class="form-control" value="<?= e($sms['sender_id'] ?? '') ?>"></div>
        </div>
        <div class="form-group">
            <label>API URL</label>
            <input type="text" name="api_url" class="form-control" value="<?= e($sms['api_url'] ?? '') ?>" placeholder="https://provider.com/send?key={api_key}&sender={sender_id}&to={number}&msg={message}">
            <div class="form-hint">{number}, {message}, {api_key}, {sender_id} — এই প্লেসহোল্ডারগুলো স্বয়ংক্রিয়ভাবে প্রকৃত মান দিয়ে প্রতিস্থাপিত হবে। আপনার প্রোভাইডারের ডকুমেন্টেশন অনুযায়ী URL ফরম্যাট বসান।</div>
        </div>
        <div class="form-group"><label>API Key</label><input type="text" name="api_key" class="form-control" value="<?= e($sms['api_key'] ?? '') ?>"></div>
        <div class="form-check form-switch" style="margin-bottom:16px;">
            <input class="form-check-input" type="checkbox" name="sms_active" <?= !empty($sms['is_active']) ? 'checked' : '' ?>>
            <label class="form-check-label">সক্রিয় করুন</label>
        </div>
        <button class="btn btn-primary" type="submit">এসএমএস সেটিংস সংরক্ষণ করুন</button>
    </form>
</div>

<div class="card" style="margin-top:18px;padding:20px;">
    <h3 style="margin-top:0;">ইমেইল গেটওয়ে (SMTP)</h3>
    <p class="form-hint" style="margin-top:-6px;">পাসওয়ার্ড রিসেট লিংক ও অন্যান্য নোটিফিকেশন ইমেইল পাঠাতে ব্যবহৃত হয়। Gmail ব্যবহার করলে হোস্টঃ smtp.gmail.com, পোর্টঃ 587, এনক্রিপশনঃ TLS, এবং সাধারণ পাসওয়ার্ডের বদলে <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener">অ্যাপ পাসওয়ার্ড</a> ব্যবহার করুন।</p>
    <form method="POST">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_email">
        <div class="row">
            <div class="col-md-6 form-group"><label>প্রোভাইডারের নাম</label><input type="text" name="provider_name" class="form-control" value="<?= e($email['provider_name'] ?? '') ?>" placeholder="যেমনঃ Gmail SMTP"></div>
            <div class="col-md-6 form-group"><label>এনক্রিপশন</label>
                <select name="smtp_encryption" class="form-control">
                    <option value="tls" <?= ($email['smtp_encryption'] ?? 'tls') === 'tls' ? 'selected' : '' ?>>TLS (পোর্ট ৫৮৭)</option>
                    <option value="ssl" <?= ($email['smtp_encryption'] ?? '') === 'ssl' ? 'selected' : '' ?>>SSL (পোর্ট ৪৬৫)</option>
                    <option value="none" <?= ($email['smtp_encryption'] ?? '') === 'none' ? 'selected' : '' ?>>কোনোটিই নয়</option>
                </select>
            </div>
        </div>
        <div class="row">
            <div class="col-md-8 form-group"><label>SMTP হোস্ট</label><input type="text" name="smtp_host" class="form-control" value="<?= e($email['smtp_host'] ?? '') ?>" placeholder="smtp.gmail.com"></div>
            <div class="col-md-4 form-group"><label>SMTP পোর্ট</label><input type="number" name="smtp_port" class="form-control" value="<?= e($email['smtp_port'] ?? '587') ?>"></div>
        </div>
        <div class="row">
            <div class="col-md-6 form-group"><label>SMTP ইউজারনেম</label><input type="text" name="smtp_username" class="form-control" value="<?= e($email['smtp_username'] ?? '') ?>" placeholder="you@example.com"></div>
            <div class="col-md-6 form-group"><label>SMTP পাসওয়ার্ড</label><input type="password" name="smtp_password" class="form-control" placeholder="<?= !empty($email['smtp_password']) ? 'অপরিবর্তিত রাখতে খালি রাখুন' : '' ?>"></div>
        </div>
        <div class="row">
            <div class="col-md-6 form-group"><label>প্রেরকের ইমেইল (From)</label><input type="email" name="from_email" class="form-control" value="<?= e($email['from_email'] ?? '') ?>" placeholder="no-reply@yourshop.com"></div>
            <div class="col-md-6 form-group"><label>প্রেরকের নাম (From Name)</label><input type="text" name="from_name" class="form-control" value="<?= e($email['from_name'] ?? '') ?>" placeholder="<?= e($settings['shop_name'] ?? 'Mallik Book House & Computer') ?>"></div>
        </div>
        <div class="form-check form-switch" style="margin-bottom:16px;">
            <input class="form-check-input" type="checkbox" name="email_active" <?= !empty($email['is_active']) ? 'checked' : '' ?>>
            <label class="form-check-label">সক্রিয় করুন</label>
        </div>
        <button class="btn btn-primary" type="submit">ইমেইল সেটিংস সংরক্ষণ করুন</button>
    </form>
    <hr style="margin:18px 0;">
    <form method="POST" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="send_test_email">
        <div class="form-group" style="margin-bottom:0;flex:1;min-width:220px;">
            <label>টেস্ট ইমেইল পাঠান</label>
            <input type="email" name="test_email" class="form-control" placeholder="আপনার নিজের ইমেইল দিন" value="<?= e(current_user()['email'] ?? '') ?>" required>
        </div>
        <button class="btn btn-light" type="submit"><i class="bi bi-send"></i> টেস্ট পাঠান</button>
    </form>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
