<h1><?= __('admin.system') ?></h1>
<div class="grid-2">
  <section class="card">
    <h2 class="h3"><?= __('admin.versions') ?></h2>
    <dl class="kv">
      <dt>Boikonika</dt><dd><?= e($version) ?></dd>
      <dt>PHP</dt><dd><?= e($php) ?></dd>
      <dt>MySQL / MariaDB</dt><dd><?= e($db) ?></dd>
      <dt><?= __('admin.extensions') ?></dt><dd><?php foreach ($extensions as $ext): ?><span class="badge <?= extension_loaded($ext) ? 'badge-success' : 'badge-danger' ?>"><?= e($ext) ?></span> <?php endforeach; ?></dd>
      <dt><?= __('admin.folders') ?></dt><dd><?php foreach ($dirs as $d => $ok): ?><span class="badge <?= $ok ? 'badge-success' : 'badge-danger' ?>"><?= e($d) ?></span> <?php endforeach; ?></dd>
    </dl>
  </section>
  <section class="card">
    <h2 class="h3"><?= __('admin.database') ?></h2>
    <p class="small"><?= e(t('admin.migrationsApplied', ['list' => implode(', ', $applied)])) ?></p>
    <?php if ($pending): ?>
      <div class="alert alert-warning"><?= icon('alert') ?><div><?= e(t('admin.migrationsPending', ['list' => implode(', ', $pending)])) ?></div></div>
      <form method="post" action="<?= e(url('admin/system/migrate')) ?>" data-confirm="<?= __('admin.backupFirst') ?>"><?= csrf_field() ?><button class="btn btn-primary" type="submit"><?= __('admin.applyMigrations') ?></button></form>
    <?php else: ?><p class="text-success small mb-0"><?= icon('check', 'icon icon-sm') ?> <?= __('admin.upToDate') ?></p><?php endif; ?>
  </section>
  <section class="card">
    <h2 class="h3"><?= __('admin.scheduledTasks') ?></h2>
    <p class="small"><?= $cronLast ? e(t('admin.cronLast', ['time' => fdate(date('Y-m-d H:i:s', $cronLast), 'datetime')])) : __('admin.cronNever') ?></p>
    <p class="small muted"><?= __('admin.cronHelp') ?></p>
    <p class="small mono">*/5 * * * * php <?= e(BK_ROOT) ?>/cron.php</p>
    <?php if ($cronKey !== ''): ?><p class="small muted"><?= __('admin.cronUrlHelp') ?><br><span class="mono"><?= e(rtrim((string) \App\Core\App::config('url'), '/')) ?>/cron.php?key=<?= e($cronKey) ?></span></p><?php endif; ?>
    <form method="post" action="<?= e(url('admin/system/cron')) ?>"><?= csrf_field() ?><button class="btn btn-outline btn-sm" type="submit"><?= __('admin.runNow') ?></button></form>
  </section>
  <section class="card">
    <h2 class="h3"><?= __('admin.emailQueue') ?></h2>
    <dl class="kv"><dt><?= __('admin.queued') ?></dt><dd><?= e(num((int) $mail['queued'])) ?></dd><dt><?= __('admin.sent24') ?></dt><dd><?= e(num((int) $mail['sent'])) ?></dd><dt><?= __('admin.failed') ?></dt><dd><?= e(num((int) $mail['failed'])) ?></dd></dl>
    <?php foreach ($failedMails as $fm): ?><p class="small text-danger mb-1"><?= e($fm['to_email']) ?> — <?= e((string) $fm['last_error']) ?></p><?php endforeach; ?>
  </section>
</div>
<section class="card">
  <h2 class="h3"><?= __('admin.recentErrors') ?></h2>
  <?php if ($logTail === ''): ?><p class="muted mb-0"><?= __('admin.noErrors') ?></p><?php else: ?><pre class="small mono" tabindex="0"><?= e($logTail) ?></pre><?php endif; ?>
  <p class="small muted mb-0"><?= __('admin.logsHelp') ?></p>
</section>
