<h1><?= __('admin.audit') ?></h1>
<form class="toolbar" method="get" action="<?= e(url('admin/audit')) ?>" role="search">
  <div class="field"><label class="sr-only" for="aq"><?= __('common.search') ?></label><input id="aq" type="search" name="q" value="<?= e($q) ?>" placeholder="<?= __('admin.searchAudit') ?>"></div>
  <button class="btn btn-outline" type="submit"><?= __('common.search') ?></button>
</form>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('common.date') ?></th><th><?= __('admin.who') ?></th><th><?= __('admin.action') ?></th><th><?= __('admin.what') ?></th><th>IP</th></tr></thead>
  <tbody><?php foreach ($rows as $r): ?><tr>
    <td class="small nowrap"><?= e(fdate($r['created_at'], 'datetime')) ?></td>
    <td class="small"><?= $r['actor'] ? e($r['actor']) : '<span class="subtle">' . __('admin.systemActor') . '</span>' ?></td>
    <td class="mono small"><?= e($r['action']) ?></td>
    <td class="small"><?= e(trim($r['entity_type'] . ' ' . $r['entity_id'])) ?><?php if ($r['details']): ?><br><span class="subtle mono"><?= e(mb_substr($r['details'], 0, 160)) ?></span><?php endif; ?></td>
    <td class="mono small"><?= e((string) $r['ip']) ?></td>
  </tr><?php endforeach; ?></tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
