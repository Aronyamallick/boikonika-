<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\DB;
use App\Core\Money;
use App\Core\Settings;

/** Seller money: earnings become withdrawable once delivered parcels pass the return window. */
final class Sellers
{
    /** @return array{available:int, pending:int, upcoming:int, debits:int, payouts:int, withdrawable:int, paid:int} all in poisha */
    public static function balance(int $sellerId): array
    {
        $days = Settings::int('orders.return_window_days');
        $cut = date('Y-m-d H:i:s', time() - 86400 * $days);
        $available = Money::toPoisha((string) DB::val("SELECT COALESCE(SUM(seller_earning), 0) FROM seller_orders WHERE seller_id = ? AND status = 'delivered' AND delivered_at <= ? AND NOT EXISTS (SELECT 1 FROM returns r WHERE r.seller_order_id = seller_orders.id AND r.status IN ('requested', 'approved', 'received'))", [$sellerId, $cut]));
        $pending = Money::toPoisha((string) DB::val("SELECT COALESCE(SUM(seller_earning), 0) FROM seller_orders WHERE seller_id = ? AND status = 'delivered' AND (delivered_at > ? OR EXISTS (SELECT 1 FROM returns r WHERE r.seller_order_id = seller_orders.id AND r.status IN ('requested', 'approved', 'received')))", [$sellerId, $cut]));
        $upcoming = Money::toPoisha((string) DB::val("SELECT COALESCE(SUM(seller_earning), 0) FROM seller_orders WHERE seller_id = ? AND status IN ('pending', 'confirmed', 'processing', 'shipped')", [$sellerId]));
        $debits = Money::toPoisha((string) DB::val("SELECT COALESCE(SUM(r.seller_debit), 0) FROM refunds r JOIN seller_orders so ON so.id = r.seller_order_id WHERE so.seller_id = ? AND r.status = 'completed'", [$sellerId]));
        $payouts = Money::toPoisha((string) DB::val("SELECT COALESCE(SUM(amount), 0) FROM payouts WHERE seller_id = ? AND status IN ('requested', 'processing', 'paid')", [$sellerId]));
        $paid = Money::toPoisha((string) DB::val("SELECT COALESCE(SUM(amount), 0) FROM payouts WHERE seller_id = ? AND status = 'paid'", [$sellerId]));
        return [
            'available' => $available,
            'pending' => $pending,
            'upcoming' => $upcoming,
            'debits' => $debits,
            'payouts' => $payouts,
            'paid' => $paid,
            'withdrawable' => max(0, $available - $debits - $payouts),
        ];
    }

    public static function storeUrl(array $seller): string
    {
        return url('stores/' . $seller['slug']);
    }
}
