<div class="container auth-wrap">
  <div class="auth-card">
    <div class="card">
      <h1><?= __('auth.registerTitle') ?></h1>
      <p class="muted"><?= __('auth.registerSubtitle') ?></p>
      <form method="post" action="<?= e(url('register')) ?>" novalidate>
        <?= csrf_field() ?>
        <?= form_input('name', t('auth.name'), ['required' => true, 'autocomplete' => 'name', 'attrs' => ['maxlength' => 120]]) ?>
        <?= form_input('email', t('auth.email'), ['type' => 'email', 'required' => true, 'autocomplete' => 'email', 'hint' => t('auth.emailHint')]) ?>
        <?= form_input('phone', t('auth.phone'), ['type' => 'tel', 'optional' => true, 'autocomplete' => 'tel', 'hint' => t('auth.phoneHint'), 'attrs' => ['inputmode' => 'tel']]) ?>
        <?= form_input('password', t('auth.password'), ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password', 'hint' => t('auth.passwordHint')]) ?>
        <?= form_input('password_confirmation', t('auth.confirmPassword'), ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password']) ?>
        <?= form_check('agree', '', false, ['html' => __('auth.agreePrefix') . ' <a href="' . e(url('pages/terms')) . '" target="_blank">' . __('auth.terms') . '</a> ' . __('common.and') . ' <a href="' . e(url('pages/privacy')) . '" target="_blank">' . __('auth.privacy') . '</a>' . __('auth.agreeSuffix')]) ?>
        <?= submit_button(t('auth.registerButton'), 'btn btn-primary btn-block btn-lg') ?>
      </form>
      <div class="divider"><?= __('common.or') ?></div>
      <p class="center mb-0"><?= __('auth.haveAccount') ?> <a href="<?= e(url('login')) ?>"><?= __('nav.login') ?></a></p>
    </div>
  </div>
</div>
