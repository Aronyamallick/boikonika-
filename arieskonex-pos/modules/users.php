<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();

$isOwner = is_owner();
$me = current_user();

// ---------- POST অ্যাকশন ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'save_user' && $isOwner) {
        $id = (int)($_POST['id'] ?? 0);
        $name = trim($_POST['name']);
        $username = trim($_POST['username']);
        $roleInput = $_POST['role'] ?? 'cashier';
        $role = $roleInput === 'owner' ? 'owner' : ($roleInput === 'salesman' ? 'salesman' : 'cashier');
        $permissions = [];
        if ($roleInput === 'salesman') {
            $permissions = array_values(array_unique(array_filter([
                !empty($_POST['perm_sales']) ? 'sales' : null,
                !empty($_POST['perm_purchase']) ? 'purchase' : null,
                !empty($_POST['perm_sales_list']) ? 'sales_list' : null,
                !empty($_POST['perm_sales_return']) ? 'sales_return' : null,
                !empty($_POST['perm_customers']) ? 'customers' : null,
                !empty($_POST['perm_stock_insights']) ? 'stock_insights' : null,
                !empty($_POST['perm_add_product']) ? 'add_product' : null,
                !empty($_POST['perm_sell_below_cost']) ? 'sell_below_cost' : null,
            ], function ($v) { return $v !== null; })));
        }
        $mobile = trim($_POST['mobile'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        try {
            if ($id) {
                $permValue = json_encode($permissions, JSON_UNESCAPED_UNICODE);
                if ($password !== '') {
                    $stmt = $pdo->prepare("UPDATE users SET name=?, username=?, role=?, mobile=?, email=?, permissions=?, password=? WHERE id=?");
                    $stmt->execute([$name, $username, $role, $mobile, $email, $permValue, password_hash($password, PASSWORD_DEFAULT), $id]);
                } else {
                    $stmt = $pdo->prepare("UPDATE users SET name=?, username=?, role=?, mobile=?, email=?, permissions=? WHERE id=?");
                    $stmt->execute([$name, $username, $role, $mobile, $email, $permValue, $id]);
                }
                flash_set('ইউজার হালনাগাদ হয়েছে।');
            } else {
                if (strlen($password) < 6) {
                    flash_set('পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।', 'danger');
                    redirect('users.php');
                }
                $stmt = $pdo->prepare("INSERT INTO users (name, username, password, role, mobile, email, permissions) VALUES (?,?,?,?,?,?,?)");
                $stmt->execute([$name, $username, password_hash($password, PASSWORD_DEFAULT), $role, $mobile, $email, json_encode($permissions, JSON_UNESCAPED_UNICODE)]);
                flash_set('নতুন ইউজার যুক্ত হয়েছে।');
            }
            log_activity($pdo, 'ইউজার সংরক্ষণ: ' . $name);
        } catch (PDOException $ex) {
            flash_set('সংরক্ষণ ব্যর্থ — এই ইউজারনেম আগে থেকেই ব্যবহৃত হচ্ছে।', 'danger');
        }
        redirect('users.php');
    }

    if ($action === 'toggle_status' && $isOwner) {
        $id = (int)$_POST['id'];
        if ($id != $me['id']) {
            $stmt = $pdo->prepare("UPDATE users SET status = IF(status='active','inactive','active') WHERE id=?");
            $stmt->execute([$id]);
            flash_set('ইউজারের অবস্থা পরিবর্তন হয়েছে।');
        }
        redirect('users.php');
    }

    if ($action === 'save_profile') {
        $stmt = $pdo->prepare("UPDATE users SET name=?, mobile=?, email=? WHERE id=?");
        $stmt->execute([trim($_POST['my_name']), trim($_POST['my_mobile']), trim($_POST['my_email']), $me['id']]);
        $_SESSION['user']['name'] = trim($_POST['my_name']);
        $_SESSION['user']['mobile'] = trim($_POST['my_mobile']);
        $_SESSION['user']['email'] = trim($_POST['my_email']);

        if (!empty($_POST['my_password'])) {
            if (strlen($_POST['my_password']) >= 6) {
                $stmt = $pdo->prepare("UPDATE users SET password=? WHERE id=?");
                $stmt->execute([password_hash($_POST['my_password'], PASSWORD_DEFAULT), $me['id']]);
                flash_set('প্রোফাইল ও পাসওয়ার্ড হালনাগাদ হয়েছে।');
            } else {
                flash_set('প্রোফাইল হালনাগাদ হয়েছে, তবে পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।', 'warning');
            }
        } else {
            flash_set('প্রোফাইল হালনাগাদ হয়েছে।');
        }
        redirect('users.php?profile=1');
    }

    if ($action === 'save_shop' && $isOwner) {
        $logo = null;
        if (!empty($_FILES['logo']['name']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg','jpeg','png','webp','svg'])) {
                $logoDir = APP_ROOT . '/uploads/logo';
                if (!is_dir($logoDir)) mkdir($logoDir, 0755, true);
                $fname = 'logo_' . time() . '.' . $ext;
                if (move_uploaded_file($_FILES['logo']['tmp_name'], $logoDir . '/' . $fname)) {
                    $logo = 'uploads/logo/' . $fname;
                }
            }
        }
        $stmt = $pdo->prepare("UPDATE shop_settings SET shop_name=?, owner_name=?, address=?, mobile=?, email=?, whatsapp=?, stagnant_stock_days=?" . ($logo ? ", logo=?" : "") . " WHERE id = (SELECT id FROM (SELECT id FROM shop_settings ORDER BY id LIMIT 1) t)");
        $params = [trim($_POST['shop_name']), trim($_POST['owner_name']), trim($_POST['address']), trim($_POST['mobile']), trim($_POST['email']), trim($_POST['whatsapp'] ?? ''), (int)($_POST['stagnant_days'] ?: 60)];
        if ($logo) $params[] = $logo;
        $stmt->execute($params);

        // সাইট URL (BASE_URL) হালনাগাদ — সাবফোল্ডারে ইনস্টল করা থাকলে এটি ভুল/খালি থাকলেই
        // CSS/JS/মেনু লোড না হওয়ার সমস্যা হয় (নেভিগেশন বার কাজ না করার প্রধান কারণ)
        $newBaseUrl = rtrim(trim($_POST['site_base_url'] ?? ''), '/');
        if ($newBaseUrl !== '' && $newBaseUrl !== BASE_URL) {
            $configFile = APP_ROOT . '/config/config.php';
            $configContent = file_get_contents($configFile);
            if ($configContent !== false) {
                $updated = preg_replace(
                    "/define\\('BASE_URL',\\s*'.*?'\\);/",
                    "define('BASE_URL', " . var_export($newBaseUrl, true) . ");",
                    $configContent,
                    1,
                    $count
                );
                if ($count > 0 && is_writable($configFile)) {
                    file_put_contents($configFile, $updated);
                } else {
                    flash_set('দোকানের তথ্য সংরক্ষিত হয়েছে, কিন্তু সাইট URL পরিবর্তন করা যায়নি — config/config.php ফাইলে লেখার অনুমতি (permission) নেই।', 'warning');
                    redirect('users.php?profile=1');
                }
            }
        }
        flash_set('দোকানের তথ্য হালনাগাদ হয়েছে।');
        redirect('users.php?profile=1');
    }
}

// ---------- প্রোফাইল ভিউ ----------
if (!empty($_GET['profile'])) {
    $settings = shop_settings($pdo);
    $stmtMe = $pdo->prepare("SELECT * FROM users WHERE id=?");
    $stmtMe->execute([$me['id']]);
    $myData = $stmtMe->fetch();

    $pageTitle = 'প্রোফাইল';
    $activeNav = 'users';
    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="row g-3">
        <div class="col-lg-6">
            <div class="card" style="padding:20px;">
                <h3 style="margin-top:0;">আমার প্রোফাইল</h3>
                <form method="POST">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="save_profile">
                    <div class="form-group"><label>নাম</label><input type="text" name="my_name" class="form-control" value="<?= e($myData['name']) ?>" required></div>
                    <div class="form-group"><label>মোবাইল</label><input type="text" name="my_mobile" class="form-control" value="<?= e($myData['mobile']) ?>"></div>
                    <div class="form-group"><label>ইমেইল</label><input type="email" name="my_email" class="form-control" value="<?= e($myData['email']) ?>"></div>
                    <div class="form-group"><label>নতুন পাসওয়ার্ড (ঐচ্ছিক)</label><input type="password" name="my_password" class="form-control" placeholder="পরিবর্তন না করলে খালি রাখুন"></div>
                    <button class="btn btn-primary" type="submit">প্রোফাইল সংরক্ষণ করুন</button>
                </form>
            </div>
        </div>
        <?php if ($isOwner): ?>
        <div class="col-lg-6">
            <div class="card" style="padding:20px;">
                <h3 style="margin-top:0;">দোকানের তথ্য</h3>
                <form method="POST" enctype="multipart/form-data">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="save_shop">
                    <div class="form-group"><label>দোকানের নাম</label><input type="text" name="shop_name" class="form-control" value="<?= e($settings['shop_name']) ?>" required></div>
                    <div class="form-group"><label>মালিকের নাম</label><input type="text" name="owner_name" class="form-control" value="<?= e($settings['owner_name']) ?>" required></div>
                    <div class="form-group"><label>ঠিকানা</label><input type="text" name="address" class="form-control" value="<?= e($settings['address']) ?>"></div>
                    <div class="form-group"><label>মোবাইল নং</label><input type="text" name="mobile" class="form-control" value="<?= e($settings['mobile']) ?>"></div>
                    <div class="form-group"><label>হোয়াটসঅ্যাপ নং</label><input type="text" name="whatsapp" class="form-control" placeholder="যেমন: 01712345678" value="<?= e($settings['whatsapp'] ?? '') ?>">
                        <div class="form-hint">খালি রাখলে মোবাইল নং-ই ইনভয়েসে হোয়াটসঅ্যাপ হিসেবে দেখানো হবে।</div>
                    </div>
                    <div class="form-group"><label>ইমেইল</label><input type="email" name="email" class="form-control" value="<?= e($settings['email']) ?>"></div>
                    <div class="form-group">
                        <label>সাইটের URL</label>
                        <input type="text" name="site_base_url" class="form-control" value="<?= e(BASE_URL) ?>" placeholder="https://yourdomain.com">
                        <div class="form-hint">এটি ভুল হলে CSS/JS/মেনু ঠিকভাবে লোড হয় না ও নেভিগেশন কাজ করে না বলে মনে হয়। সাবডোমেইন/সাবফোল্ডারে ইনস্টল করলে এখানে সঠিক ঠিকানা বসান (শেষে স্ল্যাশ ছাড়া)।</div>
                    </div>
                    <div class="form-group"><label>স্থবির স্টক সতর্কতা (দিন)</label><input type="number" name="stagnant_days" class="form-control" value="<?= (int)($settings['stagnant_stock_days'] ?? 60) ?>"></div>
                    <div class="form-group"><label>লোগো</label><input type="file" name="logo" class="form-control" accept="image/*">
                        <?php if (!empty($settings['logo'])): ?><div class="form-hint">বর্তমান লোগো: <?= e($settings['logo']) ?></div><?php endif; ?>
                    </div>
                    <button class="btn btn-primary" type="submit">দোকানের তথ্য সংরক্ষণ করুন</button>
                </form>
            </div>
        </div>
        <?php endif; ?>
    </div>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ইউজার তালিকা (শুধু মালিক) ----------
require_owner();
$users = $pdo->query("SELECT * FROM users ORDER BY role ASC, name ASC")->fetchAll();

$pageTitle = 'ইউজার ও শপ';
$activeNav = 'users';
require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <a href="users.php?profile=1" class="btn btn-light btn-sm"><i class="bi bi-person"></i> আমার প্রোফাইল / দোকানের তথ্য</a>
    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#userModal" onclick="openNewUser()"><i class="bi bi-person-plus"></i> নতুন ইউজার</button>
</div>
<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th>নাম</th><th>ইউজারনেম</th><th>রোল</th><th>মোবাইল</th><th>অবস্থা</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($users as $u): ?>
            <tr>
                <td><?= e($u['name']) ?></td>
                <td><?= e($u['username']) ?></td>
                <td><?= $u['role'] === 'owner' ? '<span class="badge badge-purple">মালিক</span>' : ($u['role'] === 'salesman' ? '<span class="badge badge-info">সেলসম্যান</span>' : '<span class="badge badge-info">ক্যাশিয়ার</span>') ?></td>
                <td><?= e($u['mobile'] ?: '—') ?></td>
                <td><?= $u['status'] === 'active' ? '<span class="badge badge-success">সক্রিয়</span>' : '<span class="badge badge-danger">নিষ্ক্রিয়</span>' ?></td>
                <td style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-light" onclick='openEditUser(<?= json_encode($u, JSON_UNESCAPED_UNICODE) ?>)'><i class="bi bi-pencil"></i></button>
                    <?php if ($u['id'] != $me['id']): ?>
                    <form method="POST" onsubmit="return confirm('অবস্থা পরিবর্তন করবেন?');">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="toggle_status">
                        <input type="hidden" name="id" value="<?= $u['id'] ?>">
                        <button class="btn btn-sm btn-light" type="submit"><i class="bi bi-power"></i></button>
                    </form>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="modal fade" id="userModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_user">
                <input type="hidden" name="id" id="u_id">
                <div class="modal-header"><h5 class="modal-title" id="u_modal_title">নতুন ইউজার</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body">
                    <div class="form-group"><label>নাম</label><input type="text" name="name" id="u_name" class="form-control" required></div>
                    <div class="form-group"><label>ইউজারনেম</label><input type="text" name="username" id="u_username" class="form-control" required></div>
                    <div class="form-group">
                        <label>রোল</label>
                        <select name="role" id="u_role" class="form-control">
                            <option value="salesman">সেলসম্যান</option>
                            <option value="cashier">ক্যাশিয়ার</option>
                            <option value="owner">মালিক</option>
                        </select>
                    </div>
                    <div id="permBlock" style="display:none;margin-top:10px;">
                        <div class="form-group" style="margin-bottom:6px;"><label>অনুমতি</label></div>
                        <div class="form-check"><input class="form-check-input" type="checkbox" name="perm_sales" value="1" id="perm_sales"><label class="form-check-label" for="perm_sales">বিক্রয় (POS)</label></div>
                        <div class="form-check"><input class="form-check-input" type="checkbox" name="perm_purchase" value="1" id="perm_purchase"><label class="form-check-label" for="perm_purchase">ক্রয়</label></div>
                        <div class="form-check"><input class="form-check-input" type="checkbox" name="perm_sales_list" value="1" id="perm_sales_list"><label class="form-check-label" for="perm_sales_list">বিক্রয় তালিকা</label></div>
                        <div class="form-check"><input class="form-check-input" type="checkbox" name="perm_sales_return" value="1" id="perm_sales_return"><label class="form-check-label" for="perm_sales_return">বিক্রয় ফেরত</label></div>
                        <div class="form-check"><input class="form-check-input" type="checkbox" name="perm_customers" value="1" id="perm_customers"><label class="form-check-label" for="perm_customers">কাস্টমার</label></div>
                        <div class="form-check"><input class="form-check-input" type="checkbox" name="perm_stock_insights" value="1" id="perm_stock_insights"><label class="form-check-label" for="perm_stock_insights">লো স্টক/বেস্ট সেলিং/স্থবির স্টক</label></div>
                        <div class="form-check"><input class="form-check-input" type="checkbox" name="perm_add_product" value="1" id="perm_add_product"><label class="form-check-label" for="perm_add_product">নতুন পণ্য যুক্ত করতে পারবে</label></div>
                        <div class="form-check"><input class="form-check-input" type="checkbox" name="perm_sell_below_cost" value="1" id="perm_sell_below_cost"><label class="form-check-label" for="perm_sell_below_cost">ক্রয়মূল্যের নিচে (লোকসানে) বিক্রি করতে পারবে</label></div>
                    </div>
                    <div class="form-group"><label>মোবাইল</label><input type="text" name="mobile" id="u_mobile" class="form-control"></div>
                    <div class="form-group"><label>ইমেইল</label><input type="email" name="email" id="u_email" class="form-control"></div>
                    <div class="form-group"><label>পাসওয়ার্ড</label><input type="password" name="password" id="u_password" class="form-control" placeholder="সম্পাদনায় পরিবর্তন না করলে খালি রাখুন"></div>
                </div>
                <div class="modal-footer"><button type="submit" class="btn btn-primary">সংরক্ষণ করুন</button></div>
            </form>
        </div>
    </div>
</div>
<script>
function togglePermissionBlock() {
    const role = document.getElementById('u_role').value;
    const block = document.getElementById('permBlock');
    if (block) {
        block.style.display = role === 'salesman' ? 'block' : 'none';
    }
}
function openNewUser() {
    document.getElementById('u_modal_title').textContent = 'নতুন ইউজার';
    document.getElementById('u_id').value = '';
    document.getElementById('u_name').value = '';
    document.getElementById('u_username').value = '';
    document.getElementById('u_role').value = 'salesman';
    document.getElementById('u_mobile').value = '';
    document.getElementById('u_email').value = '';
    document.getElementById('u_password').required = true;
    document.querySelectorAll('#permBlock input[type="checkbox"]').forEach(cb => cb.checked = false);
    togglePermissionBlock();
}
function openEditUser(u) {
    document.getElementById('u_modal_title').textContent = 'ইউজার সম্পাদনা';
    document.getElementById('u_id').value = u.id;
    document.getElementById('u_name').value = u.name;
    document.getElementById('u_username').value = u.username;
    document.getElementById('u_role').value = u.role === 'owner' ? 'owner' : (u.role === 'salesman' ? 'salesman' : 'cashier');
    document.getElementById('u_mobile').value = u.mobile || '';
    document.getElementById('u_email').value = u.email || '';
    document.getElementById('u_password').required = false;
    document.querySelectorAll('#permBlock input[type="checkbox"]').forEach(cb => cb.checked = false);
    const permissionMap = {
        sales: 'perm_sales',
        purchase: 'perm_purchase',
        sales_list: 'perm_sales_list',
        sales_return: 'perm_sales_return',
        customers: 'perm_customers',
        stock_insights: 'perm_stock_insights',
        add_product: 'perm_add_product',
        sell_below_cost: 'perm_sell_below_cost'
    };
    const perms = Array.isArray(u.permissions)
        ? u.permissions
        : (typeof u.permissions === 'string' ? JSON.parse(u.permissions || '[]') : []);
    perms.forEach(function(p) {
        const checkboxName = permissionMap[p];
        if (!checkboxName) return;
        const cb = document.querySelector('#permBlock input[name="' + checkboxName + '"]');
        if (cb) cb.checked = true;
    });
    togglePermissionBlock();
    new bootstrap.Modal(document.getElementById('userModal')).show();
}
document.getElementById('u_role').addEventListener('change', togglePermissionBlock);
</script>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
