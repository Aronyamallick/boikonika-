<div class="container auth-wrap">
  <div class="auth-card">
    <div class="card">
      <h1><?= __('auth.resetTitle') ?></h1>
      <p class="muted"><?= __('auth.resetText') ?></p>
      <form method="post" action="<?= e(url('reset-password')) ?>" novalidate>
        <?= csrf_field() ?>
        <?= form_input('code', t('auth.code'), ['required' => true, 'autocomplete' => 'one-time-code', 'attrs' => ['inputmode' => 'numeric', 'maxlength' => 6, 'class' => 'code-input', 'autofocus' => true]]) ?>
        <?= form_input('password', t('auth.newPassword'), ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password', 'hint' => t('auth.passwordHint')]) ?>
        <?= form_input('password_confirmation', t('auth.confirmPassword'), ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password']) ?>
        <?= submit_button(t('auth.resetButton'), 'btn btn-primary btn-block btn-lg') ?>
      </form>
      <p class="center small mt-2 mb-0"><a href="<?= e(url('forgot-password')) ?>"><?= __('auth.resend') ?></a></p>
    </div>
  </div>
</div>
