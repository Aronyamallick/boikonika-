<?php
declare(strict_types=1);

namespace App\Controllers\Seller;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Money;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Services\Notify;
use App\Services\Orders;

/** Parcels a seller has to confirm, pack, ship and deliver, and buyers' return requests. */
final class OrdersController
{
    use SellerPage;

    public function index(Request $req): Response
    {
        $sid = $this->sid();
        $status = in_array($req->query('status'), ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'], true) ? $req->query('status') : '';
        $where = "so.seller_id = ? AND so.status <> 'awaiting_payment'";
        $params = [$sid];
        if ($status !== '') {
            $where .= ' AND so.status = ?';
            $params[] = $status;
        }
        $q = mb_substr($req->query('q'), 0, 40);
        if ($q !== '') {
            $where .= ' AND (so.number LIKE ? OR o.ship_name LIKE ?)';
            array_push($params, '%' . $q . '%', '%' . $q . '%');
        }
        $total = (int) DB::val("SELECT COUNT(*) FROM seller_orders so JOIN orders o ON o.id = so.order_id WHERE {$where}", $params);
        $pager = new Paginator($total, 25);
        $rows = DB::all("SELECT so.*, o.ship_name, o.ship_district, o.payment_method, o.payment_status, (SELECT SUM(quantity) FROM order_items i WHERE i.seller_order_id = so.id) AS items,
            (SELECT r.status FROM returns r WHERE r.seller_order_id = so.id ORDER BY r.id DESC LIMIT 1) AS return_status
            FROM seller_orders so JOIN orders o ON o.id = so.order_id WHERE {$where} ORDER BY so.id DESC" . $pager->sql(), $params);
        $counts = [];
        foreach (DB::all("SELECT status, COUNT(*) AS n FROM seller_orders WHERE seller_id = ? AND status <> 'awaiting_payment' GROUP BY status", [$sid]) as $c) {
            $counts[$c['status']] = (int) $c['n'];
        }
        return $this->page('orders', ['title' => t('seller.orders'), 'rows' => $rows, 'pager' => $pager, 'status' => $status, 'counts' => $counts, 'q' => $q]);
    }

    private function parcel(string $number): array
    {
        return DB::one("SELECT so.*, o.number AS order_number, o.ship_name, o.ship_phone, o.ship_address, o.ship_area, o.ship_district, o.ship_division, o.ship_postcode, o.note, o.payment_method, o.payment_status, o.shipping_method_name, o.created_at AS ordered_at
            FROM seller_orders so JOIN orders o ON o.id = so.order_id WHERE so.number = ? AND so.seller_id = ? AND so.status <> 'awaiting_payment'", [$number, $this->sid()]) ?? throw new HttpException(404);
    }

    public function show(Request $req, string $number): Response
    {
        $p = $this->parcel($number);
        $items = DB::all('SELECT i.*, l.sku FROM order_items i LEFT JOIN listings l ON l.id = i.listing_id WHERE i.seller_order_id = ?', [$p['id']]);
        $events = DB::all('SELECT * FROM order_events WHERE order_id = ? AND (seller_order_id = ? OR seller_order_id IS NULL) ORDER BY id', [$p['order_id'], $p['id']]);
        $return = DB::one('SELECT * FROM returns WHERE seller_order_id = ? ORDER BY id DESC LIMIT 1', [$p['id']]);
        // Cash to collect: what the buyer pays for this parcel when it's cash on delivery.
        $collect = $p['payment_method'] === 'cod' && $p['payment_status'] === 'unpaid' ? $p['total'] : null;
        return $this->page('order', ['title' => t('seller.parcelTitle', ['number' => $p['number']]), 'p' => $p, 'items' => $items, 'events' => $events, 'return' => $return, 'collect' => $collect, 'next' => Orders::TRANSITIONS[$p['status']] ?? []]);
    }

    public function status(Request $req, string $number): Response
    {
        $p = $this->parcel($number);
        $to = $req->str('to');
        if ($to === 'cancelled') {
            return back();
        }
        $err = Orders::setParcelStatus((int) $p['id'], $to, ['courier' => $req->str('courier'), 'tracking' => $req->str('tracking')], Auth::id(), 'seller');
        if ($err) {
            return back()->with('error', t($err))->withInput();
        }
        return redirect(url('seller/orders/' . $number))->with('success', t('seller.statusUpdated', ['status' => status_label('parcel', $to)]));
    }

    public function cancel(Request $req, string $number): Response
    {
        $p = $this->parcel($number);
        $reason = in_array($req->str('reason'), ['out_of_stock', 'cannot_deliver', 'buyer_request', 'other'], true) ? $req->str('reason') : 'other';
        if (!Orders::cancelParcel((int) $p['id'], $reason, Auth::id(), 'seller')) {
            return back()->with('error', t('orders.cannotChange'));
        }
        return redirect(url('seller/orders/' . $number))->with('success', t('seller.parcelCancelled'));
    }

    /** approve / reject / received */
    public function respondReturn(Request $req, string $id): Response
    {
        $r = DB::one('SELECT r.*, so.number, so.seller_id, so.total, so.status AS parcel_status, o.user_id, o.number AS order_number, o.payment_status FROM returns r JOIN seller_orders so ON so.id = r.seller_order_id JOIN orders o ON o.id = r.order_id WHERE r.id = ? AND so.seller_id = ?', [(int) $id, $this->sid()]) ?? throw new HttpException(404);
        $action = $req->str('action');
        $note = mb_substr($req->str('note'), 0, 500);
        return self::decide($r, $action, $note, (bool) $req->bool('restock'), 'seller', url('seller/orders/' . $r['number']));
    }

    /** Shared with the admin returns screen. */
    public static function decide(array $r, string $action, string $note, bool $restock, string $by, string $back): Response
    {
        $allowed = ['requested' => ['approve', 'reject'], 'approved' => ['received', 'reject']][$r['status']] ?? [];
        if (!in_array($action, $allowed, true)) {
            return redirect($back)->with('error', t('orders.cannotChange'));
        }
        if ($action === 'reject' && $note === '') {
            return redirect($back)->with('error', t('seller.reasonRequired'));
        }
        $status = ['approve' => 'approved', 'reject' => 'rejected', 'received' => 'received'][$action];
        DB::tx(static function () use ($r, $status, $note, $restock): void {
            DB::exec('UPDATE returns SET status = ?, response_note = ?, updated_at = NOW() WHERE id = ?', [$status, $note !== '' ? $note : null, $r['id']]);
            Orders::event((int) $r['order_id'], (int) $r['seller_order_id'], 'return_' . ($status === 'approved' ? 'approved' : ($status === 'rejected' ? 'rejected' : 'received')), $note ?: null, Auth::id());
            if ($status === 'received') {
                DB::exec("UPDATE seller_orders SET status = 'returned', updated_at = NOW() WHERE id = ? AND status = 'delivered'", [$r['seller_order_id']]);
                if ($restock) {
                    Orders::restock((int) $r['seller_order_id']);
                }
                Orders::sync((int) $r['order_id']);
                if (in_array($r['payment_status'], ['paid', 'partially_refunded'], true)) {
                    Orders::requestRefund((int) $r['order_id'], (int) $r['seller_order_id'], Money::toPoisha($r['total']), 'return', Auth::id(), (int) $r['id']);
                }
            }
        });
        if ($restock && $status === 'received') {
            \App\Services\Catalog::refresh(array_map('intval', DB::col('SELECT DISTINCT product_id FROM order_items WHERE seller_order_id = ? AND product_id IS NOT NULL', [$r['seller_order_id']])));
        }
        $key = ['approved' => 'returnApproved', 'rejected' => 'returnRejected', 'received' => 'returnReceived'][$status];
        Notify::user((int) $r['user_id'], $key, ['number' => $r['order_number'], 'note' => $note], 'account/orders/' . $r['order_number'], true, true);
        if ($status === 'received') {
            Notify::staff('refunds.manage', 'staffRefundNeeded', ['number' => $r['number']], 'admin/refunds');
        }
        return redirect($back)->with('success', t('seller.returnUpdated'));
    }
}
