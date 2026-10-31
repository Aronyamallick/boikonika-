<?php $isAuthors = $kind === 'authors'; ?>
<div class="row-between mb-2">
  <h1 class="mb-0"><?= $isAuthors ? __('admin.authors') : __('admin.publishers') ?></h1>
  <a class="btn btn-primary" href="<?= e(url('admin/' . $kind . '/new')) ?>"><?= icon('plus') ?><?= $isAuthors ? __('admin.newAuthor') : __('admin.newPublisher') ?></a>
</div>
<form class="toolbar" method="get" action="<?= e(url('admin/' . $kind)) ?>" role="search">
  <div class="field"><label class="sr-only" for="nq"><?= __('common.search') ?></label><input id="nq" type="search" name="q" value="<?= e($q) ?>"></div>
  <button class="btn btn-outline" type="submit"><?= __('common.search') ?></button>
</form>
<div class="table-wrap"><table class="table">
  <thead><tr><th><?= __('common.name') ?></th><th><?= __('admin.slug') ?></th><th class="num"><?= __('nav.books') ?></th><th></th></tr></thead>
  <tbody><?php foreach ($rows as $r): ?><tr><td><?= e($r['name_bn']) ?><?= $r['name_en'] && $r['name_en'] !== $r['name_bn'] ? '<br><span class="small subtle">' . e($r['name_en']) . '</span>' : '' ?></td><td class="mono small"><?= e($r['slug']) ?></td><td class="num"><?= e(num((int) $r['books'])) ?></td><td class="right"><a class="btn btn-outline btn-sm" href="<?= e(url('admin/' . $kind . '/' . $r['id'])) ?>"><?= __('common.edit') ?></a></td></tr><?php endforeach; ?></tbody>
</table></div>
<?= partial('partials/pagination', ['pager' => $pager]) ?>
