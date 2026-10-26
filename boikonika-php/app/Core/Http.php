<?php
declare(strict_types=1);

namespace App\Core;

/** Outbound HTTPS calls to payment gateways (cURL, TLS verified, short timeouts). */
final class Http
{
    /** @return array{status:int, body:string, json:array} */
    public static function request(string $method, string $url, array $headers = [], string|array|null $body = null, int $timeout = 30): array
    {
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('The PHP cURL extension is required for online payments.');
        }
        $ch = curl_init($url);
        $h = [];
        foreach ($headers as $k => $v) {
            $h[] = $k . ': ' . $v;
        }
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $h,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($body) ? http_build_query($body) : $body);
        }
        $res = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($res === false) {
            throw new \RuntimeException('HTTP request failed: ' . $err);
        }
        $json = json_decode((string) $res, true);
        return ['status' => $status, 'body' => (string) $res, 'json' => is_array($json) ? $json : []];
    }

    public static function postJson(string $url, array $data, array $headers = []): array
    {
        return self::request('POST', $url, ['Content-Type' => 'application/json', 'Accept' => 'application/json'] + $headers, json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    public static function postForm(string $url, array $data): array
    {
        return self::request('POST', $url, ['Content-Type' => 'application/x-www-form-urlencoded', 'Accept' => 'application/json'], $data);
    }

    public static function get(string $url, array $query = []): array
    {
        return self::request('GET', $url . ($query ? (str_contains($url, '?') ? '&' : '?') . http_build_query($query) : ''), ['Accept' => 'application/json']);
    }
}
