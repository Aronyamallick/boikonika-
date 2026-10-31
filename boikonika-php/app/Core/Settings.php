<?php
declare(strict_types=1);

namespace App\Core;

/** Key/value settings edited in Admin → Settings. Secret values are stored encrypted. */
final class Settings
{
    public const DEFAULTS = [
        'site.name_bn' => 'বইকণিকা',
        'site.name_en' => 'Boikonika',
        'site.tagline_bn' => 'আপনার পরবর্তী বই খুঁজে নিন',
        'site.tagline_en' => 'Find your next book',
        'site.email' => '',
        'site.phone' => '',
        'site.address' => '',
        'site.facebook' => '',
        'site.youtube' => '',
        'site.indexing' => '1',
        'orders.commission_percent' => '10',
        'orders.payment_window_minutes' => '30',
        'orders.cod_enabled' => '1',
        'orders.cod_max' => '20000',
        'orders.return_window_days' => '7',
        'orders.min_payout' => '500',
        'catalog.review_new_products' => '1',
        'payments.bkash.enabled' => '0',
        'payments.bkash.sandbox' => '1',
        'payments.bkash.username' => '',
        'payments.bkash.password' => '',
        'payments.bkash.app_key' => '',
        'payments.bkash.app_secret' => '',
        'payments.ssl.enabled' => '0',
        'payments.ssl.sandbox' => '1',
        'payments.ssl.store_id' => '',
        'payments.ssl.store_password' => '',
        'mail.driver' => 'mail',
        'mail.from_email' => '',
        'mail.from_name' => 'Boikonika',
        'mail.smtp_host' => '',
        'mail.smtp_port' => '587',
        'mail.smtp_encryption' => 'tls',
        'mail.smtp_username' => '',
        'mail.smtp_password' => '',
        'cron.key' => '',
        'cron.last_run' => '',
    ];

    /** Stored with Crypto::encrypt and never shown back in full. */
    public const SECRETS = ['payments.bkash.password', 'payments.bkash.app_secret', 'payments.ssl.store_password', 'mail.smtp_password'];

    private static ?array $cache = null;

    private static function load(): array
    {
        if (self::$cache === null) {
            self::$cache = [];
            foreach (DB::all('SELECT `key`, value FROM settings') as $row) {
                self::$cache[$row['key']] = $row['value'];
            }
        }
        return self::$cache;
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $all = self::load();
        $v = $all[$key] ?? self::DEFAULTS[$key] ?? $default;
        if ($v !== null && in_array($key, self::SECRETS, true)) {
            return Crypto::decrypt($v) ?? '';
        }
        return $v;
    }

    public static function bool(string $key): bool
    {
        return self::get($key) === '1';
    }

    public static function int(string $key): int
    {
        return (int) self::get($key, '0');
    }

    public static function set(string $key, ?string $value): void
    {
        if ($value !== null && $value !== '' && in_array($key, self::SECRETS, true)) {
            $value = Crypto::encrypt($value);
        }
        DB::exec('INSERT INTO settings (`key`, value, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)', [$key, $value, DB::now()]);
        if (self::$cache !== null) {
            self::$cache[$key] = $value;
        }
    }

    public static function hasSecret(string $key): bool
    {
        return (self::load()[$key] ?? '') !== '';
    }

    public static function flush(): void
    {
        self::$cache = null;
    }
}
