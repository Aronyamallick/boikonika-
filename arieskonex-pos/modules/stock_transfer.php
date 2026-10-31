<?php
/**
 * শাখার মধ্যে স্টক ট্রান্সফার। products.stock_qty সবসময় "প্রধান শাখা"-র স্টক
 * হিসেবে গণ্য হয় (POS/ক্রয়/সমন্বয় এটাই ব্যবহার করে) — অন্য শাখার স্টক
 * product_stock টেবিলে থাকে। ট্রান্সফার হলে উৎস থেকে বাদ, গন্তব্যে যোগ —
 * দুটোই একই ডাটাবেজ ট্রানজেকশনে, যাতে মাঝপথে ব্যর্থ হলে স্টক অসামঞ্জস্যপূর্ণ না হয়।
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
if (!is_owner() && !is_salesman()) {
    flash_set('আপনার এই কাজের অনুমতি নেই।', 'danger');
    redirect('dashboard.php');
}

/** নির্দিষ্ট শাখায় একটি পণ্যের বর্তমান স্টক — প্রধান শাখা হলে products.stock_qty, নাহলে product_stock। */
function wh_get_qty(PDO $pdo, int $productId, array $warehouse) {
    if ($warehouse['is_main']) {
        $s = $pdo->prepare("SELECT stock_qty FROM products WHERE id=?");
        $s->execute([$productId]);
        return (float)$s->fetchColumn();
    }
    $s = $pdo->prepare("SELECT qty FROM product_stock WHERE product_id=? AND warehouse_id=?");
    $s->execute([$productId, $warehouse['id']]);
    $v = $s->fetchColumn();
    return $v === false ? 0.0 : (float)$v;
}

/** নির্দিষ্ট শাখায় একটি পণ্যের স্টক $delta দিয়ে বাড়ায়/কমায় (ঋণাত্মক দিলে কমে); ০-এর নিচে নামে না। */
function wh_adjust_qty(PDO $pdo, int $productId, array $warehouse, $delta) {
    if ($warehouse['is_main']) {
        $pdo->prepare("UPDATE products SET stock_qty = GREATEST(0, stock_qty + ?) WHERE id=?")->execute([$delta, $productId]);
        return;
    }
    $pdo->prepare("
        INSERT INTO product_stock (product_id, warehouse_id, qty) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE qty = GREATEST(0, qty + ?)
    ")->execute([$productId, $warehouse['id'], max(0, $delta), $delta]);
}

function wh_find(PDO $pdo, $id) {
    $s = $pdo->prepare("SELECT * FROM warehouses WHERE id=?");
    $s->execute([(int)$id]);
    return $s->fetch() ?: null;
}

// ---------- POST: নতুন ট্রান্সফার সংরক্ষণ ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_transfer') {
    csrf_verify();
    $fromId = (int)($_POST['from_warehouse_id'] ?? 0);
    $toId = (int)($_POST['to_warehouse_id'] ?? 0);
    $transferDate = $_POST['transfer_date'] ?: date('Y-m-d');
    $note = trim($_POST['note'] ?? '');
    $ids = $_POST['item_id'] ?? [];
    $qtys = $_POST['item_qty'] ?? [];

    if ($fromId <= 0 || $toId <= 0 || $fromId === $toId) {
        flash_set('উৎস ও গন্তব্য শাখা অবশ্যই ভিন্ন হতে হবে।', 'danger');
        redirect('stock_transfer.php?view=create');
    }

    $fw = wh_find($pdo, $fromId);
    $tw = wh_find($pdo, $toId);
    if (!$fw || !$tw) {
        flash_set('অবৈধ শাখা নির্বাচিত হয়েছে।', 'danger');
        redirect('stock_transfer.php?view=create');
    }

    $items = [];
    foreach ($ids as $i => $id) {
        $qty = (float)($qtys[$i] ?? 0);
        if ($qty <= 0) continue;
        $items[] = ['product_id' => (int)$id, 'qty' => $qty];
    }
    if (empty($items)) {
        flash_set('অন্তত একটি পণ্য ও পরিমাণ যোগ করুন।', 'danger');
        redirect('stock_transfer.php?view=create&from=' . $fromId . '&to=' . $toId);
    }

    // সার্ভার-সাইড স্টক যাচাই — ক্লায়েন্টের দেখানো পরিমাণ কখনো সরাসরি বিশ্বাস করা হয় না
    foreach ($items as $it) {
        $avail = wh_get_qty($pdo, $it['product_id'], $fw);
        if ($it['qty'] > $avail) {
            $pRow = $pdo->prepare("SELECT name FROM products WHERE id=?");
            $pRow->execute([$it['product_id']]);
            $pName = $pRow->fetchColumn() ?: ('#' . $it['product_id']);
            flash_set('"' . $pName . '"-এর জন্য পর্যাপ্ত স্টক নেই ' . $fw['name'] . '-এ (আছে ' . $avail . ', চাওয়া হয়েছে ' . $it['qty'] . ')।', 'danger');
            redirect('stock_transfer.php?view=create&from=' . $fromId . '&to=' . $toId);
        }
    }

    $pdo->beginTransaction();
    try {
        $transferNo = generate_doc_no($pdo, 'stock_transfers', 'transfer_date', 'transfer_no', 'TRF');
        $stmt = $pdo->prepare("INSERT INTO stock_transfers (transfer_no, from_warehouse_id, to_warehouse_id, transfer_date, note, created_by) VALUES (?,?,?,?,?,?)");
        $stmt->execute([$transferNo, $fromId, $toId, $transferDate, $note ?: null, current_user()['id'] ?? null]);
        $transferId = $pdo->lastInsertId();

        $itemStmt = $pdo->prepare("INSERT INTO stock_transfer_items (transfer_id, product_id, qty) VALUES (?,?,?)");
        foreach ($items as $it) {
            $itemStmt->execute([$transferId, $it['product_id'], $it['qty']]);
            wh_adjust_qty($pdo, $it['product_id'], $fw, -$it['qty']);
            wh_adjust_qty($pdo, $it['product_id'], $tw, $it['qty']);
        }
        $pdo->commit();
        log_activity($pdo, 'স্টক ট্রান্সফার সম্পন্ন: ' . $transferNo . ' (' . $fw['name'] . ' → ' . $tw['name'] . ')');
        flash_set('স্টক ট্রান্সফার সম্পন্ন হয়েছে — ' . $transferNo);
        redirect('stock_transfer.php?view=show&id=' . $transferId);
    } catch (Throwable $ex) {
        $pdo->rollBack();
        flash_set('ট্রান্সফার সংরক্ষণ ব্যর্থ হয়েছে — আবার চেষ্টা করুন।', 'danger');
        redirect('stock_transfer.php?view=create&from=' . $fromId . '&to=' . $toId);
    }
}

$view = $_GET['view'] ?? 'list';
$pageTitle = 'স্টক ট্রান্সফার';
$activeNav = 'stock_transfer';
$warehouseList = $pdo->query("SELECT * FROM warehouses ORDER BY is_main DESC, name ASC")->fetchAll();

// ---------- ভিউ: একটি নির্দিষ্ট শাখার স্টক (শুধু দেখার জন্য) ----------
if ($view === 'stock') {
    $warehouseId = (int)($_GET['warehouse_id'] ?? 0);
    $wh = wh_find($pdo, $warehouseId);
    if (!$wh) { flash_set('শাখা খুঁজে পাওয়া যায়নি।', 'danger'); redirect('warehouse.php'); }

    if ($wh['is_main']) {
        $stockRows = $pdo->query("SELECT id, name, item_code, unit, stock_qty AS qty FROM products WHERE status='active' ORDER BY name")->fetchAll();
    } else {
        $stmt = $pdo->prepare("SELECT p.id, p.name, p.item_code, p.unit, COALESCE(ps.qty,0) AS qty FROM products p LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=? WHERE p.status='active' ORDER BY p.name");
        $stmt->execute([$warehouseId]);
        $stockRows = $stmt->fetchAll();
    }

    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head">
        <a href="warehouse.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> শাখার তালিকায় ফিরুন</a>
        <a href="stock_transfer.php?view=create&from=<?= (int)$warehouseId ?>" class="btn btn-primary btn-sm"><i class="bi bi-arrow-left-right"></i> এখান থেকে ট্রান্সফার করুন</a>
    </div>
    <h3 style="margin-top:0;"><?= e($wh['name']) ?> — বর্তমান স্টক</h3>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>আইটেম কোড</th><th>নাম</th><th>একক</th><th class="num">স্টক</th></tr></thead>
            <tbody>
            <?php if (empty($stockRows)): ?>
                <tr><td colspan="4"><div class="empty-state"><i class="bi bi-box-seam"></i>কোনো পণ্য নেই।</div></td></tr>
            <?php endif; ?>
            <?php foreach ($stockRows as $r): ?>
                <tr>
                    <td><?= e($r['item_code']) ?></td>
                    <td><?= e($r['name']) ?></td>
                    <td><?= e($r['unit']) ?></td>
                    <td class="num"><?= (float)$r['qty'] ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: নতুন ট্রান্সফার তৈরি ----------
if ($view === 'create') {
    $fromId = (int)($_GET['from'] ?? 0);
    $toId = (int)($_GET['to'] ?? 0);
    $fw = $fromId ? wh_find($pdo, $fromId) : null;
    $tw = $toId ? wh_find($pdo, $toId) : null;

    require_once __DIR__ . '/../includes/header.php';

    // ধাপ ১: উৎস ও গন্তব্য শাখা এখনো বাছাই করা হয়নি (বা একই) — শুধু বাছাই ফর্ম দেখানো হবে
    if (!$fw || !$tw || $fromId === $toId) {
        ?>
        <div class="page-head">
            <a href="stock_transfer.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> তালিকায় ফিরুন</a>
        </div>
        <div class="card" style="max-width:480px;padding:20px;">
            <h3 style="margin-top:0;">উৎস ও গন্তব্য শাখা বাছাই করুন</h3>
            <form method="GET">
                <input type="hidden" name="view" value="create">
                <div class="form-group">
                    <label>কোথা থেকে (উৎস)</label>
                    <select name="from" class="form-control" required>
                        <option value="">— বাছাই করুন —</option>
                        <?php foreach ($warehouseList as $w): ?>
                            <option value="<?= (int)$w['id'] ?>" <?= $fromId == $w['id'] ? 'selected' : '' ?>><?= e($w['name']) ?><?= $w['is_main'] ? ' (প্রধান)' : '' ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label>কোথায় (গন্তব্য)</label>
                    <select name="to" class="form-control" required>
                        <option value="">— বাছাই করুন —</option>
                        <?php foreach ($warehouseList as $w): ?>
                            <option value="<?= (int)$w['id'] ?>" <?= $toId == $w['id'] ? 'selected' : '' ?>><?= e($w['name']) ?><?= $w['is_main'] ? ' (প্রধান)' : '' ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <?php if ($fromId && $toId && $fromId === $toId): ?>
                    <div class="alert alert-danger">উৎস ও গন্তব্য শাখা ভিন্ন হতে হবে।</div>
                <?php endif; ?>
                <?php if (count($warehouseList) < 2): ?>
                    <div class="alert alert-info">ট্রান্সফারের জন্য অন্তত ২টি শাখা লাগবে। <a href="warehouse.php">এখান থেকে নতুন শাখা যোগ করুন</a>।</div>
                <?php endif; ?>
                <button type="submit" class="btn btn-primary btn-block">এগিয়ে যান</button>
            </form>
        </div>
        <?php
        require_once __DIR__ . '/../includes/footer.php';
        exit;
    }

    // ধাপ ২: পণ্য বাছাই ও পরিমাণ দিয়ে ট্রান্সফার তৈরি
    if ($fw['is_main']) {
        $products = $pdo->query("SELECT id, name, unit, item_code, barcode, stock_qty AS avail_qty FROM products WHERE status='active' ORDER BY name LIMIT 800")->fetchAll();
    } else {
        $stmt = $pdo->prepare("SELECT p.id, p.name, p.unit, p.item_code, p.barcode, COALESCE(ps.qty,0) AS avail_qty FROM products p LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=? WHERE p.status='active' ORDER BY p.name LIMIT 800");
        $stmt->execute([$fromId]);
        $products = $stmt->fetchAll();
    }
    ?>
    <div class="page-head no-print">
        <a href="stock_transfer.php?view=create" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> শাখা বদলান</a>
        <div style="font-weight:600;"><?= e($fw['name']) ?> <i class="bi bi-arrow-right"></i> <?= e($tw['name']) ?></div>
    </div>
    <form method="POST" id="transferForm">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_transfer">
        <input type="hidden" name="from_warehouse_id" value="<?= (int)$fromId ?>">
        <input type="hidden" name="to_warehouse_id" value="<?= (int)$toId ?>">
        <div class="row">
            <div class="col-md-7">
                <div class="card" style="padding:16px;">
                    <h3 style="font-size:15px;margin:0 0 10px;">পণ্য যোগ করুন <span style="font-weight:400;color:var(--text-secondary);">(<?= e($fw['name']) ?>-এ উপলব্ধ পরিমাণ দেখানো হচ্ছে)</span></h3>
                    <input type="text" id="itemSearch" class="form-control" placeholder="নাম বা আইটেম কোড দিয়ে খুঁজুন..." autocomplete="off">
                    <div id="itemGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(160px,1fr));gap:8px;max-height:55vh;overflow-y:auto;margin-top:10px;"></div>
                </div>
            </div>
            <div class="col-md-5">
                <div class="card" style="padding:16px;">
                    <h3 style="font-size:15px;margin:0 0 10px;"><i class="bi bi-arrow-left-right"></i> ট্রান্সফার তালিকা</h3>
                    <div id="cartRows"><div class="empty-state" id="emptyCart" style="padding:20px;"><i class="bi bi-box"></i>এখনো কিছু যোগ হয়নি।</div></div>
                    <hr>
                    <div class="form-group"><label>তারিখ</label><input type="date" name="transfer_date" class="form-control" value="<?= date('Y-m-d') ?>"></div>
                    <div class="form-group"><label>নোট (ঐচ্ছিক)</label><textarea name="note" class="form-control" rows="2"></textarea></div>
                    <button type="submit" class="btn btn-primary btn-block" id="submitBtn" disabled><i class="bi bi-save"></i> ট্রান্সফার সংরক্ষণ করুন</button>
                </div>
            </div>
        </div>
    </form>
    <script>
    const PRODUCTS = <?= json_encode($products, JSON_UNESCAPED_UNICODE) ?>;
    let cart = [];

    function renderGrid(query) {
        const grid = document.getElementById('itemGrid');
        grid.innerHTML = '';
        const q = (query || '').toLowerCase();
        const list = PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q) || (p.item_code||'').toLowerCase().includes(q)).slice(0, 80);
        list.forEach(p => {
            const avail = Number(p.avail_qty);
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cssText = 'padding:8px;text-align:center;font-size:12.5px;' + (avail > 0 ? 'cursor:pointer;' : 'opacity:.45;');
            card.innerHTML = `<div style="font-weight:600;">${p.name}</div><div style="color:var(--text-secondary);">স্টক: ${avail}</div>`;
            if (avail > 0) card.onclick = () => addToCart(p.id, p.name, p.unit, avail);
            grid.appendChild(card);
        });
    }
    document.getElementById('itemSearch').addEventListener('input', e => renderGrid(e.target.value));
    renderGrid('');

    function addToCart(id, name, unit, avail) {
        const existing = cart.find(c => c.id === id);
        if (existing) {
            existing.qty = Math.min(avail, existing.qty + 1);
        } else {
            cart.push({id, name, unit, avail, qty: 1});
        }
        renderCart();
    }
    function updateQty(idx, val) {
        const c = cart[idx];
        c.qty = Math.max(1, Math.min(c.avail, parseInt(val) || 1));
        renderCart();
    }
    function removeItem(idx) { cart.splice(idx, 1); renderCart(); }

    function renderCart() {
        const wrap = document.getElementById('cartRows');
        document.getElementById('submitBtn').disabled = cart.length === 0;
        if (cart.length === 0) {
            wrap.innerHTML = '<div class="empty-state" id="emptyCart" style="padding:20px;"><i class="bi bi-box"></i>এখনো কিছু যোগ হয়নি।</div>';
            return;
        }
        wrap.innerHTML = cart.map((c, i) => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
                <div style="flex:1;">
                    <div style="font-weight:600;font-size:13px;">${c.name}</div>
                    <div style="font-size:11.5px;color:var(--text-secondary);">সর্বোচ্চ ${c.avail} ${c.unit}</div>
                </div>
                <input type="number" min="1" max="${c.avail}" value="${c.qty}" style="width:64px;" class="form-control form-control-sm" onchange="updateQty(${i}, this.value)">
                <input type="hidden" name="item_id[]" value="${c.id}">
                <input type="hidden" name="item_qty[]" value="${c.qty}">
                <button type="button" class="btn btn-sm btn-light text-danger" onclick="removeItem(${i})"><i class="bi bi-x"></i></button>
            </div>
        `).join('');
    }
    </script>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: একটি ট্রান্সফারের বিস্তারিত (প্রিন্ট করা যায়) ----------
if ($view === 'show') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("
        SELECT t.*, fw.name AS from_name, tw.name AS to_name, u.name AS created_by_name
        FROM stock_transfers t
        LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id
        LEFT JOIN users u ON u.id = t.created_by
        WHERE t.id = ?
    ");
    $stmt->execute([$id]);
    $transfer = $stmt->fetch();
    if (!$transfer) { flash_set('ট্রান্সফার খুঁজে পাওয়া যায়নি।', 'danger'); redirect('stock_transfer.php'); }

    $itemsStmt = $pdo->prepare("
        SELECT sti.*, p.name AS product_name, p.item_code, p.unit
        FROM stock_transfer_items sti JOIN products p ON p.id = sti.product_id
        WHERE sti.transfer_id = ?
    ");
    $itemsStmt->execute([$id]);
    $tItems = $itemsStmt->fetchAll();
    $settings = shop_settings($pdo);

    require_once __DIR__ . '/../includes/header.php';
    ?>
    <div class="page-head no-print">
        <a href="stock_transfer.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> তালিকায় ফিরুন</a>
        <button type="button" class="btn btn-light btn-sm" onclick="window.print()"><i class="bi bi-printer"></i> প্রিন্ট / PDF</button>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
        <h2 style="margin:0;"><?= e($settings['shop_name'] ?? '') ?></h2>
        <h3 style="margin:14px 0 4px;">স্টক ট্রান্সফার — <?= e($transfer['transfer_no']) ?></h3>
    </div>
    <div class="row" style="margin-bottom:14px;">
        <div class="col-md-6">
            <strong>তারিখ:</strong> <?= e(date('d M Y', strtotime($transfer['transfer_date']))) ?><br>
            <strong>থেকে:</strong> <?= e($transfer['from_name']) ?><br>
            <strong>যেখানে:</strong> <?= e($transfer['to_name']) ?><br>
        </div>
        <div class="col-md-6" style="text-align:right;">
            <strong>যিনি করেছেন:</strong> <?= e($transfer['created_by_name'] ?: '—') ?><br>
            <?php if ($transfer['note']): ?><strong>নোট:</strong> <?= e($transfer['note']) ?><?php endif; ?>
        </div>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead><tr><th>#</th><th>আইটেম কোড</th><th>পণ্য</th><th class="num">পরিমাণ</th></tr></thead>
            <tbody>
            <?php foreach ($tItems as $i => $it): ?>
                <tr>
                    <td><?= $i + 1 ?></td>
                    <td><?= e($it['item_code']) ?></td>
                    <td><?= e($it['product_name']) ?></td>
                    <td class="num"><?= (float)$it['qty'] ?> <?= e($it['unit']) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: তালিকা ----------
$transfers = $pdo->query("
    SELECT t.*, fw.name AS from_name, tw.name AS to_name,
        (SELECT COUNT(*) FROM stock_transfer_items WHERE transfer_id = t.id) AS item_count
    FROM stock_transfers t
    LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id
    LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id
    ORDER BY t.created_at DESC LIMIT 400
")->fetchAll();

require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <a href="warehouse.php" class="btn btn-light"><i class="bi bi-building"></i> শাখা ব্যবস্থাপনা</a>
    <a href="stock_transfer.php?view=create" class="btn btn-primary"><i class="bi bi-plus-lg"></i> নতুন ট্রান্সফার</a>
</div>
<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th>ট্রান্সফার নং</th><th>তারিখ</th><th>থেকে</th><th>যেখানে</th><th class="num">আইটেম</th><th></th></tr></thead>
        <tbody>
        <?php if (empty($transfers)): ?>
            <tr><td colspan="6"><div class="empty-state"><i class="bi bi-arrow-left-right"></i>এখনো কোনো স্টক ট্রান্সফার হয়নি।</div></td></tr>
        <?php endif; ?>
        <?php foreach ($transfers as $t): ?>
            <tr>
                <td><a href="stock_transfer.php?view=show&id=<?= (int)$t['id'] ?>"><?= e($t['transfer_no']) ?></a></td>
                <td><?= e(date('d M Y', strtotime($t['transfer_date']))) ?></td>
                <td><?= e($t['from_name']) ?></td>
                <td><?= e($t['to_name']) ?></td>
                <td class="num"><?= (int)$t['item_count'] ?></td>
                <td><a href="stock_transfer.php?view=show&id=<?= (int)$t['id'] ?>" class="btn btn-sm btn-light"><i class="bi bi-eye"></i> দেখুন</a></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
