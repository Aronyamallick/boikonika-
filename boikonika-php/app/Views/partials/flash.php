<?php
use App\Core\Session;

$messages = Session::messages();
if (has_errors() && !$messages) {
    $messages[] = ['error', t('validation.fixErrors')];
}
if (!$messages) {
    return;
}
$icons = ['success' => 'check-circle', 'error' => 'alert', 'info' => 'info', 'warning' => 'alert'];
?>
<div class="container flash-stack" role="status" aria-live="polite">
<?php foreach ($messages as [$type, $msg]): ?>
  <div class="alert alert-<?= e($type) ?>"><?= icon($icons[$type] ?? 'info') ?><div><?= e($msg) ?></div></div>
<?php endforeach; ?>
</div>
