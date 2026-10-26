<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Money is stored as DECIMAL(12,2) and computed in integer poisha (1 taka = 100 poisha).
 * Never floating point.
 */
final class Money
{
    /** "120.5" | "120" | 12050 (already poisha when int) → poisha. */
    public static function toPoisha(string|int|null $amount): int
    {
        if ($amount === null || $amount === '') {
            return 0;
        }
        if (is_int($amount)) {
            return $amount;
        }
        $s = trim(I18n::toAscii(str_replace([',', '৳', ' '], '', $amount)));
        if (!preg_match('/^(-)?(\d+)(?:\.(\d{1,2}))?$/', $s, $m)) {
            throw new \InvalidArgumentException('Invalid money amount: ' . $amount);
        }
        $p = (int) $m[2] * 100 + (int) str_pad($m[3] ?? '0', 2, '0');
        return ($m[1] ?? '') === '-' ? -$p : $p;
    }

    /** Poisha → "120.50" for the database. */
    public static function toDecimal(int $poisha): string
    {
        $neg = $poisha < 0;
        $poisha = abs($poisha);
        return ($neg ? '-' : '') . intdiv($poisha, 100) . '.' . str_pad((string) ($poisha % 100), 2, '0', STR_PAD_LEFT);
    }

    /** Whether the user typed a valid non-negative amount (up to 2 decimals). */
    public static function valid(string $s, bool $allowZero = true): bool
    {
        $s = I18n::toAscii(str_replace([',', ' '], '', $s));
        if (!preg_match('/^\d{1,9}(\.\d{1,2})?$/', $s)) {
            return false;
        }
        return $allowZero || self::toPoisha($s) > 0;
    }

    /** Display: "৳১,২০০" or "৳1,200.50". */
    public static function format(string|int|null $amount, ?string $locale = null): string
    {
        $p = self::toPoisha($amount ?? 0);
        $neg = $p < 0;
        $p = abs($p);
        $int = (string) intdiv($p, 100);
        $frac = $p % 100;
        $num = I18n::number($int . ($frac ? '.' . str_pad((string) $frac, 2, '0', STR_PAD_LEFT) : ''), $locale);
        return ($neg ? '-' : '') . '৳' . $num;
    }

    /** $poisha × $percent (up to 2 decimals) / 100, rounded half up. */
    public static function percent(int $poisha, string $percent): int
    {
        $basis = self::toPoisha($percent); // percent × 100
        return intdiv($poisha * $basis + 5000, 10000);
    }
}
