<?php
declare(strict_types=1);

namespace App\Services\Payments;

use App\Core\Crypto;
use App\Core\Http;
use App\Core\Settings;

/**
 * bKash Tokenized Checkout (v1.2.0-beta): grant token → create → buyer approves on bKash → execute
 * (or query status) → paid. Refunds use the same token.
 */
final class Bkash
{
    private const SANDBOX = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout';
    private const LIVE = 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout';
    private const TOKEN_KEY = 'payments.bkash.token_cache';

    public static function configured(): bool
    {
        return Settings::get('payments.bkash.username') !== '' && Settings::get('payments.bkash.password') !== ''
            && Settings::get('payments.bkash.app_key') !== '' && Settings::get('payments.bkash.app_secret') !== '';
    }

    private function base(): string
    {
        return Settings::bool('payments.bkash.sandbox') ? self::SANDBOX : self::LIVE;
    }

    private function token(bool $fresh = false): string
    {
        if (!$fresh) {
            $cached = json_decode((string) Crypto::decrypt(Settings::get(self::TOKEN_KEY)), true);
            if (is_array($cached) && ($cached['expires'] ?? 0) > time() && ($cached['base'] ?? '') === $this->base()) {
                return (string) $cached['token'];
            }
        }
        $res = Http::postJson($this->base() . '/token/grant', [
            'app_key' => Settings::get('payments.bkash.app_key'),
            'app_secret' => Settings::get('payments.bkash.app_secret'),
        ], [
            'username' => (string) Settings::get('payments.bkash.username'),
            'password' => (string) Settings::get('payments.bkash.password'),
        ]);
        $token = $res['json']['id_token'] ?? null;
        if (!is_string($token) || $token === '') {
            throw new \RuntimeException('bKash token grant failed: ' . ($res['json']['statusMessage'] ?? $res['json']['msg'] ?? ('HTTP ' . $res['status'])));
        }
        $ttl = max(60, (int) ($res['json']['expires_in'] ?? 3600) - 120);
        Settings::set(self::TOKEN_KEY, Crypto::encrypt(json_encode(['token' => $token, 'expires' => time() + $ttl, 'base' => $this->base()])));
        return $token;
    }

    private function call(string $path, array $body): array
    {
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $res = Http::postJson($this->base() . $path, $body, [
                'Authorization' => $this->token($attempt > 0),
                'X-APP-Key' => (string) Settings::get('payments.bkash.app_key'),
            ]);
            if ($res['status'] !== 401) {
                return $res['json'];
            }
        }
        throw new \RuntimeException('bKash refused the access token');
    }

    /** @return array{paymentID:string, bkashURL:string, raw:array} */
    public function create(string $amount, string $reference, string $payer, string $callbackUrl, string $invoice): array
    {
        $json = $this->call('/create', [
            'mode' => '0011',
            'payerReference' => preg_replace('/^\+?88/', '', $payer) ?: $reference,
            'callbackURL' => $callbackUrl,
            'amount' => $amount,
            'currency' => 'BDT',
            'intent' => 'sale',
            'merchantInvoiceNumber' => $invoice,
        ]);
        if (($json['statusCode'] ?? '') !== '0000' || empty($json['paymentID']) || empty($json['bkashURL'])) {
            throw new \RuntimeException('bKash create failed: ' . ($json['statusMessage'] ?? 'unknown'));
        }
        return ['paymentID' => (string) $json['paymentID'], 'bkashURL' => (string) $json['bkashURL'], 'raw' => self::clean($json)];
    }

    /** @return array{status:string, transactionId:?string, amount:?string, raw:array} status: paid|pending|failed */
    public function execute(string $paymentId): array
    {
        $json = $this->call('/execute', ['paymentID' => $paymentId]);
        if (($json['statusCode'] ?? '') !== '0000') {
            $json = $this->call('/payment/status', ['paymentID' => $paymentId]);
        }
        return self::result($json);
    }

    public function status(string $paymentId): array
    {
        return self::result($this->call('/payment/status', ['paymentID' => $paymentId]));
    }

    /** @return array{ok:bool, refundId:?string, raw:array, reason:?string} */
    public function refund(string $paymentId, string $trxId, string $amount, string $sku, string $reason): array
    {
        $json = $this->call('/payment/refund', ['paymentID' => $paymentId, 'trxID' => $trxId, 'amount' => $amount, 'sku' => mb_substr($sku, 0, 255), 'reason' => mb_substr($reason, 0, 255)]);
        $ok = ($json['transactionStatus'] ?? '') === 'Completed';
        return ['ok' => $ok, 'refundId' => isset($json['refundTrxID']) ? (string) $json['refundTrxID'] : null, 'raw' => self::clean($json), 'reason' => $ok ? null : (string) ($json['statusMessage'] ?? $json['errorMessage'] ?? 'refund_failed')];
    }

    private static function result(array $json): array
    {
        $ts = (string) ($json['transactionStatus'] ?? '');
        $status = match ($ts) {
            'Completed' => 'paid',
            'Initiated', 'Pending Authorized', 'Authorized' => 'pending',
            default => 'failed',
        };
        return ['status' => $status, 'transactionId' => isset($json['trxID']) ? (string) $json['trxID'] : null, 'amount' => isset($json['amount']) ? (string) $json['amount'] : null, 'raw' => self::clean($json), 'reason' => $status === 'failed' ? (string) ($json['statusMessage'] ?? $ts ?: 'failed') : null];
    }

    /** Keeps the reply for support, without account numbers or tokens. */
    public static function clean(array $json): array
    {
        unset($json['id_token'], $json['refresh_token'], $json['bkashURL']);
        if (isset($json['customerMsisdn'])) {
            $json['customerMsisdn'] = mask_phone((string) $json['customerMsisdn']);
        }
        return $json;
    }
}
