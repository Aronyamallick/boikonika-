<?php use App\Core\Auth; ?>
<p class="small mb-1"><a href="<?= e(url('admin/users')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('admin.users') ?></a></p>
<div class="row-between mb-2"><h1 class="mb-0"><?= e($u['name']) ?></h1><span class="badge<?= $u['status'] === 'suspended' ? ' badge-danger' : '' ?>"><?= e(status_label('user', $u['status'])) ?></span></div>
<div class="grid-2">
  <section class="card">
    <dl class="kv">
      <dt><?= __('common.email') ?></dt><dd><?= e((string) $u['email']) ?> <?php if ($u['email_verified_at']): ?><span class="badge badge-success"><?= __('common.verified') ?></span><?php endif; ?></dd>
      <dt><?= __('common.phone') ?></dt><dd><?= e(digits((string) $u['phone'])) ?></dd>
      <dt><?= __('admin.joined') ?></dt><dd><?= e(fdate($u['created_at'], 'datetime')) ?></dd>
      <dt><?= __('admin.lastLogin') ?></dt><dd><?= e(fdate($u['last_login_at'], 'datetime')) ?> <span class="mono small"><?= e((string) $u['last_login_ip']) ?></span></dd>
      <dt><?= __('auth.twoStepTitle') ?></dt><dd><?= $u['totp_enabled_at'] ? __('security.on') : __('common.no') ?></dd>
      <?php if ($u['suspended_reason']): ?><dt><?= __('common.reason') ?></dt><dd><?= e($u['suspended_reason']) ?></dd><?php endif; ?>
      <?php if ($seller): ?><dt><?= __('admin.store') ?></dt><dd><a href="<?= e(url('admin/sellers/' . $seller['id'])) ?>"><?= e($seller['store_name']) ?></a> · <?= e(status_label('seller', $seller['status'])) ?></dd><?php endif; ?>
    </dl>
    <?php if ($u['locked_until'] && strtotime($u['locked_until']) > time() && can('users.manage')): ?>
      <form method="post" action="<?= e(url('admin/users/' . $u['id'] . '/unlock')) ?>" class="mt-2"><?= csrf_field() ?><button class="btn btn-outline btn-sm" type="submit"><?= __('admin.unlock') ?></button></form>
    <?php endif; ?>
  </section>
  <section class="card">
    <?php if (can('users.manage') && $u['status'] !== 'deleted' && (int) $u['id'] !== Auth::id()): ?>
      <h2 class="h3"><?= $u['status'] === 'active' ? __('admin.suspendUser') : __('admin.reactivateUser') ?></h2>
      <form method="post" action="<?= e(url('admin/users/' . $u['id'] . '/status')) ?>" data-confirm="<?= __('common.areYouSure') ?>">
        <?= csrf_field() ?>
        <input type="hidden" name="status" value="<?= $u['status'] === 'active' ? 'suspended' : 'active' ?>">
        <?php if ($u['status'] === 'active'): ?><?= form_input('reason', t('common.reason'), ['required' => true]) ?><?php endif; ?>
        <button class="btn <?= $u['status'] === 'active' ? 'btn-danger-outline' : 'btn-outline' ?>" type="submit"><?= $u['status'] === 'active' ? __('admin.suspendUser') : __('admin.reactivateUser') ?></button>
      </form>
    <?php endif; ?>
    <?php if (can('roles.manage')): ?>
      <h2 class="h3 mt-3"><?= __('admin.staffRoles') ?></h2>
      <form method="post" action="<?= e(url('admin/users/' . $u['id'] . '/roles')) ?>">
        <?= csrf_field() ?>
        <?php foreach (Auth::STAFF_ROLES as $r): ?><label class="check mb-1"><input type="checkbox" name="roles[]" value="<?= $r ?>"<?= checked(in_array($r, $roles, true)) ?>><span><strong><?= __('admin.role.' . $r) ?></strong> <span class="small muted">— <?= __('admin.roleHint.' . $r) ?></span></span></label><?php endforeach; ?>
        <button class="btn btn-outline mt-1" type="submit"><?= __('common.save') ?></button>
      </form>
    <?php endif; ?>
  </section>
</div>
<section class="card"><h2 class="h3"><?= __('admin.orders') ?></h2>
  <?php if (!$orders): ?><p class="muted mb-0"><?= __('common.empty') ?></p><?php else: ?>
  <div class="table-wrap"><table class="table"><tbody><?php foreach ($orders as $o): ?><tr><td><a class="mono" href="<?= e(url('admin/orders/' . $o['number'])) ?>"><?= e($o['number']) ?></a></td><td class="small"><?= e(fdate($o['created_at'])) ?></td><td><?= e(status_label('order', $o['status'])) ?></td><td class="num"><?= e(money($o['total'])) ?></td></tr><?php endforeach; ?></tbody></table></div>
  <?php endif; ?>
</section>
<section class="card"><h2 class="h3"><?= __('security.history') ?></h2>
  <div class="table-wrap"><table class="table"><tbody><?php foreach ($logins as $l): ?><tr><td class="small"><?= e(fdate($l['created_at'], 'datetime')) ?></td><td class="small"><?= e(\App\Services\Devices::describe((string) $l['user_agent'])) ?></td><td class="mono small"><?= e((string) $l['ip']) ?></td><td><?= $l['success'] ? __('security.success') : __('security.failed') ?></td></tr><?php endforeach; ?></tbody></table></div>
</section>
