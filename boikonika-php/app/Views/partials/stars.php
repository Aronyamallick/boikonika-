<?php $r = (int) round((float) $rating); ?>
<span class="rating" role="img" aria-label="<?= e(t('catalog.stars', ['rating' => num($r)])) ?>"><?php for ($i = 1; $i <= 5; $i++): ?><?= icon('star', $i <= $r ? 'icon icon-fill' : 'icon') ?><?php endfor; ?></span>
