<h1><?= __('security.title') ?></h1>
<section class="card">
  <h2><?= __('security.changePassword') ?></h2>
  <form method="post" action="<?= e(url('account/security/password')) ?>" class="form">
    <?= csrf_field() ?>
    <?= form_input('current_password', t('security.currentPassword'), ['type' => 'password', 'required' => true, 'autocomplete' => 'current-password']) ?>
    <?= form_input('password', t('auth.newPassword'), ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password', 'hint' => t('auth.passwordHint')]) ?>
    <?= form_input('password_confirmation', t('auth.confirmPassword'), ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password']) ?>
    <?= submit_button(t('security.changePassword')) ?>
  </form>
</section>

<section class="card" id="two-step">
  <h2><?= __('auth.twoStepTitle') ?></h2>
  <?php if ($recovery): ?>
    <div class="alert alert-warning"><?= icon('key') ?><div><strong><?= __('security.saveCodes') ?></strong><p class="small mb-0"><?= __('security.saveCodesText') ?></p></div></div>
    <ul class="codes-list"><?php foreach ($recovery as $c): ?><li><?= e($c) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>
  <?php if ($user['totp_enabled_at']): ?>
    <p><span class="badge badge-success"><?= icon('shield', 'icon icon-sm') ?><?= __('security.on') ?></span> <span class="small muted"><?= e(t('security.onSince', ['date' => fdate($user['totp_enabled_at'])])) ?> · <?= e(tn('security.codesLeft', $codesLeft)) ?></span></p>
    <details class="disclosure">
      <summary><?= __('security.turnOff') ?></summary>
      <form method="post" action="<?= e(url('account/security/two-step/disable')) ?>" class="form">
        <?= csrf_field() ?>
        <?= form_input('current_password', t('security.currentPassword'), ['type' => 'password', 'required' => true, 'id' => 'f-pw-2fa', 'error' => error_for('current_password_2fa'), 'autocomplete' => 'current-password']) ?>
        <?= submit_button(t('security.turnOff'), 'btn btn-danger-outline') ?>
      </form>
    </details>
  <?php elseif ($setupSecret): ?>
    <ol>
      <li><?= __('security.step1') ?></li>
      <li><?= __('security.step2') ?><div class="secret-box mt-1 mb-1"><?= e(\App\Services\Totp::pretty($setupSecret)) ?></div><p class="small"><a href="<?= e($setupUri) ?>"><?= __('security.openApp') ?></a></p></li>
      <li><?= __('security.step3') ?></li>
    </ol>
    <form method="post" action="<?= e(url('account/security/two-step/confirm')) ?>" class="form">
      <?= csrf_field() ?>
      <?= form_input('code', t('auth.authCode'), ['required' => true, 'autocomplete' => 'one-time-code', 'attrs' => ['inputmode' => 'numeric', 'maxlength' => 6, 'class' => 'code-input']]) ?>
      <?= submit_button(t('security.turnOn')) ?>
    </form>
  <?php else: ?>
    <p class="muted"><?= __('security.twoStepIntro') ?></p>
    <form method="post" action="<?= e(url('account/security/two-step/start')) ?>"><?= csrf_field() ?><button class="btn btn-secondary" type="submit"><?= icon('shield') ?><?= __('security.setUp') ?></button></form>
  <?php endif; ?>
</section>

<section class="card">
  <div class="card-head"><h2><?= __('security.devices') ?></h2>
    <?php if (count($sessions) > 1): ?><form method="post" action="<?= e(url('account/security/sessions/revoke-others')) ?>"><?= csrf_field() ?><button class="btn btn-outline btn-sm" type="submit"><?= __('security.signOutOthers') ?></button></form><?php endif; ?>
  </div>
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('security.device') ?></th><th><?= __('security.lastActive') ?></th><th></th></tr></thead>
    <tbody>
    <?php foreach ($sessions as $s): ?>
      <tr>
        <td><?= icon(preg_match('/Mobile|Android|iPhone/i', (string) $s['user_agent']) ? 'phone-device' : 'monitor') ?> <?= e(\App\Services\Devices::describe((string) $s['user_agent'])) ?><br><span class="small subtle mono"><?= e($s['ip']) ?></span></td>
        <td class="small"><?= e(ago($s['last_seen_at'])) ?></td>
        <td class="right"><?php if ((int) $s['id'] === $current): ?><span class="badge badge-primary"><?= __('security.thisDevice') ?></span><?php else: ?><form method="post" action="<?= e(url('account/security/sessions/' . $s['id'] . '/revoke')) ?>"><?= csrf_field() ?><button class="link-btn danger small" type="submit"><?= __('security.signOut') ?></button></form><?php endif; ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
</section>

<section class="card">
  <h2><?= __('security.history') ?></h2>
  <div class="table-wrap"><table class="table">
    <thead><tr><th><?= __('common.date') ?></th><th><?= __('security.device') ?></th><th><?= __('common.status') ?></th></tr></thead>
    <tbody>
    <?php foreach ($history as $h): ?>
      <tr><td class="small nowrap"><?= e(fdate($h['created_at'], 'datetime')) ?></td><td class="small"><?= e(\App\Services\Devices::describe((string) $h['user_agent'])) ?> · <span class="mono"><?= e($h['ip']) ?></span></td><td><?= $h['success'] ? '<span class="badge badge-success">' . __('security.success') . '</span>' : '<span class="badge badge-danger">' . __('security.failed') . '</span>' ?></td></tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
</section>
