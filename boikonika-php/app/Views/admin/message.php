<p class="small mb-1"><a href="<?= e(url('admin/messages')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('admin.messages') ?></a></p>
<h1><?= e($m['subject']) ?></h1>
<section class="card">
  <p class="small muted"><?= e($m['name']) ?> · <a href="mailto:<?= e($m['email']) ?>"><?= e($m['email']) ?></a><?= $m['phone'] ? ' · ' . e(digits($m['phone'])) : '' ?> · <?= __('contact.topics.' . $m['topic']) ?> · <?= e(fdate($m['created_at'], 'datetime')) ?><?= $m['user_id'] ? ' · <a href="' . e(url('admin/users/' . $m['user_id'])) . '">' . __('admin.account') . '</a>' : '' ?></p>
  <p class="mb-0"><?= nl2br(e($m['message'])) ?></p>
</section>
<?php if ($m['reply']): ?><section class="card"><h2 class="h3"><?= __('admin.reply') ?> · <span class="small subtle"><?= e(fdate($m['replied_at'], 'datetime')) ?></span></h2><p class="mb-0"><?= nl2br(e($m['reply'])) ?></p></section><?php endif; ?>
<form method="post" action="<?= e(url('admin/messages/' . $m['id'])) ?>" class="card form">
  <?= csrf_field() ?>
  <?= form_textarea('reply', t('admin.replyByEmail'), ['rows' => 6]) ?>
  <div class="row"><button class="btn btn-primary" type="submit" name="action" value="reply"><?= __('admin.sendReply') ?></button><button class="btn btn-outline" type="submit" name="action" value="close" formnovalidate><?= __('admin.closeMessage') ?></button></div>
</form>
