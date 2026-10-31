<?php
/**
 * ওয়্যারহাউজ/শাখা ব্যবস্থাপনা — শুধুমাত্র মালিকের জন্য।
 * "প্রধান শাখা" (is_main=1) সবসময় স্বয়ংক্রিয়ভাবে থাকে এবং products.stock_qty-ই
 * তার স্টক হিসেবে গণ্য হয় (ক্রয়/বিক্রয়/সমন্বয় সবসময় এখানেই ধরা হয়)। অন্য যেকোনো
 * শাখা যোগ করা হলে তার স্টক product_stock টেবিলে থাকে, এবং শুধুমাত্র স্টক
 * ট্রান্সফারের (stock_transfer.php) মাধ্যমে বদলায়।
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_owner();

// ---------- POST অ্যাকশন ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'save_warehouse') {
        $id = (int)($_POST['id'] ?? 0);
        $name = trim($_POST['name'] ?? '');
        $address = trim($_POST['address'] ?? '') ?: null;

        if ($name === '') {
            flash_set('শাখার নাম আবশ্যক।', 'danger');
            redirect('warehouse.php');
        }

        if ($id) {
            $stmt = $pdo->prepare("UPDATE warehouses SET name=?, address=? WHERE id=?");
            $stmt->execute([$name, $address, $id]);
            flash_set('শাখার তথ্য হালনাগাদ হয়েছে।');
        } else {
            $stmt = $pdo->prepare("INSERT INTO warehouses (name, address, is_main) VALUES (?, ?, 0)");
            $stmt->execute([$name, $address]);
            $newId = $pdo->lastInsertId();
            // নতুন শাখার জন্য প্রতিটি পণ্যের শুরুর স্টক ০ ধরে product_stock-এ সারি তৈরি —
            // এতে পরে ট্রান্সফার/রিপোর্টে প্রতিটি পণ্য এই শাখায়ও দেখা যাবে
            $pdo->exec("INSERT INTO product_stock (product_id, warehouse_id, qty) SELECT id, $newId, 0 FROM products");
            flash_set('নতুন শাখা যুক্ত হয়েছে।');
        }
        redirect('warehouse.php');
    }

    if ($action === 'delete_warehouse') {
        $id = (int)($_POST['id'] ?? 0);
        $w = $pdo->prepare("SELECT * FROM warehouses WHERE id=?");
        $w->execute([$id]);
        $wh = $w->fetch();
        if (!$wh || $wh['is_main']) {
            flash_set('প্রধান শাখা মুছে ফেলা যাবে না।', 'danger');
            redirect('warehouse.php');
        }
        $stockCheck = $pdo->prepare("SELECT COALESCE(SUM(qty),0) v FROM product_stock WHERE warehouse_id=?");
        $stockCheck->execute([$id]);
        if ((float)$stockCheck->fetch()['v'] > 0) {
            flash_set('এই শাখায় এখনো স্টক আছে — মুছে ফেলার আগে অন্য শাখায় ট্রান্সফার করুন।', 'danger');
            redirect('warehouse.php');
        }
        $pdo->prepare("DELETE FROM product_stock WHERE warehouse_id=?")->execute([$id]);
        $pdo->prepare("DELETE FROM warehouses WHERE id=?")->execute([$id]);
        flash_set('শাখাটি মুছে ফেলা হয়েছে।');
        redirect('warehouse.php');
    }
}

$pageTitle = 'শাখা / ওয়্যারহাউজ';
$activeNav = 'warehouse';

// প্রতিটি শাখার মোট স্টক-পরিমাণ ও পণ্য-সংখ্যা — প্রধান শাখার জন্য products.stock_qty,
// অন্যগুলোর জন্য product_stock টেবিল থেকে
$warehouses = $pdo->query("
    SELECT w.*,
        CASE WHEN w.is_main = 1
            THEN (SELECT COALESCE(SUM(stock_qty),0) FROM products WHERE status='active')
            ELSE (SELECT COALESCE(SUM(qty),0) FROM product_stock WHERE warehouse_id = w.id)
        END AS total_qty,
        CASE WHEN w.is_main = 1
            THEN (SELECT COUNT(*) FROM products WHERE status='active' AND stock_qty > 0)
            ELSE (SELECT COUNT(*) FROM product_stock WHERE warehouse_id = w.id AND qty > 0)
        END AS product_count
    FROM warehouses w
    ORDER BY w.is_main DESC, w.name ASC
")->fetchAll();

require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <div></div>
    <div style="display:flex;gap:8px;">
        <a href="stock_transfer.php" class="btn btn-light"><i class="bi bi-arrow-left-right"></i> স্টক ট্রান্সফার</a>
        <button class="btn btn-primary" onclick="openAddWarehouse()" data-bs-toggle="modal" data-bs-target="#warehouseModal"><i class="bi bi-building-add"></i> নতুন শাখা</button>
    </div>
</div>

<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th>শাখার নাম</th><th>ঠিকানা</th><th class="num">মোট স্টক (ইউনিট)</th><th class="num">পণ্যের সংখ্যা</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($warehouses as $w): ?>
            <tr>
                <td>
                    <?= e($w['name']) ?>
                    <?php if ($w['is_main']): ?><span class="badge badge-success" style="margin-left:6px;">প্রধান</span><?php endif; ?>
                </td>
                <td><?= e($w['address'] ?: '—') ?></td>
                <td class="num"><?= (int)$w['total_qty'] ?></td>
                <td class="num"><?= (int)$w['product_count'] ?></td>
                <td style="display:flex;gap:6px;">
                    <a href="stock_transfer.php?view=stock&warehouse_id=<?= (int)$w['id'] ?>" class="btn btn-sm btn-light" title="স্টক দেখুন"><i class="bi bi-box-seam"></i></a>
                    <?php if (!$w['is_main']): ?>
                    <button type="button" class="btn btn-sm btn-light" title="সম্পাদনা" onclick='openEditWarehouse(<?= json_encode($w, JSON_UNESCAPED_UNICODE) ?>)'><i class="bi bi-pencil"></i></button>
                    <form method="POST" onsubmit="return confirm('এই শাখাটি মুছে ফেলতে চান?');" style="display:inline;">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="delete_warehouse">
                        <input type="hidden" name="id" value="<?= (int)$w['id'] ?>">
                        <button class="btn btn-sm btn-light text-danger" title="মুছে ফেলুন"><i class="bi bi-trash"></i></button>
                    </form>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="modal fade" id="warehouseModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_warehouse">
                <input type="hidden" name="id" id="w_id">
                <div class="modal-header"><h5 class="modal-title" id="w_modal_title">নতুন শাখা</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body">
                    <div class="form-group"><label>শাখার নাম</label><input type="text" name="name" id="w_name" class="form-control" placeholder="যেমনঃ মিরপুর শাখা" required></div>
                    <div class="form-group"><label>ঠিকানা (ঐচ্ছিক)</label><input type="text" name="address" id="w_address" class="form-control"></div>
                </div>
                <div class="modal-footer"><button type="submit" class="btn btn-primary">সংরক্ষণ করুন</button></div>
            </form>
        </div>
    </div>
</div>
<script>
function openAddWarehouse() {
    document.getElementById('w_modal_title').textContent = 'নতুন শাখা';
    document.getElementById('w_id').value = '';
    document.getElementById('w_name').value = '';
    document.getElementById('w_address').value = '';
}
function openEditWarehouse(w) {
    document.getElementById('w_modal_title').textContent = 'শাখা সম্পাদনা';
    document.getElementById('w_id').value = w.id;
    document.getElementById('w_name').value = w.name || '';
    document.getElementById('w_address').value = w.address || '';
    new bootstrap.Modal(document.getElementById('warehouseModal')).show();
}
</script>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
