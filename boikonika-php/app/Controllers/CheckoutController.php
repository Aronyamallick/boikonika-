<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\Money;
use App\Core\RateLimit;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Services\Cart;
use App\Services\Checkout;
use App\Services\Geo;
use App\Services\Payments;
use App\Services\UserError;

final class CheckoutController
{
    public function show(Request $req): Response
    {
        $uid = (int) Auth::id();
        $contents = Cart::contents();
        if (!$contents['lines']) {
            return redirect(url('cart'));
        }
        if ($contents['problems']) {
            flash('warning', t('cart.problems'));
            return redirect(url('cart'));
        }
        $addresses = DB::all('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [$uid]);
        $addressId = $req->int('address');
        $address = null;
        foreach ($addresses as $a) {
            if ((int) $a['id'] === $addressId || ($addressId === 0 && $address === null)) {
                $address = $a;
            }
        }
        $address ??= $addresses[0] ?? null;
        $methods = Checkout::shippingMethods();
        $methodId = $req->int('shipping');
        $method = null;
        foreach ($methods as $m) {
            if ((int) $m['id'] === $methodId) {
                $method = $m;
            }
        }
        $method ??= $methods[0] ?? null;
        $coupon = strtoupper(mb_substr($req->query('coupon'), 0, 40));
        $quote = Checkout::quote($contents, $address['district'] ?? null, $method, $coupon !== '' ? $coupon : null, $uid);
        $payments = Checkout::paymentMethods($quote['total']);
        $selectedPm = $req->query('payment');
        if (!isset($payments[$selectedPm]) || !$payments[$selectedPm]['available']) {
            $selectedPm = '';
            foreach ($payments as $k => $p) {
                if ($p['available']) {
                    $selectedPm = $k;
                    break;
                }
            }
        }
        return view('checkout/show', [
            'title' => t('checkout.title'),
            'robots' => 'noindex',
            'addresses' => $addresses,
            'address' => $address,
            'methods' => $methods,
            'method' => $method,
            'coupon' => $coupon,
            'quote' => $quote,
            'payments' => $payments,
            'selectedPm' => $selectedPm,
            'key' => bin2hex(random_bytes(32)),
            'note' => mb_substr($req->query('note'), 0, 500),
            'districts' => Geo::districtOptions(),
        ]);
    }

    /** Re-prices the page after the buyer changes the address, delivery, payment or coupon. */
    public function refresh(Request $req): Response
    {
        return redirect(url('checkout', array_filter([
            'address' => $req->int('address_id') ?: null,
            'shipping' => $req->int('shipping_method_id') ?: null,
            'payment' => $req->str('payment_method') ?: null,
            'coupon' => mb_substr($req->str('coupon'), 0, 40) ?: null,
            'note' => mb_substr($req->str('note'), 0, 500) ?: null,
        ])));
    }

    public function saveAddress(Request $req): Response
    {
        $uid = (int) Auth::id();
        $data = $req->only(['name', 'phone', 'district', 'area', 'address_line', 'postcode', 'label']);
        $errors = Validator::make($data, [
            'name' => 'required|max:120',
            'phone' => 'required|phone',
            'district' => 'required',
            'area' => 'required|max:120',
            'address_line' => 'required|max:255',
            'postcode' => 'nullable|max:10',
            'label' => 'nullable|max:40',
        ]);
        if (!isset($errors['district']) && !Geo::isDistrict((string) $data['district'])) {
            $errors['district'] = t('validation.in');
        }
        $back = (string) $req->input('return', 'checkout');
        $back = in_array($back, ['checkout', 'account/addresses'], true) ? $back : 'checkout';
        if ($errors) {
            return redirect(url($back, ['new' => 1]))->withErrors($errors)->withInput();
        }
        if ((int) DB::val('SELECT COUNT(*) FROM addresses WHERE user_id = ?', [$uid]) >= 10) {
            return redirect(url($back))->with('error', t('addresses.tooMany'));
        }
        $first = !DB::val('SELECT 1 FROM addresses WHERE user_id = ? LIMIT 1', [$uid]);
        $id = DB::insert('addresses', [
            'user_id' => $uid,
            'label' => $data['label'] ?: null,
            'name' => $data['name'],
            'phone' => Validator::phone($data['phone']),
            'division' => Geo::divisionOf($data['district']),
            'district' => $data['district'],
            'area' => $data['area'],
            'address_line' => $data['address_line'],
            'postcode' => $data['postcode'] ? to_ascii_digits($data['postcode']) : null,
            'is_default' => $first ? 1 : 0,
            'created_at' => DB::now(),
        ]);
        flash('success', t('addresses.saved'));
        return redirect(url($back, $back === 'checkout' ? ['address' => $id] : []));
    }

    public function place(Request $req): Response
    {
        $uid = (int) Auth::id();
        RateLimit::enforce('checkout:' . $uid, 10, 600);
        $in = [
            'address_id' => $req->int('address_id'),
            'shipping_method_id' => $req->int('shipping_method_id'),
            'payment_method' => $req->str('payment_method'),
            'coupon' => strtoupper(mb_substr($req->str('coupon'), 0, 40)) ?: null,
            'note' => mb_substr($req->str('note'), 0, 500),
            'key' => $req->str('key'),
        ];
        $backQuery = ['address' => $in['address_id'], 'shipping' => $in['shipping_method_id'], 'payment' => $in['payment_method'], 'coupon' => $in['coupon'] ?? '', 'note' => $in['note']];
        if (!$req->bool('agree')) {
            return redirect(url('checkout', $backQuery))->withErrors(['agree' => t('validation.accept')]);
        }
        // The buyer must have seen the total they're agreeing to.
        $address = DB::one('SELECT district FROM addresses WHERE id = ? AND user_id = ?', [$in['address_id'], $uid]);
        $method = DB::one('SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1', [$in['shipping_method_id']]);
        $quote = Checkout::quote(Cart::contents(), $address['district'] ?? null, $method, $in['coupon'], $uid);
        if (DB::val('SELECT 1 FROM orders WHERE idempotency_key = ?', [$in['key']]) === null && (string) $quote['total'] !== $req->str('expected_total')) {
            flash('warning', t('checkout.totalChanged'));
            return redirect(url('checkout', $backQuery));
        }
        try {
            $order = Checkout::place($uid, $in, locale(), $req->ip());
        } catch (UserError $e) {
            flash('error', $e->text());
            return redirect(url($e->key === 'checkout.cartChanged' || $e->key === 'checkout.emptyCart' ? 'cart' : 'checkout', $e->key === 'checkout.cartChanged' ? [] : $backQuery));
        }
        $orderUrl = url('account/orders/' . $order['number']);
        if ($order['payment_method'] === 'cod') {
            if (empty($order['_replayed'])) {
                flash('success', t('checkout.placed', ['number' => $order['number']]));
            }
            return redirect($orderUrl);
        }
        if ($order['status'] !== 'awaiting_payment') {
            return redirect($orderUrl);
        }
        try {
            return redirect(Payments::start($order));
        } catch (UserError $e) {
            flash('error', $e->text());
            return redirect($orderUrl);
        }
    }
}
