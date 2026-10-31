<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Audit;
use App\Core\DB;
use App\Core\Money;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;

/** Coupons and delivery methods. */
final class StoreSetupController
{
    use AdminPage;

    public function coupons(Request $req): Response
    {
        $rows = DB::all('SELECT c.*, (SELECT COALESCE(SUM(amount), 0) FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS given FROM coupons c ORDER BY c.id DESC LIMIT 200');
        $edit = $req->query('edit') !== '' ? DB::one('SELECT * FROM coupons WHERE id = ?', [(int) $req->query('edit')]) : null;
        return $this->page('coupons', ['title' => t('admin.coupons'), 'rows' => $rows, 'edit' => $edit]);
    }

    public function saveCoupon(Request $req): Response
    {
        $id = $req->int('id');
        $data = $req->only(['code', 'description', 'type', 'value', 'max_discount', 'min_order', 'starts_at', 'ends_at', 'usage_limit', 'per_user_limit']);
        $data['code'] = strtoupper(preg_replace('/\s+/', '', (string) $data['code']));
        $errors = Validator::make($data, [
            'code' => 'required|min:3|max:40', 'description' => 'nullable|max:255', 'type' => 'required|in:percent,fixed', 'value' => 'required|money_positive',
            'max_discount' => 'nullable|money', 'min_order' => 'nullable|money', 'starts_at' => 'nullable|datetime', 'ends_at' => 'nullable|datetime',
            'usage_limit' => 'nullable|int|gte:1', 'per_user_limit' => 'nullable|int|gte:1',
        ]);
        if (!isset($errors['code']) && !preg_match('/^[A-Z0-9_-]+$/', $data['code'])) {
            $errors['code'] = t('admin.codeFormat');
        }
        if (!isset($errors['code']) && DB::val('SELECT 1 FROM coupons WHERE code = ? AND id <> ?', [$data['code'], $id])) {
            $errors['code'] = t('validation.unique');
        }
        if (!isset($errors['value']) && $data['type'] === 'percent' && Money::toPoisha($data['value']) > 10000) {
            $errors['value'] = t('validation.lte', ['max' => num(100)]);
        }
        if ($errors) {
            return redirect(url('admin/coupons', $id ? ['edit' => $id] : []))->withErrors($errors)->withInput();
        }
        $dec = static fn ($v) => $v === '' || $v === null ? null : Money::toDecimal(Money::toPoisha($v));
        $row = [
            'code' => $data['code'], 'description' => $data['description'] ?: null, 'type' => $data['type'], 'value' => $dec($data['value']),
            'max_discount' => $dec($data['max_discount']), 'min_order' => $dec($data['min_order']),
            'starts_at' => $data['starts_at'] ? str_replace('T', ' ', $data['starts_at']) . ':00' : null,
            'ends_at' => $data['ends_at'] ? str_replace('T', ' ', $data['ends_at']) . ':00' : null,
            'usage_limit' => $data['usage_limit'] ? (int) $data['usage_limit'] : null,
            'per_user_limit' => $data['per_user_limit'] ? (int) $data['per_user_limit'] : null,
            'is_active' => $req->bool('is_active') ? 1 : 0,
        ];
        if ($id) {
            DB::update('coupons', $row, 'id = ?', [$id]);
        } else {
            $id = DB::insert('coupons', $row + ['created_at' => DB::now()]);
        }
        Audit::log('coupon.saved', 'coupon', $id, ['code' => $data['code']]);
        return redirect(url('admin/coupons'))->with('success', t('common.saved'));
    }

    public function shipping(Request $req): Response
    {
        return $this->page('shipping', ['title' => t('admin.shipping'), 'rows' => DB::all('SELECT * FROM shipping_methods ORDER BY position, id')]);
    }

    public function saveShipping(Request $req): Response
    {
        $id = $req->int('id');
        $data = $req->only(['code', 'name_bn', 'name_en', 'inside_dhaka_fee', 'outside_dhaka_fee', 'free_threshold', 'min_days', 'max_days', 'position']);
        $errors = Validator::make($data, [
            'code' => 'required|max:40', 'name_bn' => 'required|max:80', 'name_en' => 'required|max:80',
            'inside_dhaka_fee' => 'required|money', 'outside_dhaka_fee' => 'required|money', 'free_threshold' => 'nullable|money',
            'min_days' => 'required|int|gte:0|lte:60', 'max_days' => 'required|int|gte:0|lte:60', 'position' => 'nullable|int',
        ]);
        $code = slugify((string) $data['code']);
        if (!isset($errors['code']) && DB::val('SELECT 1 FROM shipping_methods WHERE code = ? AND id <> ?', [$code, $id])) {
            $errors['code'] = t('validation.unique');
        }
        if ($errors) {
            return redirect(url('admin/shipping'))->withErrors($errors)->withInput();
        }
        $row = [
            'code' => $code, 'name_bn' => $data['name_bn'], 'name_en' => $data['name_en'],
            'inside_dhaka_fee' => Money::toDecimal(Money::toPoisha($data['inside_dhaka_fee'])),
            'outside_dhaka_fee' => Money::toDecimal(Money::toPoisha($data['outside_dhaka_fee'])),
            'free_threshold' => $data['free_threshold'] !== '' && $data['free_threshold'] !== null ? Money::toDecimal(Money::toPoisha($data['free_threshold'])) : null,
            'min_days' => (int) $data['min_days'], 'max_days' => max((int) $data['min_days'], (int) $data['max_days']),
            'position' => (int) ($data['position'] ?: 0), 'is_active' => $req->bool('is_active') ? 1 : 0,
        ];
        if ($id) {
            DB::update('shipping_methods', $row, 'id = ?', [$id]);
        } else {
            $id = DB::insert('shipping_methods', $row);
        }
        Audit::log('shipping.saved', 'shipping_method', $id);
        return redirect(url('admin/shipping'))->with('success', t('common.saved'));
    }
}
