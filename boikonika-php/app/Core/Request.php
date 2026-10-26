<?php
declare(strict_types=1);

namespace App\Core;

final class Request
{
    public string $method;
    /** Path after the install folder, without the language prefix, e.g. "/books/x". */
    public string $path = '/';
    /** Path as requested (after the install folder), with the language prefix. */
    public string $fullPath = '/';
    public string $basePath = '';
    public array $params = [];

    public static function capture(): self
    {
        $r = new self();
        $r->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
        $base = rtrim(str_replace('\\', '/', dirname($script)), '/');
        $r->basePath = $base === '.' ? '' : $base;
        $uri = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        if ($r->basePath !== '' && str_starts_with($uri, $r->basePath)) {
            $uri = substr($uri, strlen($r->basePath));
        }
        if (str_starts_with($uri, '/index.php')) {
            $uri = substr($uri, 10);
        }
        $uri = '/' . ltrim(rawurldecode($uri), '/');
        $r->fullPath = $uri;
        $r->path = $uri;
        return $r;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        $v = $_POST[$key] ?? $_GET[$key] ?? $default;
        return is_string($v) ? trim($v) : $v;
    }

    public function str(string $key, string $default = ''): string
    {
        $v = $this->input($key, $default);
        return is_string($v) ? $v : $default;
    }

    public function int(string $key, int $default = 0): int
    {
        $v = $this->input($key);
        return is_string($v) && preg_match('/^-?\d{1,10}$/', to_ascii_digits($v)) ? (int) to_ascii_digits($v) : $default;
    }

    public function bool(string $key): bool
    {
        return in_array($this->input($key), ['1', 'on', 'true', 'yes'], true);
    }

    public function query(string $key, string $default = ''): string
    {
        $v = $_GET[$key] ?? $default;
        return is_string($v) ? trim($v) : $default;
    }

    /** @return array<string,mixed> Only the given POST fields, trimmed. */
    public function only(array $keys): array
    {
        $out = [];
        foreach ($keys as $k) {
            $v = $_POST[$k] ?? null;
            $out[$k] = is_string($v) ? trim($v) : $v;
        }
        return $out;
    }

    public function file(string $key): ?array
    {
        $f = $_FILES[$key] ?? null;
        if (!is_array($f) || !isset($f['error']) || is_array($f['error']) || $f['error'] === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        return $f;
    }

    /** @return list<array> Files from a multiple file input. */
    public function files(string $key, int $max = 10): array
    {
        $f = $_FILES[$key] ?? null;
        if (!is_array($f) || !isset($f['name']) || !is_array($f['name'])) {
            $one = $this->file($key);
            return $one ? [$one] : [];
        }
        $out = [];
        foreach ($f['name'] as $i => $name) {
            if (($f['error'][$i] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            $out[] = ['name' => $name, 'type' => $f['type'][$i], 'tmp_name' => $f['tmp_name'][$i], 'error' => $f['error'][$i], 'size' => $f['size'][$i]];
            if (count($out) >= $max) {
                break;
            }
        }
        return $out;
    }

    public function isPost(): bool
    {
        return $this->method === 'POST';
    }

    public function wantsJson(): bool
    {
        return str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
    }

    public function ip(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        if (App::config('trust_proxy')) {
            $fwd = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
            $first = trim(explode(',', $fwd)[0]);
            if ($first !== '' && filter_var($first, FILTER_VALIDATE_IP)) {
                $ip = $first;
            }
        }
        return substr($ip, 0, 45);
    }

    public function userAgent(): string
    {
        return mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    }

    public function header(string $name): string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return (string) ($_SERVER[$key] ?? '');
    }
}
