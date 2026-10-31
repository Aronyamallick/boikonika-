<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
// ক্যাশিয়ার নিজে এইমাত্র যে বিক্রয়টি সম্পন্ন করলেন, তার ইনভয়েস দেখা/প্রিন্ট করতে পারবেন —
// "বিক্রয় তালিকা" অনুমতি না থাকলেও (আগে এ অবস্থায় ড্যাশবোর্ডে ফেরত পাঠানো হতো, ইনভয়েস প্রিন্ট করা যেত না)
$ownCompletedSale = ($_GET['view'] ?? '') === 'show'
    && in_array((int)($_GET['id'] ?? 0), array_map('intval', array_values($_SESSION['pos_done'] ?? [])), true)
    && has_permission(current_user(), 'sales');
if (!$ownCompletedSale) {
    require_permission('sales_list');
}

$settings = shop_settings($pdo);
$isOwner = is_owner();
$view = $_GET['view'] ?? 'list';
$pageTitle = 'বিক্রয় তালিকা';
$activeNav = 'sales_list';

// ---------- ভিউ: একটি ইনভয়েসের বিস্তারিত / প্রিন্ট ----------
if ($view === 'show') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT s.*, c.name AS customer_name, c.mobile AS customer_mobile, c.address AS customer_address, u.name AS cashier_name FROM sales s LEFT JOIN customers c ON s.customer_id = c.id LEFT JOIN users u ON s.created_by = u.id WHERE s.id = ?");
    $stmt->execute([$id]);
    $sale = $stmt->fetch();
    if (!$sale) { flash_set('ইনভয়েসটি খুঁজে পাওয়া যায়নি।', 'danger'); redirect('sales_list.php'); }

    $stmt = $pdo->prepare("SELECT * FROM sale_items WHERE sale_id = ?");
    $stmt->execute([$id]);
    $items = $stmt->fetchAll();

    // এই ইনভয়েসের আগে থেকে কাস্টমারের পূর্বের বাকি বা অগ্রিম (জমা) হিসাব
    $previousBalance = 0.0;
    if (!empty($sale['customer_id'])) {
        $pbStmt = $pdo->prepare("SELECT c.opening_balance AS ob, COALESCE((SELECT SUM(due_amount) FROM sales WHERE customer_id = c.id AND id != ?), 0) AS other_due FROM customers c WHERE c.id = ?");
        $pbStmt->execute([$id, $sale['customer_id']]);
        $pbRow = $pbStmt->fetch();
        if ($pbRow) {
            $previousBalance = (float)$pbRow['ob'] + (float)$pbRow['other_due'];
        }
    }
    $grandBalance = $previousBalance + (float)$sale['due_amount'];

    // "পূর্বের বাকি" হিসেবে দেখানো হবে বিক্রয়ের মুহূর্তে নেওয়া স্ন্যাপশট
    // (অতিরিক্ত পরিশোধ দিয়ে পুরোনো বাকি সমন্বয় করার আগের অবস্থা) — যাতে
    // গ্রাহক আগে কত বাকি ছিল আর এই পরিশোধে কত সমন্বয় হলো তা স্পষ্ট বোঝা যায়।
    // পুরোনো ইনভয়েসে (স্ন্যাপশট কলাম আসার আগে তৈরি) এই মান ফাঁকা থাকতে পারে —
    // সেক্ষেত্রে বর্তমান হিসাবই (লাইভ) দেখানো হবে।
    $previousBalanceDisplay = isset($sale['previous_balance_snapshot']) && $sale['previous_balance_snapshot'] !== null
        ? (float)$sale['previous_balance_snapshot']
        : $previousBalance;

    // হোয়াটসঅ্যাপ / জিমেইলে শেয়ার করার জন্য ইনভয়েসের সংক্ষিপ্ত লেখা তৈরি
    $shareLines = [];
    $shareLines[] = ($settings['shop_name'] ?? '') . ' — ইনভয়েস';
    $shareLines[] = 'ইনভয়েস নং: ' . $sale['invoice_no'];
    $shareLines[] = 'তারিখ: ' . date('d M Y', strtotime($sale['sale_date']));
    $shareLines[] = 'ক্রেতা: ' . ($sale['customer_name'] ?? 'ওয়াক-ইন কাস্টমার');
    $shareLines[] = '';
    foreach ($items as $it) {
        $shareLines[] = '- ' . $it['description'] . ' x' . (int)$it['qty'] . ' = ৳' . money($it['subtotal']);
    }
    $shareLines[] = '';
    $shareLines[] = 'সাবটোটাল: ৳' . money($sale['subtotal']);
    if ((float)$sale['discount'] > 0) {
        $shareLines[] = 'ডিসকাউন্ট: -৳' . money($sale['discount']);
    }
    $shareLines[] = 'সর্বমোট: ৳' . money($sale['total_amount']);
    $shareLines[] = 'পরিশোধিত: ৳' . money($sale['paid_amount']);
    if ((float)$sale['due_amount'] > 0) {
        $shareLines[] = 'এই ইনভয়েসের বাকি: ৳' . money($sale['due_amount']);
    }
    if (abs($previousBalanceDisplay) > 0.004) {
        $shareLines[] = $previousBalanceDisplay > 0
            ? 'পূর্বের বাকি: ৳' . money($previousBalanceDisplay)
            : 'পূর্বের জমা (অগ্রিম): ৳' . money(abs($previousBalanceDisplay));
        if ($grandBalance > 0.004) {
            $shareLines[] = 'সর্বমোট বাকি: ৳' . money($grandBalance);
        } elseif ($grandBalance < -0.004) {
            $shareLines[] = 'সর্বমোট জমা: ৳' . money(abs($grandBalance));
        }
    }
    $shareLines[] = '';
    $shareLines[] = 'ধন্যবাদ! আবার আসবেন।';
    $shareText = implode("\n", $shareLines);
    $shareWaNumber = whatsapp_number($sale['customer_mobile'] ?? '');
    $shopWaNumber = whatsapp_number(!empty($settings['whatsapp']) ? $settings['whatsapp'] : ($settings['mobile'] ?? ''));
    $verifyUrl = invoice_verify_url('sale', $sale['id'], $sale['invoice_no']);

    $hideBottomNav = true; // ইনভয়েস/প্রিন্ট ভিউতে মোবাইল বটম ন্যাভিগেশন বার দেখানো হয় না
    require_once __DIR__ . '/../includes/header.php';
    ?>
    <style>
        @media print {
            @page { size: A5; margin: 8mm; }
            body { background: #fff; }
        }
        .invoice-doc, .invoice-doc * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
        }
        .invoice-doc {
            max-width: 148mm;
            margin: 0 auto;
            background: #fff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(36,27,58,.08);
            font-size: 12.5px;
        }
        @media print {
            .invoice-doc { max-width: none; width: 100%; box-shadow: none; border-radius: 0; }
        }
        .invoice-copy-label {
            text-align: center;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.5px;
            color: #fff;
            background: var(--text-primary);
            padding: 4px 0;
        }
        .invoice-body { padding: 20px 22px 6px; }
        .invoice-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .invoice-head .shop-name { font-size: 16px; }
        .invoice-head .shop-name small { font-size: 10.5px; }
        .invoice-head-right { text-align: right; }
        .invoice-head-right .tag { font-family:'Baloo Da 2',sans-serif; font-weight:700; font-size:19px; letter-spacing:1px; background:linear-gradient(90deg,var(--brand-purple),var(--brand-magenta),var(--brand-orange)); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .invoice-head-right table { margin-top:6px; font-size:11.5px; border-collapse:collapse; }
        .invoice-head-right table td { padding:1.5px 0; }
        .invoice-head-right table td:first-child { color: var(--text-secondary); padding-right:10px; }
        .invoice-head-right table td:last-child { font-weight:600; text-align:right; }
        .invoice-billto { margin-bottom: 14px; }
        .invoice-billto .label { font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.5px; margin-bottom:3px; }
        .invoice-billto .name { font-weight:700; font-size:13.5px; }
        .invoice-billto .line { font-size:11.5px; color:var(--text-secondary); }
        .invoice-items { width:100%; border-collapse:collapse; margin-bottom: 4px; }
        .invoice-items thead th {
            background: linear-gradient(90deg,var(--brand-purple),var(--brand-magenta) 55%,var(--brand-orange));
            color:#fff; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px;
            padding:8px 10px; text-align:left; font-weight:700;
        }
        .invoice-items thead th.num, .invoice-items tbody td.num { text-align:right; }
        .invoice-items tbody td { padding:7px 10px; border-bottom:1px solid var(--border); font-size:12px; }
        .invoice-items tbody tr:last-child td { border-bottom:none; }
        .invoice-totals { max-width: 230px; margin-left:auto; margin-top:8px; }
        .invoice-totals .row { display:flex; justify-content:space-between; padding:4px 10px; font-size:12px; }
        .invoice-totals .row.strong { font-weight:700; border-top:1px solid var(--border); padding-top:7px; margin-top:2px; }
        .invoice-totals .grand {
            display:flex; justify-content:space-between; align-items:center;
            background: linear-gradient(90deg,var(--brand-purple),var(--brand-magenta) 55%,var(--brand-orange));
            color:#fff; font-weight:700; font-size:14px; padding:8px 10px; border-radius:6px; margin-top:6px;
        }
        .invoice-thanks { text-align:center; margin: 18px 0 14px; font-weight:600; font-size:12.5px; }
        .invoice-footer { padding: 10px 22px; border-top:1px solid var(--border); display:flex; flex-wrap:wrap; gap:6px 18px; font-size:10.5px; color:var(--text-secondary); align-items:center; }
        .invoice-footer span { white-space:nowrap; }
        .invoice-footer .invoice-qr-block { margin-left:auto; display:flex; align-items:center; gap:8px; }
        .invoice-footer .invoice-qr-block canvas { width:56px; height:56px; display:block; }
        .invoice-footer .invoice-qr-block .qr-caption { font-size:9px; line-height:1.3; color:var(--text-secondary); max-width:80px; }
        .invoice-wave { height: 10px; background: linear-gradient(90deg,var(--brand-purple),var(--brand-magenta) 50%,var(--brand-orange)); }

        /* --- সাদাকালো (নন-কালার প্রিন্টার) মোড: গ্র্যাডিয়েন্ট/রঙের বদলে কালো-সাদা কনট্রাস্ট --- */
        .invoice-doc.bw-mode .invoice-copy-label { background:#000 !important; color:#fff !important; }
        .invoice-doc.bw-mode .invoice-head-right .tag { background:none !important; -webkit-background-clip:initial !important; background-clip:initial !important; -webkit-text-fill-color:#000 !important; color:#000 !important; }
        .invoice-doc.bw-mode .invoice-items thead th { background:#000 !important; color:#fff !important; }
        .invoice-doc.bw-mode .invoice-totals .grand { background:#000 !important; color:#fff !important; }
        .invoice-doc.bw-mode .invoice-wave { background:#000 !important; }
        .invoice-doc.bw-mode .book-spine-mark span { background:#000 !important; }
        .invoice-doc.bw-mode .badge-info { background:#fff !important; color:#000 !important; border:1px solid #000 !important; }
    </style>
    <div class="page-head no-print">
        <?php if ($ownCompletedSale && !has_permission(current_user(), 'sales_list')): ?>
        <a href="sales_pos.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> POS-এ ফিরুন</a>
        <?php else: ?>
        <a href="sales_list.php" class="btn btn-light btn-sm"><i class="bi bi-arrow-left"></i> তালিকায় ফিরুন</a>
        <?php endif; ?>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a href="sales_return.php?sale_id=<?= (int)$sale['id'] ?>" class="btn btn-light btn-sm"><i class="bi bi-arrow-counterclockwise"></i> বিক্রয় ফেরত</a>
            <button onclick="printInvoice(false)" class="btn btn-outline btn-sm"><i class="bi bi-printer-fill" style="color:var(--brand-magenta);"></i> কালার প্রিন্ট</button>
            <button onclick="printInvoice(true)" class="btn btn-outline btn-sm"><i class="bi bi-printer"></i> সাদাকালো প্রিন্ট</button>
            <button onclick="shareInvoiceWhatsApp()" class="btn btn-outline btn-sm"><i class="bi bi-whatsapp" style="color:#25D366;"></i> হোয়াটসঅ্যাপ</button>
            <button onclick="shareInvoiceGmail()" class="btn btn-outline btn-sm"><i class="bi bi-envelope" style="color:#EA4335;"></i> জিমেইল</button>
        </div>
    </div>
    <div class="alert alert-info no-print" style="margin-bottom:14px;">
        এই ইনভয়েস থেকে শুধুমাত্র যে পরিমাণ পণ্য ফেরত হয়েছে ততোটাই নির্বাচন করুন। পুরা ইনভয়েস ফেরত নেওয়ার দরকার নেই যদি কিছু পণ্য ফেরত দেয়া হয়।
    </div>

    <?php if (!empty($_GET['fresh'])): ?>
        <!-- বিক্রয় সম্পন্ন: কয়েক সেকেন্ড পর স্বয়ংক্রিয়ভাবে এই বিক্রয় বন্ধ হয়ে নতুন বিক্রয়ের (POS) পাতা খোলে -->
        <div class="sale-done-banner no-print" id="saleDoneBanner">
            <div class="sdb-icon"><i class="bi bi-check2-circle"></i></div>
            <div class="sdb-text">
                <strong>বিক্রয় সফলভাবে সম্পন্ন হয়েছে — ইনভয়েস <?= e($sale['invoice_no']) ?></strong>
                <span id="sdbCountdownText">নতুন বিক্রয় খুলছে <b id="sdbCountdown">8</b> সেকেন্ডে... (পরবর্তী পণ্য স্ক্যান করলেও সাথে সাথে নতুন বিক্রয় শুরু হবে)</span>
            </div>
            <div class="sdb-actions">
                <button type="button" class="btn btn-light btn-sm" id="sdbPrint"><i class="bi bi-printer"></i> প্রিন্ট করে নতুন বিক্রয়</button>
                <a href="sales_pos.php" class="btn btn-primary btn-sm" id="sdbNew"><i class="bi bi-plus-circle"></i> নতুন বিক্রয় <kbd>Enter</kbd></a>
                <button type="button" class="btn btn-light btn-sm" id="sdbStay" title="এই পাতায় থাকুন"><i class="bi bi-pause-circle"></i> থামুন <kbd>Esc</kbd></button>
            </div>
            <div class="sdb-progress"><span id="sdbProgress"></span></div>
        </div>
        <script>
        (function () {
            // সম্পন্ন বিক্রয়ের কার্ট মুছে ফেলা হয়, যাতে নতুন বিক্রয় খালি কার্ট দিয়ে শুরু হয়
            try { sessionStorage.removeItem('arieskonex_pos_cart_v1'); } catch (e) {}
            // রিলোড করলে যেন আবার কাউন্টডাউন শুরু না হয়
            try {
                var u = new URL(location.href); u.searchParams.delete('fresh');
                history.replaceState(null, '', u.pathname + u.search);
            } catch (e) {}

            var SECONDS = 8, left = SECONDS, timer = null, stopped = false, goAfterPrint = false;
            var posUrl = 'sales_pos.php';
            var cd = document.getElementById('sdbCountdown');
            var bar = document.getElementById('sdbProgress');
            function go() { location.href = posUrl; }
            function stop() {
                stopped = true; clearInterval(timer);
                document.getElementById('sdbCountdownText').textContent = 'স্বয়ংক্রিয় বন্ধ থামানো হয়েছে — প্রস্তুত হলে "নতুন বিক্রয়" চাপুন।';
                bar.style.width = '0%';
            }
            function tick() {
                left -= 1;
                cd.textContent = left;
                bar.style.width = ((SECONDS - left) / SECONDS * 100) + '%';
                if (left <= 0) { clearInterval(timer); go(); }
            }
            bar.style.width = '0%';
            timer = setInterval(tick, 1000);

            document.getElementById('sdbStay').addEventListener('click', stop);
            document.getElementById('sdbPrint').addEventListener('click', function () {
                clearInterval(timer);
                goAfterPrint = true;
                if (typeof printInvoice === 'function') { printInvoice(false); } else { window.print(); }
                // কিছু ব্রাউজারে afterprint আসে না — window.print() ব্লকিং, তাই এরপরই চলে যাওয়া নিরাপদ
                setTimeout(function () { if (goAfterPrint) go(); }, 600);
            });
            window.addEventListener('afterprint', function () { if (goAfterPrint) go(); });
            document.addEventListener('keydown', function (e) {
                if (e.ctrlKey || e.altKey || e.metaKey) return;
                var tag = (e.target && e.target.tagName) || '';
                if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
                if (e.key === 'Escape') { e.preventDefault(); stop(); }
                else if (e.key === 'Enter' && !e.repeat) {
                    // স্ক্যানারের Enter গ্লোবাল স্ক্যানার আগেই ধরে নেয় (capture phase); এটি হাতে চাপা Enter
                    e.preventDefault(); go();
                }
            });
        })();
        </script>
    <?php endif; ?>

    <div class="invoice-doc">
        <div class="invoice-copy-label">কাস্টমার কপি</div>
        <div class="invoice-body">
            <div class="invoice-head">
                <div class="brand-lockup">
                    <div class="book-spine-mark lg"><span></span><span></span><span></span><span></span></div>
                    <div class="shop-name"><?= e($settings['shop_name'] ?? '') ?>
                        <small><?= e($settings['address'] ?? '') ?></small>
                    </div>
                </div>
                <div class="invoice-head-right">
                    <div class="tag">ইনভয়েস</div>
                    <table>
                        <tr><td>ইনভয়েস নং</td><td><?= e($sale['invoice_no']) ?></td></tr>
                        <tr><td>তারিখ</td><td><?= date('d M Y', strtotime($sale['sale_date'])) ?></td></tr>
                        <tr><td>বিক্রেতা</td><td><?= e($sale['cashier_name'] ?? '—') ?></td></tr>
                    </table>
                </div>
            </div>

            <div class="invoice-billto">
                <div class="label">ক্রেতা</div>
                <div class="name"><?= e($sale['customer_name'] ?? 'ওয়াক-ইন কাস্টমার') ?></div>
                <?php if (!empty($sale['customer_address'])): ?><div class="line"><?= e($sale['customer_address']) ?></div><?php endif; ?>
                <?php if (!empty($sale['customer_mobile'])): ?><div class="line"><?= e($sale['customer_mobile']) ?></div><?php endif; ?>
            </div>

            <table class="invoice-items">
                <thead><tr><th>বিবরণ</th><th class="num">পরিমাণ</th><th class="num">হার</th><th class="num">মূল্য</th></tr></thead>
                <tbody>
                <?php foreach ($items as $it): ?>
                    <tr>
                        <td><?= e($it['description']) ?> <?php if ($it['item_type'] === 'service'): ?><span class="badge badge-info">সার্ভিস</span><?php endif; ?></td>
                        <td class="num"><?= (int)$it['qty'] ?></td>
                        <td class="num">৳<?= money($it['unit_price']) ?></td>
                        <td class="num">৳<?= money($it['subtotal']) ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <div class="invoice-totals">
                <div class="row"><span>সাবটোটাল</span><span>৳<?= money($sale['subtotal']) ?></span></div>
                <?php if ((float)$sale['discount'] > 0): ?>
                    <div class="row"><span>ডিসকাউন্ট<?php if (($sale['discount_type'] ?? 'fixed') === 'percent'): ?> (<?= money($sale['discount_value'] ?? 0) ?>%)<?php endif; ?></span><span>-৳<?= money($sale['discount']) ?></span></div>
                <?php endif; ?>
                <?php if (!empty($sale['below_cost_approved'])): ?>
                    <div class="row" style="color:var(--danger);"><span><i class="bi bi-exclamation-triangle-fill"></i> ক্রয়মূল্যের নিচে (লোকসানে) বিক্রি — অনুমোদিত</span><span></span></div>
                <?php endif; ?>
                <div class="grand"><span>সর্বমোট</span><span>৳<?= money($sale['total_amount']) ?></span></div>
                <div class="row strong"><span>পরিশোধিত (<?= e($sale['payment_method']) ?>)</span><span>৳<?= money($sale['paid_amount']) ?></span></div>
                <?php if ((float)$sale['due_amount'] > 0): ?>
                    <div class="row strong"><span>এই ইনভয়েসের বাকি</span><span>৳<?= money($sale['due_amount']) ?></span></div>
                <?php endif; ?>
                <?php if (abs($previousBalanceDisplay) > 0.004): ?>
                    <?php if ($previousBalanceDisplay > 0): ?>
                        <div class="row" style="color:var(--danger);"><span>পূর্বের বাকি</span><span>৳<?= money($previousBalanceDisplay) ?></span></div>
                    <?php else: ?>
                        <div class="row" style="color:var(--success);"><span>পূর্বের জমা (অগ্রিম)</span><span>৳<?= money(abs($previousBalanceDisplay)) ?></span></div>
                    <?php endif; ?>
                    <?php if ($grandBalance > 0.004): ?>
                        <div class="row strong" style="color:var(--danger);"><span>সর্বমোট বাকি</span><span>৳<?= money($grandBalance) ?></span></div>
                    <?php elseif ($grandBalance < -0.004): ?>
                        <div class="row strong" style="color:var(--success);"><span>সর্বমোট জমা</span><span>৳<?= money(abs($grandBalance)) ?></span></div>
                    <?php endif; ?>
                <?php endif; ?>
            </div>

            <p class="invoice-thanks">ধন্যবাদ! আবার আসবেন।</p>
        </div>
        <div class="invoice-footer">
            <?php if (!empty($settings['mobile'])): ?><span><i class="bi bi-telephone"></i> <?= e($settings['mobile']) ?></span><?php endif; ?>
            <?php if ($shopWaNumber): ?><span><i class="bi bi-whatsapp" style="color:#25D366;"></i> <?= e($settings['whatsapp'] ?: $settings['mobile']) ?></span><?php endif; ?>
            <?php if (!empty($settings['email'])): ?><span><i class="bi bi-envelope"></i> <?= e($settings['email']) ?></span><?php endif; ?>
            <?php if (!empty($settings['address'])): ?><span><i class="bi bi-geo-alt"></i> <?= e($settings['address']) ?></span><?php endif; ?>
            <div class="invoice-qr-block">
                <canvas id="invoiceQr"></canvas>
                <div class="qr-caption">ইনভয়েস যাচাই করতে স্ক্যান করুন</div>
            </div>
        </div>
        <div class="invoice-wave"></div>
    </div>
    <script>
    function printInvoice(bw) {
        const doc = document.querySelector('.invoice-doc');
        if (bw) { doc.classList.add('bw-mode'); } else { doc.classList.remove('bw-mode'); }
        window.print();
    }
    window.addEventListener('afterprint', function () {
        // প্রিন্টের পর স্ক্রিনে সবসময় রঙিন ভার্সন দেখানো হবে
        document.querySelector('.invoice-doc')?.classList.remove('bw-mode');
    });

    const SHARE_TEXT = <?= json_encode($shareText, JSON_UNESCAPED_UNICODE) ?>;
    const SHARE_WA_NUMBER = <?= json_encode($shareWaNumber) ?>;
    const SHARE_SUBJECT = <?= json_encode('ইনভয়েস ' . $sale['invoice_no'] . ' — ' . ($settings['shop_name'] ?? ''), JSON_UNESCAPED_UNICODE) ?>;

    function shareInvoiceWhatsApp() {
        const base = SHARE_WA_NUMBER ? ('https://wa.me/' + SHARE_WA_NUMBER) : 'https://api.whatsapp.com/send';
        window.open(base + '?text=' + encodeURIComponent(SHARE_TEXT), '_blank');
    }

    function shareInvoiceGmail() {
        const url = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(SHARE_SUBJECT) + '&body=' + encodeURIComponent(SHARE_TEXT);
        window.open(url, '_blank');
    }

    const VERIFY_URL = <?= json_encode($verifyUrl) ?>;
    </script>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
    <script>
    (function () {
        const canvas = document.getElementById('invoiceQr');
        if (canvas && window.QRCode) {
            QRCode.toCanvas(canvas, VERIFY_URL, { width: 110, margin: 0, color: { dark: '#241B3A', light: '#00000000' } }, function (err) {
                if (err) console.error(err);
            });
        }
    })();
    </script>
    <?php
    require_once __DIR__ . '/../includes/footer.php';
    exit;
}

// ---------- ভিউ: বিক্রয় তালিকা ----------
$from = $_GET['from'] ?? date('Y-m-01');
$to   = $_GET['to'] ?? date('Y-m-d');
$search = trim($_GET['q'] ?? '');

$where = ["DATE(s.sale_date) BETWEEN ? AND ?"];
$params = [$from, $to];
if ($search !== '') {
    $where[] = "(s.invoice_no LIKE ? OR c.name LIKE ? OR c.mobile LIKE ?)";
    $like = "%$search%";
    array_push($params, $like, $like, $like);
}
if (!$isOwner) {
    $where[] = "s.created_by = ?";
    $params[] = current_user()['id'];
}
$whereSql = 'WHERE ' . implode(' AND ', $where);

$stmt = $pdo->prepare("SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON s.customer_id = c.id $whereSql ORDER BY s.id DESC LIMIT 400");
$stmt->execute($params);
$sales = $stmt->fetchAll();

$totalsStmt = $pdo->prepare("SELECT COALESCE(SUM(total_amount),0) t, COALESCE(SUM(paid_amount),0) p, COALESCE(SUM(due_amount),0) d, COUNT(*) c FROM sales s LEFT JOIN customers c2 ON s.customer_id=c2.id $whereSql");
$totalsStmt->execute($params);
$totals = $totalsStmt->fetch();

require_once __DIR__ . '/../includes/header.php';
?>
<div class="page-head">
    <form method="GET" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <input type="text" name="q" class="form-control" placeholder="ইনভয়েস / কাস্টমার খুঁজুন..." value="<?= e($search) ?>" style="width:200px;">
        <input type="date" name="from" class="form-control" value="<?= e($from) ?>">
        <input type="date" name="to" class="form-control" value="<?= e($to) ?>">
        <button class="btn btn-light btn-sm"><i class="bi bi-search"></i> খুঁজুন</button>
    </form>
    <a href="sales_pos.php" class="btn btn-primary"><i class="bi bi-cart-plus"></i> নতুন বিক্রয়</a>
</div>

<div class="row g-3" style="margin-bottom:16px;">
    <div class="col-6 col-md-3"><div class="stat-card c-purple sm"><div class="stat-label">মোট বিক্রয়</div><div class="stat-value num">৳<?= money($totals['t']) ?></div></div></div>
    <div class="col-6 col-md-3"><div class="stat-card c-success sm"><div class="stat-label">পরিশোধিত</div><div class="stat-value num">৳<?= money($totals['p']) ?></div></div></div>
    <div class="col-6 col-md-3"><div class="stat-card c-orange sm"><div class="stat-label">বাকি</div><div class="stat-value num">৳<?= money($totals['d']) ?></div></div></div>
    <div class="col-6 col-md-3"><div class="stat-card c-yellow sm"><div class="stat-label">ইনভয়েস সংখ্যা</div><div class="stat-value num"><?= (int)$totals['c'] ?></div></div></div>
</div>

<div class="table-wrap">
    <table class="data-table">
        <thead><tr><th>ইনভয়েস</th><th>কাস্টমার</th><th>তারিখ</th><th>মেথড</th><th class="num">মোট</th><th class="num">বাকি</th><th></th><th></th></tr></thead>
        <tbody>
        <?php if (empty($sales)): ?>

            <tr><td colspan="8"><div class="empty-state"><i class="bi bi-receipt"></i>এই সময়ে কোনো বিক্রয় নেই।</div></td></tr>
        <?php endif; ?>
        <?php foreach ($sales as $s): ?>
            <tr>
                <td><a href="sales_list.php?view=show&id=<?= $s['id'] ?>"><?= e($s['invoice_no']) ?></a></td>
                <td><?= e($s['customer_name'] ?? 'ওয়াক-ইন') ?></td>
                <td><?= date('d M Y, h:i A', strtotime($s['sale_date'])) ?></td>
                <td><?= e($s['payment_method']) ?></td>
                <td class="num">৳<?= money($s['total_amount']) ?></td>
                <td class="num"><?= $s['due_amount'] > 0 ? '<span class="badge badge-danger">৳'.money($s['due_amount']).'</span>' : '৳০.০০' ?></td>
                <td><a href="sales_list.php?view=show&id=<?= $s['id'] ?>" class="btn btn-sm btn-light"><i class="bi bi-eye"></i></a></td>
                <td><a href="sales_return.php?sale_id=<?= $s['id'] ?>" class="btn btn-sm btn-light"><i class="bi bi-arrow-counterclockwise"></i></a></td>
            </tr>
        <?php endforeach; ?>

        </tbody>
    </table>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
