<h1><?= __('account.profile') ?></h1>
<form method="post" action="<?= e(url('account/profile')) ?>" enctype="multipart/form-data" class="card form">
  <?= csrf_field() ?>
  <div class="row mb-2">
    <span class="avatar avatar-lg"><?php if ($user['avatar_path']): ?><img src="<?= e(upload_url($user['avatar_path'])) ?>" alt=""><?php else: ?><?= e(mb_strtoupper(mb_substr($user['name'], 0, 1))) ?><?php endif; ?></span>
    <div class="grow">
      <?= form_file('avatar', t('account.photo'), ['optional' => true, 'hint' => t('account.photoHint'), 'preview' => true]) ?>
      <?php if ($user['avatar_path']): ?><label class="check small"><input type="checkbox" name="remove_avatar" value="1"><span><?= __('account.removePhoto') ?></span></label><?php endif; ?>
    </div>
  </div>
  <?= form_input('name', t('auth.name'), ['value' => $user['name'], 'required' => true, 'autocomplete' => 'name']) ?>
  <div class="field"><span class="label"><?= __('auth.email') ?></span><p class="mb-0"><?= e($user['email']) ?> <?php if ($user['email_verified_at']): ?><span class="badge badge-success"><?= __('common.verified') ?></span><?php endif; ?></p><p class="hint"><?= __('account.emailFixed') ?></p></div>
  <?= form_input('phone', t('auth.phone'), ['type' => 'tel', 'value' => $user['phone'] ?? '', 'optional' => true, 'autocomplete' => 'tel']) ?>
  <?= form_select('locale', t('account.emailLanguage'), ['bn' => 'বাংলা', 'en' => 'English'], ['value' => $user['locale']]) ?>
  <?= form_check('notify_email', t('account.notifyEmail'), (bool) $user['notify_email'], ['hint' => t('account.notifyEmailHint')]) ?>
  <?= submit_button(t('common.saveChanges')) ?>
</form>
