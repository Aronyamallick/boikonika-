<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\DB;
use App\Core\ErrorHandler;
use App\Core\I18n;
use App\Core\Settings;
use App\Core\View;

/**
 * Email. Notices go through mail_queue (sent right after the page is delivered, and by cron);
 * sign-up and reset codes are sent immediately. Drivers: PHP mail() (default on cPanel), SMTP, or
 * "log" (writes to storage/logs/mail.log — for testing only).
 */
final class Mail
{
    public static bool $queued = false;

    /** Renders app/Views/emails/{template}.php in $locale. @return array{0:string,1:string,2:string} subject, html, text */
    public static function render(string $template, array $data, string $locale): array
    {
        $prev = I18n::locale();
        I18n::setLocale($locale);
        try {
            $data['locale'] = $locale;
            $body = View::partial('emails/' . $template, $data);
            $subject = (string) ($data['subject'] ?? '');
            if (preg_match('/<!--subject:(.*?)-->/s', $body, $m)) {
                $subject = trim(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'));
                $body = str_replace($m[0], '', $body);
            }
            $html = View::partial('emails/layout', ['content' => $body, 'subject' => $subject, 'locale' => $locale]);
        } finally {
            I18n::setLocale($prev);
        }
        return [$subject, $html, self::toText($html)];
    }

    public static function queue(string $to, string $template, array $data, string $locale = 'bn', ?string $toName = null): void
    {
        if ($to === '') {
            return;
        }
        [$subject, $html, $text] = self::render($template, $data, $locale);
        DB::insert('mail_queue', [
            'to_email' => $to,
            'to_name' => $toName,
            'subject' => $subject,
            'html' => $html,
            'text' => $text,
            'send_after' => DB::now(),
            'created_at' => DB::now(),
        ]);
        self::$queued = true;
    }

    /** Sends at once (codes). Returns false when delivery failed; the error is logged. */
    public static function sendNow(string $to, string $template, array $data, string $locale = 'bn', ?string $toName = null): bool
    {
        [$subject, $html, $text] = self::render($template, $data, $locale);
        try {
            self::deliver($to, $toName, $subject, $html, $text);
            return true;
        } catch (\Throwable $e) {
            ErrorHandler::log('mail', 'Sending to ' . $to . ' failed: ' . $e->getMessage());
            return false;
        }
    }

    /** Sends up to $limit queued messages; failures retry with back-off, up to 5 attempts. */
    public static function flush(int $limit = 20): int
    {
        $sent = 0;
        $rows = DB::all("SELECT * FROM mail_queue WHERE status = 'queued' AND send_after <= NOW() ORDER BY id LIMIT " . (int) $limit);
        foreach ($rows as $m) {
            if (DB::exec("UPDATE mail_queue SET status = 'sending', attempts = attempts + 1 WHERE id = ? AND status = 'queued'", [$m['id']]) !== 1) {
                continue;
            }
            try {
                self::deliver($m['to_email'], $m['to_name'], $m['subject'], $m['html'], $m['text']);
                DB::exec("UPDATE mail_queue SET status = 'sent', sent_at = NOW(), last_error = NULL WHERE id = ?", [$m['id']]);
                $sent++;
            } catch (\Throwable $e) {
                $attempts = (int) $m['attempts'] + 1;
                $status = $attempts >= 5 ? 'failed' : 'queued';
                DB::exec('UPDATE mail_queue SET status = ?, last_error = ?, send_after = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?', [$status, mb_substr($e->getMessage(), 0, 500), 5 * $attempts * $attempts, $m['id']]);
            }
        }
        // Messages stuck in "sending" (the process died) go back to the queue after 15 minutes.
        DB::exec("UPDATE mail_queue SET status = 'queued' WHERE status = 'sending' AND send_after < DATE_SUB(NOW(), INTERVAL 15 MINUTE)");
        return $sent;
    }

    public static function deliver(string $to, ?string $toName, string $subject, string $html, string $text): void
    {
        $driver = Settings::get('mail.driver', 'mail');
        $fromEmail = Settings::get('mail.from_email') ?: Settings::get('site.email') ?: 'no-reply@' . preg_replace('/^www\./', '', (string) parse_url((string) \App\Core\App::config('url', 'http://localhost'), PHP_URL_HOST));
        $fromName = Settings::get('mail.from_name') ?: 'Boikonika';
        $boundary = 'bk_' . bin2hex(random_bytes(12));
        $domain = substr((string) strrchr($fromEmail, '@'), 1) ?: 'localhost';
        $headers = [
            'From' => self::encodeName($fromName) . ' <' . $fromEmail . '>',
            'Reply-To' => Settings::get('site.email') ?: $fromEmail,
            'MIME-Version' => '1.0',
            'Content-Type' => 'multipart/alternative; boundary="' . $boundary . '"',
            'Message-ID' => '<' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
            'Date' => date('r'),
            'X-Mailer' => 'Boikonika',
        ];
        $body = '--' . $boundary . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($text)) . '--' . $boundary . "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html)) . '--' . $boundary . "--\r\n";
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $toHeader = $toName ? self::encodeName($toName) . ' <' . $to . '>' : $to;

        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Invalid recipient');
        }
        switch ($driver) {
            case 'log':
                $line = '[' . date('Y-m-d H:i:s') . "] To: {$to}\nSubject: {$subject}\n{$text}\n" . str_repeat('-', 60) . "\n";
                file_put_contents(BK_STORAGE . '/logs/mail.log', $line, FILE_APPEND | LOCK_EX);
                return;
            case 'smtp':
                (new Smtp(
                    (string) Settings::get('mail.smtp_host'),
                    (int) Settings::get('mail.smtp_port', '587'),
                    (string) Settings::get('mail.smtp_encryption', 'tls'),
                    (string) Settings::get('mail.smtp_username'),
                    (string) Settings::get('mail.smtp_password'),
                ))->send($fromEmail, $to, array_merge(['To' => $toHeader, 'Subject' => $encodedSubject], $headers), $body);
                return;
            default:
                $h = '';
                foreach ($headers as $k => $v) {
                    $h .= $k . ': ' . $v . "\r\n";
                }
                if (!mail($toHeader, $encodedSubject, $body, rtrim($h), '-f' . $fromEmail)) {
                    throw new \RuntimeException('mail() returned false');
                }
        }
    }

    private static function encodeName(string $name): string
    {
        return preg_match('/^[A-Za-z0-9 .\-]+$/', $name) ? '"' . $name . '"' : '=?UTF-8?B?' . base64_encode($name) . '?=';
    }

    public static function toText(string $html): string
    {
        $t = preg_replace(['#<(style|script|head)[^>]*>.*?</\1>#si', '#<br\s*/?>#i', '#</(p|div|h\d|li|tr)>#i', '#<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>#si'], ['', "\n", "\n", '$2 ($1)'], $html);
        $t = html_entity_decode(strip_tags((string) $t), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $t = preg_replace("/[ \t]+/", ' ', $t);
        $t = preg_replace("/\n\s*\n\s*\n+/", "\n\n", (string) $t);
        return trim((string) $t);
    }
}
