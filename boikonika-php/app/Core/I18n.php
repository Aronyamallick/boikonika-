<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Bangla (default, no URL prefix) and English (/en). Messages live in app/lang/{bn,en}.php as nested
 * arrays; placeholders are ":name". Plural messages are arrays with "one" / "other".
 */
final class I18n
{
    public const LOCALES = ['bn', 'en'];
    private const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    private const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    private const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    private static string $locale = 'bn';
    private static array $messages = [];

    /** @return array{0:string,1:string} [locale, path without prefix] */
    public static function detect(string $path): array
    {
        if ($path === '/en' || str_starts_with($path, '/en/')) {
            return ['en', substr($path, 3) ?: '/'];
        }
        return ['bn', $path];
    }

    public static function setLocale(string $locale): void
    {
        self::$locale = in_array($locale, self::LOCALES, true) ? $locale : 'bn';
    }

    public static function locale(): string
    {
        return self::$locale;
    }

    /** Messages are split by the first key segment: "cart.title" lives in app/lang/{locale}/cart.php. */
    private static function section(string $locale, string $section): array
    {
        if (!isset(self::$messages[$locale][$section])) {
            $file = BK_APP . '/lang/' . $locale . '/' . basename($section) . '.php';
            self::$messages[$locale][$section] = is_file($file) ? require $file : [];
        }
        return self::$messages[$locale][$section];
    }

    public static function get(string $key, ?string $locale = null): mixed
    {
        $locale ??= self::$locale;
        $parts = explode('.', $key);
        $node = self::section($locale, array_shift($parts));
        foreach ($parts as $part) {
            if (!is_array($node) || !array_key_exists($part, $node)) {
                return $locale !== 'en' ? self::get($key, 'en') : null;
            }
            $node = $node[$part];
        }
        if ($node === [] && $locale !== 'en') {
            return self::get($key, 'en');
        }
        return $node === [] ? null : $node;
    }

    public static function has(string $key): bool
    {
        return self::get($key) !== null;
    }

    public static function t(string $key, array $params = [], ?string $locale = null): string
    {
        $msg = self::get($key, $locale);
        if (is_array($msg)) {
            $msg = $msg['other'] ?? reset($msg);
        }
        if (!is_string($msg)) {
            return $key;
        }
        return self::replace($msg, $params);
    }

    public static function choice(string $key, int $count, array $params = [], ?string $locale = null): string
    {
        $locale ??= self::$locale;
        $msg = self::get($key, $locale);
        if (is_array($msg)) {
            $form = $count === 0 && isset($msg['zero']) ? 'zero' : ($count === 1 && $locale === 'en' && isset($msg['one']) ? 'one' : 'other');
            $msg = $msg[$form] ?? reset($msg);
        }
        if (!is_string($msg)) {
            return $key;
        }
        return self::replace($msg, ['count' => self::number($count, $locale)] + $params);
    }

    private static function replace(string $msg, array $params): string
    {
        if (!$params) {
            return $msg;
        }
        uksort($params, static fn ($a, $b) => strlen((string) $b) <=> strlen((string) $a));
        foreach ($params as $k => $v) {
            $msg = str_replace(':' . $k, (string) $v, $msg);
        }
        return $msg;
    }

    public static function digits(string $s, ?string $locale = null): string
    {
        return ($locale ?? self::$locale) === 'bn' ? strtr($s, array_combine(range('0', '9'), self::BN_DIGITS)) : $s;
    }

    public static function toAscii(string $s): string
    {
        return strtr($s, array_combine(self::BN_DIGITS, range('0', '9')));
    }

    /** 1234567 → "12,34,567" (Bangla, Indian grouping) or "1,234,567" (English). */
    public static function number(int|string $n, ?string $locale = null): string
    {
        $locale ??= self::$locale;
        $s = (string) $n;
        $neg = str_starts_with($s, '-');
        $s = ltrim($s, '-');
        [$int, $frac] = array_pad(explode('.', $s, 2), 2, '');
        if ($locale === 'bn' && strlen($int) > 3) {
            $last = substr($int, -3);
            $rest = substr($int, 0, -3);
            $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);
            $int = $rest . ',' . $last;
        } else {
            $int = preg_replace('/\B(?=(\d{3})+(?!\d))/', ',', $int);
        }
        $out = ($neg ? '-' : '') . $int . ($frac !== '' ? '.' . $frac : '');
        return self::digits($out, $locale);
    }

    public static function date(?string $datetime, string $style = 'date', ?string $locale = null): string
    {
        if (!$datetime) {
            return '';
        }
        $locale ??= self::$locale;
        $ts = strtotime($datetime);
        if ($ts === false) {
            return '';
        }
        $m = (int) date('n', $ts) - 1;
        $month = $locale === 'bn' ? self::BN_MONTHS[$m] : self::EN_MONTHS[$m];
        $out = $locale === 'bn' ? date('j', $ts) . ' ' . $month . ' ' . date('Y', $ts) : date('j', $ts) . ' ' . $month . ' ' . date('Y', $ts);
        if ($style === 'datetime') {
            $out .= ', ' . ($locale === 'bn' ? self::bnTime($ts) : date('g:i A', $ts));
        } elseif ($style === 'short') {
            $out = $locale === 'bn' ? date('j', $ts) . ' ' . $month : date('j', $ts) . ' ' . $month;
        }
        return self::digits($out, $locale);
    }

    private static function bnTime(int $ts): string
    {
        $h = (int) date('G', $ts);
        $part = match (true) {
            $h < 4 => 'রাত',
            $h < 6 => 'ভোর',
            $h < 12 => 'সকাল',
            $h < 15 => 'দুপুর',
            $h < 18 => 'বিকেল',
            $h < 20 => 'সন্ধ্যা',
            default => 'রাত',
        };
        return $part . ' ' . date('g:i', $ts);
    }

    /** "3 minutes ago" style, for notifications. */
    public static function ago(?string $datetime): string
    {
        if (!$datetime) {
            return '';
        }
        $diff = time() - (int) strtotime($datetime);
        if ($diff < 60) {
            return self::t('time.justNow');
        }
        if ($diff < 3600) {
            return self::choice('time.minutesAgo', intdiv($diff, 60));
        }
        if ($diff < 86400) {
            return self::choice('time.hoursAgo', intdiv($diff, 3600));
        }
        if ($diff < 86400 * 7) {
            return self::choice('time.daysAgo', intdiv($diff, 86400));
        }
        return self::date($datetime);
    }
}
