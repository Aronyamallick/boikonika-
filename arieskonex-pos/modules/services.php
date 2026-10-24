<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_owner();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'save_service') {
        $id = (int)($_POST['id'] ?? 0);
        $name = trim($_POST['name']);
        $price = (float)$_POST['price'];
        $unit = trim($_POST['unit']) ?: t('unit_piece', 'টি');
        if ($id) {
            $stmt = $pdo->prepare("UPDATE services SET name=?, price=?, unit=? WHERE id=?");
            $stmt->execute([$name, $price, $unit, $id]);
            flash_set(t('service_updated', 'সার্ভিস হালনাগাদ হয়েছে।'));
            log_activity($pdo, t('log_service_updated', 'সার্ভিস হালনাগাদ') . ': ' . $name . ' (৳' . money($price) . ')');
        } else {
            $stmt = $pdo->prepare("INSERT INTO services (name, price, unit) VALUES (?,?,?)");
            $stmt->execute([$name, $price, $unit]);
            flash_set(t('service_added', 'নতুন সার্ভিস যুক্ত হয়েছে।'));
            log_activity($pdo, t('log_service_new', 'নতুন সার্ভিস') . ': ' . $name);
        }
        redirect('services.php');
    }

    if ($action === 'toggle_status') {
        $id = (int)$_POST['id'];
        $stmt = $pdo->prepare("UPDATE services SET status = IF(status='active','inactive','active') WHERE id=?");
        $stmt->execute([$id]);
        flash_set(t('status_changed', 'সার্ভিসের অবস্থা পরিবর্তন হয়েছে।'));
        redirect('services.php');
    }

    if ($action === 'quick_price') {
        $id = (int)$_POST['id'];
        $price = (float)$_POST['price'];
        $stmt = $pdo->prepare("UPDATE services SET price=? WHERE id=?");
        $stmt->execute([$price, $id]);
        flash_set(t('price_updated', 'মূল্য হালনাগাদ হয়েছে।'));
        redirect('services.php');
    }

    if ($action === 'add_material') {
        $serviceId = (int)$_POST['service_id'];
        $productId = (int)$_POST['product_id'];
        $qty = (float)$_POST['qty_per_unit'];
        if ($serviceId && $productId && $qty > 0) {
            $stmt = $pdo->prepare("INSERT INTO service_materials (service_id, product_id, qty_per_unit) VALUES (?,?,?) ON DUPLICATE KEY UPDATE qty_per_unit = VALUES(qty_per_unit)");
            $stmt->execute([$serviceId, $productId, $qty]);
            flash_set(t('material_linked', 'কাঁচামাল যুক্ত হয়েছে — এখন এই সার্ভিস বিক্রি হলে স্টক থেকে স্বয়ংক্রিয়ভাবে বাদ যাবে।'));
            log_activity($pdo, t('log_material_linked', 'সার্ভিস কাঁচামাল যুক্ত') . ' #' . $serviceId);
        } else {
            flash_set(t('err_material_invalid', 'কাঁচামাল ও পরিমাণ সঠিকভাবে দিন।'), 'danger');
        }
        redirect('services.php?materials=' . $serviceId);
    }

    if ($action === 'delete_material') {
        $id = (int)$_POST['id'];
        $serviceId = (int)($_POST['service_id'] ?? 0);
        $stmt = $pdo->prepare("DELETE FROM service_materials WHERE id=?");
        $stmt->execute([$id]);
        flash_set(t('material_removed', 'কাঁচামাল সরানো হয়েছে।'));
        redirect('services.php?materials=' . $serviceId);
    }
}

$services = $pdo->query("SELECT * FROM services ORDER BY status DESC, name ASC")->fetchAll();
$rawProducts = $pdo->query("SELECT id, name, unit, barcode, stock_qty FROM products WHERE status='active' ORDER BY name")->fetchAll();

$materialsByService = [];
$matRows = $pdo->query("SELECT sm.id, sm.service_id, sm.product_id, sm.qty_per_unit, p.name AS product_name, p.unit AS product_unit, p.stock_qty FROM service_materials sm JOIN products p ON p.id = sm.product_id ORDER BY p.name")->fetchAll();
foreach ($matRows as $m) {
    $materialsByService[$m['service_id']][] = $m;
}
$materialsOpenId = (int)($_GET['materials'] ?? 0);

$pageTitle = t('nav_services');
$activeNav = 'services';
require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <p style="color:var(--text-secondary);font-size:13.5px;margin:0;"><?= e(t('services_hint', 'ফটোকপি, প্রিন্ট, স্ক্যান, লেমিনেশন, অনলাইন ফর্ম ফিলাপের মতো সার্ভিসের মূল্য এখানে সেট করুন। সার্ভিসগুলো সাধারণত দোকান থেকে সরবরাহযোগ্য, তাই সেগুলোর জন্য সরবরাহকারীর থেকে আলাদা ক্রয় প্রয়োজন হয় না — পণ্য বিক্রির জন্য Products ব্যবহার করুন।')) ?></p>
    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#serviceModal" onclick="openAddService()"><i class="bi bi-plus-lg"></i> <?= e(t('new_service', 'নতুন সার্ভিস')) ?></button>
</div>

<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th><?= e(t('service_name', 'সার্ভিসের নাম')) ?></th><th><?= e(t('unit', 'একক')) ?></th><th class="num"><?= e(t('price_bdt', 'মূল্য (৳)')) ?></th><th><?= e(t('status', 'অবস্থা')) ?></th><th></th></tr></thead>
        <tbody>
        <?php if (empty($services)): ?>
            <tr><td colspan="5"><div class="empty-state"><i class="bi bi-printer"></i><?= e(t('no_services', 'এখনো কোনো সার্ভিস যুক্ত হয়নি।')) ?></div></td></tr>
        <?php endif; ?>
        <?php foreach ($services as $s): ?>
            <tr>
                <td><strong><?= e($s['name']) ?></strong></td>
                <td><?= e($s['unit']) ?></td>
                <td class="num">
                    <form method="POST" style="display:flex;gap:6px;justify-content:flex-end;align-items:center;">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="quick_price">
                        <input type="hidden" name="id" value="<?= $s['id'] ?>">
                        <span>৳</span>
                        <input type="number" step="0.01" name="price" value="<?= $s['price'] ?>" class="form-control" style="width:100px;padding:5px 8px;text-align:right;">
                        <button class="btn btn-sm btn-light" type="submit" title="<?= e(t('save_price', 'মূল্য সংরক্ষণ করুন')) ?>"><i class="bi bi-check-lg"></i></button>
                    </form>
                </td>
                <td><?= $s['status'] === 'active' ? '<span class="badge badge-success">' . e(t('active', 'সক্রিয়')) . '</span>' : '<span class="badge badge-danger">' . e(t('inactive', 'নিষ্ক্রিয়')) . '</span>' ?></td>
                <td style="display:flex;gap:6px;">
                    <?php $matCount = count($materialsByService[$s['id']] ?? []); ?>
                    <button class="btn btn-sm btn-light" title="<?= e(t('materials', 'কাঁচামাল')) ?>" onclick="openMaterials(<?= (int)$s['id'] ?>)"><i class="bi bi-box-seam"></i> <?= $matCount ?></button>
                    <button class="btn btn-sm btn-light" onclick='openEditService(<?= json_encode($s, JSON_UNESCAPED_UNICODE) ?>)'><i class="bi bi-pencil"></i></button>
                    <form method="POST" onsubmit="return confirm('<?= e(t('confirm_status_change', 'অবস্থা পরিবর্তন করবেন?')) ?>');">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="toggle_status">
                        <input type="hidden" name="id" value="<?= $s['id'] ?>">
                        <button class="btn btn-sm btn-light" type="submit"><i class="bi bi-power"></i></button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="modal fade" id="serviceModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_service">
                <input type="hidden" name="id" id="s_id">
                <div class="modal-header"><h5 class="modal-title" id="s_modal_title"><?= e(t('new_service', 'নতুন সার্ভিস')) ?></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body">
                    <div class="form-group"><label><?= e(t('service_name', 'সার্ভিসের নাম')) ?></label><input type="text" name="name" id="s_name" class="form-control" required placeholder="<?= e(t('service_name_ph', 'যেমনঃ ফটোকপি (প্রতি পাতা)')) ?>"></div>
                    <div class="row">
                        <div class="col-6 form-group"><label><?= e(t('price_bdt', 'মূল্য (৳)')) ?></label><input type="number" step="0.01" name="price" id="s_price" class="form-control" required></div>
                        <div class="col-6 form-group"><label><?= e(t('unit', 'একক')) ?></label><input type="text" name="unit" id="s_unit" class="form-control" placeholder="পাতা / টি"></div>
                    </div>
                </div>
                <div class="modal-footer"><button type="submit" class="btn btn-primary"><?= e(t('save', 'সংরক্ষণ করুন')) ?></button></div>
            </form>
        </div>
    </div>
</div>

<!-- কাঁচামাল (Bill of Materials) মোডাল -->
<div class="modal fade" id="materialsModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title"><?= e(t('materials_for', 'কাঁচামাল')) ?> — <span id="mat_service_name"></span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <p style="color:var(--text-secondary);font-size:13px;margin-top:0;"><?= e(t('materials_hint', 'এই সার্ভিসের ১ ইউনিট বিক্রি হলে নিচের পণ্যগুলো কত পরিমাণ স্টক থেকে বাদ যাবে তা নির্ধারণ করুন। যেমন: ফটোকপি প্রতি পাতায় "A4 কাগজ" ১ পিস।')) ?></p>
                <div id="mat_lists">
                <?php foreach ($services as $s): ?>
                    <div class="mat-list" data-service="<?= (int)$s['id'] ?>" style="display:none;">
                        <table class="data-table" style="margin-bottom:10px;">
                            <thead><tr><th><?= e(t('product', 'পণ্য')) ?></th><th class="num"><?= e(t('qty_per_unit', 'পরিমাণ / ইউনিট')) ?></th><th></th></tr></thead>
                            <tbody>
                            <?php if (empty($materialsByService[$s['id']] ?? [])): ?>
                                <tr><td colspan="3" style="color:var(--text-secondary);font-size:13px;"><?= e(t('no_materials_linked', 'কোনো কাঁচামাল যুক্ত করা হয়নি।')) ?></td></tr>
                            <?php endif; ?>
                            <?php foreach (($materialsByService[$s['id']] ?? []) as $m): ?>
                                <tr>
                                    <td><?= e($m['product_name']) ?></td>
                                    <td class="num"><?= rtrim(rtrim(number_format((float)$m['qty_per_unit'], 3), '0'), '.') ?> <?= e($m['product_unit']) ?></td>
                                    <td>
                                        <form method="POST" onsubmit="return confirm('<?= e(t('are_you_sure', 'আপনি কি নিশ্চিত?')) ?>');">
                                            <?= csrf_field() ?>
                                            <input type="hidden" name="action" value="delete_material">
                                            <input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
                                            <input type="hidden" name="service_id" value="<?= (int)$s['id'] ?>">
                                            <button class="btn btn-sm btn-light" type="submit"><i class="bi bi-trash"></i></button>
                                        </form>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                        <form method="POST" class="row g-2 mat-add-form" style="align-items:end;">
                            <?= csrf_field() ?>
                            <input type="hidden" name="action" value="add_material">
                            <input type="hidden" name="service_id" value="<?= (int)$s['id'] ?>">
                            <div class="col-6 form-group" style="margin:0;position:relative;">
                                <label><?= e(t('product', 'পণ্য')) ?></label>
                                <input type="text" class="form-control mat-product-search" autocomplete="off" placeholder="<?= e(t('search_product_ph', 'পণ্যের নাম লিখে খুঁজুন...')) ?>" data-service="<?= (int)$s['id'] ?>">
                                <input type="hidden" name="product_id" class="mat-product-id">
                                <div class="search-results-box mat-search-results" style="display:none;"></div>
                            </div>
                            <div class="col-4 form-group" style="margin:0;">
                                <label><?= e(t('qty_per_unit', 'পরিমাণ / ইউনিট')) ?></label>
                                <input type="number" step="0.001" min="0.001" name="qty_per_unit" class="form-control" value="1" required>
                            </div>
                            <div class="col-2">
                                <button type="submit" class="btn btn-primary btn-block"><i class="bi bi-plus-lg"></i></button>
                            </div>
                        </form>
                    </div>
                <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
const SERVICE_NAMES = <?= json_encode(array_column($services, 'name', 'id'), JSON_UNESCAPED_UNICODE) ?>;
const RAW_PRODUCTS = <?= json_encode($rawProducts, JSON_UNESCAPED_UNICODE) ?>;
const MATERIALS_BY_SERVICE = <?= json_encode(array_map(function ($rows) {
    return array_map(function ($r) { return (int)$r['product_id']; }, $rows);
}, $materialsByService), JSON_UNESCAPED_UNICODE) ?>;
const MAT_I18N = {
    stock: <?= json_encode(t('stock_label', 'স্টক'), JSON_UNESCAPED_UNICODE) ?>,
    noneLeft: <?= json_encode(t('no_more_products_hint', 'বাকি সব পণ্য ইতোমধ্যে এই সার্ভিসে যুক্ত করা আছে, অথবা কোনো মিল পাওয়া যায়নি।'), JSON_UNESCAPED_UNICODE) ?>,
    pickProduct: <?= json_encode(t('pick_product_first', 'অনুগ্রহ করে তালিকা থেকে একটি পণ্য বেছে নিন।'), JSON_UNESCAPED_UNICODE) ?>
};

function renderMatResults(input) {
    const box = input.closest('.form-group').querySelector('.mat-search-results');
    const excluded = MATERIALS_BY_SERVICE[input.dataset.service] || [];
    const q = toEnglishDigits(input.value.trim().toLowerCase());
    if (!q) { box.innerHTML = ''; box.style.display = 'none'; return; }
    const matches = RAW_PRODUCTS.filter(p => !excluded.includes(p.id) &&
        (p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q)))).slice(0, 12);
    if (matches.length === 0) {
        box.innerHTML = '<div class="search-result-empty">' + MAT_I18N.noneLeft + '</div>';
        box.style.display = 'block';
        return;
    }
    box.innerHTML = matches.map(p => `
        <div class="search-result-item" data-id="${p.id}">
            <span>${p.name}</span>
            <span style="color:var(--text-secondary);font-size:12px;">${MAT_I18N.stock} ${p.stock_qty} ${p.unit}</span>
        </div>`).join('');
    box.style.display = 'block';
    box.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', function () {
            const p = RAW_PRODUCTS.find(x => x.id == this.dataset.id);
            const wrap = input.closest('.form-group');
            wrap.querySelector('.mat-product-id').value = p.id;
            input.value = p.name;
            box.innerHTML = ''; box.style.display = 'none';
        });
    });
}
document.querySelectorAll('.mat-product-search').forEach(function (el) {
    hardenScanInput(el);
    el.addEventListener('input', function () {
        this.closest('.form-group').querySelector('.mat-product-id').value = '';
        renderMatResults(this);
    });
});
document.addEventListener('click', function (e) {
    if (!e.target.closest('.mat-search-results') && !e.target.classList.contains('mat-product-search')) {
        document.querySelectorAll('.mat-search-results').forEach(function (b) { b.style.display = 'none'; });
    }
});
document.querySelectorAll('.mat-add-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
        const idField = this.querySelector('.mat-product-id');
        if (!idField.value) {
            e.preventDefault();
            alert(MAT_I18N.pickProduct);
            this.querySelector('.mat-product-search').focus();
        }
    });
});

function openMaterials(serviceId) {
    document.querySelectorAll('.mat-list').forEach(function (el) {
        el.style.display = (el.dataset.service == serviceId) ? 'block' : 'none';
    });
    document.getElementById('mat_service_name').textContent = SERVICE_NAMES[serviceId] || '';
    new bootstrap.Modal(document.getElementById('materialsModal')).show();
}
<?php if ($materialsOpenId): ?>
document.addEventListener('DOMContentLoaded', function () { openMaterials(<?= (int)$materialsOpenId ?>); });
<?php endif; ?>
function openAddService() {
    document.getElementById('s_modal_title').textContent = <?= json_encode(t('new_service', 'নতুন সার্ভিস'), JSON_UNESCAPED_UNICODE) ?>;
    document.getElementById('s_id').value = '';
    document.getElementById('s_name').value = '';
    document.getElementById('s_price').value = '';
    document.getElementById('s_unit').value = <?= json_encode(t('unit_piece', 'টি'), JSON_UNESCAPED_UNICODE) ?>;
}
function openEditService(s) {
    document.getElementById('s_modal_title').textContent = <?= json_encode(t('edit_service', 'সার্ভিস সম্পাদনা'), JSON_UNESCAPED_UNICODE) ?>;
    document.getElementById('s_id').value = s.id;
    document.getElementById('s_name').value = s.name;
    document.getElementById('s_price').value = s.price;
    document.getElementById('s_unit').value = s.unit;
    new bootstrap.Modal(document.getElementById('serviceModal')).show();
}
</script>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
