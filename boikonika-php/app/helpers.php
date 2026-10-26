<?php
declare(strict_types=1);

use App\Core\App;
use App\Core\Auth;
use App\Core\I18n;
use App\Core\Money;
use App\Core\Response;
use App\Core\Session;
use App\Core\Settings;
use App\Core\View;

function e(mixed $v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
}

/** Translated text (raw — escape it when printing). */
function t(string $key, array $params = []): string
{
    return I18n::t($key, $params);
}

/** Translated plural text, e.g. tn('common.items', 3). */
function tn(string $key, int $count, array $params = []): string
{
    return I18n::choice($key, $count, $params);
}

/** Translated text, HTML-escaped, ready to print in a template. */
function __(string $key, array $params = []): string
{
    return e(I18n::t($key, $params));
}

function locale(): string
{
    return I18n::locale();
}

/** Picks the Bangla or English column of a row: lf($row, 'name') → name_bn / name_en. */
function lf(?array $row, string $field): string
{
    if (!$row) {
        return '';
    }
    $l = I18n::locale();
    $v = $row[$field . '_' . $l] ?? null;
    if ($v === null || $v === '') {
        $v = $row[$field . '_' . ($l === 'bn' ? 'en' : 'bn')] ?? '';
    }
    return (string) $v;
}

/** Site URL path for the current (or given) language: url('books') → /en/books. */
function url(string $path = '', array $query = [], ?string $locale = null): string
{
    $locale ??= I18n::locale();
    $base = isset(App::$request) ? App::$request->basePath : '';
    $path = ltrim($path, '/');
    if ($path === '') {
        $u = $base . ($locale === 'en' ? '/en' : '/');
    } else {
        $u = $base . ($locale === 'en' ? '/en/' : '/') . $path;
    }
    if ($query) {
        $u .= '?' . http_build_query($query);
    }
    return $u;
}

/** Absolute URL (emails, payment callbacks, sitemap, canonical links). */
function abs_url(string $path = '', array $query = [], ?string $locale = null): string
{
    $root = rtrim((string) App::config('url', ''), '/');
    $rel = url($path, $query, $locale);
    $base = isset(App::$request) ? App::$request->basePath : '';
    if ($base !== '' && str_starts_with($rel, $base)) {
        $rel = substr($rel, strlen($base));
    }
    return $root . ($rel === '' ? '/' : $rel);
}

/** The same page in the other language. */
function switch_locale_url(string $to): string
{
    $req = App::$request;
    $q = $_SERVER['QUERY_STRING'] ?? '';
    return url(ltrim($req->path, '/'), [], $to) . ($q !== '' ? '?' . $q : '');
}

function asset(string $path): string
{
    $file = BK_ROOT . '/assets/' . $path;
    $v = is_file($file) ? substr((string) filemtime($file), -6) : BK_VERSION;
    return (isset(App::$request) ? App::$request->basePath : '') . '/assets/' . $path . '?v=' . $v;
}

function upload_url(?string $path): ?string
{
    if (!$path) {
        return null;
    }
    return (isset(App::$request) ? App::$request->basePath : '') . '/uploads/' . $path;
}

function csrf_field(): string
{
    return '<input type="hidden" name="_token" value="' . e(Session::csrfToken()) . '">';
}

function csrf_token(): string
{
    return Session::csrfToken();
}

function nonce(): string
{
    return App::$nonce;
}

/** Previously submitted value (after a validation error), else $default. */
function old(string $field, mixed $default = ''): string
{
    $old = Session::flashed('_old', []);
    $v = $old[$field] ?? $default;
    return is_scalar($v) ? (string) $v : '';
}

/** Validation error for a field from the previous request. */
function error_for(string $field): ?string
{
    return Session::flashed('_errors', [])[$field] ?? null;
}

function has_errors(): bool
{
    return (bool) Session::flashed('_errors', []);
}

function flash(string $type, string $message): void
{
    Session::pushMessage($type, $message);
}

function redirect(string $to, int $status = 303): Response
{
    return Response::redirect($to, $status);
}

function back(string $fallback = ''): Response
{
    $ref = (string) ($_SERVER['HTTP_REFERER'] ?? '');
    $root = rtrim((string) App::config('url', ''), '/');
    if ($ref !== '' && $root !== '' && str_starts_with($ref, $root)) {
        return Response::redirect($ref);
    }
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    if ($ref !== '' && $host !== '' && parse_url($ref, PHP_URL_HOST) === $host) {
        return Response::redirect($ref);
    }
    return Response::redirect($fallback !== '' ? $fallback : url());
}

function view(string $template, array $data = [], ?string $layout = 'layouts/main', int $status = 200): Response
{
    return new Response(View::render($template, $data, $layout), $status, ['Content-Type' => 'text/html; charset=utf-8']);
}

function partial(string $template, array $data = []): string
{
    return View::partial($template, $data);
}

function money(string|int|null $amount): string
{
    return Money::format($amount);
}

function num(int|string $n): string
{
    return I18n::number($n);
}

function digits(string|int $s): string
{
    return I18n::digits((string) $s);
}

function to_ascii_digits(string $s): string
{
    return I18n::toAscii($s);
}

function fdate(?string $dt, string $style = 'date'): string
{
    return I18n::date($dt, $style);
}

function ago(?string $dt): string
{
    return I18n::ago($dt);
}

function auth_user(): ?array
{
    return Auth::user();
}

function can(string $permission): bool
{
    return Auth::can($permission);
}

function setting(string $key, ?string $default = null): ?string
{
    return Settings::get($key, $default);
}

function site_name(): string
{
    return (string) Settings::get('site.name_' . I18n::locale());
}

function slugify(string $text, int $max = 80): string
{
    $s = mb_strtolower(trim($text));
    $s = I18n::toAscii($s);
    $s = (string) preg_replace('/[^\p{L}\p{M}\p{N}]+/u', '-', $s);
    $s = trim($s, '-');
    if (mb_strlen($s) > $max) {
        $s = rtrim(mb_substr($s, 0, $max), '-');
    }
    return $s !== '' ? $s : 'item';
}

/** Path → "active" class helper for navigation. */
function nav_active(string $prefix): string
{
    $p = App::$request->path;
    $prefix = '/' . ltrim($prefix, '/');
    return ($prefix === '/' ? $p === '/' : ($p === $prefix || str_starts_with($p, $prefix . '/'))) ? ' aria-current="page"' : '';
}

function selected(mixed $a, mixed $b): string
{
    return (string) $a === (string) $b ? ' selected' : '';
}

function checked(bool $on): string
{
    return $on ? ' checked' : '';
}

/** Inline SVG icon from the sprite in app/Views/partials/icons.php. */
function icon(string $name, string $class = 'icon'): string
{
    return '<svg class="' . e($class) . '" aria-hidden="true" focusable="false"><use href="#i-' . e($name) . '"></use></svg>';
}

function status_label(string $group, ?string $status): string
{
    return $status === null ? '' : t('status.' . $group . '.' . $status);
}

function mask_phone(?string $phone): string
{
    if (!$phone) {
        return '';
    }
    return substr($phone, 0, 3) . str_repeat('•', max(0, strlen($phone) - 6)) . substr($phone, -3);
}

function mask_email(?string $email): string
{
    if (!$email || !str_contains($email, '@')) {
        return (string) $email;
    }
    [$name, $domain] = explode('@', $email, 2);
    return mb_substr($name, 0, 2) . str_repeat('•', max(1, mb_strlen($name) - 2)) . '@' . $domain;
}
