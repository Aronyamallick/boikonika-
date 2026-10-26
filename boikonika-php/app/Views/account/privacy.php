<h1><?= __('privacy.title') ?></h1>
<section class="card">
  <h2><?= __('privacy.whatWeKeep') ?></h2>
  <p class="muted"><?= __('privacy.whatWeKeepText') ?></p>
  <a class="btn btn-outline" href="<?= e(url('account/privacy/export')) ?>"><?= icon('download') ?><?= __('privacy.download') ?></a>
  <p class="small muted mt-2 mb-0"><?= __('privacy.policyLink') ?> <a href="<?= e(url('pages/privacy')) ?>"><?= __('auth.privacy') ?></a></p>
</section>
<section class="card">
  <h2><?= __('privacy.deleteTitle') ?></h2>
  <p class="muted"><?= __('privacy.deleteText') ?></p>
  <?php if ($blockers): ?>
    <div class="alert alert-warning"><?= icon('alert') ?><div><strong><?= __('privacy.cannotYet') ?></strong><ul class="mb-0"><?php foreach ($blockers as $b): ?><li><?= __($b) ?></li><?php endforeach; ?></ul></div></div>
  <?php else: ?>
  <form method="post" action="<?= e(url('account/privacy/delete')) ?>" class="form" data-confirm="<?= __('privacy.confirm') ?>">
    <?= csrf_field() ?>
    <?= form_input('current_password', t('security.currentPassword'), ['type' => 'password', 'required' => true, 'autocomplete' => 'current-password']) ?>
    <?= form_input('confirm', t('privacy.typeDeleteLabel'), ['required' => true, 'attrs' => ['autocomplete' => 'off']]) ?>
    <?= submit_button(t('privacy.deleteButton'), 'btn btn-danger') ?>
  </form>
  <?php endif; ?>
</section>
