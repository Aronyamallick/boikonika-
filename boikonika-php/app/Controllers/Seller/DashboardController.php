<?php
declare(strict_types=1);

namespace App\Controllers\Seller;

use App\Core\DB;
use App\Core\Request;
use App\Core\Response;
use App\Services\Sellers;

final class DashboardController
{
    use SellerPage;

    public function index(Request $req): Response
    {
        $sid = $this->sid();
        $todo = DB::one("SELECT SUM(status = 'pending') AS pending, SUM(status IN ('confirmed', 'processing')) AS packing, SUM(status = 'shipped') AS shipped FROM seller_orders WHERE seller_id = ?", [$sid]);
        $sales30 = DB::one("SELECT COUNT(*) AS n, COALESCE(SUM(subtotal), 0) AS amount FROM seller_orders WHERE seller_id = ? AND status = 'delivered' AND delivered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)", [$sid]);
        $listings = DB::one("SELECT SUM(l.status = 'active' AND l.stock > 0) AS live, SUM(l.status = 'active' AND l.stock BETWEEN 1 AND 2) AS low, SUM(l.stock = 0) AS empty FROM listings l WHERE l.seller_id = ?", [$sid]);
        $pendingProducts = (int) DB::val("SELECT COUNT(*) FROM products WHERE seller_id = ? AND status = 'pending'", [$sid]);
        $returns = (int) DB::val("SELECT COUNT(*) FROM returns r JOIN seller_orders so ON so.id = r.seller_order_id WHERE so.seller_id = ? AND r.status IN ('requested', 'approved')", [$sid]);
        $recent = DB::all('SELECT so.*, o.ship_name, o.payment_method, o.payment_status FROM seller_orders so JOIN orders o ON o.id = so.order_id WHERE so.seller_id = ? AND so.status <> ? ORDER BY so.id DESC LIMIT 8', [$sid, 'awaiting_payment']);
        return $this->page('dashboard', [
            'title' => t('nav.sellerDashboard'),
            'todo' => $todo,
            'sales30' => $sales30,
            'listings' => $listings,
            'pendingProducts' => $pendingProducts,
            'returns' => $returns,
            'recent' => $recent,
            'balance' => Sellers::balance($sid),
        ]);
    }
}
