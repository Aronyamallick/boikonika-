<!--subject:<?= e($title) ?>-->
<p style="margin:0 0 12px;"><?= e(t('email.hello', ['name' => $name])) ?></p>
<p style="margin:0 0 12px;font-weight:700;font-size:17px;"><?= e($title) ?></p>
<p style="margin:0 0 20px;"><?= nl2br(e($body)) ?></p>
<?php if (!empty($link)): ?>
<p style="margin:0;"><a href="<?= e($link) ?>" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;"><?= e($button) ?></a></p>
<?php endif; ?>
