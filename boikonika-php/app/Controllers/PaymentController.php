<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\ErrorHandler;
use App\Core\HttpException;
use App\Core\RateLimit;
use App\Core\Request;
use App\Core\Response;
use App\Services\Payments;
use App\Services\UserError;

final class PaymentController
{
    /** "Pay now" on an order that is waiting for its online payment. */
    public function pay(Request $req, string $number): Response
    {
        $order = DB::one('SELECT * FROM orders WHERE number = ? AND user_id = ?', [$number, Auth::id()]) ?? throw new HttpException(404);
        RateLimit::enforce('pay:' . $order['id'], 10, 600);
        try {
            return redirect(Payments::start($order));
        } catch (UserError $e) {
            flash('error', $e->text());
            return redirect(url('account/orders/' . $order['number']));
        }
    }

    private function backToOrder(?array $order, string $result): Response
    {
        if (!$order) {
            return redirect(url('account/orders'));
        }
        return redirect(url('account/orders/' . $order['number'], ['payment' => $result], $order['locale']));
    }

    private static function outcome(?array $order): string
    {
        if (!$order) {
            return 'failed';
        }
        return match ($order['payment_status']) {
            'paid' => 'success',
            'pending' => 'retry',
            default => 'failed',
        };
    }

    public function bkashCallback(Request $req, string $ref): Response
    {
        RateLimit::enforce('gw:' . $req->ip(), 60, 300);
        $status = $req->query('status');
        $paymentId = $req->query('paymentID');
        if (!preg_match('/^[A-F0-9]{20}$/', $ref) || $paymentId === '') {
            return redirect(url('account/orders'));
        }
        try {
            $order = Payments::bkashReturn($ref, $paymentId, $status);
        } catch (\Throwable $e) {
            ErrorHandler::report($e);
            $order = DB::one('SELECT o.* FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.reference = ?', [$ref]);
            return $this->backToOrder($order, 'check');
        }
        return $this->backToOrder($order, $status === 'cancel' ? 'cancelled' : self::outcome($order));
    }

    public function sslReturn(Request $req): Response
    {
        RateLimit::enforce('gw:' . $req->ip(), 60, 300);
        try {
            $order = Payments::sslReturn($_POST);
        } catch (\Throwable $e) {
            ErrorHandler::report($e);
            $order = DB::one('SELECT o.* FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.reference = ?', [(string) ($_POST['tran_id'] ?? '')]);
            return $this->backToOrder($order, 'check');
        }
        $cancelled = str_ends_with($req->path, '/cancel');
        return $this->backToOrder($order, $cancelled && ($order['payment_status'] ?? '') !== 'paid' ? 'cancelled' : self::outcome($order));
    }

    /** Server-to-server notice from SSLCOMMERZ. */
    public function sslIpn(Request $req): Response
    {
        try {
            Payments::sslReturn($_POST);
        } catch (\Throwable $e) {
            ErrorHandler::report($e);
            return Response::text('ERROR', 'text/plain', 500);
        }
        return Response::text('OK');
    }
}
