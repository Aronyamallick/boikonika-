<div class="container auth-wrap">
  <div class="auth-card">
    <div class="card">
      <h1><?= __('auth.loginTitle') ?></h1>
      <p class="muted"><?= __('auth.loginSubtitle') ?></p>
      <form method="post" action="<?= e(url('login')) ?>" novalidate>
        <?= csrf_field() ?>
        <?= form_input('identifier', t('auth.identifier'), ['required' => true, 'autocomplete' => 'username', 'attrs' => ['autofocus' => true, 'maxlength' => 191]]) ?>
        <?= form_input('password', t('auth.password'), ['type' => 'password', 'required' => true, 'autocomplete' => 'current-password']) ?>
        <div class="row-between mb-2">
          <label class="check"><input type="checkbox" name="remember" value="1"><span><?= __('auth.remember') ?></span></label>
          <a class="small" href="<?= e(url('forgot-password')) ?>"><?= __('auth.forgot') ?></a>
        </div>
        <?= submit_button(t('auth.loginButton'), 'btn btn-primary btn-block btn-lg') ?>
      </form>
      <div class="divider"><?= __('common.or') ?></div>
      <p class="center mb-0"><?= __('auth.noAccount') ?> <a href="<?= e(url('register')) ?>"><?= __('auth.createAccount') ?></a></p>
    </div>
  </div>
</div>
