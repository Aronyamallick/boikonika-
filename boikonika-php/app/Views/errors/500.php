<div class="container error-page">
  <p class="code" aria-hidden="true">500</p>
  <h1><?= __('errors.500Title') ?></h1>
  <p class="muted"><?= __('errors.500Text') ?></p>
  <?php if (!empty($ref)): ?><p class="small subtle"><?= __('errors.reference', ['ref' => $ref]) ?></p><?php endif; ?>
</div>
