<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Small, safe Markdown renderer for pages and descriptions. Everything is escaped first; only a fixed
 * set of structures is turned into HTML. Raw HTML in the source is shown as text, and links only allow
 * http(s), mailto, tel and site-relative addresses.
 */
final class Markdown
{
    public static function render(?string $src): string
    {
        $src = str_replace(["\r\n", "\r"], "\n", (string) $src);
        $lines = explode("\n", $src);
        $html = [];
        $para = [];
        $list = null; // ['ul'|'ol', items[]]
        $quote = [];
        $n = count($lines);

        $flushPara = static function () use (&$para, &$html): void {
            if ($para) {
                $html[] = '<p>' . implode('<br>', array_map([self::class, 'inline'], $para)) . '</p>';
                $para = [];
            }
        };
        $flushList = static function () use (&$list, &$html): void {
            if ($list) {
                $items = array_map(static fn (string $i): string => '<li>' . self::inline($i) . '</li>', $list[1]);
                $html[] = '<' . $list[0] . '>' . implode('', $items) . '</' . $list[0] . '>';
                $list = null;
            }
        };
        $flushQuote = static function () use (&$quote, &$html): void {
            if ($quote) {
                $html[] = '<blockquote><p>' . implode('<br>', array_map([self::class, 'inline'], $quote)) . '</p></blockquote>';
                $quote = [];
            }
        };

        for ($i = 0; $i < $n; $i++) {
            $line = rtrim($lines[$i]);
            if (preg_match('/^```/', $line)) {
                $flushPara();
                $flushList();
                $flushQuote();
                $code = [];
                for ($i++; $i < $n && !preg_match('/^```/', rtrim($lines[$i])); $i++) {
                    $code[] = $lines[$i];
                }
                $html[] = '<pre><code>' . e(implode("\n", $code)) . '</code></pre>';
                continue;
            }
            if (trim($line) === '') {
                $flushPara();
                $flushList();
                $flushQuote();
                continue;
            }
            if (preg_match('/^(#{1,4})\s+(.+)$/u', $line, $m)) {
                $flushPara();
                $flushList();
                $flushQuote();
                $level = strlen($m[1]) + 1;
                $html[] = "<h{$level}>" . self::inline(rtrim($m[2], ' #')) . "</h{$level}>";
                continue;
            }
            if (preg_match('/^(-{3,}|\*{3,}|_{3,})$/', trim($line))) {
                $flushPara();
                $flushList();
                $flushQuote();
                $html[] = '<hr>';
                continue;
            }
            if (preg_match('/^>\s?(.*)$/u', $line, $m)) {
                $flushPara();
                $flushList();
                $quote[] = $m[1];
                continue;
            }
            if (preg_match('/^\s*[-*+]\s+(.+)$/u', $line, $m)) {
                $flushPara();
                $flushQuote();
                if (!$list || $list[0] !== 'ul') {
                    $flushList();
                    $list = ['ul', []];
                }
                $list[1][] = $m[1];
                continue;
            }
            if (preg_match('/^\s*[0-9০-৯]+[.)]\s+(.+)$/u', $line, $m)) {
                $flushPara();
                $flushQuote();
                if (!$list || $list[0] !== 'ol') {
                    $flushList();
                    $list = ['ol', []];
                }
                $list[1][] = $m[1];
                continue;
            }
            if ($list && preg_match('/^\s{2,}(.+)$/u', $line, $m)) {
                $list[1][count($list[1]) - 1] .= ' ' . $m[1];
                continue;
            }
            $flushList();
            $flushQuote();
            $para[] = $line;
        }
        $flushPara();
        $flushList();
        $flushQuote();
        return implode("\n", $html);
    }

    /** Plain text (for meta descriptions and cards). */
    public static function plain(?string $src, int $limit = 160): string
    {
        $t = preg_replace(['/```.*?```/s', '/!\[[^\]]*\]\([^)]*\)/', '/\[([^\]]+)\]\([^)]*\)/', '/[#>*_`~]+/', '/\s+/u'], ['', '', '$1', '', ' '], (string) $src);
        $t = trim((string) $t);
        return mb_strlen($t) > $limit ? rtrim(mb_substr($t, 0, $limit - 1)) . '…' : $t;
    }

    public static function inline(string $text): string
    {
        $s = e($text);
        $codes = [];
        $s = preg_replace_callback('/`([^`]+)`/', static function (array $m) use (&$codes): string {
            $codes[] = '<code>' . $m[1] . '</code>';
            return "\x01" . (count($codes) - 1) . "\x01";
        }, $s);
        $s = preg_replace_callback('/\[([^\]]+)\]\(([^)\s]+)\)/u', static function (array $m): string {
            $href = html_entity_decode($m[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (!preg_match('#^(https?://|mailto:|tel:|/(?!/)|\#)#i', $href)) {
                return $m[1];
            }
            $external = preg_match('#^https?://#i', $href) && !str_starts_with($href, (string) App::config('url', "\0"));
            return '<a href="' . e($href) . '"' . ($external ? ' rel="nofollow noopener noreferrer" target="_blank"' : '') . '>' . $m[1] . '</a>';
        }, $s);
        $s = preg_replace('/\*\*(.+?)\*\*/u', '<strong>$1</strong>', $s);
        $s = preg_replace('/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/u', '<em>$1</em>', $s);
        $s = preg_replace('/(?<![\w])_(?!\s)(.+?)(?<!\s)_(?![\w])/u', '<em>$1</em>', $s);
        return preg_replace_callback("/\x01(\d+)\x01/", static fn (array $m): string => $codes[(int) $m[1]], $s);
    }
}
