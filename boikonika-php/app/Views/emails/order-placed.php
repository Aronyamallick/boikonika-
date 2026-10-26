<?php use App\Core\Money; ?>
<!--subject:<?= e(t('email.orderSubject', ['number' => $order['number']])) ?>-->
<p style="margin:0 0 12px;"><?= e(t('email.hello', ['name' => $name])) ?></p>
<p style="margin:0 0 16px;"><?= e($order['payment_method'] === 'cod' ? t('email.orderCod', ['number' => $order['number']]) : t('email.orderPaid', ['number' => $order['number']])) ?></p>
<?php foreach ($parcels as $p): ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:10px;margin:0 0 12px;">
  <tr><td colspan="2" style="padding:10px 12px;background:#F8FAFC;font-weight:700;"><?= e($p['store_name']) ?></td></tr>
  <?php foreach ($p['items'] as $i): ?>
  <tr><td style="padding:8px 12px;border-top:1px solid #E2E8F0;"><?= e($i['title']) ?> × <?= e(num((int) $i['quantity'])) ?></td><td style="padding:8px 12px;border-top:1px solid #E2E8F0;text-align:right;white-space:nowrap;"><?= e(money($i['line_total'])) ?></td></tr>
  <?php endforeach; ?>
  <tr><td style="padding:8px 12px;border-top:1px solid #E2E8F0;color:#475569;"><?= e(t('common.shipping')) ?></td><td style="padding:8px 12px;border-top:1px solid #E2E8F0;text-align:right;"><?= Money::toPoisha($p['shipping_fee']) === 0 ? e(t('common.free')) : e(money($p['shipping_fee'])) ?></td></tr>
</table>
<?php endforeach; ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
  <?php if (Money::toPoisha($order['discount_total']) > 0): ?><tr><td style="padding:4px 0;"><?= e(t('common.discount')) ?></td><td style="padding:4px 0;text-align:right;">−<?= e(money($order['discount_total'])) ?></td></tr><?php endif; ?>
  <tr><td style="padding:4px 0;font-weight:800;font-size:17px;"><?= e(t('common.total')) ?></td><td style="padding:4px 0;text-align:right;font-weight:800;font-size:17px;"><?= e(money($order['total'])) ?></td></tr>
  <tr><td style="padding:4px 0;color:#475569;" colspan="2"><?= e(t('status.method.' . $order['payment_method'])) ?> · <?= e(t('status.payment.' . $order['payment_status'])) ?></td></tr>
</table>
<p style="margin:0 0 6px;font-weight:700;"><?= e(t('email.deliverTo')) ?></p>
<p style="margin:0 0 20px;color:#475569;"><?= e($order['ship_name']) ?>, <?= e(digits($order['ship_phone'])) ?><br><?= e($order['ship_address']) ?>, <?= e($order['ship_area']) ?>, <?= e(\App\Services\Geo::districtName($order['ship_district'])) ?></p>
<p style="margin:0;"><a href="<?= e(abs_url('account/orders/' . $order['number'], [], $order['locale'])) ?>" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;"><?= e(t('email.trackOrder')) ?></a></p>
