<div class="container error-page">
  <p class="code" aria-hidden="true"><?= e(digits((string) $status)) ?></p>
  <h1><?= __('errors.' . $status . 'Title') ?></h1>
  <p class="muted"><?= __('errors.' . $status . 'Text') ?></p>
  <?php if (!empty($ref)): ?><p class="small subtle"><?= __('errors.reference', ['ref' => $ref]) ?></p><?php endif; ?>
  <p class="mt-3"><a class="btn btn-primary" href="<?= e(url()) ?>"><?= __('common.goHome') ?></a></p>
</div>
