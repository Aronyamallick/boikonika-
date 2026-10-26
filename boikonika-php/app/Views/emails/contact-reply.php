<!--subject:<?= e(t('email.replySubject', ['subject' => $subject])) ?>-->
<p style="margin:0 0 12px;"><?= e(t('email.hello', ['name' => $name])) ?></p>
<div style="margin:0 0 16px;"><?= nl2br(e($reply)) ?></div>
<p style="margin:0 0 6px;color:#64748B;font-size:13px;"><?= e(t('email.yourMessage')) ?></p>
<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #CBD5E1;color:#64748B;font-size:13px;"><?= nl2br(e($original)) ?></blockquote>
