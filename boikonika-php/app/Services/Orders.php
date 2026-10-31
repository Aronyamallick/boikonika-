<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\DB;
use App\Core\Money;
use App\Core\Settings;

/** Order life cycle: payment, parcels moving through fulfilment, cancellations, returns, refunds. */
final class Orders
{
    /** Parcel status changes a seller (or staff) may make. */
    public const TRANSITIONS = [
        'pending' => ['confirmed', 'cancelled'],
        'confirmed' => ['processing', 'shipped', 'cancelled'],
        'processing' => ['shipped', 'cancelled'],
        'shipped' => ['delivered'],
    ];
    public const STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

    public static function event(int $orderId, ?int $soId, string $type, ?string $note = null, ?int $actor = null): void
    {
        DB::insert('order_events', ['order_id' => $orderId, 'seller_order_id' => $soId, 'actor_user_id' => $actor, 'type' => $type, 'note' => $note !== null ? mb_substr($note, 0, 500) : null, 'created_at' => DB::now()]);
    }

    public static function byNumber(string $number): ?array
    {
        return DB::one('SELECT * FROM orders WHERE number = ?', [$number]);
    }

    /** Parcels with their items and store. */
    public static function parcels(int $orderId): array
    {
        $parcels = DB::all('SELECT so.*, s.store_name, s.slug AS store_slug, s.user_id AS seller_user_id FROM seller_orders so JOIN sellers s ON s.id = so.seller_id WHERE so.order_id = ? ORDER BY so.id', [$orderId]);
        $items = DB::all('SELECT i.*, p.slug, p.type FROM order_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.order_id = ? ORDER BY i.id', [$orderId]);
        $returns = DB::all('SELECT * FROM returns WHERE order_id = ? ORDER BY id DESC', [$orderId]);
        foreach ($parcels as &$p) {
            $p['items'] = array_values(array_filter($items, static fn ($i) => (int) $i['seller_order_id'] === (int) $p['id']));
            $p['return'] = null;
            foreach ($returns as $r) {
                if ((int) $r['seller_order_id'] === (int) $p['id']) {
                    $p['return'] = $r;
                    break;
                }
            }
        }
        return $parcels;
    }

    /** Tells the buyer and each seller about a new (or newly paid) order. */
    public static function announce(int $orderId): void
    {
        $o = DB::one('SELECT * FROM orders WHERE id = ?', [$orderId]);
        if (!$o) {
            return;
        }
        $parcels = self::parcels($orderId);
        $buyer = DB::one('SELECT name, email, locale FROM users WHERE id = ?', [$o['user_id']]);
        if ($buyer && $buyer['email']) {
            Mail::queue($buyer['email'], 'order-placed', ['order' => $o, 'parcels' => $parcels, 'name' => $buyer['name']], $o['locale'], $buyer['name']);
        }
        DB::insert('notifications', [
            'user_id' => $o['user_id'], 'type' => 'order_placed',
            'title' => \App\Core\I18n::t('notify.orderPlaced.title', ['number' => $o['number']], $o['locale']),
            'body' => \App\Core\I18n::t('notify.orderPlaced.body', ['total' => Money::format($o['total'], $o['locale'])], $o['locale']),
            'link' => 'account/orders/' . $o['number'], 'created_at' => DB::now(),
        ]);
        foreach ($parcels as $p) {
            Notify::user((int) $p['seller_user_id'], 'sellerNewOrder', ['number' => $p['number'], 'total' => Money::format($p['subtotal'])], 'seller/orders/' . $p['number'], true, true);
        }
    }

    /** A payment was confirmed by the gateway. Safe to call more than once. */
    public static function markPaid(int $paymentId, string $transactionId, array $raw = []): void
    {
        $late = false;
        $order = DB::tx(static function () use ($paymentId, $transactionId, $raw, &$late): ?array {
            $pay = DB::one('SELECT * FROM payments WHERE id = ? FOR UPDATE', [$paymentId]);
            if (!$pay || $pay['status'] === 'paid') {
                return null;
            }
            $o = DB::one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [$pay['order_id']]);
            DB::exec("UPDATE payments SET status = 'paid', transaction_id = ?, raw = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ?", [$transactionId, json_encode($raw, JSON_UNESCAPED_UNICODE), $paymentId]);
            if ($o['payment_status'] === 'paid') {
                // A second successful payment for the same order: give it back.
                self::requestRefund((int) $o['id'], null, Money::toPoisha($pay['amount']), 'duplicate_payment', null, null, $paymentId);
                return null;
            }
            if ($o['status'] === 'cancelled') {
                // Paid after the payment window closed and the stock was released: refund in full.
                DB::exec("UPDATE orders SET payment_status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ?", [$o['id']]);
                self::event((int) $o['id'], null, 'paid_late', $transactionId);
                self::requestRefund((int) $o['id'], null, Money::toPoisha($pay['amount']), 'paid_after_cancel', null, null, $paymentId);
                $late = true;
                return $o;
            }
            DB::exec("UPDATE orders SET status = 'placed', payment_status = 'paid', paid_at = NOW(), payment_due_at = NULL, updated_at = NOW() WHERE id = ?", [$o['id']]);
            DB::exec("UPDATE seller_orders SET status = 'pending', updated_at = NOW() WHERE order_id = ? AND status = 'awaiting_payment'", [$o['id']]);
            DB::exec("UPDATE payments SET status = 'cancelled', updated_at = NOW() WHERE order_id = ? AND id <> ? AND status IN ('initiated', 'pending')", [$o['id'], $paymentId]);
            self::event((int) $o['id'], null, 'paid', $transactionId);
            return $o;
        });
        if ($order && !$late) {
            self::announce((int) $order['id']);
        } elseif ($order && $late) {
            Notify::user((int) $order['user_id'], 'paidLate', ['number' => $order['number']], 'account/orders/' . $order['number'], true, true);
        }
    }

    public static function paymentFailed(int $paymentId, string $status, ?string $reason, array $raw = []): void
    {
        $pay = DB::one('SELECT * FROM payments WHERE id = ?', [$paymentId]);
        if (!$pay || in_array($pay['status'], ['paid', 'failed', 'cancelled', 'expired'], true)) {
            return;
        }
        DB::exec('UPDATE payments SET status = ?, failure_reason = ?, raw = ?, updated_at = NOW() WHERE id = ?', [$status === 'cancelled' ? 'cancelled' : 'failed', $reason !== null ? mb_substr($reason, 0, 255) : null, json_encode($raw, JSON_UNESCAPED_UNICODE), $paymentId]);
        self::event((int) $pay['order_id'], null, $status === 'cancelled' ? 'payment_cancelled' : 'payment_failed', $reason);
    }

    /** Whether the buyer can still cancel: nothing has shipped yet. */
    public static function buyerCanCancel(array $order, array $parcels): bool
    {
        if (in_array($order['status'], ['cancelled', 'completed'], true)) {
            return false;
        }
        foreach ($parcels as $p) {
            if (!in_array($p['status'], ['awaiting_payment', 'pending', 'confirmed', 'cancelled'], true)) {
                return false;
            }
        }
        return true;
    }

    /** Cancels every parcel that hasn't shipped; paid money becomes a refund request for staff. */
    public static function cancel(int $orderId, string $reason, ?int $actor, string $by): bool
    {
        $result = DB::tx(static function () use ($orderId, $reason, $actor, $by): ?array {
            $o = DB::one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [$orderId]);
            if (!$o || $o['status'] === 'cancelled') {
                return null;
            }
            $parcels = DB::all('SELECT * FROM seller_orders WHERE order_id = ? FOR UPDATE', [$orderId]);
            $refund = 0;
            $cancelled = [];
            foreach ($parcels as $p) {
                if (!in_array($p['status'], ['awaiting_payment', 'pending', 'confirmed', 'processing'], true)) {
                    continue;
                }
                self::restock((int) $p['id']);
                DB::exec("UPDATE seller_orders SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = ?, updated_at = NOW() WHERE id = ?", [$reason, $p['id']]);
                $refund += Money::toPoisha($p['total']);
                $cancelled[] = $p;
            }
            if (!$cancelled) {
                return null;
            }
            self::event($orderId, null, 'cancelled', $by . ': ' . $reason, $actor);
            if ($o['payment_status'] === 'paid' || $o['payment_status'] === 'partially_refunded') {
                self::requestRefund($orderId, count($cancelled) === 1 ? (int) $cancelled[0]['id'] : null, $refund, 'cancelled', $actor);
            } elseif (in_array($o['payment_status'], ['pending', 'unpaid'], true)) {
                DB::exec("UPDATE payments SET status = 'cancelled', updated_at = NOW() WHERE order_id = ? AND status IN ('initiated', 'pending')", [$orderId]);
            }
            self::sync($orderId);
            return ['order' => $o, 'parcels' => $cancelled];
        });
        if (!$result) {
            return false;
        }
        $o = $result['order'];
        Catalog::refresh(array_map('intval', DB::col('SELECT DISTINCT product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL', [$orderId])));
        if ($by !== 'buyer') {
            Notify::user((int) $o['user_id'], 'orderCancelled', ['number' => $o['number']], 'account/orders/' . $o['number'], true, true);
        }
        if ($o['status'] !== 'awaiting_payment') {
            foreach ($result['parcels'] as $p) {
                $sellerUser = (int) DB::val('SELECT user_id FROM sellers WHERE id = ?', [$p['seller_id']]);
                Notify::user($sellerUser, 'sellerOrderCancelled', ['number' => $p['number']], 'seller/orders/' . $p['number'], true, true);
            }
        }
        return true;
    }

    /** A seller (or staff) cancels one parcel, e.g. when the book is no longer available. */
    public static function cancelParcel(int $soId, string $reason, ?int $actor, string $by): bool
    {
        $o = DB::tx(static function () use ($soId, $reason, $actor, $by): ?array {
            $p = DB::one('SELECT * FROM seller_orders WHERE id = ? FOR UPDATE', [$soId]);
            if (!$p || !in_array('cancelled', self::TRANSITIONS[$p['status']] ?? [], true)) {
                return null;
            }
            $o = DB::one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [$p['order_id']]);
            self::restock($soId);
            DB::exec("UPDATE seller_orders SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = ?, updated_at = NOW() WHERE id = ?", [$reason, $soId]);
            self::event((int) $o['id'], $soId, 'parcel_cancelled', $by . ': ' . $reason, $actor);
            if (in_array($o['payment_status'], ['paid', 'partially_refunded'], true)) {
                self::requestRefund((int) $o['id'], $soId, Money::toPoisha($p['total']), 'parcel_cancelled', $actor);
            }
            self::sync((int) $o['id']);
            return $o;
        });
        if (!$o) {
            return false;
        }
        Catalog::refresh(array_map('intval', DB::col('SELECT DISTINCT product_id FROM order_items WHERE seller_order_id = ? AND product_id IS NOT NULL', [$soId])));
        Notify::user((int) $o['user_id'], 'parcelCancelled', ['number' => $o['number']], 'account/orders/' . $o['number'], true, true);
        return true;
    }

    /** Moves a parcel forward. Returns an error key, or null. */
    public static function setParcelStatus(int $soId, string $to, array $data, ?int $actor, string $by): ?string
    {
        if ($to === 'cancelled') {
            return self::cancelParcel($soId, (string) ($data['reason'] ?? ''), $actor, $by) ? null : 'orders.cannotChange';
        }
        $res = DB::tx(static function () use ($soId, $to, $data, $actor, $by) {
            $p = DB::one('SELECT * FROM seller_orders WHERE id = ? FOR UPDATE', [$soId]);
            if (!$p || !in_array($to, self::TRANSITIONS[$p['status']] ?? [], true)) {
                return 'orders.cannotChange';
            }
            $set = ['status' => $to, 'updated_at' => DB::now()];
            if ($to === 'confirmed') {
                $set['confirmed_at'] = DB::now();
            }
            if ($to === 'shipped') {
                if (trim((string) ($data['courier'] ?? '')) === '') {
                    return 'orders.courierRequired';
                }
                $set['courier'] = mb_substr(trim((string) $data['courier']), 0, 60);
                $set['tracking_number'] = mb_substr(trim((string) ($data['tracking'] ?? '')), 0, 80) ?: null;
                $set['shipped_at'] = DB::now();
                $set['confirmed_at'] = $p['confirmed_at'] ?? DB::now();
            }
            if ($to === 'delivered') {
                $set['delivered_at'] = DB::now();
            }
            DB::update('seller_orders', $set, 'id = ?', [$soId]);
            $note = $to === 'shipped' ? trim($set['courier'] . ' ' . ($set['tracking_number'] ?? '')) : null;
            self::event((int) $p['order_id'], $soId, $to, $note, $actor);
            if ($to === 'delivered') {
                DB::exec('UPDATE products p JOIN order_items i ON i.product_id = p.id SET p.sold_count = p.sold_count + i.quantity WHERE i.seller_order_id = ?', [$soId]);
            }
            self::sync((int) $p['order_id']);
            return DB::one('SELECT o.*, so.number AS parcel_number, so.courier, so.tracking_number FROM orders o JOIN seller_orders so ON so.order_id = o.id WHERE so.id = ?', [$soId]);
        });
        if (is_string($res)) {
            return $res;
        }
        if ($to === 'shipped') {
            Notify::user((int) $res['user_id'], 'parcelShipped', ['number' => $res['number'], 'courier' => $res['courier'], 'tracking' => $res['tracking_number'] ?? '—'], 'account/orders/' . $res['number'], true, true);
        } elseif ($to === 'delivered') {
            Notify::user((int) $res['user_id'], 'parcelDelivered', ['number' => $res['number']], 'account/orders/' . $res['number'], true, false);
        }
        return null;
    }

    /** Recomputes the order's overall status from its parcels. */
    public static function sync(int $orderId): void
    {
        $o = DB::one('SELECT * FROM orders WHERE id = ?', [$orderId]);
        $statuses = DB::col('SELECT status FROM seller_orders WHERE order_id = ?', [$orderId]);
        $open = array_diff($statuses, ['delivered', 'cancelled', 'returned']);
        $status = $o['status'];
        if (!$open) {
            $status = in_array('delivered', $statuses, true) || in_array('returned', $statuses, true) ? 'completed' : 'cancelled';
        }
        $set = ['status' => $status, 'updated_at' => DB::now()];
        if ($status === 'cancelled' && !$o['cancelled_at']) {
            $set['cancelled_at'] = DB::now();
        }
        // Cash on delivery counts as paid once every remaining parcel is delivered.
        if ($o['payment_method'] === 'cod' && $o['payment_status'] === 'unpaid' && !$open && in_array('delivered', $statuses, true)) {
            $set['payment_status'] = 'paid';
            $set['paid_at'] = DB::now();
        }
        if ($status === 'cancelled' && $o['payment_status'] === 'unpaid') {
            $set['payment_status'] = 'cancelled';
        }
        if ($status === 'cancelled' && $o['payment_status'] === 'pending') {
            $set['payment_status'] = 'cancelled';
        }
        DB::update('orders', $set, 'id = ?', [$orderId]);
    }

    /** Puts a parcel's items back in stock. */
    public static function restock(int $soId): void
    {
        foreach (DB::all('SELECT listing_id, quantity FROM order_items WHERE seller_order_id = ? AND listing_id IS NOT NULL', [$soId]) as $i) {
            DB::exec('UPDATE listings SET stock = stock + ?, updated_at = NOW() WHERE id = ?', [(int) $i['quantity'], $i['listing_id']]);
        }
    }

    /** Creates a refund request for staff to send (by gateway or by hand). */
    public static function requestRefund(int $orderId, ?int $soId, int $amount, string $reason, ?int $actor, ?int $returnId = null, ?int $paymentId = null): int
    {
        if ($amount <= 0) {
            return 0;
        }
        $paymentId ??= DB::val("SELECT id FROM payments WHERE order_id = ? AND status = 'paid' ORDER BY id DESC LIMIT 1", [$orderId]);
        $id = DB::insert('refunds', [
            'order_id' => $orderId,
            'seller_order_id' => $soId,
            'payment_id' => $paymentId,
            'return_id' => $returnId,
            'amount' => Money::toDecimal($amount),
            'reason' => $reason,
            'status' => 'requested',
            'requested_by' => $actor,
            'created_at' => DB::now(),
        ]);
        self::event($orderId, $soId, 'refund_requested', Money::toDecimal($amount), $actor);
        return $id;
    }

    /** After a refund is sent: updates the order's refunded total and payment status. */
    public static function refundCompleted(int $refundId): void
    {
        $r = DB::one('SELECT * FROM refunds WHERE id = ?', [$refundId]);
        $o = DB::one('SELECT * FROM orders WHERE id = ?', [$r['order_id']]);
        $refunded = Money::toPoisha($o['refunded_total']) + Money::toPoisha($r['amount']);
        $status = $refunded >= Money::toPoisha($o['total']) ? 'refunded' : 'partially_refunded';
        DB::exec('UPDATE orders SET refunded_total = ?, payment_status = ?, updated_at = NOW() WHERE id = ?', [Money::toDecimal($refunded), $status, $o['id']]);
        if ($r['return_id']) {
            DB::exec("UPDATE returns SET status = 'refunded', updated_at = NOW() WHERE id = ?", [$r['return_id']]);
        }
        self::event((int) $o['id'], $r['seller_order_id'] ? (int) $r['seller_order_id'] : null, 'refunded', Money::toDecimal(Money::toPoisha($r['amount'])));
        Notify::user((int) $o['user_id'], 'refundSent', ['number' => $o['number'], 'amount' => Money::format($r['amount'], $o['locale'])], 'account/orders/' . $o['number'], true, true);
    }

    public static function returnWindowOpen(array $parcel): bool
    {
        if ($parcel['status'] !== 'delivered' || !$parcel['delivered_at']) {
            return false;
        }
        return strtotime($parcel['delivered_at']) + 86400 * Settings::int('orders.return_window_days') > time();
    }

    /** Cancels online orders whose payment window passed, after asking the gateway one last time. */
    public static function expireUnpaid(int $limit = 20): int
    {
        $count = 0;
        $rows = DB::all("SELECT * FROM orders WHERE status = 'awaiting_payment' AND payment_due_at IS NOT NULL AND payment_due_at < NOW() ORDER BY payment_due_at LIMIT " . (int) $limit);
        foreach ($rows as $o) {
            $pending = DB::all("SELECT * FROM payments WHERE order_id = ? AND status IN ('initiated', 'pending') ORDER BY id DESC", [$o['id']]);
            $paid = false;
            foreach ($pending as $p) {
                try {
                    if (Payments::check($p) === 'paid') {
                        $paid = true;
                        break;
                    }
                } catch (\Throwable $e) {
                    \App\Core\ErrorHandler::log('payments', 'Status check for payment ' . $p['id'] . ' failed: ' . $e->getMessage());
                    // Try again on the next run rather than cancel blindly, for up to a day.
                    if (strtotime($o['payment_due_at']) > time() - 86400) {
                        continue 2;
                    }
                }
            }
            if ($paid) {
                continue;
            }
            DB::exec("UPDATE payments SET status = 'expired', updated_at = NOW() WHERE order_id = ? AND status IN ('initiated', 'pending')", [$o['id']]);
            if (self::cancel((int) $o['id'], 'payment_timeout', null, 'system')) {
                $count++;
            }
        }
        return $count;
    }
}
