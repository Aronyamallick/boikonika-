<?php
/**
 * বারকোড/QR কোড লেবেল জেনারেটর। বারকোড/QR গ্রাফিক্স সরাসরি ব্রাউজারে (ক্লায়েন্ট-সাইড)
 * JsBarcode ও qrcodejs লাইব্রেরি দিয়ে তৈরি হয় — সার্ভারে কোনো ইমেজ-জেনারেশন লাইব্রেরি
 * ইনস্টল করার দরকার নেই। প্রতিটি পণ্যের products.barcode কলামের মান এনকোড করা হয় —
 * খালি থাকলে (প্রথমবার লেবেল বানানোর সময়) স্বয়ংক্রিয়ভাবে item_code বসিয়ে সংরক্ষণ করা
 * হয়, যাতে প্রিন্ট হওয়া বারকোডটি POS স্ক্যান-ইনপুটে (sales_pos.php) সঠিকভাবে মিলে যায়।
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
if (!is_owner() && !is_salesman()) {
    flash_set('আপনার এই কাজের অনুমতি নেই।', 'danger');
    redirect('dashboard.php');
}

$pageTitle = 'বারকোড / QR কোড';
$activeNav = 'barcode';

$printItems = null;

// ---------- POST: লেবেল তৈরি ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'generate_labels') {
    csrf_verify();
    $mode = ($_POST['mode'] ?? 'barcode') === 'qr' ? 'qr' : 'barcode';
    $ids = $_POST['item_id'] ?? [];
    $copies = $_POST['item_copies'] ?? [];

    // পণ্য: সংখ্যা আইডি (যেমন "12"); সার্ভিস: "s" প্রিফিক্সসহ (যেমন "s3")
    $selected = [];
    $selectedServices = [];
    foreach ($ids as $i => $id) {
        $c = max(1, min(100, (int)($copies[$i] ?? 1)));
        if (is_string($id) && strtolower(substr($id, 0, 1)) === 's') {
            $sid = (int)substr($id, 1);
            if ($sid > 0) $selectedServices[$sid] = $c;
            continue;
        }
        $id = (int)$id;
        if ($id > 0) $selected[$id] = $c;
    }

    if (empty($selected) && empty($selectedServices)) {
        flash_set('অন্তত একটি পণ্য বা সার্ভিস নির্বাচন করুন।', 'danger');
    } else {
        $printItems = [];
        if (!empty($selected)) {
            // যেসব পণ্যের বারকোড ফাঁকা, প্রথমবার লেবেল বানানোর সময় item_code-কেই
            // বারকোড হিসেবে বসিয়ে সংরক্ষণ করা হয় — এতে ভবিষ্যতে POS স্ক্যানে মিলবে।
            $fillStmt = $pdo->prepare("UPDATE products SET barcode = item_code WHERE id = ? AND (barcode IS NULL OR barcode = '')");
            foreach (array_keys($selected) as $id) {
                $fillStmt->execute([$id]);
            }

            $inPlaceholders = implode(',', array_fill(0, count($selected), '?'));
            $stmt = $pdo->prepare("SELECT id, name, item_code, barcode, sale_price, unit FROM products WHERE id IN ($inPlaceholders)");
            $stmt->execute(array_keys($selected));
            foreach ($stmt->fetchAll() as $r) {
                $copiesForThis = $selected[$r['id']] ?? 1;
                for ($i = 0; $i < $copiesForThis; $i++) {
                    $printItems[] = $r;
                }
            }
        }
        if (!empty($selectedServices)) {
            // কোড ফাঁকা থাকলে স্বয়ংক্রিয় S00001-ধাঁচের কোড বসানো হয়
            $fillSvc = $pdo->prepare("UPDATE services SET code = CONCAT('S', LPAD(id, 5, '0')) WHERE id = ? AND (code IS NULL OR code = '')");
            foreach (array_keys($selectedServices) as $sid) {
                try { $fillSvc->execute([$sid]); } catch (Exception $e) {}
            }
            $inPlaceholders = implode(',', array_fill(0, count($selectedServices), '?'));
            $stmt = $pdo->prepare("SELECT id, name, code AS barcode, price AS sale_price, unit FROM services WHERE id IN ($inPlaceholders)");
            $stmt->execute(array_keys($selectedServices));
            foreach ($stmt->fetchAll() as $r) {
                $copiesForThis = $selectedServices[$r['id']] ?? 1;
                for ($i = 0; $i < $copiesForThis; $i++) {
                    $printItems[] = $r;
                }
            }
        }
        $printMode = $mode;
    }
}

require_once __DIR__ . '/../includes/header.php';

// ---------- ভিউ: প্রিন্ট-বান্ধব লেবেল শিট ----------
if ($printItems !== null) {
    $settings = shop_settings($pdo);
    ?>
    <div class="page-head no-print">
        <a href="barcode.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> আবার বাছাই করুন</a>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.print()"><i class="bi bi-printer"></i> প্রিন্ট / PDF</button>
    </div>
    <style>
    .label-sheet { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
    .label-box { border:1px dashed #bbb; border-radius:6px; padding:8px; text-align:center; page-break-inside:avoid; }
    .label-box .lbl-name { font-size:11px; font-weight:600; line-height:1.2; margin-bottom:3px; max-height:2.4em; overflow:hidden; }
    .label-box .lbl-price { font-size:12px; font-weight:700; margin-top:3px; }
    .label-box svg, .label-box canvas { max-width:100%; }
    @media print { .label-sheet { grid-template-columns:repeat(3, 1fr); } }
    </style>
    <div class="label-sheet">
        <?php foreach ($printItems as $i => $it): ?>
            <div class="label-box">
                <div class="lbl-name"><?= e($it['name']) ?></div>
                <?php if ($printMode === 'qr'): ?>
                    <div class="lbl-qr" data-value="<?= e($it['barcode']) ?>" id="qr-<?= $i ?>"></div>
                <?php else: ?>
                    <svg class="lbl-barcode" data-value="<?= e($it['barcode']) ?>" id="bc-<?= $i ?>"></svg>
                <?php endif; ?>
                <div class="lbl-price">৳<?= money($it['sale_price']) ?></div>
            </div>
        <?php endforeach; ?>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script>
    document.querySelectorAll('.lbl-barcode').forEach(function (el) {
        try {
            JsBarcode(el, el.dataset.value || '', { format: 'CODE128', width: 1.4, height: 40, fontSize: 11, margin: 2 });
        } catch (e) { el.outerHTML = '<div style="font-size:10px;color:red;">বারকোড তৈরি ব্যর্থ</div>'; }
    });
    document.querySelectorAll('.lbl-qr').forEach(function (el) {
        if (!window.QRCode) { el.innerHTML = '<div style="font-size:10px;color:red;">QR লাইব্রেরি লোড হয়নি — ইন্টারনেট যাচাই করুন</div>'; return; }
        new QRCode(el, { text: el.dataset.value || '', width: 84, height: 84, correctLevel: QRCode.CorrectLevel.M });
    });
    </script>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: পণ্য বাছাই ----------
$search = trim($_GET['q'] ?? '');
$where = '';
$params = [];
if ($search !== '') {
    $where = "AND (name LIKE ? OR item_code LIKE ? OR barcode LIKE ?)";
    $like = "%$search%";
    $params = [$like, $like, $like];
}
$stmt = $pdo->prepare("SELECT id, name, item_code, barcode, sale_price, unit FROM products WHERE status='active' $where ORDER BY name LIMIT 500");
$stmt->execute($params);
$products = $stmt->fetchAll();
$servicesForLabels = [];
try {
    $svcStmt = $pdo->prepare("SELECT id, name, code, price, unit FROM services WHERE status='active' " . ($search !== '' ? "AND (name LIKE ? OR code LIKE ?)" : '') . " ORDER BY name");
    $svcStmt->execute($search !== '' ? ["%$search%", "%$search%"] : []);
    $servicesForLabels = $svcStmt->fetchAll();
} catch (Exception $e) {}
$missingBarcodeCount = (int)$pdo->query("SELECT COUNT(*) c FROM products WHERE status='active' AND (barcode IS NULL OR barcode = '')")->fetch()['c'];
?>
<div class="page-head">
    <form method="GET"><input type="text" name="q" class="form-control" placeholder="নাম বা আইটেম কোড দিয়ে খুঁজুন..." value="<?= e($search) ?>"></form>
</div>
<?php if ($missingBarcodeCount > 0): ?>
<div class="alert alert-info"><?= $missingBarcodeCount ?>টি পণ্যের কোনো বারকোড নেই — সেগুলো নির্বাচন করে লেবেল তৈরি করলে স্বয়ংক্রিয়ভাবে আইটেম কোডকেই বারকোড হিসেবে বসিয়ে দেওয়া হবে।</div>
<?php endif; ?>
<form method="POST" id="labelForm">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="generate_labels">
    <div class="card" style="padding:14px;margin-bottom:14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <div style="display:flex;gap:14px;align-items:center;">
            <label style="margin:0;"><input type="radio" name="mode" value="barcode" checked> বারকোড (Code128)</label>
            <label style="margin:0;"><input type="radio" name="mode" value="qr"> QR কোড</label>
        </div>
        <div style="margin-left:auto;font-size:13px;color:var(--text-secondary);"><span id="selCount">0</span>টি পণ্য নির্বাচিত</div>
        <button type="submit" class="btn btn-primary" id="genBtn" disabled><i class="bi bi-upc-scan"></i> লেবেল তৈরি করুন</button>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th style="width:36px;"></th><th>আইটেম কোড</th><th>নাম</th><th>বারকোড</th><th class="num">দাম</th><th style="width:110px;">কপি সংখ্যা</th></tr></thead>
            <tbody>
            <?php if (empty($products)): ?>
                <tr><td colspan="6"><div class="empty-state"><i class="bi bi-upc-scan"></i>কোনো পণ্য পাওয়া যায়নি।</div></td></tr>
            <?php endif; ?>
            <?php foreach ($products as $p): ?>
                <tr>
                    <td><input type="checkbox" class="item-check" data-id="<?= (int)$p['id'] ?>" onchange="toggleItem(this)"></td>
                    <td><?= e($p['item_code']) ?></td>
                    <td><?= e($p['name']) ?></td>
                    <td><?= $p['barcode'] ? e($p['barcode']) : '<span style="color:var(--text-secondary);">নেই — স্বয়ংক্রিয়ভাবে বসবে</span>' ?></td>
                    <td class="num">৳<?= money($p['sale_price']) ?></td>
                    <td><input type="number" min="1" max="100" value="1" class="form-control form-control-sm copy-input" data-id="<?= (int)$p['id'] ?>" disabled></td>
                </tr>
            <?php endforeach; ?>
            <?php if (!empty($servicesForLabels)): ?>
                <tr><td colspan="6" style="background:var(--surface-alt);font-weight:700;"><i class="bi bi-printer"></i> সার্ভিস — স্ক্যান করলেই POS-এ সরাসরি যুক্ত হবে</td></tr>
                <?php foreach ($servicesForLabels as $sv): ?>
                <tr>
                    <td><input type="checkbox" class="item-check" data-id="s<?= (int)$sv['id'] ?>" onchange="toggleItem(this)"></td>
                    <td><span class="badge badge-info">সার্ভিস</span></td>
                    <td><?= e($sv['name']) ?></td>
                    <td><?= !empty($sv['code']) ? e($sv['code']) : '<span style="color:var(--text-secondary);">নেই — স্বয়ংক্রিয়ভাবে বসবে</span>' ?></td>
                    <td class="num">৳<?= money($sv['price']) ?></td>
                    <td><input type="number" min="1" max="100" value="1" class="form-control form-control-sm copy-input" data-id="s<?= (int)$sv['id'] ?>" disabled></td>
                </tr>
                <?php endforeach; ?>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
</form>
<script>
function toggleItem(checkbox) {
    const id = checkbox.dataset.id;
    const copyInput = document.querySelector('.copy-input[data-id="' + id + '"]');
    copyInput.disabled = !checkbox.checked;
    syncHiddenInputs();
}
function syncHiddenInputs() {
    document.querySelectorAll('input[name="item_id[]"], input[name="item_copies[]"]').forEach(el => el.remove());
    const form = document.getElementById('labelForm');
    let count = 0;
    document.querySelectorAll('.item-check:checked').forEach(cb => {
        const id = cb.dataset.id;
        const copies = document.querySelector('.copy-input[data-id="' + id + '"]').value || 1;
        const idInput = document.createElement('input');
        idInput.type = 'hidden'; idInput.name = 'item_id[]'; idInput.value = id;
        const copyInput = document.createElement('input');
        copyInput.type = 'hidden'; copyInput.name = 'item_copies[]'; copyInput.value = copies;
        form.appendChild(idInput); form.appendChild(copyInput);
        count++;
    });
    document.getElementById('selCount').textContent = count;
    document.getElementById('genBtn').disabled = count === 0;
}
document.querySelectorAll('.copy-input').forEach(el => el.addEventListener('input', syncHiddenInputs));
document.getElementById('labelForm').addEventListener('submit', syncHiddenInputs);
</script>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
