<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\DB;
use App\Core\Money;
use App\Core\Settings;

/**
 * Prices a cart (per-seller delivery, coupon) and turns it into an order: one parcel per seller,
 * stock reserved under row locks, and an idempotency key so a double click can't order twice.
 */
final class Checkout
{
    public static function shippingMethods(): array
    {
        return DB::all('SELECT * FROM shipping_methods WHERE is_active = 1 ORDER BY position, id');
    }

    public static function insideDhaka(?string $district): bool
    {
        return $district === 'Dhaka';
    }

    /**
     * @return array{groups:list<array>,subtotal:int,shipping:int,discount:int,total:int,coupon:?array,coupon_error:?string,inside_dhaka:bool,items:int}
     */
    public static function quote(array $contents, ?string $district, ?array $method, ?string $couponCode, int $userId): array
    {
        $inside = self::insideDhaka($district);
        $groups = [];
        $subtotal = 0;
        $shipping = 0;
        foreach ($contents['groups'] as $g) {
            $lines = array_values(array_filter($g['lines'], static fn ($l) => $l['available']));
            if (!$lines) {
                continue;
            }
            $fee = 0;
            if ($method) {
                $fee = Money::toPoisha($inside ? $method['inside_dhaka_fee'] : $method['outside_dhaka_fee']);
                if ($method['free_threshold'] !== null && $g['subtotal'] >= Money::toPoisha($method['free_threshold'])) {
                    $fee = 0;
                }
            }
            $groups[] = ['seller_id' => $g['seller_id'], 'store_name' => $g['store_name'], 'store_slug' => $g['store_slug'], 'lines' => $lines, 'subtotal' => $g['subtotal'], 'shipping' => $fee, 'discount' => 0];
            $subtotal += $g['subtotal'];
            $shipping += $fee;
        }

        $coupon = null;
        $couponError = null;
        $discount = 0;
        if ($couponCode !== null && $couponCode !== '') {
            [$coupon, $couponError] = self::checkCoupon($couponCode, $userId, $subtotal);
            if ($coupon) {
                $discount = self::couponDiscount($coupon, $subtotal);
            }
        }
        // Spread the discount over the parcels in proportion to their value; the rest goes to the largest.
        if ($discount > 0 && $subtotal > 0) {
            $left = $discount;
            $largest = 0;
            foreach ($groups as $i => $g) {
                $share = intdiv($discount * $g['subtotal'], $subtotal);
                $groups[$i]['discount'] = $share;
                $left -= $share;
                if ($g['subtotal'] > $groups[$largest]['subtotal']) {
                    $largest = $i;
                }
            }
            $groups[$largest]['discount'] += $left;
        }
        foreach ($groups as $i => $g) {
            $groups[$i]['total'] = $g['subtotal'] + $g['shipping'] - $g['discount'];
        }
        return [
            'groups' => $groups,
            'subtotal' => $subtotal,
            'shipping' => $shipping,
            'discount' => $discount,
            'total' => $subtotal + $shipping - $discount,
            'coupon' => $coupon,
            'coupon_error' => $couponError,
            'inside_dhaka' => $inside,
            'items' => $contents['items'],
        ];
    }

    /** @return array{0:?array,1:?string} [coupon, error key] */
    public static function checkCoupon(string $code, int $userId, int $subtotal, bool $lock = false): array
    {
        $c = DB::one('SELECT * FROM coupons WHERE code = ?' . ($lock ? ' FOR UPDATE' : ''), [strtoupper(trim($code))]);
        $now = time();
        if (!$c || !(int) $c['is_active']) {
            return [null, 'checkout.couponInvalid'];
        }
        if (($c['starts_at'] && strtotime($c['starts_at']) > $now) || ($c['ends_at'] && strtotime($c['ends_at']) < $now)) {
            return [null, 'checkout.couponExpired'];
        }
        if ($c['usage_limit'] !== null && (int) $c['used_count'] >= (int) $c['usage_limit']) {
            return [null, 'checkout.couponUsedUp'];
        }
        if ($c['per_user_limit'] !== null) {
            $mine = (int) DB::val('SELECT COUNT(*) FROM coupon_redemptions r JOIN orders o ON o.id = r.order_id WHERE r.coupon_id = ? AND r.user_id = ? AND o.status <> ?', [$c['id'], $userId, 'cancelled']);
            if ($mine >= (int) $c['per_user_limit']) {
                return [null, 'checkout.couponAlreadyUsed'];
            }
        }
        if ($c['min_order'] !== null && $subtotal < Money::toPoisha($c['min_order'])) {
            return [null, 'checkout.couponMinOrder'];
        }
        return [$c, null];
    }

    public static function couponDiscount(array $c, int $subtotal): int
    {
        if ($c['type'] === 'percent') {
            $d = Money::percent($subtotal, (string) $c['value']);
            if ($c['max_discount'] !== null) {
                $d = min($d, Money::toPoisha($c['max_discount']));
            }
        } else {
            $d = Money::toPoisha($c['value']);
        }
        return max(0, min($d, $subtotal));
    }

    /** @return array<string, array{available:bool, reason:?string}> */
    public static function paymentMethods(int $total): array
    {
        $codMax = Money::toPoisha(Settings::get('orders.cod_max', '20000'));
        return [
            'cod' => Settings::bool('orders.cod_enabled')
                ? ['available' => $total <= $codMax, 'reason' => $total <= $codMax ? null : 'checkout.codLimit']
                : ['available' => false, 'reason' => 'checkout.methodOff'],
            'bkash' => ['available' => Payments::available('bkash'), 'reason' => Payments::available('bkash') ? null : 'checkout.methodOff'],
            'sslcommerz' => ['available' => Payments::available('sslcommerz'), 'reason' => Payments::available('sslcommerz') ? null : 'checkout.methodOff'],
        ];
    }

    public static function commissionPercent(int $sellerId): string
    {
        $own = DB::val('SELECT commission_percent FROM sellers WHERE id = ?', [$sellerId]);
        return $own !== null ? (string) $own : (string) Settings::get('orders.commission_percent', '10');
    }

    /**
     * Places the order. Throws UserError for anything the buyer can fix.
     * @param array{address_id:int,shipping_method_id:int,payment_method:string,coupon:?string,note:?string,key:string} $in
     */
    public static function place(int $userId, array $in, string $locale, string $ip): array
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $in['key'])) {
            throw new UserError('checkout.expired');
        }
        $order = DB::tx(static function () use ($userId, $in, $locale, $ip): array {
            $existing = DB::one('SELECT * FROM orders WHERE idempotency_key = ?', [$in['key']]);
            if ($existing) {
                if ((int) $existing['user_id'] !== $userId) {
                    throw new UserError('checkout.expired');
                }
                $existing['_replayed'] = true;
                return $existing;
            }
            $cart = DB::one('SELECT * FROM carts WHERE user_id = ? FOR UPDATE', [$userId]);
            if (!$cart) {
                throw new UserError('checkout.emptyCart');
            }
            $listingIds = DB::col('SELECT listing_id FROM cart_items WHERE cart_id = ?', [$cart['id']]);
            if (!$listingIds) {
                throw new UserError('checkout.emptyCart');
            }
            DB::all('SELECT id FROM listings WHERE id IN (' . DB::in($listingIds) . ') ORDER BY id FOR UPDATE', $listingIds);
            $contents = Cart::contents($cart);
            if ($contents['problems']) {
                throw new UserError('checkout.cartChanged');
            }
            if (!$contents['groups']) {
                throw new UserError('checkout.emptyCart');
            }
            $address = DB::one('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [$in['address_id'], $userId]);
            if (!$address) {
                throw new UserError('checkout.chooseAddress');
            }
            $method = DB::one('SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1', [$in['shipping_method_id']]);
            if (!$method) {
                throw new UserError('checkout.chooseShipping');
            }
            if (!empty($in['coupon'])) {
                [, $err] = self::checkCoupon($in['coupon'], $userId, $contents['subtotal'], true);
                if ($err) {
                    throw new UserError($err);
                }
            }
            $quote = self::quote($contents, $address['district'], $method, $in['coupon'] ?: null, $userId);
            $methods = self::paymentMethods($quote['total']);
            $pm = $in['payment_method'];
            if (!isset($methods[$pm]) || !$methods[$pm]['available']) {
                throw new UserError($methods[$pm]['reason'] ?? 'checkout.choosePayment');
            }
            $online = $pm !== 'cod';
            $number = self::newNumber();
            $now = DB::now();
            $orderId = DB::insert('orders', [
                'number' => $number,
                'user_id' => $userId,
                'status' => $online ? 'awaiting_payment' : 'placed',
                'payment_method' => $pm,
                'payment_status' => $online ? 'pending' : 'unpaid',
                'subtotal' => Money::toDecimal($quote['subtotal']),
                'shipping_total' => Money::toDecimal($quote['shipping']),
                'discount_total' => Money::toDecimal($quote['discount']),
                'total' => Money::toDecimal($quote['total']),
                'coupon_id' => $quote['coupon']['id'] ?? null,
                'coupon_code' => $quote['coupon']['code'] ?? null,
                'shipping_method_id' => $method['id'],
                'shipping_method_name' => $locale === 'en' ? $method['name_en'] : $method['name_bn'],
                'ship_name' => $address['name'],
                'ship_phone' => $address['phone'],
                'ship_division' => $address['division'],
                'ship_district' => $address['district'],
                'ship_area' => $address['area'],
                'ship_address' => $address['address_line'],
                'ship_postcode' => $address['postcode'],
                'inside_dhaka' => $quote['inside_dhaka'] ? 1 : 0,
                'note' => $in['note'] !== null && $in['note'] !== '' ? mb_substr($in['note'], 0, 500) : null,
                'idempotency_key' => $in['key'],
                'locale' => $locale,
                'payment_due_at' => $online ? date('Y-m-d H:i:s', time() + 60 * max(5, Settings::int('orders.payment_window_minutes'))) : null,
                'ip' => $ip,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $n = 1;
            foreach ($quote['groups'] as $g) {
                $percent = self::commissionPercent((int) $g['seller_id']);
                $commission = Money::percent($g['subtotal'], $percent);
                $soId = DB::insert('seller_orders', [
                    'order_id' => $orderId,
                    'seller_id' => $g['seller_id'],
                    'number' => $number . '-' . $n++,
                    'status' => $online ? 'awaiting_payment' : 'pending',
                    'subtotal' => Money::toDecimal($g['subtotal']),
                    'shipping_fee' => Money::toDecimal($g['shipping']),
                    'discount' => Money::toDecimal($g['discount']),
                    'total' => Money::toDecimal($g['total']),
                    'commission_percent' => $percent,
                    'commission_amount' => Money::toDecimal($commission),
                    'seller_earning' => Money::toDecimal($g['subtotal'] + $g['shipping'] - $commission),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                foreach ($g['lines'] as $l) {
                    $ok = DB::exec('UPDATE listings SET stock = stock - ?, updated_at = NOW() WHERE id = ? AND stock >= ?', [(int) $l['quantity'], $l['listing_id'], (int) $l['quantity']]);
                    if ($ok !== 1) {
                        throw new UserError('checkout.cartChanged');
                    }
                    DB::insert('order_items', [
                        'order_id' => $orderId,
                        'seller_order_id' => $soId,
                        'listing_id' => $l['listing_id'],
                        'product_id' => $l['product_id'],
                        'title' => $l['title'],
                        'item_condition' => $l['item_condition'],
                        'cover_path' => $l['cover_path'],
                        'unit_price' => $l['price'],
                        'quantity' => (int) $l['quantity'],
                        'line_total' => Money::toDecimal($l['line_total']),
                    ]);
                }
            }
            if ($quote['coupon']) {
                DB::insert('coupon_redemptions', ['coupon_id' => $quote['coupon']['id'], 'user_id' => $userId, 'order_id' => $orderId, 'amount' => Money::toDecimal($quote['discount']), 'created_at' => $now]);
                DB::exec('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [$quote['coupon']['id']]);
            }
            DB::exec('DELETE FROM cart_items WHERE cart_id = ?', [$cart['id']]);
            DB::exec('UPDATE carts SET coupon_code = NULL WHERE id = ?', [$cart['id']]);
            Orders::event($orderId, null, 'placed', null, $userId);
            $order = DB::one('SELECT * FROM orders WHERE id = ?', [$orderId]);
            $order['_product_ids'] = array_values(array_unique(array_map(static fn ($l) => (int) $l['product_id'], $contents['lines'])));
            return $order;
        });
        if (empty($order['_replayed'])) {
            Catalog::refresh($order['_product_ids']);
            if ($order['payment_method'] === 'cod') {
                Orders::announce((int) $order['id']);
            }
        }
        return $order;
    }

    private static function newNumber(): string
    {
        for ($i = 0; $i < 10; $i++) {
            $n = 'BK' . date('ymd') . '-' . str_pad((string) random_int(0, 99999), 5, '0', STR_PAD_LEFT);
            if (!DB::val('SELECT id FROM orders WHERE number = ?', [$n])) {
                return $n;
            }
        }
        return 'BK' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
    }
}
