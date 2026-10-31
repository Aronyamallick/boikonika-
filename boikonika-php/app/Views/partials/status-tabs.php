<?php /** $base, $tabs (value => label), $current, $counts?, $keep (extra query) */ ?>
<div class="status-tabs">
<?php foreach ($tabs as $k => $v): ?>
  <a class="chip" href="<?= e(url($base, array_filter(($keep ?? []) + ['status' => $k]))) ?>"<?= (string) $current === (string) $k ? ' aria-current="page"' : '' ?>><?= e($v) ?><?php if ($k !== '' && !empty($counts[$k])): ?> <span class="badge"><?= e(num($counts[$k])) ?></span><?php endif; ?></a>
<?php endforeach; ?>
</div>
