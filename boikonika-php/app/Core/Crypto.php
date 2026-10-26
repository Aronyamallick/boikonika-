<?php
declare(strict_types=1);

namespace App\Core;

/**
 * AES-256-GCM with the install's app key, for data that must be readable later but never stored in
 * plain text (identity-document numbers, payout account numbers, gateway secrets, 2-step secrets).
 */
final class Crypto
{
    private static function key(): string
    {
        $key = base64_decode((string) App::config('app_key'), true);
        if ($key === false || strlen($key) !== 32) {
            throw new \RuntimeException('app_key in app/config.php must be 32 random bytes, base64-encoded.');
        }
        return $key;
    }

    public static function encrypt(string $plain): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) {
            throw new \RuntimeException('Encryption failed');
        }
        return 'v1:' . base64_encode($iv . $tag . $cipher);
    }

    public static function decrypt(?string $value): ?string
    {
        if ($value === null || $value === '' || !str_starts_with($value, 'v1:')) {
            return null;
        }
        $raw = base64_decode(substr($value, 3), true);
        if ($raw === false || strlen($raw) < 29) {
            return null;
        }
        $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        return $plain === false ? null : $plain;
    }

    public static function token(int $bytes = 32): string
    {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }

    /** Keyed hash for lookups of secrets (codes, remember tokens). */
    public static function hash(string $value): string
    {
        return hash_hmac('sha256', $value, self::key());
    }

    public static function code(int $digits = 6): string
    {
        return str_pad((string) random_int(0, 10 ** $digits - 1), $digits, '0', STR_PAD_LEFT);
    }

    public static function passwordHash(string $password): string
    {
        return defined('PASSWORD_ARGON2ID') ? password_hash($password, PASSWORD_ARGON2ID) : password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function mask(?string $last4): string
    {
        return $last4 ? '•••• ' . $last4 : '';
    }
}
