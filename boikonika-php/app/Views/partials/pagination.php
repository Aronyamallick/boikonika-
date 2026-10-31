<?php /** @var \App\Core\Paginator $pager */
if ($pager->pages <= 1) {
    return;
} ?>
<nav class="pagination" aria-label="<?= __('common.pagination') ?>">
  <?php if ($pager->page > 1): ?><a href="<?= e($pager->url($pager->page - 1)) ?>" rel="prev" aria-label="<?= __('common.previous') ?>"><?= icon('chevron-left') ?></a><?php endif; ?>
  <?php foreach ($pager->window() as $n): ?>
    <?php if ($n === null): ?><span class="gap" aria-hidden="true">…</span>
    <?php elseif ($n === $pager->page): ?><span aria-current="page"><?= e(num($n)) ?></span>
    <?php else: ?><a href="<?= e($pager->url($n)) ?>"><?= e(num($n)) ?></a><?php endif; ?>
  <?php endforeach; ?>
  <?php if ($pager->page < $pager->pages): ?><a href="<?= e($pager->url($pager->page + 1)) ?>" rel="next" aria-label="<?= __('common.next') ?>"><?= icon('chevron-right') ?></a><?php endif; ?>
</nav>
