<?php
$badge = ['awaiting_payment' => 'badge-warning', 'placed' => 'badge-primary', 'completed' => 'badge-success', 'cancelled' => 'badge-danger'][$o['status']] ?? '';
?>
<tr>
  <td><a href="<?= e(url('account/orders/' . $o['number'])) ?>" class="mono"><?= e($o['number']) ?></a></td>
  <td class="nowrap"><?= e(fdate($o['created_at'])) ?></td>
  <td><span class="badge <?= $badge ?>"><?= e(status_label('order', $o['status'])) ?></span></td>
  <td class="small"><?= e(status_label('payment', $o['payment_status'])) ?></td>
  <td class="num"><?= e(money($o['total'])) ?></td>
</tr>
