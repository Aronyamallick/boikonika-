<?php
/**
 * ডিসকাউন্ট/কুপন কোড ব্যবস্থাপনা — শুধুমাত্র মালিকের জন্য।
 * POS চেকআউটে কুপন প্রয়োগ ও যাচাই হয় validate_coupon() ফাংশন দিয়ে
 * (includes/functions.php) — এখানে শুধু কুপন তৈরি/সম্পাদনা/মুছে ফেলা হয়।
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_owner();

// ---------- POST অ্যাকশন ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'save_coupon') {
        $id = (int)($_POST['id'] ?? 0);
        $code = strtoupper(trim($_POST['code'] ?? ''));
        $discountType = ($_POST['discount_type'] ?? 'percent') === 'fixed' ? 'fixed' : 'percent';
        $discountValue = max(0, (float)($_POST['discount_value'] ?? 0));
        $minPurchase = max(0, (float)($_POST['min_purchase'] ?? 0));
        $maxDiscount = trim($_POST['max_discount'] ?? '') !== '' ? max(0, (float)$_POST['max_discount']) : null;
        $usageLimit = trim($_POST['usage_limit'] ?? '') !== '' ? max(0, (int)$_POST['usage_limit']) : null;
        $validFrom = trim($_POST['valid_from'] ?? '') ?: null;
        $validTo = trim($_POST['valid_to'] ?? '') ?: null;
        $isActive = isset($_POST['is_active']) ? 1 : 0;

        if ($code === '') {
            flash_set('কুপন কোড আবশ্যক।', 'danger');
            redirect('coupons.php');
        }
        if ($discountType === 'percent' && $discountValue > 100) {
            $discountValue = 100;
        }

        try {
            if ($id) {
                $stmt = $pdo->prepare("UPDATE coupons SET code=?, discount_type=?, discount_value=?, min_purchase=?, max_discount=?, usage_limit=?, valid_from=?, valid_to=?, is_active=? WHERE id=?");
                $stmt->execute([$code, $discountType, $discountValue, $minPurchase, $maxDiscount, $usageLimit, $validFrom, $validTo, $isActive, $id]);
                flash_set('কুপন হালনাগাদ হয়েছে।');
            } else {
                $stmt = $pdo->prepare("INSERT INTO coupons (code, discount_type, discount_value, min_purchase, max_discount, usage_limit, valid_from, valid_to, is_active, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)");
                $stmt->execute([$code, $discountType, $discountValue, $minPurchase, $maxDiscount, $usageLimit, $validFrom, $validTo, $isActive, current_user()['id']]);
                flash_set('নতুন কুপন তৈরি হয়েছে।');
            }
        } catch (PDOException $ex) {
            flash_set('সংরক্ষণ ব্যর্থ — এই কোডে ইতিমধ্যে একটি কুপন আছে।', 'danger');
        }
        redirect('coupons.php');
    }

    if ($action === 'delete_coupon') {
        $id = (int)($_POST['id'] ?? 0);
        $pdo->prepare("DELETE FROM coupons WHERE id=?")->execute([$id]);
        flash_set('কুপন মুছে ফেলা হয়েছে।');
        redirect('coupons.php');
    }
}

$pageTitle = 'ডিসকাউন্ট / কুপন কোড';
$activeNav = 'coupons';

$coupons = $pdo->query("SELECT * FROM coupons ORDER BY created_at DESC")->fetchAll();
$today = date('Y-m-d');

require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <div></div>
    <button class="btn btn-primary" onclick="openAddCoupon()" data-bs-toggle="modal" data-bs-target="#couponModal"><i class="bi bi-ticket-perforated"></i> নতুন কুপন</button>
</div>

<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th>কোড</th><th>ছাড়</th><th>শর্ত</th><th>মেয়াদ</th><th>ব্যবহার</th><th>অবস্থা</th><th></th></tr></thead>
        <tbody>
        <?php if (empty($coupons)): ?>
            <tr><td colspan="7"><div class="empty-state"><i class="bi bi-ticket-perforated"></i>এখনো কোনো কুপন তৈরি হয়নি।</div></td></tr>
        <?php endif; ?>
        <?php foreach ($coupons as $c):
            $expired = !empty($c['valid_to']) && $c['valid_to'] < $today;
            $notStarted = !empty($c['valid_from']) && $c['valid_from'] > $today;
            $limitReached = $c['usage_limit'] !== null && (int)$c['used_count'] >= (int)$c['usage_limit'];
        ?>
            <tr>
                <td><code style="font-weight:700;"><?= e($c['code']) ?></code></td>
                <td><?= $c['discount_type'] === 'percent' ? e($c['discount_value']) . '%' : '৳' . money($c['discount_value']) ?>
                    <?php if ($c['discount_type'] === 'percent' && $c['max_discount']): ?><div style="font-size:11.5px;color:var(--text-secondary);">সর্বোচ্চ ৳<?= money($c['max_discount']) ?></div><?php endif; ?>
                </td>
                <td style="font-size:12.5px;color:var(--text-secondary);"><?= $c['min_purchase'] > 0 ? 'সর্বনিম্ন ৳' . money($c['min_purchase']) : '—' ?></td>
                <td style="font-size:12.5px;">
                    <?php if ($c['valid_from'] || $c['valid_to']): ?>
                        <?= $c['valid_from'] ? e(date('d M Y', strtotime($c['valid_from']))) : 'শুরু থেকে' ?> — <?= $c['valid_to'] ? e(date('d M Y', strtotime($c['valid_to']))) : 'অসীম' ?>
                    <?php else: ?>—<?php endif; ?>
                </td>
                <td class="num"><?= (int)$c['used_count'] ?><?= $c['usage_limit'] !== null ? ' / ' . (int)$c['usage_limit'] : '' ?></td>
                <td>
                    <?php if (!$c['is_active']): ?><span class="badge badge-danger">নিষ্ক্রিয়</span>
                    <?php elseif ($expired): ?><span class="badge badge-danger">মেয়াদোত্তীর্ণ</span>
                    <?php elseif ($notStarted): ?><span class="badge badge-warning">শুরু হয়নি</span>
                    <?php elseif ($limitReached): ?><span class="badge badge-warning">সীমা শেষ</span>
                    <?php else: ?><span class="badge badge-success">সক্রিয়</span><?php endif; ?>
                </td>
                <td style="display:flex;gap:6px;">
                    <button type="button" class="btn btn-sm btn-light" onclick='openEditCoupon(<?= json_encode($c, JSON_UNESCAPED_UNICODE) ?>)'><i class="bi bi-pencil"></i></button>
                    <form method="POST" onsubmit="return confirm('এই কুপনটি মুছে ফেলতে চান?');" style="display:inline;">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="delete_coupon">
                        <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
                        <button class="btn btn-sm btn-light text-danger"><i class="bi bi-trash"></i></button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="modal fade" id="couponModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_coupon">
                <input type="hidden" name="id" id="cp_id">
                <div class="modal-header"><h5 class="modal-title" id="cp_modal_title">নতুন কুপন</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body">
                    <div class="form-group"><label>কুপন কোড</label><input type="text" name="code" id="cp_code" class="form-control" style="text-transform:uppercase;" placeholder="যেমনঃ EID2026" required></div>
                    <div class="row">
                        <div class="col-md-6 form-group">
                            <label>ছাড়ের ধরন</label>
                            <select name="discount_type" id="cp_type" class="form-control" onchange="toggleMaxDiscount()">
                                <option value="percent">শতাংশ (%)</option>
                                <option value="fixed">নির্দিষ্ট (৳)</option>
                            </select>
                        </div>
                        <div class="col-md-6 form-group"><label>ছাড়ের পরিমাণ</label><input type="number" step="0.01" min="0" name="discount_value" id="cp_value" class="form-control" required></div>
                    </div>
                    <div class="row">
                        <div class="col-md-6 form-group" id="cp_max_row"><label>সর্বোচ্চ ছাড় (৳, ঐচ্ছিক)</label><input type="number" step="0.01" min="0" name="max_discount" id="cp_max" class="form-control" placeholder="সীমাহীন হলে ফাঁকা রাখুন"></div>
                        <div class="col-md-6 form-group"><label>সর্বনিম্ন কেনাকাটা (৳)</label><input type="number" step="0.01" min="0" name="min_purchase" id="cp_min" class="form-control" value="0"></div>
                    </div>
                    <div class="row">
                        <div class="col-md-6 form-group"><label>মেয়াদ শুরু (ঐচ্ছিক)</label><input type="date" name="valid_from" id="cp_from" class="form-control"></div>
                        <div class="col-md-6 form-group"><label>মেয়াদ শেষ (ঐচ্ছিক)</label><input type="date" name="valid_to" id="cp_to" class="form-control"></div>
                    </div>
                    <div class="form-group"><label>সর্বোচ্চ কতবার ব্যবহার করা যাবে (ঐচ্ছিক)</label><input type="number" min="0" name="usage_limit" id="cp_limit" class="form-control" placeholder="সীমাহীন হলে ফাঁকা রাখুন"></div>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" name="is_active" id="cp_active" checked>
                        <label class="form-check-label">সক্রিয়</label>
                    </div>
                </div>
                <div class="modal-footer"><button type="submit" class="btn btn-primary">সংরক্ষণ করুন</button></div>
            </form>
        </div>
    </div>
</div>
<script>
function toggleMaxDiscount() {
    document.getElementById('cp_max_row').style.display = document.getElementById('cp_type').value === 'percent' ? '' : 'none';
}
function openAddCoupon() {
    document.getElementById('cp_modal_title').textContent = 'নতুন কুপন';
    document.getElementById('cp_id').value = '';
    document.getElementById('cp_code').value = '';
    document.getElementById('cp_type').value = 'percent';
    document.getElementById('cp_value').value = '';
    document.getElementById('cp_max').value = '';
    document.getElementById('cp_min').value = '0';
    document.getElementById('cp_from').value = '';
    document.getElementById('cp_to').value = '';
    document.getElementById('cp_limit').value = '';
    document.getElementById('cp_active').checked = true;
    toggleMaxDiscount();
}
function openEditCoupon(c) {
    document.getElementById('cp_modal_title').textContent = 'কুপন সম্পাদনা';
    document.getElementById('cp_id').value = c.id;
    document.getElementById('cp_code').value = c.code || '';
    document.getElementById('cp_type').value = c.discount_type || 'percent';
    document.getElementById('cp_value').value = c.discount_value || '';
    document.getElementById('cp_max').value = c.max_discount || '';
    document.getElementById('cp_min').value = c.min_purchase || '0';
    document.getElementById('cp_from').value = c.valid_from || '';
    document.getElementById('cp_to').value = c.valid_to || '';
    document.getElementById('cp_limit').value = c.usage_limit === null ? '' : c.usage_limit;
    document.getElementById('cp_active').checked = !!parseInt(c.is_active);
    toggleMaxDiscount();
    new bootstrap.Modal(document.getElementById('couponModal')).show();
}
</script>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
