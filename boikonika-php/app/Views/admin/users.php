<h1><?= __('admin.users') ?></h1>
<form class="toolbar" method="get" action="<?= e(url('admin/users')) ?>" role="search">
  <div class="field"><label class="small" for="uq"><?= __('common.search') ?></label><input id="uq" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= __('admin.searchUsers') ?>"></div>
  <div class="field"><label class="small" for="ur"><?= __('admin.type') ?></label><select id="ur" name="role"><option value=""><?= __('common.all') ?></option><option value="staff"<?= selected('staff', $role) ?>><?= __('admin.staff') ?></option><option value="seller"<?= selected('seller', $role) ?>><?= __('admin.sellers') ?></option></select></div>
  <div class="field"><label class="small" for="us"><?= __('common.status') ?></label><select id="us" name="status"><option value=""><?= __('common.all') ?></option><?php foreach (['active', 'suspended', 'deleted'] as $s): ?><option value="<?= $s ?>"<?= selected($s, $status) ?>><?= e(status_label('user', $s)) ?></option><?php endforeach; ?></select></div>
  <button class="btn btn-outline" type="submit"><?= __('common.filter') ?></button>
</form>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('common.name') ?></th><th><?= __('admin.contact') ?></th><th><?= __('admin.roles') ?></th><th><?= __('common.status') ?></th><th class="num"><?= __('admin.orders') ?></th><th><?= __('admin.joined') ?></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $u): ?>
    <tr>
      <td><a href="<?= e(url('admin/users/' . $u['id'])) ?>"><?= e($u['name']) ?></a><?php if ($u['store']): ?><br><span class="small subtle"><?= icon('store', 'icon icon-sm') ?> <?= e($u['store']) ?></span><?php endif; ?></td>
      <td class="small"><?= e((string) $u['email']) ?><br><?= e(digits((string) $u['phone'])) ?></td>
      <td class="small"><?php foreach (array_filter(explode(',', (string) $u['roles'])) as $r): ?><span class="badge badge-primary"><?= __('admin.role.' . $r) ?></span> <?php endforeach; ?></td>
      <td><span class="badge<?= $u['status'] === 'suspended' ? ' badge-danger' : '' ?>"><?= e(status_label('user', $u['status'])) ?></span></td>
      <td class="num"><?= e(num((int) $u['orders'])) ?></td>
      <td class="small nowrap"><?= e(fdate($u['created_at'])) ?></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
