<?php
/**
 * কমন হেল্পার ফাংশনসমূহ
 */

function e($str) {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * অনুবাদ হেল্পার। lang/*.php ফাইলে $key না পাওয়া গেলে $default (বা key নিজেই) দেখাবে,
 * তাই কোনো পাতা এখনো অনুবাদ করা না থাকলেও অ্যাপ ভেঙে পড়বে না।
 */
function t($key, $default = null) {
    $lang = $GLOBALS['LANG'] ?? [];
    if (isset($lang[$key])) return $lang[$key];
    return $default !== null ? $default : $key;
}

function money($amount) {
    return number_format((float)$amount, 2);
}

/**
 * হোয়াটসঅ্যাপ লিংকের জন্য বাংলাদেশি মোবাইল নম্বরকে আন্তর্জাতিক ফরম্যাটে (৮৮০...) রূপান্তর করে।
 * যেমন: 01712345678 -> 8801712345678, +8801712345678 -> 8801712345678
 */
function whatsapp_number($mobile) {
    $digits = preg_replace('/\D/', '', $mobile ?? '');
    if ($digits === '') return '';
    if (substr($digits, 0, 3) === '880') return $digits;
    if (substr($digits, 0, 1) === '0') return '880' . substr($digits, 1);
    return $digits;
}

/**
 * ইনভয়েস QR-কোড যাচাইকরণের জন্য একটি অনুমান-অযোগ্য টোকেন তৈরি করে।
 * $type = 'sale' | 'purchase', $id = রেকর্ড আইডি, $extra = ইনভয়েস নং (রেকর্ডের সাথে বাঁধা থাকে)।
 * verify.php এই একই ফাংশন দিয়ে টোকেন পুনরায় হিসাব করে মিলিয়ে দেখে।
 */
function invoice_verify_token($type, $id, $extra = '') {
    $secret = defined('APP_SECRET') ? APP_SECRET : ((defined('DB_NAME') ? DB_NAME : '') . '|' . (defined('DB_HOST') ? DB_HOST : '') . '|mallik-book-house');
    return substr(hash_hmac('sha256', $type . ':' . $id . ':' . $extra, $secret), 0, 20);
}

/**
 * একটি ইনভয়েসের যাচাইযোগ্য পাবলিক লিংক (QR কোডে এনকোড করার জন্য)।
 */
function invoice_verify_url($type, $id, $invoiceNo) {
    $token = invoice_verify_token($type, $id, $invoiceNo);
    return rtrim(BASE_URL, '/') . '/verify.php?type=' . urlencode($type) . '&id=' . (int)$id . '&token=' . $token;
}

function redirect($url) {
    header('Location: ' . $url);
    exit;
}

function flash_set($message, $type = 'success') {
    $_SESSION['flash'] = ['message' => $message, 'type' => $type];
}

function flash_get() {
    if (!empty($_SESSION['flash'])) {
        $f = $_SESSION['flash'];
        unset($_SESSION['flash']);
        return $f;
    }
    return null;
}

function csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field() {
    return '<input type="hidden" name="csrf_token" value="' . csrf_token() . '">';
}

function csrf_verify() {
    $token = $_POST['csrf_token'] ?? '';
    if (!$token || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        flash_set('নিরাপত্তা যাচাই ব্যর্থ হয়েছে, আবার চেষ্টা করুন।', 'danger');
        redirect($_SERVER['HTTP_REFERER'] ?? BASE_URL);
    }
}

function current_user() {
    return $_SESSION['user'] ?? null;
}

function normalize_user_role($role) {
    $role = strtolower((string)($role ?? ''));
    if (in_array($role, ['owner', 'cashier', 'salesman'], true)) {
        return $role;
    }
    return 'cashier';
}

function user_role($user = null) {
    $u = $user ?: current_user();
    return normalize_user_role($u['role'] ?? 'cashier');
}

function user_permissions($user = null) {
    $u = $user ?: current_user();
    if (!$u) {
        return [];
    }
    if (isset($u['permissions']) && is_array($u['permissions'])) {
        return array_values(array_filter($u['permissions'], 'is_string'));
    }
    $value = $u['permissions'] ?? '';
    if (is_string($value) && $value !== '') {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            return array_values(array_filter($decoded, 'is_string'));
        }
        return array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $value) ?: [])));
    }
    return [];
}

function user_has_role($user = null, array $roles = []) {
    if (!$roles) {
        return true;
    }
    return in_array(user_role($user), $roles, true);
}

function has_permission($user = null, $permission = null) {
    if (!$user) {
        return false;
    }
    if (is_owner($user)) {
        return true;
    }
    if ($permission === 'dashboard') {
        return true;
    }
    if (user_role($user) === 'salesman' && $permission === 'stock_insights') {
        return true;
    }
    $permissions = user_permissions($user);
    if (!empty($permissions)) {
        return in_array($permission, $permissions, true);
    }
    if (user_role($user) === 'salesman') {
        return false;
    }
    $fallback = ['dashboard', 'sales', 'sales_list', 'sales_return', 'customers'];
    return in_array($permission, $fallback, true);
}

function can_access_module($user = null, $module = null) {
    return has_permission($user, $module);
}

/**
 * ক্রয়মূল্যের নিচে (লোকসানে) বিক্রি করার জন্য বিশেষভাবে অনুমোদিত কিনা।
 * মালিকের (owner) জন্য সবসময় সত্য (has_permission-এ is_owner() চেক থাকায়);
 * ক্যাশিয়ার/সেলসম্যানের জন্য এটি সুনির্দিষ্টভাবে অনুমতি দেওয়া না থাকলে মিথ্যা —
 * অর্থাৎ ডিফল্টভাবে কেউ লোকসানে বিক্রি করতে পারবে না।
 */
function can_override_below_cost($user = null) {
    return has_permission($user, 'sell_below_cost');
}

function require_permission($permission) {
    require_login();
    if (!has_permission(current_user(), $permission)) {
        flash_set('আপনার এই কাজের অনুমতি নেই।', 'danger');
        redirect(BASE_URL . '/modules/dashboard.php');
    }
}

function require_login() {
    if (empty($_SESSION['user'])) {
        redirect(BASE_URL . '/login.php');
    }
}

function is_owner($user = null) {
    return user_role($user) === 'owner';
}

function is_salesman($user = null) {
    return user_role($user) === 'salesman';
}

function can_view_purchase_price($user = null) {
    return is_owner($user);
}

function can_view_profit($user = null) {
    return is_owner($user);
}

function can_access_reports($user = null) {
    return is_owner($user);
}

function require_owner() {
    require_login();
    if (!is_owner()) {
        flash_set('এই পাতাটি শুধুমাত্র মালিকের জন্য। লাভ-ক্ষতির তথ্য দেখার অনুমতি একমাত্র মালিকের।', 'danger');
        redirect(BASE_URL . '/modules/dashboard.php');
    }
}

function generate_invoice_no($pdo, $table = 'sales', $prefix = 'INV') {
    $today = date('Ymd');
    $dateCol = ($table === 'sales') ? 'sale_date' : 'purchase_date';
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM $table WHERE DATE($dateCol) = CURDATE()");
        $stmt->execute();
        $count = (int)$stmt->fetch()['c'] + 1;
    } catch (Exception $e) {
        // ফলব্যাক: মাইক্রোসেকেন্ড-ভিত্তিক সাফিক্স, যাতে একই সময়ে একাধিক ইনভয়েস তৈরি হলেও সংঘর্ষ না হয়
        $count = (int)substr((string)round(microtime(true) * 1000), -4);
    }
    $invoiceNo = $prefix . '-' . $today . '-' . str_pad((string)$count, 4, '0', STR_PAD_LEFT);

    // ইউনিক আছে কিনা যাচাই — সংঘর্ষ হলে সাফিক্স বাড়িয়ে আবার চেষ্টা করুন
    try {
        $check = $pdo->prepare("SELECT id FROM $table WHERE invoice_no = ? LIMIT 1");
        $attempt = 0;
        while ($attempt < 20) {
            $check->execute([$invoiceNo]);
            if (!$check->fetch()) break;
            $count++;
            $invoiceNo = $prefix . '-' . $today . '-' . str_pad((string)$count, 4, '0', STR_PAD_LEFT);
            $attempt++;
        }
    } catch (Exception $e) {
        // যাচাই ব্যর্থ হলেও চলতে দিন — INSERT নিজেই UNIQUE constraint দিয়ে সুরক্ষিত
    }
    return $invoiceNo;
}

/**
 * quotation_no / transfer_no-এর মতো সাধারণ ডকুমেন্ট নম্বর তৈরি করে —
 * generate_invoice_no()-এর মতোই কাজ করে কিন্তু sales/purchases ছাড়া
 * অন্য যেকোনো টেবিলের জন্য ব্যবহারযোগ্য (কলামের নাম নিজে দেওয়া যায়)।
 */
function generate_doc_no($pdo, $table, $dateCol, $numberCol, $prefix) {
    $today = date('Ymd');
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM $table WHERE DATE($dateCol) = CURDATE()");
        $stmt->execute();
        $count = (int)$stmt->fetch()['c'] + 1;
    } catch (Exception $e) {
        $count = (int)substr((string)round(microtime(true) * 1000), -4);
    }
    $docNo = $prefix . '-' . $today . '-' . str_pad((string)$count, 4, '0', STR_PAD_LEFT);
    try {
        $check = $pdo->prepare("SELECT id FROM $table WHERE $numberCol = ? LIMIT 1");
        $attempt = 0;
        while ($attempt < 20) {
            $check->execute([$docNo]);
            if (!$check->fetch()) break;
            $count++;
            $docNo = $prefix . '-' . $today . '-' . str_pad((string)$count, 4, '0', STR_PAD_LEFT);
            $attempt++;
        }
    } catch (Exception $e) {
    }
    return $docNo;
}

/**
 * একটি কুপন কোড বৈধ কিনা যাচাই করে এবং ছাড়ের পরিমাণ হিসাব করে দেয়।
 * POS চেকআউট (সার্ভার-সাইড, চূড়ান্ত) এবং লাইভ প্রিভিউ (coupon_check.php)
 * — দুই জায়গাতেই এই একই ফাংশন ব্যবহার হয়, যাতে হিসাব সবসময় মিলে যায়।
 * রিটার্ন করে: ['ok'=>bool, 'message'=>string, 'coupon'=>row|null, 'discount_amount'=>float]
 */
function validate_coupon($pdo, $code, $subtotal) {
    $code = strtoupper(trim((string)$code));
    if ($code === '') {
        return ['ok' => false, 'message' => 'কুপন কোড দিন।', 'coupon' => null, 'discount_amount' => 0.0];
    }
    $stmt = $pdo->prepare("SELECT * FROM coupons WHERE code = ? LIMIT 1");
    $stmt->execute([$code]);
    $coupon = $stmt->fetch();
    if (!$coupon) {
        return ['ok' => false, 'message' => 'এই কুপন কোডটি সঠিক নয়।', 'coupon' => null, 'discount_amount' => 0.0];
    }
    if (!$coupon['is_active']) {
        return ['ok' => false, 'message' => 'এই কুপনটি বর্তমানে নিষ্ক্রিয়।', 'coupon' => $coupon, 'discount_amount' => 0.0];
    }
    $today = date('Y-m-d');
    if (!empty($coupon['valid_from']) && $coupon['valid_from'] > $today) {
        return ['ok' => false, 'message' => 'এই কুপনের মেয়াদ এখনো শুরু হয়নি।', 'coupon' => $coupon, 'discount_amount' => 0.0];
    }
    if (!empty($coupon['valid_to']) && $coupon['valid_to'] < $today) {
        return ['ok' => false, 'message' => 'এই কুপনের মেয়াদ শেষ হয়ে গেছে।', 'coupon' => $coupon, 'discount_amount' => 0.0];
    }
    if ($coupon['usage_limit'] !== null && (int)$coupon['used_count'] >= (int)$coupon['usage_limit']) {
        return ['ok' => false, 'message' => 'এই কুপনের ব্যবহারসীমা শেষ হয়ে গেছে।', 'coupon' => $coupon, 'discount_amount' => 0.0];
    }
    if ((float)$coupon['min_purchase'] > 0 && $subtotal < (float)$coupon['min_purchase']) {
        return ['ok' => false, 'message' => 'সর্বনিম্ন ৳' . money($coupon['min_purchase']) . ' কেনাকাটায় এই কুপন প্রযোজ্য।', 'coupon' => $coupon, 'discount_amount' => 0.0];
    }

    if ($coupon['discount_type'] === 'percent') {
        $amount = round($subtotal * (float)$coupon['discount_value'] / 100, 2);
        if (!empty($coupon['max_discount']) && $amount > (float)$coupon['max_discount']) {
            $amount = (float)$coupon['max_discount'];
        }
    } else {
        $amount = min($subtotal, (float)$coupon['discount_value']);
    }

    return ['ok' => true, 'message' => 'কুপন প্রয়োগ হয়েছে — ৳' . money($amount) . ' ছাড়।', 'coupon' => $coupon, 'discount_amount' => $amount];
}

function generate_item_code($pdo, $prefix = 'P') {
    try {
        $count = (int)$pdo->query("SELECT COUNT(*) AS c FROM products")->fetch()['c'] + 1;
    } catch (Exception $e) {
        // ফলব্যাক: মাইক্রোসেকেন্ড-ভিত্তিক সাফিক্স, যাতে সংঘর্ষ না হয়
        $count = (int)substr((string)round(microtime(true) * 1000), -6);
    }
    $itemCode = $prefix . str_pad((string)$count, 5, '0', STR_PAD_LEFT);

    // ইউনিক আছে কিনা যাচাই — সংঘর্ষ হলে সাফিক্স বাড়িয়ে আবার চেষ্টা করুন
    try {
        $check = $pdo->prepare("SELECT id FROM products WHERE item_code = ? LIMIT 1");
        $attempt = 0;
        while ($attempt < 20) {
            $check->execute([$itemCode]);
            if (!$check->fetch()) break;
            $count++;
            $itemCode = $prefix . str_pad((string)$count, 5, '0', STR_PAD_LEFT);
            $attempt++;
        }
    } catch (Exception $e) {
        // যাচাই ব্যর্থ হলেও চলতে দিন — INSERT নিজেই UNIQUE constraint দিয়ে সুরক্ষিত
    }
    return $itemCode;
}

function log_activity($pdo, $action) {
    try {
        $u = current_user();
        $stmt = $pdo->prepare("INSERT INTO activity_log (user_id, action) VALUES (?, ?)");
        $stmt->execute([$u['id'] ?? null, $action]);
    } catch (Exception $e) {
        // নীরবে উপেক্ষা করুন, লগিং ব্যর্থ হলে অ্যাপ থামবে না
    }
}

/**
 * কনফিগার করা গেটওয়ে দিয়ে এসএমএস পাঠানো (জেনেরিক HTTP GET/POST অ্যাডাপ্টার)।
 * sms_settings টেবিলের api_url -এ {number}, {message}, {api_key}, {sender_id}
 * প্লেসহোল্ডার বসিয়ে দিলে তা প্রকৃত মান দিয়ে প্রতিস্থাপিত হবে।
 */
function send_sms($pdo, $mobile, $message) {
    try {
        $stmt = $pdo->query("SELECT * FROM sms_settings ORDER BY id DESC LIMIT 1");
        $cfg = $stmt->fetch();
        if (!$cfg || !$cfg['is_active'] || empty($cfg['api_url'])) {
            return ['ok' => false, 'error' => 'এসএমএস গেটওয়ে কনফিগার করা নেই।'];
        }
        $url = str_replace(
            ['{number}', '{message}', '{api_key}', '{sender_id}'],
            [urlencode($mobile), urlencode($message), urlencode($cfg['api_key'] ?? ''), urlencode($cfg['sender_id'] ?? '')],
            $cfg['api_url']
        );
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        $response = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        $log = $pdo->prepare("INSERT INTO sms_logs (mobile, message, status) VALUES (?, ?, ?)");
        $log->execute([$mobile, $message, $err ? 'failed' : 'sent']);

        if ($err) {
            return ['ok' => false, 'error' => $err];
        }
        return ['ok' => true, 'response' => $response];
    } catch (Exception $e) {
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

/**
 * email_settings টেবিলের SMTP তথ্য ব্যবহার করে (PHPMailer দিয়ে) ইমেইল পাঠায়।
 * পাসওয়ার্ড রিসেট লিংক ও অন্যান্য নোটিফিকেশনের জন্য ব্যবহৃত হয়।
 * প্রতিটি প্রচেষ্টা email_logs টেবিলে লগ হয় (সফল হোক বা ব্যর্থ)।
 */
function send_email($pdo, $toEmail, $subject, $bodyHtml, $toName = '') {
    if (empty($toEmail)) {
        return ['ok' => false, 'error' => 'প্রাপকের ইমেইল ঠিকানা নেই।'];
    }
    try {
        $stmt = $pdo->query("SELECT * FROM email_settings ORDER BY id DESC LIMIT 1");
        $cfg = $stmt->fetch();
    } catch (Exception $e) {
        $cfg = null;
    }
    if (!$cfg || !$cfg['is_active'] || empty($cfg['smtp_host'])) {
        return ['ok' => false, 'error' => 'ইমেইল গেটওয়ে কনফিগার করা নেই।'];
    }

    require_once __DIR__ . '/PHPMailer/Exception.php';
    require_once __DIR__ . '/PHPMailer/PHPMailer.php';
    require_once __DIR__ . '/PHPMailer/SMTP.php';

    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $cfg['smtp_host'];
        $mail->Port = (int)($cfg['smtp_port'] ?: 587);
        if (!empty($cfg['smtp_username'])) {
            $mail->SMTPAuth = true;
            $mail->Username = $cfg['smtp_username'];
            $mail->Password = (string)$cfg['smtp_password'];
        }
        if ($cfg['smtp_encryption'] === 'ssl') {
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($cfg['smtp_encryption'] === 'tls') {
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mail->SMTPAutoTLS = false;
        }
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($cfg['from_email'] ?: ($cfg['smtp_username'] ?: 'no-reply@localhost'), $cfg['from_name'] ?: '');
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $bodyHtml;
        $mail->AltBody = trim(strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $bodyHtml)));
        $mail->send();

        try {
            $pdo->prepare("INSERT INTO email_logs (to_email, subject, status) VALUES (?, ?, 'sent')")->execute([$toEmail, $subject]);
        } catch (Exception $e) {}
        return ['ok' => true];
    } catch (\Exception $e) {
        $error = $mail->ErrorInfo ?: $e->getMessage();
        try {
            $pdo->prepare("INSERT INTO email_logs (to_email, subject, status, error) VALUES (?, ?, 'failed', ?)")->execute([$toEmail, $subject, $error]);
        } catch (Exception $e2) {}
        return ['ok' => false, 'error' => $error];
    }
}

/**
 * পাসওয়ার্ড রিসেট টোকেন তৈরি করে password_resets টেবিলে সংরক্ষণ করে।
 * শুধু টোকেনের SHA-256 hash সংরক্ষণ করা হয় — DB ফাঁস হলেও কেউ সেই
 * hash দিয়ে সরাসরি পাসওয়ার্ড রিসেট করতে পারবে না, আসল টোকেন (URL-এ
 * যেটা যায়) দরকার হবে। $minutes = টোকেন কত মিনিট বৈধ থাকবে।
 * রিটার্ন করে সম্পূর্ণ রিসেট লিংক (BASE_URL সহ)।
 */
function password_reset_create($pdo, $userId, $minutes = 60) {
    $token = bin2hex(random_bytes(32));
    $hash = hash('sha256', $token);
    $expiresAt = date('Y-m-d H:i:s', time() + $minutes * 60);
    $stmt = $pdo->prepare("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$userId, $hash, $expiresAt]);
    return rtrim(BASE_URL, '/') . '/reset_password.php?token=' . $token;
}

/**
 * URL থেকে পাওয়া টোকেন যাচাই করে — বৈধ (মেয়াদ আছে, ব্যবহার হয়নি) হলে
 * সংশ্লিষ্ট রিসেট রেকর্ড + ইউজারের তথ্য ফেরত দেয়, নাহলে null।
 */
function password_reset_verify($pdo, $token) {
    if (!$token) return null;
    $hash = hash('sha256', $token);
    $stmt = $pdo->prepare("
        SELECT pr.id AS reset_id, pr.user_id, pr.expires_at, u.name, u.username, u.email, u.status
        FROM password_resets pr
        JOIN users u ON u.id = pr.user_id
        WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > NOW()
        LIMIT 1
    ");
    $stmt->execute([$hash]);
    $row = $stmt->fetch();
    if (!$row || $row['status'] !== 'active') return null;
    return $row;
}

/** একটি রিসেট টোকেন ব্যবহৃত হিসেবে চিহ্নিত করে — পুনরায় ব্যবহার ঠেকাতে। */
function password_reset_consume($pdo, $resetId) {
    $pdo->prepare("UPDATE password_resets SET used_at = NOW() WHERE id = ?")->execute([$resetId]);
}

function shop_settings($pdo) {
    static $settings = null;
    if ($settings === null) {
        $stmt = $pdo->query("SELECT * FROM shop_settings ORDER BY id ASC LIMIT 1");
        $settings = $stmt->fetch() ?: [];
    }
    return $settings;
}

/**
 * রিপোর্ট সেন্টারের জন্য সাধারণ ডেট-রেঞ্জ প্রিসেট — 'আজ', 'গতকাল', 'এই সপ্তাহ' ইত্যাদি
 * প্রতিটি রিপোর্ট ট্যাবে একই রকম কুইক-ফিল্টার লিংক তৈরির জন্য ব্যবহৃত হয়।
 */
function report_date_presets() {
    $today = date('Y-m-d');
    return [
        'today'      => ['label' => 'আজ',        'from' => $today, 'to' => $today],
        'yesterday'  => ['label' => 'গতকাল',      'from' => date('Y-m-d', strtotime('-1 day')), 'to' => date('Y-m-d', strtotime('-1 day'))],
        'this_week'  => ['label' => 'এই সপ্তাহ',   'from' => date('Y-m-d', strtotime('monday this week')), 'to' => $today],
        'this_month' => ['label' => 'এই মাস',     'from' => date('Y-m-01'), 'to' => $today],
        'this_year'  => ['label' => 'এই বছর',     'from' => date('Y-01-01'), 'to' => $today],
    ];
}

/**
 * একটি তারিখ-পরিসীমার ঠিক আগের সমান-দৈর্ঘ্যের পরিসীমা — তুলনামূলক (আগের সময়ের
 * সাথে) হিসাব দেখানোর জন্য। যেমন ৭ দিনের রিপোর্ট হলে তার ঠিক আগের ৭ দিন।
 */
function report_previous_range($from, $to) {
    $days = (int)((strtotime($to) - strtotime($from)) / 86400) + 1;
    $prevTo = date('Y-m-d', strtotime($from . ' -1 day'));
    $prevFrom = date('Y-m-d', strtotime($prevTo . ' -' . ($days - 1) . ' days'));
    return [$prevFrom, $prevTo];
}

/**
 * দুইটি সংখ্যার মধ্যে % পরিবর্তন — তুলনামূলক ট্রেন্ড দেখানোর জন্য। আগেরটি শূন্য
 * হলে (এবং নতুনটি শূন্য না হলে) বিভাজন-বাই-শূন্য এড়াতে null ফেরত দেয় (UI এটিকে "নতুন" দেখাবে)।
 */
function report_trend_percent($current, $previous) {
    $current = (float)$current;
    $previous = (float)$previous;
    if ($previous == 0.0) {
        return $current == 0.0 ? 0.0 : null;
    }
    return round((($current - $previous) / abs($previous)) * 100, 1);
}

/**
 * টেবিল-আকৃতির রিপোর্ট ডেটাকে CSV হিসেবে ডাউনলোড করায় (Excel-এ খোলা যায়) এবং
 * স্ক্রিপ্ট থামিয়ে দেয়। UTF-8 BOM যোগ করা হয় যাতে বাংলা লেখা Excel-এ সঠিকভাবে দেখায়।
 */
function export_csv($filename, array $headers, array $rows) {
    while (ob_get_level() > 0) { ob_end_clean(); }
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . preg_replace('/[^A-Za-z0-9_\-\.]/', '_', $filename) . '.csv"');
    echo "\xEF\xBB\xBF"; // UTF-8 BOM
    $out = fopen('php://output', 'w');
    fputcsv($out, $headers);
    foreach ($rows as $row) {
        fputcsv($out, $row);
    }
    fclose($out);
    exit;
}

function time_ago_bn($datetime) {
    $diff = time() - strtotime($datetime);
    if ($diff < 60) return 'এইমাত্র';
    if ($diff < 3600) return floor($diff / 60) . ' মিনিট আগে';
    if ($diff < 86400) return floor($diff / 3600) . ' ঘন্টা আগে';
    return floor($diff / 86400) . ' দিন আগে';
}
