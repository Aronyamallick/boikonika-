<?php $email = setting('site.email'); $phone = setting('site.phone'); $address = setting('site.address'); ?>
<div class="container">
  <?= partial('partials/breadcrumbs', ['items' => [[t('contact.title'), null]]]) ?>
  <div class="page-head"><h1><?= __('contact.title') ?></h1><p><?= __('contact.intro') ?></p></div>
  <div class="cart-layout mt-2">
    <form method="post" action="<?= e(url('contact')) ?>" class="card form form-wide">
      <?= csrf_field() ?>
      <div class="grid-2">
        <?= form_input('name', t('common.name'), ['value' => $user['name'] ?? '', 'required' => true, 'autocomplete' => 'name']) ?>
        <?= form_input('email', t('common.email'), ['type' => 'email', 'value' => $user['email'] ?? '', 'required' => true, 'autocomplete' => 'email']) ?>
      </div>
      <div class="grid-2">
        <?= form_input('phone', t('common.phone'), ['type' => 'tel', 'value' => $user['phone'] ?? '', 'optional' => true, 'autocomplete' => 'tel']) ?>
        <?= form_select('topic', t('contact.topic'), ['order' => t('contact.topics.order'), 'seller' => t('contact.topics.seller'), 'account' => t('contact.topics.account'), 'copyright' => t('contact.topics.copyright'), 'other' => t('contact.topics.other')], ['value' => $orderRef !== '' ? 'order' : 'other', 'required' => true]) ?>
      </div>
      <?= form_input('subject', t('contact.subject'), ['value' => $orderRef !== '' ? t('contact.aboutOrder', ['number' => $orderRef]) : '', 'required' => true, 'attrs' => ['maxlength' => 160]]) ?>
      <?= form_textarea('message', t('contact.message'), ['required' => true, 'rows' => 6, 'attrs' => ['maxlength' => 5000]]) ?>
      <div class="hidden" aria-hidden="true"><label for="f-website">Website</label><input id="f-website" type="text" name="website" tabindex="-1" autocomplete="off"></div>
      <p class="small muted"><?= __('contact.privacy') ?></p>
      <?= submit_button(t('contact.send')) ?>
    </form>
    <aside class="card">
      <h2 class="h3"><?= __('contact.reachUs') ?></h2>
      <?php if ($email): ?><p><?= icon('mail') ?> <a href="mailto:<?= e($email) ?>"><?= e($email) ?></a></p><?php endif; ?>
      <?php if ($phone): ?><p><?= icon('phone') ?> <a href="tel:<?= e($phone) ?>"><?= e(digits($phone)) ?></a></p><?php endif; ?>
      <?php if ($address): ?><p><?= icon('map-pin') ?> <?= nl2br(e($address)) ?></p><?php endif; ?>
      <p class="small muted mb-0"><?= __('contact.hours') ?></p>
    </aside>
  </div>
</div>
