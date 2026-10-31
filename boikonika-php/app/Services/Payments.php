<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\DB;
use App\Core\Money;
use App\Core\Settings;
use App\Services\Payments\Bkash;
use App\Services\Payments\Sslcommerz;

/** Starts online payments and handles what the gateways send back. */
final class Payments
{
    public static function available(string $provider): bool
    {
        return match ($provider) {
            'bkash' => Settings::bool('payments.bkash.enabled') && Bkash::configured(),
            'sslcommerz' => Settings::bool('payments.ssl.enabled') && Sslcommerz::configured(),
            default => false,
        };
    }

    /** Creates a payment attempt and returns the gateway page to send the buyer to. */
    public static function start(array $order): string
    {
        if ($order['status'] !== 'awaiting_payment' || $order['payment_status'] === 'paid') {
            throw new UserError('payment.notPayable');
        }
        $provider = $order['payment_method'];
        if (!self::available($provider)) {
            throw new UserError('checkout.methodOff');
        }
        $reference = strtoupper(bin2hex(random_bytes(10)));
        $paymentId = DB::insert('payments', [
            'order_id' => $order['id'],
            'provider' => $provider,
            'reference' => $reference,
            'amount' => $order['total'],
            'status' => 'initiated',
            'created_at' => DB::now(),
            'updated_at' => DB::now(),
        ]);
        $payment = DB::one('SELECT * FROM payments WHERE id = ?', [$paymentId]);
        try {
            if ($provider === 'bkash') {
                $r = (new Bkash())->create(
                    Money::toDecimal(Money::toPoisha($order['total'])),
                    $reference,
                    $order['ship_phone'],
                    abs_url('payment/bkash/callback/' . $reference, [], 'bn'),
                    $order['number'],
                );
                DB::exec("UPDATE payments SET status = 'pending', provider_payment_id = ?, raw = ?, updated_at = NOW() WHERE id = ?", [$r['paymentID'], json_encode($r['raw'], JSON_UNESCAPED_UNICODE), $paymentId]);
                $url = $r['bkashURL'];
            } else {
                $email = DB::val('SELECT email FROM users WHERE id = ?', [$order['user_id']]);
                $items = (int) DB::val('SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = ?', [$order['id']]);
                $r = (new Sslcommerz())->init($order, $payment, [
                    'success' => abs_url('payment/sslcommerz/success', [], 'bn'),
                    'fail' => abs_url('payment/sslcommerz/fail', [], 'bn'),
                    'cancel' => abs_url('payment/sslcommerz/cancel', [], 'bn'),
                    'ipn' => abs_url('payment/sslcommerz/ipn', [], 'bn'),
                ], $email ? (string) $email : null, $items);
                DB::exec("UPDATE payments SET status = 'pending', provider_payment_id = ?, raw = ?, updated_at = NOW() WHERE id = ?", [$r['sessionKey'], json_encode($r['raw'], JSON_UNESCAPED_UNICODE), $paymentId]);
                $url = $r['url'];
            }
        } catch (\Throwable $e) {
            \App\Core\ErrorHandler::log('payments', 'Start ' . $provider . ' for ' . $order['number'] . ' failed: ' . $e->getMessage());
            DB::exec("UPDATE payments SET status = 'failed', failure_reason = ?, updated_at = NOW() WHERE id = ?", [mb_substr($e->getMessage(), 0, 255), $paymentId]);
            throw new UserError('payment.startFailed');
        }
        if (!preg_match('#^https://#', $url)) {
            throw new UserError('payment.startFailed');
        }
        Orders::event((int) $order['id'], null, 'payment_started', $provider);
        return $url;
    }

    /** bKash sends the buyer back with ?paymentID=…&status=success|failure|cancel. @return ?array the order */
    public static function bkashReturn(string $reference, string $paymentId, string $status): ?array
    {
        $p = DB::one("SELECT * FROM payments WHERE reference = ? AND provider = 'bkash'", [$reference]);
        if (!$p || ($p['provider_payment_id'] !== null && !hash_equals((string) $p['provider_payment_id'], $paymentId))) {
            return null;
        }
        if ($p['status'] === 'pending' || $p['status'] === 'initiated') {
            if ($status === 'success') {
                $r = (new Bkash())->execute($paymentId);
                self::apply($p, $r);
            } else {
                Orders::paymentFailed((int) $p['id'], $status === 'cancel' ? 'cancelled' : 'failed', $status, []);
            }
        }
        return DB::one('SELECT * FROM orders WHERE id = ?', [$p['order_id']]);
    }

    /** SSLCOMMERZ success / fail / cancel pages and the IPN post the same fields. */
    public static function sslReturn(array $post): ?array
    {
        $reference = (string) ($post['tran_id'] ?? '');
        $p = DB::one("SELECT * FROM payments WHERE reference = ? AND provider = 'sslcommerz'", [$reference]);
        if (!$p) {
            return null;
        }
        if (in_array($p['status'], ['pending', 'initiated'], true)) {
            $gw = new Sslcommerz();
            $valId = (string) ($post['val_id'] ?? '');
            $r = $valId !== '' ? $gw->validate($p, $valId) : $gw->query($p);
            if ($r['status'] === 'failed' && $valId === '' && in_array($post['status'] ?? '', ['CANCELLED'], true)) {
                $r['status'] = 'cancelled';
            }
            if ($r['status'] !== 'pending' || in_array($post['status'] ?? '', ['FAILED', 'CANCELLED'], true)) {
                self::apply($p, $r);
            }
        }
        return DB::one('SELECT * FROM orders WHERE id = ?', [$p['order_id']]);
    }

    /** Asks the gateway about a payment (payment expiry, staff "check again"). Returns the status. */
    public static function check(array $p): string
    {
        if (!in_array($p['status'], ['pending', 'initiated'], true)) {
            return $p['status'];
        }
        if ($p['provider_payment_id'] === null && $p['provider'] === 'bkash') {
            return 'failed';
        }
        $r = $p['provider'] === 'bkash' ? (new Bkash())->status((string) $p['provider_payment_id']) : (new Sslcommerz())->query($p);
        if ($r['status'] === 'paid') {
            self::apply($p, $r);
        }
        return $r['status'];
    }

    private static function apply(array $p, array $r): void
    {
        if ($r['status'] === 'paid') {
            if (isset($r['amount']) && $r['amount'] !== null && Money::toPoisha((string) $r['amount']) !== Money::toPoisha($p['amount'])) {
                Orders::paymentFailed((int) $p['id'], 'failed', 'amount_mismatch', $r['raw']);
                return;
            }
            Orders::markPaid((int) $p['id'], (string) $r['transactionId'], $r['raw']);
        } elseif ($r['status'] === 'failed' || $r['status'] === 'cancelled') {
            Orders::paymentFailed((int) $p['id'], $r['status'], $r['reason'] ?? null, $r['raw']);
        }
    }

    /** Sends a refund through the gateway the money came from. @return array{ok:bool, refundId:?string, reason:?string, async:bool} */
    public static function refund(array $refund): array
    {
        $p = $refund['payment_id'] ? DB::one('SELECT * FROM payments WHERE id = ?', [$refund['payment_id']]) : null;
        if (!$p || $p['status'] !== 'paid') {
            return ['ok' => false, 'refundId' => null, 'reason' => 'no_online_payment', 'async' => false];
        }
        if ($p['provider'] === 'bkash') {
            $r = (new Bkash())->refund((string) $p['provider_payment_id'], (string) $p['transaction_id'], $refund['amount'], 'R' . $refund['id'], (string) $refund['reason']);
            return ['ok' => $r['ok'], 'refundId' => $r['refundId'], 'reason' => $r['reason'], 'async' => false];
        }
        $r = (new Sslcommerz())->refund($p, $refund['amount'], (string) $refund['reason'], 'R' . $refund['id']);
        return ['ok' => $r['ok'], 'refundId' => $r['refundId'], 'reason' => $r['reason'], 'async' => true];
    }
}
