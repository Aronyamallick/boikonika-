<!--subject:<?= e($purpose === 'reset' ? t('email.resetSubject') : t('email.verifySubject')) ?>-->
<p style="margin:0 0 12px;"><?= e(t('email.hello', ['name' => $name])) ?></p>
<p style="margin:0 0 16px;"><?= e($purpose === 'reset' ? t('email.resetText') : t('email.verifyText')) ?></p>
<p style="margin:0 0 16px;font-size:32px;font-weight:800;letter-spacing:8px;color:#0F172A;background:#F1F5F9;border-radius:10px;padding:14px;text-align:center;"><?= e($code) ?></p>
<p style="margin:0 0 8px;color:#475569;"><?= e(t('email.codeExpires', ['minutes' => digits((string) $minutes)])) ?></p>
<p style="margin:0;color:#475569;"><?= e(t('email.notYou')) ?></p>
