<?php use App\Core\Crypto; ?>
<p class="small mb-1"><a href="<?= e(url('admin/sellers')) ?>"><?= icon('chevron-left', 'icon icon-sm') ?> <?= __('admin.sellers') ?></a></p>
<div class="row-between mb-2"><h1 class="mb-0"><?= e($s['store_name']) ?></h1><span class="badge<?= $s['status'] === 'approved' ? ' badge-success' : ($s['status'] === 'pending' ? ' badge-warning' : ' badge-danger') ?>"><?= e(status_label('seller', $s['status'])) ?></span></div>
<div class="grid-2">
  <section class="card">
    <dl class="kv">
      <dt><?= __('admin.owner') ?></dt><dd><a href="<?= e(url('admin/users/' . $s['user_id'])) ?>"><?= e($s['owner']) ?></a><br><span class="small"><?= e((string) $s['owner_email']) ?> · <?= e(digits((string) $s['owner_phone'])) ?></span></dd>
      <dt><?= __('sell.businessType') ?></dt><dd><?= __('sell.types.' . $s['business_type']) ?><?= $s['business_name'] ? ' · ' . e($s['business_name']) : '' ?></dd>
      <dt><?= __('common.phone') ?></dt><dd><?= e(digits($s['phone'])) ?></dd>
      <dt><?= __('sell.storeEmail') ?></dt><dd><?= e((string) $s['email']) ?></dd>
      <dt><?= __('sell.pickupAddress') ?></dt><dd><?= nl2br(e($s['address'])) ?>, <?= e(\App\Services\Geo::districtName($s['district'])) ?></dd>
      <dt><?= __('admin.applied') ?></dt><dd><?= e(fdate($s['created_at'], 'datetime')) ?></dd>
      <?php if ($s['review_note']): ?><dt><?= __('admin.note') ?></dt><dd><?= e($s['review_note']) ?></dd><?php endif; ?>
    </dl>
    <?php if ($s['description']): ?><p class="small muted mt-2 mb-0"><?= e($s['description']) ?></p><?php endif; ?>
    <?php if ($s['status'] === 'approved'): ?><p class="mt-2 mb-0"><a href="<?= e(url('stores/' . $s['slug'])) ?>"><?= __('seller.viewShop') ?> <?= icon('external', 'icon icon-sm') ?></a></p><?php endif; ?>
  </section>
  <section class="card">
    <h2 class="h3"><?= __('admin.decision') ?></h2>
    <form method="post" action="<?= e(url('admin/sellers/' . $s['id'] . '/review')) ?>">
      <?= csrf_field() ?>
      <?= form_textarea('note', t('admin.noteToSeller'), ['rows' => 2, 'hint' => t('admin.noteToSellerHint')]) ?>
      <div class="row">
        <?php if (in_array($s['status'], ['pending', 'rejected'], true)): ?><button class="btn btn-primary" type="submit" name="action" value="approve"><?= __('admin.approve') ?></button><?php endif; ?>
        <?php if ($s['status'] === 'pending'): ?><button class="btn btn-danger-outline" type="submit" name="action" value="reject"><?= __('admin.reject') ?></button><?php endif; ?>
        <?php if ($s['status'] === 'approved'): ?><button class="btn btn-danger-outline" type="submit" name="action" value="suspend"><?= __('admin.suspend') ?></button><?php endif; ?>
        <?php if ($s['status'] === 'suspended'): ?><button class="btn btn-primary" type="submit" name="action" value="reinstate"><?= __('admin.reinstate') ?></button><?php endif; ?>
      </div>
    </form>
    <h2 class="h3 mt-3"><?= __('admin.commission') ?></h2>
    <form method="post" action="<?= e(url('admin/sellers/' . $s['id'] . '/commission')) ?>" class="row">
      <?= csrf_field() ?>
      <label class="sr-only" for="cp"><?= __('admin.commission') ?></label>
      <input id="cp" name="commission_percent" value="<?= e((string) $s['commission_percent']) ?>" placeholder="<?= e(t('admin.defaultPercent', ['percent' => setting('orders.commission_percent')])) ?>" inputmode="decimal">
      <button class="btn btn-outline" type="submit"><?= __('common.save') ?></button>
    </form>
    <dl class="kv mt-3">
      <dt><?= __('seller.withdrawable') ?></dt><dd><?= e(money($balance['withdrawable'])) ?></dd>
      <dt><?= __('seller.paidOut') ?></dt><dd><?= e(money($balance['paid'])) ?></dd>
      <dt><?= __('admin.parcels') ?></dt><dd><?= e(t('admin.parcelStats', ['all' => num((int) $stats['parcels']), 'delivered' => num((int) $stats['delivered']), 'cancelled' => num((int) $stats['cancelled']), 'returned' => num((int) $stats['returned'])])) ?></dd>
    </dl>
  </section>
</div>
<section class="card">
  <h2 class="h3"><?= icon('lock') ?> <?= __('admin.identity') ?></h2>
  <p class="small muted"><?= __('admin.identityHint') ?></p>
  <?php if (!$docs): ?><p class="muted mb-0"><?= __('admin.noDocs') ?></p><?php endif; ?>
  <?php foreach ($docs as $d): ?>
    <p><strong><?= __('sell.docs.' . $d['doc_type']) ?></strong> ·
      <?php if ($d['number'] !== null): ?><span class="mono"><?= e($d['number']) ?></span>
      <?php else: ?><span class="mono"><?= e(Crypto::mask($d['number_last4'])) ?></span> <a class="small" href="<?= e(url('admin/sellers/' . $s['id'], ['reveal' => $d['id']])) ?>"><?= __('admin.revealNumber') ?></a><?php endif; ?>
      <span class="small subtle">· <?= e(fdate($d['created_at'])) ?></span></p>
    <div class="doc-images">
      <a href="<?= e(url('admin/documents/' . $d['id'] . '/front')) ?>" target="_blank" rel="noopener"><img src="<?= e(url('admin/documents/' . $d['id'] . '/front')) ?>" alt="<?= __('sell.docFront') ?>" loading="lazy"></a>
      <?php if ($d['back_path']): ?><a href="<?= e(url('admin/documents/' . $d['id'] . '/back')) ?>" target="_blank" rel="noopener"><img src="<?= e(url('admin/documents/' . $d['id'] . '/back')) ?>" alt="<?= __('sell.docBack') ?>" loading="lazy"></a><?php endif; ?>
    </div>
  <?php endforeach; ?>
</section>
<?php if ($history): ?>
<section class="card"><h2 class="h3"><?= __('admin.audit') ?></h2>
  <ul class="timeline"><?php foreach ($history as $h): ?><li><span class="mono small"><?= e($h['action']) ?></span> <span class="small subtle"><?= e(fdate($h['created_at'], 'datetime')) ?> · <?= e((string) $h['actor']) ?></span></li><?php endforeach; ?></ul>
</section>
<?php endif; ?>
