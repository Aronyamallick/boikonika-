<?php
declare(strict_types=1);

namespace App\Core;

use App\Services\Cron;
use App\Services\Mail;

final class App
{
    public static Request $request;
    public static string $nonce = '';
    private static array $config = [];
    /** @var list<callable> Work done after the response is sent. */
    private static array $after = [];

    public static function config(?string $key = null, mixed $default = null): mixed
    {
        if ($key === null) {
            return self::$config;
        }
        return self::$config[$key] ?? $default;
    }

    public static function setConfig(array $config): void
    {
        self::$config = $config;
    }

    public static function installed(): bool
    {
        return is_file(BK_APP . '/config.php') && is_file(BK_STORAGE . '/installed.lock');
    }

    public static function after(callable $fn): void
    {
        self::$after[] = $fn;
    }

    public static function run(): void
    {
        self::$nonce = base64_encode(random_bytes(16));
        ErrorHandler::register();
        mb_internal_encoding('UTF-8');
        self::$request = $req = Request::capture();

        if (!self::installed()) {
            header('Location: ' . $req->basePath . '/install/', true, 302);
            return;
        }
        self::$config = require BK_APP . '/config.php';
        date_default_timezone_set(self::$config['timezone'] ?? 'Asia/Dhaka');

        [$locale, $path] = I18n::detect($req->fullPath);
        I18n::setLocale($locale);
        $req->path = $path;

        try {
            $response = self::dispatch($req);
        } catch (HttpException $e) {
            $response = self::errorResponse($e->status);
        } catch (\Throwable $e) {
            $ref = ErrorHandler::report($e);
            $response = self::errorResponse(500, $ref);
        }

        self::securityHeaders($response);
        $response->send();
        self::finish();
    }

    private static function dispatch(Request $req): Response
    {
        $router = new Router();
        (require BK_APP . '/routes.php')($router);
        $match = $router->match($req->method, $req->path);
        if ($match === false) {
            throw new HttpException(405);
        }
        if ($match === null) {
            // Start the session so the 404 page shows the signed-in header.
            Session::start();
            Auth::boot();
            throw new HttpException(404);
        }
        $opts = $match['opts'];
        $req->params = $match['params'];

        if (($opts['session'] ?? true) !== false) {
            Session::start();
            Auth::boot();
        }
        if ($req->method === 'POST' && ($opts['csrf'] ?? true) !== false && !Session::checkCsrf((string) ($_POST['_token'] ?? $req->header('X-CSRF-Token')))) {
            throw new HttpException(419);
        }
        if (!empty($opts['guest']) && Auth::check()) {
            return Response::redirect(url('account'));
        }
        if (!empty($opts['auth']) || !empty($opts['seller']) || !empty($opts['perm'])) {
            if (!Auth::check()) {
                if ($req->method === 'GET') {
                    Session::put('intended', $req->fullPath . (($q = $_SERVER['QUERY_STRING'] ?? '') !== '' ? '?' . $q : ''));
                }
                flash('info', t('auth.loginRequired'));
                return Response::redirect(url('login'));
            }
        }
        if (!empty($opts['seller']) && !Auth::isSeller()) {
            return Response::redirect(url('seller/apply'));
        }
        if (!empty($opts['perm']) && !Auth::can($opts['perm'])) {
            throw new HttpException(403);
        }

        [$class, $method] = explode('@', $match['handler']);
        $class = 'App\\Controllers\\' . $class;
        $controller = new $class();
        $result = $controller->{$method}($req, ...array_values($match['params']));
        return $result instanceof Response ? $result : new Response((string) $result, 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    public static function errorResponse(int $status, string $ref = ''): Response
    {
        if (isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json')) {
            return Response::json(['ok' => false, 'error' => $status, 'message' => t('errors.' . $status . 'Text')], $status);
        }
        $known = [403, 404, 405, 419, 429, 500];
        $code = in_array($status, $known, true) ? $status : 500;
        try {
            $html = View::render('errors/error', [
                'title' => t('errors.' . $code . 'Title'),
                'status' => $code,
                'ref' => $ref,
                'robots' => 'noindex',
            ]);
        } catch (\Throwable $e) {
            ErrorHandler::report($e);
            $html = '<!doctype html><meta charset="utf-8"><title>' . $code . '</title><p>' . $code . ($ref ? ' · Ref ' . e($ref) : '') . '</p>';
        }
        return new Response($html, $status, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    private static function securityHeaders(Response $r): void
    {
        $nonce = self::$nonce;
        $csp = "default-src 'self'; script-src 'self' 'nonce-{$nonce}'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
            . "form-action 'self' https://*.bka.sh https://*.bkash.com https://*.sslcommerz.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; manifest-src 'self'; worker-src 'self'";
        $r->headers += [
            'Content-Security-Policy' => $csp,
            'X-Frame-Options' => 'DENY',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
            'Cross-Origin-Opener-Policy' => 'same-origin',
        ];
        if (str_starts_with((string) self::config('url', ''), 'https://')) {
            $r->headers += ['Strict-Transport-Security' => 'max-age=31536000'];
        }
        if (!isset($r->headers['Cache-Control'])) {
            $r->headers['Cache-Control'] = Session::started() ? 'private, no-store' : 'public, max-age=300';
        }
    }

    private static function finish(): void
    {
        if (Session::started()) {
            session_write_close();
        }
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } elseif (function_exists('litespeed_finish_request')) {
            litespeed_finish_request();
        }
        ignore_user_abort(true);
        try {
            foreach (self::$after as $fn) {
                $fn();
            }
            if (Mail::$queued) {
                Mail::flush(10);
            }
            Cron::maybeRun();
        } catch (\Throwable $e) {
            ErrorHandler::report($e);
        }
    }
}
