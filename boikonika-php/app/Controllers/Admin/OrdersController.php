<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Audit;
use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Money;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Services\Catalog;
use App\Services\Orders;
use App\Services\Payments;

final class OrdersController
{
    use AdminPage;

    public function index(Request $req): Response
    {
        $status = in_array($req->query('status'), ['awaiting_payment', 'placed', 'completed', 'cancelled'], true) ? $req->query('status') : '';
        $payment = in_array($req->query('payment'), ['unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled'], true) ? $req->query('payment') : '';
        $q = mb_substr($req->query('q'), 0, 80);
        $where = ['1=1'];
        $params = [];
        if ($status !== '') {
            $where[] = 'o.status = ?';
            $params[] = $status;
        }
        if ($payment !== '') {
            $where[] = 'o.payment_status = ?';
            $params[] = $payment;
        }
        if ($req->query('stuck') === '1') {
            $where[] = "EXISTS (SELECT 1 FROM seller_orders so WHERE so.order_id = o.id AND so.status = 'pending' AND so.created_at < DATE_SUB(NOW(), INTERVAL 2 DAY))";
        }
        if ($q !== '') {
            $like = '%' . Catalog::likeEscape($q) . '%';
            $where[] = '(o.number LIKE ? OR o.ship_name LIKE ? OR o.ship_phone LIKE ? OR u.email LIKE ?)';
            array_push($params, $like, $like, '%' . Catalog::likeEscape(to_ascii_digits($q)) . '%', $like);
        }
        $w = implode(' AND ', $where);
        $total = (int) DB::val("SELECT COUNT(*) FROM orders o JOIN users u ON u.id = o.user_id WHERE {$w}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT o.*, u.name AS buyer, (SELECT COUNT(*) FROM seller_orders so WHERE so.order_id = o.id) AS parcels FROM orders o JOIN users u ON u.id = o.user_id WHERE {$w} ORDER BY o.id DESC" . $pager->sql(), $params);
        return $this->page('orders', ['title' => t('admin.orders'), 'rows' => $rows, 'pager' => $pager, 'status' => $status, 'payment' => $payment, 'q' => $q]);
    }

    private function order(string $number): array
    {
        return DB::one('SELECT o.*, u.name AS buyer, u.email AS buyer_email, u.phone AS buyer_phone FROM orders o JOIN users u ON u.id = o.user_id WHERE o.number = ?', [$number]) ?? throw new HttpException(404);
    }

    public function show(Request $req, string $number): Response
    {
        $o = $this->order($number);
        return $this->page('order', [
            'title' => t('orders.orderTitle', ['number' => $o['number']]),
            'o' => $o,
            'parcels' => Orders::parcels((int) $o['id']),
            'payments' => DB::all('SELECT * FROM payments WHERE order_id = ? ORDER BY id', [$o['id']]),
            'refunds' => DB::all('SELECT * FROM refunds WHERE order_id = ? ORDER BY id', [$o['id']]),
            'events' => DB::all('SELECT e.*, u.name AS actor FROM order_events e LEFT JOIN users u ON u.id = e.actor_user_id WHERE e.order_id = ? ORDER BY e.id', [$o['id']]),
        ]);
    }

    public function cancel(Request $req, string $number): Response
    {
        $o = $this->order($number);
        $reason = in_array($req->str('reason'), ['out_of_stock', 'cannot_deliver', 'buyer_request', 'fraud_suspected', 'other'], true) ? $req->str('reason') : 'other';
        if (!Orders::cancel((int) $o['id'], $reason, Auth::id(), 'admin')) {
            return back()->with('error', t('orders.cannotChange'));
        }
        Audit::log('order.cancelled', 'order', $o['id'], ['reason' => $reason]);
        return back()->with('success', t('orders.cancelled'));
    }

    public function parcelStatus(Request $req, string $number, string $id): Response
    {
        $o = $this->order($number);
        $p = DB::one('SELECT * FROM seller_orders WHERE id = ? AND order_id = ?', [(int) $id, $o['id']]) ?? throw new HttpException(404);
        $to = $req->str('to');
        $err = Orders::setParcelStatus((int) $p['id'], $to, ['courier' => $req->str('courier'), 'tracking' => $req->str('tracking'), 'reason' => $req->str('reason') ?: 'other'], Auth::id(), 'admin');
        if ($err) {
            return back()->with('error', t($err));
        }
        Audit::log('parcel.' . $to, 'seller_order', $p['id']);
        return back()->with('success', t('seller.statusUpdated', ['status' => status_label('parcel', $to)]));
    }

    /** Asks the gateway again (for a buyer who says they paid). */
    public function checkPayment(Request $req, string $number, string $id): Response
    {
        $o = $this->order($number);
        $p = DB::one('SELECT * FROM payments WHERE id = ? AND order_id = ?', [(int) $id, $o['id']]) ?? throw new HttpException(404);
        try {
            $status = Payments::check($p);
        } catch (\Throwable $e) {
            \App\Core\ErrorHandler::report($e);
            return back()->with('error', t('admin.gatewayError'));
        }
        Audit::log('payment.checked', 'payment', $p['id'], ['status' => $status]);
        return back()->with('info', t('admin.gatewaySays', ['status' => status_label('attempt', $status)]));
    }

    public function createRefund(Request $req, string $number): Response
    {
        $o = $this->order($number);
        $amount = $req->str('amount');
        if (!Money::valid($amount, false)) {
            return back()->with('error', t('validation.moneyPositive'));
        }
        $paid = Money::toPoisha($o['total']) - Money::toPoisha($o['refunded_total']) - Money::toPoisha((string) DB::val("SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE order_id = ? AND status IN ('requested', 'processing')", [$o['id']]));
        if (!in_array($o['payment_status'], ['paid', 'partially_refunded'], true) || Money::toPoisha($amount) > $paid) {
            return back()->with('error', t('admin.refundTooMuch', ['max' => money(max(0, $paid))]));
        }
        $soId = $req->int('seller_order_id') ?: null;
        if ($soId && !DB::val('SELECT 1 FROM seller_orders WHERE id = ? AND order_id = ?', [$soId, $o['id']])) {
            $soId = null;
        }
        $rid = Orders::requestRefund((int) $o['id'], $soId, Money::toPoisha($amount), mb_substr($req->str('reason') ?: 'goodwill', 0, 200), Auth::id());
        Audit::log('refund.created', 'refund', $rid);
        return redirect(url('admin/refunds'))->with('success', t('admin.refundCreated'));
    }
}
