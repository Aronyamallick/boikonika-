<div class="container auth-wrap">
  <div class="auth-card">
    <div class="card">
      <h1><?= __('auth.twoStepTitle') ?></h1>
      <p class="muted"><?= __('auth.twoStepText') ?></p>
      <form method="post" action="<?= e(url('login/two-step')) ?>" novalidate>
        <?= csrf_field() ?>
        <?= form_input('code', t('auth.authCode'), ['required' => true, 'autocomplete' => 'one-time-code', 'hint' => t('auth.recoveryHint'), 'attrs' => ['autofocus' => true, 'maxlength' => 20]]) ?>
        <?= submit_button(t('auth.verify'), 'btn btn-primary btn-block btn-lg') ?>
      </form>
      <p class="center small mt-2 mb-0"><a href="<?= e(url('login')) ?>"><?= __('auth.backToLogin') ?></a></p>
    </div>
  </div>
</div>
