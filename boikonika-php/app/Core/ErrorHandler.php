<?php
declare(strict_types=1);

namespace App\Core;

/** Logs every error with a reference number; people only ever see a friendly page with that number. */
final class ErrorHandler
{
    public static function register(): void
    {
        error_reporting(E_ALL);
        ini_set('display_errors', '0');
        ini_set('log_errors', '1');
        set_error_handler(static function (int $no, string $msg, string $file, int $line): bool {
            if (!(error_reporting() & $no)) {
                return false;
            }
            if (App::config('debug')) {
                throw new \ErrorException($msg, 0, $no, $file, $line);
            }
            self::log('warning', $msg . ' at ' . $file . ':' . $line);
            return true;
        });
        set_exception_handler(static function (\Throwable $e): void {
            $ref = self::report($e);
            self::renderFatal($ref);
        });
    }

    public static function report(\Throwable $e): string
    {
        $ref = strtoupper(bin2hex(random_bytes(4)));
        $uri = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
        $uri .= ' ' . ($_SERVER['REQUEST_URI'] ?? '');
        self::log('error', sprintf("[%s] %s %s: %s at %s:%d\n%s", $ref, $uri, get_class($e), $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString()));
        return $ref;
    }

    public static function log(string $level, string $message): void
    {
        $dir = BK_STORAGE . '/logs';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        @file_put_contents($dir . '/app-' . date('Y-m-d') . '.log', '[' . date('Y-m-d H:i:s') . '] ' . strtoupper($level) . ' ' . $message . "\n", FILE_APPEND | LOCK_EX);
    }

    /** Last resort when even the error page can't be rendered. */
    public static function renderFatal(string $ref): void
    {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: text/html; charset=utf-8');
        }
        try {
            echo View::render('errors/500', ['title' => I18n::t('errors.serverTitle'), 'ref' => $ref, 'status' => 500], 'layouts/bare');
        } catch (\Throwable) {
            echo '<!doctype html><meta charset="utf-8"><title>Error</title><p style="font-family:sans-serif">দুঃখিত, একটি সমস্যা হয়েছে। Sorry, something went wrong. Ref: ' . htmlspecialchars($ref) . '</p>';
        }
    }
}
