<!doctype html>
<html lang="<?= e($locale) ?>">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title><?= e($subject) ?></title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Noto Sans Bengali','Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;">
      <tr><td style="padding:20px 24px;border-bottom:1px solid #E2E8F0;">
        <a href="<?= e(abs_url('', [], $locale)) ?>" style="text-decoration:none;color:#2563EB;font-weight:800;font-size:20px;"><?= e(\App\Core\Settings::get('site.name_' . $locale)) ?></a>
      </td></tr>
      <tr><td style="padding:24px;font-size:15px;line-height:1.65;"><?= $content ?></td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B;line-height:1.6;">
        <?= e(t('email.footer')) ?><br>
        <a href="<?= e(abs_url('account/profile', [], $locale)) ?>" style="color:#64748B;"><?= e(t('email.preferences')) ?></a> · <?= e(t('common.developedBy')) ?>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
