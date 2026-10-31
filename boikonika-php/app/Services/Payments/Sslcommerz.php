<?php
declare(strict_types=1);

namespace App\Services\Payments;

use App\Core\Http;
use App\Core\Money;
use App\Core\Settings;

/**
 * SSLCOMMERZ hosted checkout (cards, Nagad, Rocket, internet banking). Card details are typed on
 * SSLCOMMERZ's page only. Every success/IPN is confirmed with the validation API — status, our
 * transaction id, amount and currency — before the order counts as paid.
 */
final class Sslcommerz
{
    public static function configured(): bool
    {
        return Settings::get('payments.ssl.store_id') !== '' && Settings::get('payments.ssl.store_password') !== '';
    }

    private function base(): string
    {
        return Settings::bool('payments.ssl.sandbox') ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';
    }

    private function creds(): array
    {
        return ['store_id' => (string) Settings::get('payments.ssl.store_id'), 'store_passwd' => (string) Settings::get('payments.ssl.store_password')];
    }

    /** @return array{url:string, sessionKey:?string, raw:array} */
    public function init(array $order, array $payment, array $urls, ?string $email, int $itemCount): array
    {
        $res = Http::postForm($this->base() . '/gwprocess/v4/api.php', $this->creds() + [
            'total_amount' => $payment['amount'],
            'currency' => 'BDT',
            'tran_id' => $payment['reference'],
            'success_url' => $urls['success'],
            'fail_url' => $urls['fail'],
            'cancel_url' => $urls['cancel'],
            'ipn_url' => $urls['ipn'],
            'cus_name' => $order['ship_name'],
            'cus_email' => $email ?: 'no-reply@' . (parse_url((string) \App\Core\App::config('url'), PHP_URL_HOST) ?: 'boikonika.com'),
            'cus_phone' => $order['ship_phone'],
            'cus_add1' => $order['ship_address'],
            'cus_city' => $order['ship_district'],
            'cus_country' => 'Bangladesh',
            'shipping_method' => 'Courier',
            'ship_name' => $order['ship_name'],
            'ship_add1' => $order['ship_address'] . ', ' . $order['ship_area'],
            'ship_city' => $order['ship_district'],
            'ship_postcode' => $order['ship_postcode'] ?: '0000',
            'ship_country' => 'Bangladesh',
            'num_of_item' => (string) $itemCount,
            'product_name' => 'Order ' . $order['number'],
            'product_category' => 'Books',
            'product_profile' => 'physical-goods',
            'value_a' => $order['number'],
        ]);
        $json = $res['json'];
        if (($json['status'] ?? '') !== 'SUCCESS' || empty($json['GatewayPageURL'])) {
            throw new \RuntimeException('SSLCOMMERZ init failed: ' . ($json['failedreason'] ?? ('HTTP ' . $res['status'])));
        }
        return ['url' => (string) $json['GatewayPageURL'], 'sessionKey' => isset($json['sessionkey']) ? (string) $json['sessionkey'] : null, 'raw' => self::clean($json)];
    }

    /** Confirms a val_id from the success page or IPN. */
    public function validate(array $payment, string $valId): array
    {
        $res = Http::get($this->base() . '/validator/api/validationserverAPI.php', ['val_id' => $valId] + $this->creds() + ['format' => 'json']);
        return $this->toResult($payment, $res['json']);
    }

    /** Looks the payment up by our transaction id (when no val_id arrived). */
    public function query(array $payment): array
    {
        $res = Http::get($this->base() . '/validator/api/merchantTransIDvalidationAPI.php', ['tran_id' => $payment['reference']] + $this->creds() + ['format' => 'json']);
        $elements = $res['json']['element'] ?? [];
        foreach ($elements as $e) {
            if (in_array($e['status'] ?? '', ['VALID', 'VALIDATED'], true)) {
                return $this->toResult($payment, $e);
            }
        }
        foreach ($elements as $e) {
            if (($e['status'] ?? '') === 'PENDING') {
                return ['status' => 'pending', 'transactionId' => null, 'raw' => [], 'reason' => null];
            }
        }
        if ($elements) {
            return ['status' => 'failed', 'transactionId' => null, 'raw' => self::clean($elements[0]), 'reason' => (string) ($elements[0]['status'] ?? 'failed')];
        }
        return ['status' => 'pending', 'transactionId' => null, 'raw' => [], 'reason' => null];
    }

    private function toResult(array $payment, array $body): array
    {
        $raw = self::clean($body);
        $status = (string) ($body['status'] ?? '');
        if ($status !== 'VALID' && $status !== 'VALIDATED') {
            return ['status' => $status === 'CANCELLED' ? 'cancelled' : 'failed', 'transactionId' => null, 'raw' => $raw, 'reason' => $status ?: 'invalid'];
        }
        $amount = (string) ($body['currency_amount'] ?? $body['amount'] ?? '');
        $currency = (string) ($body['currency_type'] ?? $body['currency'] ?? 'BDT');
        if (($body['tran_id'] ?? '') !== $payment['reference'] || $currency !== 'BDT' || !preg_match('/^\d+(\.\d{1,2})?$/', $amount) || Money::toPoisha($amount) !== Money::toPoisha($payment['amount'])) {
            return ['status' => 'failed', 'transactionId' => null, 'raw' => $raw, 'reason' => 'validation_mismatch'];
        }
        return ['status' => 'paid', 'transactionId' => (string) ($body['bank_tran_id'] ?? $body['val_id'] ?? ''), 'raw' => $raw, 'reason' => null];
    }

    /** SSLCOMMERZ accepts the refund and settles it with the bank later. */
    public function refund(array $payment, string $amount, string $reason, string $refundRef): array
    {
        $res = Http::get($this->base() . '/validator/api/merchantTransIDvalidationAPI.php', [
            'bank_tran_id' => (string) $payment['transaction_id'],
            'refund_amount' => $amount,
            'refund_remarks' => mb_substr($reason, 0, 200),
            'refe_id' => $refundRef,
        ] + $this->creds() + ['format' => 'json']);
        $json = $res['json'];
        $ok = ($json['APIConnect'] ?? '') === 'DONE' && ($json['status'] ?? '') === 'success';
        return ['ok' => $ok, 'refundId' => isset($json['refund_ref_id']) ? (string) $json['refund_ref_id'] : null, 'raw' => self::clean($json), 'reason' => $ok ? null : (string) ($json['errorReason'] ?? $json['status'] ?? 'refund_failed')];
    }

    public static function clean(array $json): array
    {
        foreach (['store_passwd', 'card_no', 'card_number', 'cus_phone', 'cus_email', 'GatewayPageURL', 'redirectGatewayURL', 'gw', 'desc'] as $k) {
            unset($json[$k]);
        }
        return $json;
    }
}
