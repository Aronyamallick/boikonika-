<div class="container auth-wrap">
  <div class="auth-card">
    <div class="card">
      <h1><?= __('auth.verifyTitle') ?></h1>
      <p class="muted"><?= __('auth.codeSentTo', ['target' => $target]) ?></p>
      <form method="post" action="<?= e(url('register/verify')) ?>" novalidate>
        <?= csrf_field() ?>
        <?= form_input('code', t('auth.code'), ['required' => true, 'autocomplete' => 'one-time-code', 'attrs' => ['inputmode' => 'numeric', 'maxlength' => 6, 'class' => 'code-input', 'autofocus' => true, 'pattern' => '[0-9০-৯]{6}']]) ?>
        <?= submit_button(t('auth.verify'), 'btn btn-primary btn-block btn-lg') ?>
      </form>
      <form method="post" action="<?= e(url('register/resend')) ?>" class="center mt-2">
        <?= csrf_field() ?>
        <span class="small muted"><?= __('auth.noCode') ?></span> <button class="link-btn small" type="submit"><?= __('auth.resend') ?></button>
      </form>
      <p class="center small mt-2 mb-0"><a href="<?= e(url('register')) ?>"><?= __('auth.changeEmail') ?></a></p>
    </div>
  </div>
</div>
