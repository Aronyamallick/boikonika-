<?php
declare(strict_types=1);

namespace App\Core;

final class Session
{
    private static bool $started = false;
    private static array $flashOld = [];

    public static function start(): void
    {
        if (self::$started) {
            return;
        }
        $secure = str_starts_with((string) App::config('url', ''), 'https://') || (($_SERVER['HTTPS'] ?? '') === 'on');
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.gc_maxlifetime', '7200');
        $dir = BK_STORAGE . '/sessions';
        if (is_dir($dir) && is_writable($dir)) {
            session_save_path($dir);
        }
        session_name('bk_session');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => (App::$request->basePath ?: '') . '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
        self::$started = true;
        self::$flashOld = $_SESSION['_flash'] ?? [];
        $_SESSION['_flash'] = [];
    }

    public static function started(): bool
    {
        return self::$started;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function put(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public static function regenerate(): void
    {
        if (self::$started) {
            session_regenerate_id(true);
        }
    }

    public static function destroy(): void
    {
        if (!self::$started) {
            return;
        }
        $_SESSION = [];
        session_regenerate_id(true);
    }

    /** Value for the next request only. */
    public static function flashNow(string $key, mixed $value): void
    {
        if (self::$started) {
            $_SESSION['_flash'][$key] = $value;
        }
    }

    /** Value flashed by the previous request. */
    public static function flashed(string $key, mixed $default = null): mixed
    {
        return self::$flashOld[$key] ?? $default;
    }

    public static function pushMessage(string $type, string $message): void
    {
        if (self::$started) {
            $_SESSION['_flash']['_messages'][] = [$type, $message];
        }
    }

    /** @return list<array{0:string,1:string}> */
    public static function messages(): array
    {
        return self::$flashOld['_messages'] ?? [];
    }

    public static function csrfToken(): string
    {
        if (!self::$started) {
            return '';
        }
        if (empty($_SESSION['_csrf'])) {
            $_SESSION['_csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['_csrf'];
    }

    public static function checkCsrf(string $token): bool
    {
        return self::$started && !empty($_SESSION['_csrf']) && hash_equals($_SESSION['_csrf'], $token);
    }
}
