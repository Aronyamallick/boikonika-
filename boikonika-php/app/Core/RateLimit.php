<?php
declare(strict_types=1);

namespace App\Core;

/** Fixed-window counters in the database (works on any shared host). */
final class RateLimit
{
    /** Counts a hit; false when $max hits were already made within $seconds. */
    public static function hit(string $bucket, int $max, int $seconds): bool
    {
        $key = substr(hash('sha256', $bucket), 0, 40);
        $now = time();
        $row = DB::one('SELECT hits, reset_at FROM rate_limits WHERE bucket = ?', [$key]);
        if (!$row || (int) $row['reset_at'] <= $now) {
            DB::exec('REPLACE INTO rate_limits (bucket, hits, reset_at) VALUES (?, 1, ?)', [$key, $now + $seconds]);
            return true;
        }
        if ((int) $row['hits'] >= $max) {
            return false;
        }
        DB::exec('UPDATE rate_limits SET hits = hits + 1 WHERE bucket = ?', [$key]);
        return true;
    }

    /** Throws a 429 page when over the limit. */
    public static function enforce(string $bucket, int $max, int $seconds): void
    {
        if (!self::hit($bucket, $max, $seconds)) {
            throw new HttpException(429);
        }
    }

    public static function clear(string $bucket): void
    {
        DB::exec('DELETE FROM rate_limits WHERE bucket = ?', [substr(hash('sha256', $bucket), 0, 40)]);
    }

    public static function prune(): void
    {
        DB::exec('DELETE FROM rate_limits WHERE reset_at < ?', [time()]);
    }
}
