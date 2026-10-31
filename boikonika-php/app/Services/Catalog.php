<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\DB;
use App\Core\I18n;
use App\Core\Paginator;

/** Browsing, search and product pages. Only live products with at least one available offer are listed. */
final class Catalog
{
    public const SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'popular', 'rating'];
    public const LANGUAGES = ['bn', 'en', 'ar', 'other'];

    private static ?array $categories = null;

    /** Columns for product cards. */
    public const CARD = "p.id, p.type, p.slug, p.title, p.cover_path, p.min_price, p.max_discount_percent, p.has_used, p.offer_count, p.rating_avg, p.rating_count, p.language,
        (SELECT GROUP_CONCAT(COALESCE(NULLIF(a.name_%s, ''), a.name_bn) ORDER BY pa.position SEPARATOR ', ') FROM product_authors pa JOIN authors a ON a.id = pa.author_id WHERE pa.product_id = p.id AND pa.role = 'author') AS author_names,
        (SELECT MAX(l.compare_at_price) FROM listings l WHERE l.product_id = p.id AND l.status = 'active' AND l.stock > 0 AND l.price = p.min_price) AS compare_price";

    public static function cardColumns(): string
    {
        return sprintf(self::CARD, I18n::locale() === 'en' ? 'en' : 'bn');
    }

    /**
     * @param array{type?:string,category?:array|null,q?:string,condition?:string,language?:string,min?:string,max?:string,sort?:string,author_id?:int,publisher_id?:int,seller_id?:int,discount?:bool} $f
     * @return array{0:list<array>,1:Paginator}
     */
    public static function browse(array $f, int $perPage = 24): array
    {
        $where = ["p.status = 'active'", 'p.offer_count > 0'];
        $params = [];
        if (!empty($f['type'])) {
            $where[] = 'p.type = ?';
            $params[] = $f['type'];
        }
        if (!empty($f['category'])) {
            $ids = self::descendantIds((int) $f['category']['id']);
            $where[] = 'p.category_id IN (' . DB::in($ids) . ')';
            array_push($params, ...$ids);
        }
        if (($f['condition'] ?? '') === 'used') {
            $where[] = 'p.has_used = 1';
        } elseif (($f['condition'] ?? '') === 'new') {
            $where[] = "EXISTS (SELECT 1 FROM listings l2 WHERE l2.product_id = p.id AND l2.status = 'active' AND l2.stock > 0 AND l2.item_condition = 'new')";
        }
        if (!empty($f['language']) && in_array($f['language'], self::LANGUAGES, true)) {
            $where[] = 'p.language = ?';
            $params[] = $f['language'];
        }
        if (!empty($f['min']) && \App\Core\Money::valid($f['min'])) {
            $where[] = 'p.min_price >= ?';
            $params[] = \App\Core\Money::toDecimal(\App\Core\Money::toPoisha($f['min']));
        }
        if (!empty($f['max']) && \App\Core\Money::valid($f['max'])) {
            $where[] = 'p.min_price <= ?';
            $params[] = \App\Core\Money::toDecimal(\App\Core\Money::toPoisha($f['max']));
        }
        if (!empty($f['discount'])) {
            $where[] = 'p.max_discount_percent > 0';
        }
        if (!empty($f['author_id'])) {
            $where[] = 'EXISTS (SELECT 1 FROM product_authors pa2 WHERE pa2.product_id = p.id AND pa2.author_id = ?)';
            $params[] = (int) $f['author_id'];
        }
        if (!empty($f['publisher_id'])) {
            $where[] = 'p.publisher_id = ?';
            $params[] = (int) $f['publisher_id'];
        }
        if (!empty($f['seller_id'])) {
            $where[] = "EXISTS (SELECT 1 FROM listings l3 WHERE l3.product_id = p.id AND l3.seller_id = ? AND l3.status = 'active' AND l3.stock > 0)";
            $params[] = (int) $f['seller_id'];
        }
        $relevance = '';
        $relParams = [];
        $q = trim((string) ($f['q'] ?? ''));
        if ($q !== '') {
            $isbn = \App\Core\Validator::isbn($q);
            if ($isbn !== null) {
                $where[] = 'p.isbn = ?';
                $params[] = $isbn;
            } else {
                foreach (self::terms($q) as $term) {
                    $where[] = 'p.search_text LIKE ?';
                    $params[] = '%' . self::likeEscape($term) . '%';
                }
                $norm = self::normalize($q);
                $relevance = 'CASE WHEN LOWER(p.title) = ? THEN 0 WHEN LOWER(p.title) LIKE ? THEN 1 WHEN LOWER(p.title) LIKE ? THEN 2 ELSE 3 END';
                $relParams = [$norm, self::likeEscape($norm) . '%', '%' . self::likeEscape($norm) . '%'];
            }
        }
        $sort = in_array($f['sort'] ?? '', self::SORTS, true) ? $f['sort'] : ($q !== '' ? 'relevance' : 'popular');
        $order = match ($sort) {
            'relevance' => ($relevance !== '' ? $relevance . ', ' : '') . 'p.sold_count DESC, p.id DESC',
            'newest' => 'p.created_at DESC, p.id DESC',
            'price_asc' => 'p.min_price ASC, p.id DESC',
            'price_desc' => 'p.min_price DESC, p.id DESC',
            'rating' => 'p.rating_avg DESC, p.rating_count DESC, p.id DESC',
            default => 'p.is_featured DESC, p.sold_count DESC, p.rating_count DESC, p.id DESC',
        };
        $sqlWhere = implode(' AND ', $where);
        $total = (int) DB::val('SELECT COUNT(*) FROM products p WHERE ' . $sqlWhere, $params);
        $pager = new Paginator($total, $perPage);
        $orderParams = $sort === 'relevance' ? $relParams : [];
        $rows = DB::all('SELECT ' . self::cardColumns() . ' FROM products p WHERE ' . $sqlWhere . ' ORDER BY ' . $order . $pager->sql(), [...$params, ...$orderParams]);
        return [$rows, $pager];
    }

    /** Lower-case, ASCII digits, single spaces. */
    public static function normalize(string $s): string
    {
        $s = mb_strtolower(I18n::toAscii($s));
        $s = (string) preg_replace('/[^\p{L}\p{M}\p{N}]+/u', ' ', $s);
        return trim((string) preg_replace('/\s+/u', ' ', $s));
    }

    /** @return list<string> up to 6 search words */
    public static function terms(string $q): array
    {
        $words = array_filter(explode(' ', self::normalize($q)), static fn (string $w): bool => mb_strlen($w) >= 1);
        return array_slice(array_values(array_unique($words)), 0, 6);
    }

    public static function likeEscape(string $s): string
    {
        return addcslashes($s, '%_\\');
    }

    /** Small product lists for the home page and "more like this". */
    public static function section(string $kind, int $limit = 10, array $extra = []): array
    {
        $where = "p.status = 'active' AND p.offer_count > 0";
        $params = [];
        $order = 'p.sold_count DESC, p.id DESC';
        switch ($kind) {
            case 'new':
                $where .= " AND p.type = 'book'";
                $order = 'p.created_at DESC, p.id DESC';
                break;
            case 'bestsellers':
                $where .= " AND p.type = 'book'";
                break;
            case 'featured':
                $where .= ' AND p.is_featured = 1';
                $order = 'p.updated_at DESC';
                break;
            case 'discounted':
                $where .= ' AND p.max_discount_percent > 0';
                $order = 'p.max_discount_percent DESC, p.sold_count DESC';
                break;
            case 'used':
                $where .= ' AND p.has_used = 1';
                $order = 'p.updated_at DESC';
                break;
            case 'general':
                $where .= " AND p.type = 'general'";
                break;
            case 'related':
                $where .= ' AND p.id <> ? AND p.category_id = ?';
                $params = [(int) $extra['product_id'], (int) $extra['category_id']];
                break;
            case 'by_author':
                $where .= ' AND p.id <> ? AND EXISTS (SELECT 1 FROM product_authors x WHERE x.product_id = p.id AND x.author_id IN (' . DB::in($extra['author_ids']) . '))';
                $params = [(int) $extra['product_id'], ...array_map('intval', $extra['author_ids'])];
                break;
        }
        return DB::all('SELECT ' . self::cardColumns() . " FROM products p WHERE {$where} ORDER BY {$order} LIMIT " . (int) $limit, $params);
    }

    // ------------------------------------------------------------------ categories

    /** @return list<array> every active category, ordered */
    public static function categories(): array
    {
        return self::$categories ??= DB::all('SELECT * FROM categories WHERE is_active = 1 ORDER BY position, id');
    }

    /** @return list<array> top-level categories with a 'children' list */
    public static function tree(?string $kind = null): array
    {
        $all = self::categories();
        $byParent = [];
        foreach ($all as $c) {
            $byParent[(int) $c['parent_id']][] = $c;
        }
        $out = [];
        foreach ($byParent[0] ?? [] as $c) {
            if ($kind !== null && $c['kind'] !== $kind) {
                continue;
            }
            $c['children'] = $byParent[(int) $c['id']] ?? [];
            $out[] = $c;
        }
        return $out;
    }

    public static function categoryBySlug(string $slug): ?array
    {
        foreach (self::categories() as $c) {
            if ($c['slug'] === $slug) {
                return $c;
            }
        }
        return null;
    }

    public static function category(?int $id): ?array
    {
        foreach (self::categories() as $c) {
            if ((int) $c['id'] === $id) {
                return $c;
            }
        }
        return null;
    }

    /** @return list<int> the category and everything under it */
    public static function descendantIds(int $id): array
    {
        $ids = [$id];
        $all = self::categories();
        for ($i = 0; $i < count($ids); $i++) {
            foreach ($all as $c) {
                if ((int) $c['parent_id'] === $ids[$i]) {
                    $ids[] = (int) $c['id'];
                }
            }
        }
        return $ids;
    }

    /** @return list<array> root → category */
    public static function trail(?int $id): array
    {
        $trail = [];
        $guard = 0;
        while ($id && ($c = self::category($id)) && $guard++ < 10) {
            array_unshift($trail, $c);
            $id = $c['parent_id'] ? (int) $c['parent_id'] : null;
        }
        return $trail;
    }

    /** Options for a <select>, grouped by top-level category. */
    public static function categoryOptions(?string $kind = null): array
    {
        $out = [];
        foreach (self::tree($kind) as $top) {
            $group = [(string) $top['id'] => lf($top, 'name')];
            foreach ($top['children'] as $ch) {
                $group[(string) $ch['id']] = '— ' . lf($ch, 'name');
            }
            $out[lf($top, 'name')] = $group;
        }
        return $out;
    }

    // ------------------------------------------------------------------ product pages

    public static function product(string $slug): ?array
    {
        $p = DB::one("SELECT p.*, pub.slug AS publisher_slug, pub.name_bn AS publisher_name_bn, pub.name_en AS publisher_name_en
            FROM products p LEFT JOIN publishers pub ON pub.id = p.publisher_id WHERE p.slug = ? AND p.status = 'active'", [$slug]);
        if (!$p) {
            return null;
        }
        $p['authors'] = self::contributors((int) $p['id']);
        $p['images'] = DB::all('SELECT path FROM product_images WHERE product_id = ? ORDER BY position, id', [$p['id']]);
        $p['offers'] = self::offers((int) $p['id']);
        return $p;
    }

    public static function contributors(int $productId): array
    {
        return DB::all('SELECT a.id, a.slug, a.name_bn, a.name_en, pa.role FROM product_authors pa JOIN authors a ON a.id = pa.author_id WHERE pa.product_id = ? ORDER BY pa.role, pa.position', [$productId]);
    }

    /** Offers that can be bought now, cheapest first. */
    public static function offers(int $productId): array
    {
        $offers = DB::all("SELECT l.*, s.store_name, s.slug AS store_slug, s.district AS store_district
            FROM listings l JOIN sellers s ON s.id = l.seller_id
            WHERE l.product_id = ? AND l.status = 'active' AND l.stock > 0 AND s.status = 'approved'
            ORDER BY l.price ASC, l.item_condition ASC, l.id ASC", [$productId]);
        if ($offers) {
            $images = DB::all('SELECT listing_id, path FROM listing_images WHERE listing_id IN (' . DB::in(array_column($offers, 'id')) . ') ORDER BY position, id', array_column($offers, 'id'));
            foreach ($offers as &$o) {
                $o['images'] = array_values(array_filter($images, static fn ($i) => (int) $i['listing_id'] === (int) $o['id']));
            }
        }
        return $offers;
    }

    /**
     * Recomputes the cached price, offer count and search text of products after listings change.
     * @param int|list<int> $ids
     */
    public static function refresh(int|array $ids): void
    {
        foreach ((array) $ids as $id) {
            $id = (int) $id;
            $agg = DB::one("SELECT MIN(l.price) AS min_price, COUNT(*) AS offers, MAX(l.item_condition <> 'new') AS has_used,
                MAX(CASE WHEN l.compare_at_price > l.price THEN FLOOR((l.compare_at_price - l.price) * 100 / l.compare_at_price) ELSE 0 END) AS disc
                FROM listings l JOIN sellers s ON s.id = l.seller_id
                WHERE l.product_id = ? AND l.status = 'active' AND l.stock > 0 AND s.status = 'approved'", [$id]);
            DB::exec('UPDATE products SET min_price = ?, offer_count = ?, has_used = ?, max_discount_percent = ?, search_text = ? WHERE id = ?', [
                $agg['min_price'],
                (int) $agg['offers'],
                (int) ($agg['has_used'] ?? 0),
                min(99, (int) ($agg['disc'] ?? 0)),
                self::searchText($id),
                $id,
            ]);
        }
    }

    public static function refreshSeller(int $sellerId): void
    {
        self::refresh(array_map('intval', DB::col('SELECT DISTINCT product_id FROM listings WHERE seller_id = ?', [$sellerId])));
    }

    public static function searchText(int $productId): string
    {
        $p = DB::one('SELECT p.title, p.title_alt, p.subtitle, p.isbn, p.brand, pub.name_bn, pub.name_en FROM products p LEFT JOIN publishers pub ON pub.id = p.publisher_id WHERE p.id = ?', [$productId]);
        if (!$p) {
            return '';
        }
        $parts = [$p['title'], $p['title_alt'], $p['subtitle'], $p['isbn'], $p['brand'], $p['name_bn'], $p['name_en']];
        foreach (DB::all('SELECT a.name_bn, a.name_en FROM product_authors pa JOIN authors a ON a.id = pa.author_id WHERE pa.product_id = ?', [$productId]) as $a) {
            $parts[] = $a['name_bn'];
            $parts[] = $a['name_en'];
        }
        return mb_substr(self::normalize(implode(' ', array_filter($parts))), 0, 2000);
    }

    /** A free slug for $table, from $text. */
    public static function uniqueSlug(string $table, string $text, ?int $exceptId = null): string
    {
        $base = slugify($text);
        $slug = $base;
        $n = 2;
        while (DB::val("SELECT id FROM `{$table}` WHERE slug = ?" . ($exceptId ? ' AND id <> ' . (int) $exceptId : ''), [$slug]) !== null) {
            $slug = $base . '-' . $n++;
        }
        return $slug;
    }

    public static function productUrl(array $p): string
    {
        return url(($p['type'] ?? 'book') === 'general' ? 'products/' . $p['slug'] : 'books/' . $p['slug']);
    }

    /** Updates the rating summary after reviews change. */
    public static function refreshRating(int $productId): void
    {
        $r = DB::one("SELECT COUNT(*) AS n, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE product_id = ? AND status = 'published'", [$productId]);
        DB::exec('UPDATE products SET rating_count = ?, rating_avg = ? WHERE id = ?', [(int) $r['n'], number_format((float) $r['avg'], 2, '.', ''), $productId]);
    }
}
