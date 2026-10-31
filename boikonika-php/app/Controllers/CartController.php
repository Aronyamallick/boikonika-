<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Services\Cart;

final class CartController
{
    public function show(Request $req): Response
    {
        $contents = Cart::contents();
        return view('cart/show', ['title' => t('cart.title'), 'c' => $contents, 'robots' => 'noindex']);
    }

    public function add(Request $req): Response
    {
        $listingId = $req->int('listing_id');
        $qty = max(1, min(Cart::MAX_QTY, $req->int('quantity', 1)));
        $error = Cart::add($listingId, $qty);
        $ok = $error === null || $error === 'cart.limited';
        $message = $ok ? ($error === 'cart.limited' ? t('cart.limited') : t('cart.added')) : t($error);
        if ($req->wantsJson()) {
            $count = Cart::count();
            return Response::json([
                'ok' => $ok,
                'message' => $message,
                'count' => $count,
                'countLabel' => num(min($count, 99)),
                'ariaLabel' => tn('nav.cartCount', $count),
                'viewCart' => t('cart.viewCart'),
                'cartPath' => (locale() === 'en' ? '/en' : '') . '/cart',
            ], $ok ? 200 : 422);
        }
        if ($ok && $req->bool('buy_now')) {
            return redirect(Auth::check() ? url('checkout') : url('cart'));
        }
        flash($ok ? 'success' : 'error', $message);
        return back(url('cart'));
    }

    public function update(Request $req, string $id): Response
    {
        Cart::setQuantity((int) $id, $req->int('quantity', 1));
        return redirect(url('cart'));
    }

    public function remove(Request $req, string $id): Response
    {
        Cart::remove((int) $id);
        flash('success', t('cart.removed'));
        return redirect(url('cart'));
    }
}
