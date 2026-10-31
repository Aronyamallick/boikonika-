<?php
declare(strict_types=1);

namespace App\Core;

final class Paginator
{
    public readonly int $page;
    public readonly int $pages;
    public readonly int $offset;

    public function __construct(public readonly int $total, public readonly int $perPage = 24, ?int $page = null)
    {
        $this->pages = max(1, (int) ceil($total / max(1, $perPage)));
        $this->page = min($this->pages, max(1, $page ?? (int) ($_GET['page'] ?? 1)));
        $this->offset = ($this->page - 1) * $perPage;
    }

    public function sql(): string
    {
        return ' LIMIT ' . (int) $this->perPage . ' OFFSET ' . (int) $this->offset;
    }

    /** Link to another page, keeping the other query parameters. */
    public function url(int $page): string
    {
        $q = $_GET;
        unset($q['page']);
        if ($page > 1) {
            $q['page'] = $page;
        }
        $path = App::$request->fullPath;
        return App::$request->basePath . $path . ($q ? '?' . http_build_query($q) : '');
    }

    /** @return list<int|null> Page numbers to show; null is a gap. */
    public function window(): array
    {
        $out = [];
        $last = 0;
        for ($i = 1; $i <= $this->pages; $i++) {
            if ($i === 1 || $i === $this->pages || abs($i - $this->page) <= 2) {
                if ($last && $i - $last > 1) {
                    $out[] = null;
                }
                $out[] = $i;
                $last = $i;
            }
        }
        return $out;
    }
}
