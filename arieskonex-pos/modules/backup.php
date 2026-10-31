<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_owner();

$backupDir = APP_ROOT . '/backups';
if (!is_dir($backupDir)) mkdir($backupDir, 0755, true);

/**
 * সম্পূর্ণ ডাটাবেজের একটি বিশুদ্ধ PHP SQL ডাম্প তৈরি করে (shell_exec / mysqldump
 * ছাড়াই — অনেক শেয়ার্ড cPanel হোস্টিং-এ এগুলো নিষ্ক্রিয় থাকে)।
 */
function generate_sql_dump(PDO $pdo, string $dbName): string {
    $out = "-- মল্লিক বুক হাউজ এন্ড কম্পিউটার — ব্যাকআপ\n-- তৈরি: " . date('Y-m-d H:i:s') . "\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n";
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        $out .= "-- --------------------------------------------------\n-- টেবিল: $table\n-- --------------------------------------------------\n";
        $createRow = $pdo->query("SHOW CREATE TABLE `$table`")->fetch();
        $out .= "DROP TABLE IF EXISTS `$table`;\n" . $createRow['Create Table'] . ";\n\n";

        $rows = $pdo->query("SELECT * FROM `$table`")->fetchAll();
        if ($rows) {
            $cols = array_keys($rows[0]);
            $colList = '`' . implode('`,`', $cols) . '`';
            $chunks = array_chunk($rows, 200);
            foreach ($chunks as $chunk) {
                $valueSql = [];
                foreach ($chunk as $row) {
                    $vals = array_map(function ($v) use ($pdo) {
                        return $v === null ? 'NULL' : $pdo->quote($v);
                    }, array_values($row));
                    $valueSql[] = '(' . implode(',', $vals) . ')';
                }
                $out .= "INSERT INTO `$table` ($colList) VALUES\n" . implode(",\n", $valueSql) . ";\n";
            }
            $out .= "\n";
        }
    }
    $out .= "SET FOREIGN_KEY_CHECKS=1;\n";
    return $out;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'create_backup') {
    csrf_verify();
    $sql = generate_sql_dump($pdo, DB_NAME);
    $fname = 'backup_' . date('Ymd_His') . '.sql';
    file_put_contents($backupDir . '/' . $fname, $sql);
    $stmt = $pdo->prepare("INSERT INTO backup_log (file_name, file_size, created_by) VALUES (?,?,?)");
    $stmt->execute([$fname, strlen($sql), current_user()['id']]);
    log_activity($pdo, 'নতুন ডাটা ব্যাকআপ তৈরি: ' . $fname);
    flash_set('ব্যাকআপ সফলভাবে তৈরি হয়েছে।');
    redirect('backup.php');
}

if (isset($_GET['download'])) {
    $fname = basename($_GET['download']);
    $path = $backupDir . '/' . $fname;
    if (is_file($path) && pathinfo($path, PATHINFO_EXTENSION) === 'sql') {
        header('Content-Type: application/sql');
        header('Content-Disposition: attachment; filename="' . $fname . '"');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }
    flash_set('ব্যাকআপ ফাইল খুঁজে পাওয়া যায়নি।', 'danger');
    redirect('backup.php');
}

if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    $stmt = $pdo->prepare("SELECT * FROM backup_log WHERE id=?");
    $stmt->execute([$id]);
    $b = $stmt->fetch();
    if ($b) {
        @unlink($backupDir . '/' . $b['file_name']);
        $pdo->prepare("DELETE FROM backup_log WHERE id=?")->execute([$id]);
        flash_set('ব্যাকআপ মুছে ফেলা হয়েছে।');
    }
    redirect('backup.php');
}

$backups = $pdo->query("SELECT bl.*, u.name AS created_by_name FROM backup_log bl LEFT JOIN users u ON bl.created_by = u.id ORDER BY bl.id DESC")->fetchAll();

$pageTitle = 'ডাটা ব্যাকআপ';
$activeNav = 'backup';
require_once __DIR__ . '/../includes/header.php';
?>
<div class="row g-3">
    <div class="col-lg-4">
        <div class="card" style="padding:20px;">
            <h3 style="margin-top:0;"><i class="bi bi-cloud-arrow-down"></i> নতুন ব্যাকআপ</h3>
            <p style="font-size:13.5px;color:var(--text-secondary);">সম্পূর্ণ ডাটাবেজের একটি .sql ফাইল তৈরি হবে যা ডাউনলোড করে নিরাপদে সংরক্ষণ (যেমন গুগল ড্রাইভ) করতে পারবেন। কম্পিউটার বা সার্ভার নষ্ট হলেও এই ফাইল দিয়ে সব হিসাব ফিরিয়ে আনা যাবে।</p>
            <form method="POST">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="create_backup">
                <button class="btn btn-primary btn-block" type="submit"><i class="bi bi-download"></i> এখনই ব্যাকআপ তৈরি করুন</button>
            </form>
        </div>
    </div>
    <div class="col-lg-8">
        <div class="table-wrap">
            <table class="data-table">
                <thead><tr><th>ফাইল</th><th>সাইজ</th><th>তৈরি করেছেন</th><th>সময়</th><th></th></tr></thead>
                <tbody>
                <?php if (empty($backups)): ?>
                    <tr><td colspan="5"><div class="empty-state"><i class="bi bi-cloud"></i>এখনো কোনো ব্যাকআপ তৈরি হয়নি।</div></td></tr>
                <?php endif; ?>
                <?php foreach ($backups as $b): ?>
                    <tr>
                        <td class="num"><?= e($b['file_name']) ?></td>
                        <td class="num"><?= round($b['file_size'] / 1024, 1) ?> KB</td>
                        <td><?= e($b['created_by_name'] ?? '—') ?></td>
                        <td><?= time_ago_bn($b['created_at']) ?></td>
                        <td style="display:flex;gap:6px;">
                            <a href="backup.php?download=<?= urlencode($b['file_name']) ?>" class="btn btn-sm btn-light"><i class="bi bi-download"></i></a>
                            <a href="backup.php?delete=<?= $b['id'] ?>" class="btn btn-sm btn-light" onclick="return confirm('এই ব্যাকআপ মুছে ফেলবেন?');"><i class="bi bi-trash"></i></a>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
