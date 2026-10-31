        </main>
    </div>
</div>

<?php
// মোবাইল বটম ট্যাব বার — সবচেয়ে বেশি ব্যবহৃত কয়েকটি পাতা, দ্রুত এক-ট্যাপে অ্যাক্সেসের জন্য
$bottomKeys = is_owner($user)
    ? array('dashboard', 'stock', 'sales', 'customers', 'reports')
    : array('dashboard');
if (has_permission($user, 'sales')) $bottomKeys[] = 'sales';
if (has_permission($user, 'sales_list')) $bottomKeys[] = 'sales_list';
if (has_permission($user, 'sales_return')) $bottomKeys[] = 'sales_return';
if (has_permission($user, 'customers')) $bottomKeys[] = 'customers';

$bottomItems = array();
foreach (($navItems ?? array()) as $navItem) {
    if (in_array($navItem['key'], $bottomKeys)) {
        $bottomItems[] = $navItem;
    }
}
usort($bottomItems, function ($a, $b) use ($bottomKeys) {
    return array_search($a['key'], $bottomKeys) - array_search($b['key'], $bottomKeys);
});
?>
<?php if (!empty($bottomItems) && empty($hideBottomNav)): ?>
<nav class="bottom-tabbar">
    <?php foreach ($bottomItems as $bi): ?>
        <a href="<?= e($bi['href']) ?>" class="<?= ($activeNav ?? '') === $bi['key'] ? 'active' : '' ?>">
            <i class="bi <?= e($bi['icon']) ?>"></i>
            <span><?= e($bi['label']) ?></span>
        </a>
    <?php endforeach; ?>
</nav>
<?php endif; ?>

<div id="pjaxLoader"></div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<?php if (!empty($extraScripts)) echo $extraScripts; ?>
</body>
</html>
