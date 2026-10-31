<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Controllers\Seller\OrdersController as SellerOrders;
use App\Core\Audit;
use App\Core\Auth;
use App\Core\Crypto;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Money;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Services\Notify;
use App\Services\Orders;
use App\Services\Payments;

/** Refunds to buyers, returns, and payouts to sellers. */
final class MoneyController
{
    use AdminPage;

    public function refunds(Request $req): Response
    {
        $status = in_array($req->query('status'), ['requested', 'processing', 'completed', 'failed', 'rejected'], true) ? $req->query('status') : '';
        $where = $status !== '' ? 'r.status = ?' : "r.status IN ('requested', 'processing', 'failed')";
        $params = $status !== '' ? [$status] : [];
        $total = (int) DB::val("SELECT COUNT(*) FROM refunds r WHERE {$where}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT r.*, o.number, o.payment_method, o.ship_name, o.ship_phone, so.number AS parcel_number, so.seller_earning, p.provider FROM refunds r JOIN orders o ON o.id = r.order_id
            LEFT JOIN seller_orders so ON so.id = r.seller_order_id LEFT JOIN payments p ON p.id = r.payment_id WHERE {$where} ORDER BY r.id DESC" . $pager->sql(), $params);
        return $this->page('refunds', ['title' => t('admin.refunds'), 'rows' => $rows, 'pager' => $pager, 'status' => $status]);
    }

    /** action: gateway | manual | complete | reject */
    public function processRefund(Request $req, string $id): Response
    {
        $r = DB::one('SELECT * FROM refunds WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        $action = $req->str('action');
        $debit = $req->str('seller_debit');
        if ($debit !== '' && !Money::valid($debit)) {
            return back()->with('error', t('validation.money'));
        }
        $debitPoisha = $debit === '' ? 0 : min(Money::toPoisha($debit), Money::toPoisha($r['amount']));
        if ($action === 'reject') {
            if (!in_array($r['status'], ['requested', 'failed'], true)) {
                return back()->with('error', t('orders.cannotChange'));
            }
            DB::exec("UPDATE refunds SET status = 'rejected', failure_reason = ?, processed_by = ?, processed_at = NOW() WHERE id = ?", [mb_substr($req->str('note'), 0, 255) ?: null, Auth::id(), $r['id']]);
            Audit::log('refund.rejected', 'refund', $r['id']);
            return back()->with('success', t('common.saved'));
        }
        if ($action === 'complete') {
            // An SSLCOMMERZ refund the bank has now settled, confirmed by staff.
            if ($r['status'] !== 'processing') {
                return back()->with('error', t('orders.cannotChange'));
            }
            DB::exec("UPDATE refunds SET status = 'completed', processed_by = ?, processed_at = NOW() WHERE id = ?", [Auth::id(), $r['id']]);
            Orders::refundCompleted((int) $r['id']);
            Audit::log('refund.completed', 'refund', $r['id']);
            return back()->with('success', t('admin.refundDone'));
        }
        if (!in_array($r['status'], ['requested', 'failed'], true)) {
            return back()->with('error', t('orders.cannotChange'));
        }
        if ($action === 'manual') {
            $reference = mb_substr($req->str('reference'), 0, 120);
            if ($reference === '') {
                return back()->with('error', t('admin.referenceRequired'));
            }
            DB::exec("UPDATE refunds SET status = 'completed', method = 'manual', reference = ?, seller_debit = ?, processed_by = ?, processed_at = NOW() WHERE id = ? AND status IN ('requested', 'failed')", [$reference, Money::toDecimal($debitPoisha), Auth::id(), $r['id']]);
            Orders::refundCompleted((int) $r['id']);
            Audit::log('refund.manual', 'refund', $r['id'], ['reference' => $reference]);
            return back()->with('success', t('admin.refundDone'));
        }
        if ($action !== 'gateway') {
            return back();
        }
        // Claim it first so two clicks can't send the money twice.
        if (DB::exec("UPDATE refunds SET status = 'processing', method = 'gateway', seller_debit = ?, processed_by = ? WHERE id = ? AND status IN ('requested', 'failed')", [Money::toDecimal($debitPoisha), Auth::id(), $r['id']]) !== 1) {
            return back()->with('error', t('orders.cannotChange'));
        }
        try {
            $res = Payments::refund($r);
        } catch (\Throwable $e) {
            \App\Core\ErrorHandler::report($e);
            $res = ['ok' => false, 'refundId' => null, 'reason' => 'gateway_error', 'async' => false];
        }
        if (!$res['ok']) {
            DB::exec("UPDATE refunds SET status = 'failed', failure_reason = ? WHERE id = ?", [mb_substr((string) $res['reason'], 0, 255), $r['id']]);
            Audit::log('refund.failed', 'refund', $r['id'], ['reason' => $res['reason']]);
            return back()->with('error', t('admin.refundFailed', ['reason' => (string) $res['reason']]));
        }
        if ($res['async']) {
            DB::exec('UPDATE refunds SET provider_refund_id = ? WHERE id = ?', [$res['refundId'], $r['id']]);
            Audit::log('refund.sent', 'refund', $r['id']);
            return back()->with('success', t('admin.refundSentAsync'));
        }
        DB::exec("UPDATE refunds SET status = 'completed', provider_refund_id = ?, processed_at = NOW() WHERE id = ?", [$res['refundId'], $r['id']]);
        Orders::refundCompleted((int) $r['id']);
        Audit::log('refund.completed', 'refund', $r['id']);
        return back()->with('success', t('admin.refundDone'));
    }

    public function returns(Request $req): Response
    {
        $status = in_array($req->query('status'), ['requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled'], true) ? $req->query('status') : '';
        $where = $status !== '' ? 'r.status = ?' : "r.status IN ('requested', 'approved', 'received')";
        $params = $status !== '' ? [$status] : [];
        $total = (int) DB::val("SELECT COUNT(*) FROM returns r WHERE {$where}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT r.*, so.number, so.total, s.store_name, o.number AS order_number, u.name AS buyer FROM returns r JOIN seller_orders so ON so.id = r.seller_order_id JOIN sellers s ON s.id = so.seller_id JOIN orders o ON o.id = r.order_id JOIN users u ON u.id = r.user_id WHERE {$where} ORDER BY r.id DESC" . $pager->sql(), $params);
        return $this->page('returns', ['title' => t('admin.returns'), 'rows' => $rows, 'pager' => $pager, 'status' => $status]);
    }

    public function decideReturn(Request $req, string $id): Response
    {
        $r = DB::one('SELECT r.*, so.number, so.seller_id, so.total, o.user_id, o.number AS order_number, o.payment_status FROM returns r JOIN seller_orders so ON so.id = r.seller_order_id JOIN orders o ON o.id = r.order_id WHERE r.id = ?', [(int) $id]) ?? throw new HttpException(404);
        Audit::log('return.' . $req->str('action'), 'return', $r['id']);
        return SellerOrders::decide($r, $req->str('action'), mb_substr($req->str('note'), 0, 500), $req->bool('restock'), 'admin', url('admin/returns'));
    }

    public function payouts(Request $req): Response
    {
        $status = in_array($req->query('status'), ['requested', 'processing', 'paid', 'rejected', 'cancelled'], true) ? $req->query('status') : '';
        $where = $status !== '' ? 'p.status = ?' : "p.status IN ('requested', 'processing')";
        $params = $status !== '' ? [$status] : [];
        $total = (int) DB::val("SELECT COUNT(*) FROM payouts p WHERE {$where}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT p.*, s.store_name, s.id AS sid FROM payouts p JOIN sellers s ON s.id = p.seller_id WHERE {$where} ORDER BY p.id DESC" . $pager->sql(), $params);
        return $this->page('payouts', ['title' => t('admin.payouts'), 'rows' => $rows, 'pager' => $pager, 'status' => $status]);
    }

    /** Full account details for sending the money; each view is logged. */
    public function payoutAccount(Request $req, string $id): Response
    {
        $p = DB::one('SELECT p.*, a.method, a.account_name, a.account_number_enc, a.bank_name, a.branch, a.routing_number, s.store_name FROM payouts p JOIN sellers s ON s.id = p.seller_id LEFT JOIN payout_accounts a ON a.id = p.payout_account_id WHERE p.id = ?', [(int) $id]) ?? throw new HttpException(404);
        Audit::log('payout.account_viewed', 'payout', $p['id']);
        $p['account_number'] = Crypto::decrypt($p['account_number_enc']);
        unset($p['account_number_enc']);
        return $this->page('payout-account', ['title' => t('admin.payoutDetails'), 'p' => $p]);
    }

    /** action: processing | paid | reject */
    public function processPayout(Request $req, string $id): Response
    {
        $p = DB::one('SELECT p.*, s.user_id, s.store_name FROM payouts p JOIN sellers s ON s.id = p.seller_id WHERE p.id = ?', [(int) $id]) ?? throw new HttpException(404);
        $action = $req->str('action');
        $note = mb_substr($req->str('note'), 0, 500);
        $reference = mb_substr($req->str('reference'), 0, 120);
        $from = ['processing' => ['requested'], 'paid' => ['requested', 'processing'], 'reject' => ['requested', 'processing']][$action] ?? [];
        if (!in_array($p['status'], $from, true)) {
            return back()->with('error', t('orders.cannotChange'));
        }
        if ($action === 'paid' && $reference === '') {
            return back()->with('error', t('admin.referenceRequired'));
        }
        if ($action === 'reject' && $note === '') {
            return back()->with('error', t('seller.reasonRequired'));
        }
        $to = ['processing' => 'processing', 'paid' => 'paid', 'reject' => 'rejected'][$action];
        DB::exec('UPDATE payouts SET status = ?, reference = COALESCE(?, reference), note = COALESCE(?, note), processed_by = ?, processed_at = NOW() WHERE id = ?', [$to, $reference ?: null, $note ?: null, Auth::id(), $p['id']]);
        Audit::log('payout.' . $to, 'payout', $p['id'], ['reference' => $reference]);
        if ($to !== 'processing') {
            Notify::user((int) $p['user_id'], $to === 'paid' ? 'payoutPaid' : 'payoutRejected', ['amount' => money($p['amount']), 'reference' => $reference, 'note' => $note], 'seller/payouts', true, true);
        }
        return back()->with('success', t('common.saved'));
    }
}
