<div class="container auth-wrap">
  <div class="auth-card">
    <div class="card">
      <h1><?= __('auth.forgotTitle') ?></h1>
      <p class="muted"><?= __('auth.forgotText') ?></p>
      <form method="post" action="<?= e(url('forgot-password')) ?>" novalidate>
        <?= csrf_field() ?>
        <?= form_input('identifier', t('auth.identifier'), ['required' => true, 'autocomplete' => 'username', 'attrs' => ['autofocus' => true]]) ?>
        <?= submit_button(t('auth.sendCode'), 'btn btn-primary btn-block btn-lg') ?>
      </form>
      <p class="center small mt-2 mb-0"><a href="<?= e(url('login')) ?>"><?= __('auth.backToLogin') ?></a></p>
    </div>
  </div>
</div>
