<h1><?= __('seller.addListing') ?></h1>
<div class="grid-2">
  <a class="card cat-tile" href="<?= e(url('seller/listings/new/book')) ?>"><?= icon('book') ?><span><?= __('seller.addBook') ?></span><span class="small muted"><?= __('seller.addBookText') ?></span></a>
  <a class="card cat-tile" href="<?= e(url('seller/listings/new/product')) ?>"><?= icon('backpack') ?><span><?= __('seller.addProduct') ?></span><span class="small muted"><?= __('seller.addProductText') ?></span></a>
</div>
