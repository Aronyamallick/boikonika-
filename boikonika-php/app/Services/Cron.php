<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\DB;
use App\Core\RateLimit;

/**
 * Housekeeping: cancels unpaid online orders after the payment window, sends queued email and
 * clears expired data. Run cron.php every 5 minutes from cPanel; without it, page visits run it.
 */
final class Cron
{
    /** Runs at most every 5 minutes, triggered by ordinary page visits. */
    public static function maybeRun(): void
    {
        $now = time();
        // Claim the run atomically so two visitors don't both start it.
        $claimed = DB::exec("UPDATE settings SET value = ?, updated_at = NOW() WHERE `key` = 'cron.last_run' AND CAST(COALESCE(NULLIF(value, ''), '0') AS UNSIGNED) < ?", [(string) $now, $now - 300]);
        if ($claimed === 1) {
            self::run();
        }
    }

    /** @return array<string,int> what was done */
    public static function run(): array
    {
        $report = [];
        $report['expired_orders'] = Orders::expireUnpaid(20);
        $report['emails_sent'] = Mail::flush(50);
        RateLimit::prune();
        $report['codes_removed'] = DB::exec('DELETE FROM verification_codes WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)');
        $report['sessions_removed'] = DB::exec('DELETE FROM user_sessions WHERE (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY)) OR expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
        $report['guest_carts_removed'] = DB::exec('DELETE FROM carts WHERE user_id IS NULL AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
        DB::exec("DELETE FROM mail_queue WHERE status = 'sent' AND sent_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
        DB::exec('DELETE FROM login_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY)');
        \App\Core\Settings::set('cron.last_run', (string) time());
        return $report;
    }
}
