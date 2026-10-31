<?php
declare(strict_types=1);

namespace App\Services;

/** Minimal SMTP client: SSL (465) or STARTTLS (587), AUTH LOGIN. Certificates are verified. */
final class Smtp
{
    /** @var resource|null */
    private $sock = null;

    public function __construct(private string $host, private int $port, private string $encryption, private string $user, private string $pass)
    {
    }

    public function send(string $from, string $to, array $headers, string $body): void
    {
        if ($this->host === '') {
            throw new \RuntimeException('SMTP host is not set');
        }
        $remote = ($this->encryption === 'ssl' ? 'ssl://' : 'tcp://') . $this->host . ':' . $this->port;
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true, 'peer_name' => $this->host]]);
        $sock = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$sock) {
            throw new \RuntimeException("SMTP connect failed: {$errstr} ({$errno})");
        }
        $this->sock = $sock;
        stream_set_timeout($sock, 20);
        try {
            $this->expect(220);
            $ehlo = 'EHLO ' . (gethostname() ?: 'localhost');
            $this->cmd($ehlo, 250);
            if ($this->encryption === 'tls') {
                $this->cmd('STARTTLS', 220);
                if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT') ? STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT : 0))) {
                    throw new \RuntimeException('STARTTLS failed');
                }
                $this->cmd($ehlo, 250);
            }
            if ($this->user !== '') {
                $this->cmd('AUTH LOGIN', 334);
                $this->cmd(base64_encode($this->user), 334);
                $this->cmd(base64_encode($this->pass), 235);
            }
            $this->cmd('MAIL FROM:<' . $from . '>', 250);
            $this->cmd('RCPT TO:<' . $to . '>', [250, 251]);
            $this->cmd('DATA', 354);
            $data = '';
            foreach ($headers as $k => $v) {
                $data .= $k . ': ' . $v . "\r\n";
            }
            $data .= "\r\n" . $body;
            $data = preg_replace('/^\./m', '..', str_replace(["\r\n", "\n"], ["\n", "\r\n"], $data));
            fwrite($sock, $data . "\r\n.\r\n");
            $this->expect(250);
            $this->cmd('QUIT', [221, 250]);
        } finally {
            fclose($sock);
            $this->sock = null;
        }
    }

    private function cmd(string $line, int|array $expect): string
    {
        fwrite($this->sock, $line . "\r\n");
        return $this->expect($expect);
    }

    private function expect(int|array $codes): string
    {
        $codes = (array) $codes;
        $resp = '';
        while (($line = fgets($this->sock, 1024)) !== false) {
            $resp .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        $code = (int) substr($resp, 0, 3);
        if (!in_array($code, $codes, true)) {
            throw new \RuntimeException('SMTP error: ' . trim($resp ?: 'no response'));
        }
        return $resp;
    }
}
