<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\RateLimit;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Services\Catalog;

/** Reviews: only people who received the item may write one (one per product, editable). */
final class ReviewController
{
    public function store(Request $req, string $slug): Response
    {
        $uid = (int) Auth::id();
        RateLimit::enforce('review:' . $uid, 20, 3600);
        $p = DB::one("SELECT id, slug, type FROM products WHERE slug = ? AND status = 'active'", [$slug]) ?? throw new HttpException(404);
        $bought = DB::val("SELECT 1 FROM order_items i JOIN seller_orders so ON so.id = i.seller_order_id JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? AND o.user_id = ? AND so.status = 'delivered' LIMIT 1", [$p['id'], $uid]);
        $back = Catalog::productUrl($p) . '#reviews';
        if (!$bought) {
            return redirect($back)->with('error', t('catalog.reviewNotAllowed'));
        }
        $data = ['rating' => $req->str('rating'), 'body' => $req->str('body')];
        $errors = Validator::make($data, ['rating' => 'required|in:1,2,3,4,5', 'body' => 'nullable|max:2000']);
        if ($errors) {
            return redirect($back)->withErrors($errors)->withInput();
        }
        DB::exec('INSERT INTO reviews (product_id, user_id, rating, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE rating = VALUES(rating), body = VALUES(body), updated_at = NOW()', [$p['id'], $uid, (int) $data['rating'], $data['body'] !== '' ? $data['body'] : null, 'published']);
        Catalog::refreshRating((int) $p['id']);
        return redirect($back)->with('success', t('catalog.reviewSaved'));
    }
}
