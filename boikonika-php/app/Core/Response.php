<?php
declare(strict_types=1);

namespace App\Core;

final class Response
{
    public ?string $file = null;

    public function __construct(public string $body = '', public int $status = 200, public array $headers = [])
    {
    }

    public static function redirect(string $url, int $status = 303): self
    {
        return new self('', $status, ['Location' => $url]);
    }

    public static function json(mixed $data, int $status = 200): self
    {
        return new self(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), $status, ['Content-Type' => 'application/json; charset=utf-8']);
    }

    public static function text(string $body, string $type = 'text/plain', int $status = 200): self
    {
        return new self($body, $status, ['Content-Type' => $type . '; charset=utf-8']);
    }

    public static function file(string $path, string $mime, string $downloadName = ''): self
    {
        $r = new self('', 200, ['Content-Type' => $mime, 'Content-Length' => (string) filesize($path), 'Cache-Control' => 'private, no-store']);
        if ($downloadName !== '') {
            $r->headers['Content-Disposition'] = 'attachment; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', $downloadName) . '"';
        }
        $r->file = $path;
        return $r;
    }

    /** Remembers validation errors for the next page. */
    public function withErrors(array $errors): self
    {
        Session::flashNow('_errors', $errors);
        return $this;
    }

    /** Keeps what was typed (never passwords or codes) for the next page. */
    public function withInput(): self
    {
        $input = $_POST;
        foreach (array_keys($input) as $k) {
            if (preg_match('/password|_token|code|secret|passwd|number$/i', (string) $k)) {
                unset($input[$k]);
            }
        }
        Session::flashNow('_old', $input);
        return $this;
    }

    public function with(string $type, string $message): self
    {
        flash($type, $message);
        return $this;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            foreach ($this->headers as $k => $v) {
                header($k . ': ' . $v);
            }
        }
        if ($this->file !== null) {
            readfile($this->file);
            return;
        }
        echo $this->body;
    }
}
