<?php $s = $seller; ?>
<section class="hero">
  <div class="container hero-inner">
    <div>
      <h1><?= __('sell.title') ?></h1>
      <p class="lead"><?= __('sell.intro') ?></p>
      <?php if ($s && $s['status'] === 'approved'): ?>
        <a class="btn btn-primary btn-lg" href="<?= e(url('seller')) ?>"><?= __('nav.sellerDashboard') ?></a>
      <?php elseif ($s): ?>
        <a class="btn btn-primary btn-lg" href="<?= e(url('seller/apply')) ?>"><?= __('sell.viewApplication') ?></a>
      <?php else: ?>
        <a class="btn btn-primary btn-lg" href="<?= e(url('seller/apply')) ?>"><?= __('sell.start') ?></a>
      <?php endif; ?>
    </div>
  </div>
</section>
<section class="section"><div class="container">
  <div class="why-grid">
    <div class="card"><?= icon('users') ?><h2 class="h3"><?= __('sell.b1Title') ?></h2><p class="muted mb-0"><?= __('sell.b1Text') ?></p></div>
    <div class="card"><?= icon('percent') ?><h2 class="h3"><?= __('sell.b2Title') ?></h2><p class="muted mb-0"><?= e(t('sell.b2Text', ['percent' => num((string) (float) $commission)])) ?></p></div>
    <div class="card"><?= icon('wallet') ?><h2 class="h3"><?= __('sell.b3Title') ?></h2><p class="muted mb-0"><?= __('sell.b3Text') ?></p></div>
    <div class="card"><?= icon('book') ?><h2 class="h3"><?= __('sell.b4Title') ?></h2><p class="muted mb-0"><?= __('sell.b4Text') ?></p></div>
  </div>
</div></section>
<section class="section"><div class="container">
  <h2><?= __('sell.howTitle') ?></h2>
  <ol class="steps mt-2">
    <li><?= __('sell.how1') ?></li><li><?= __('sell.how2') ?></li><li><?= __('sell.how3') ?></li><li><?= __('sell.how4') ?></li>
  </ol>
  <div class="card mt-2">
    <h3><?= __('sell.needTitle') ?></h3>
    <ul class="mb-0"><li><?= __('sell.need1') ?></li><li><?= __('sell.need2') ?></li><li><?= __('sell.need3') ?></li></ul>
    <p class="small muted mt-2 mb-0"><?= __('sell.privacyNote') ?> <a href="<?= e(url('pages/seller-policy')) ?>"><?= __('sell.policy') ?></a></p>
  </div>
</div></section>
