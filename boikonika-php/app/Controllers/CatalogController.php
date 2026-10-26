<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Markdown;
use App\Core\Money;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Services\Catalog;
use App\Services\Orders;

final class CatalogController
{
    private function filters(Request $req): array
    {
        return [
            'q' => mb_substr($req->query('q'), 0, 120),
            'condition' => in_array($req->query('condition'), ['new', 'used'], true) ? $req->query('condition') : '',
            'language' => in_array($req->query('language'), Catalog::LANGUAGES, true) ? $req->query('language') : '',
            'min' => $req->query('min'),
            'max' => $req->query('max'),
            'sort' => in_array($req->query('sort'), Catalog::SORTS, true) ? $req->query('sort') : '',
            'discount' => $req->query('discount') === '1',
        ];
    }

    private function listing(Request $req, array $f, array $page): Response
    {
        [$rows, $pager] = Catalog::browse($f);
        return view('catalog/list', $page + ['products' => $rows, 'pager' => $pager, 'f' => $f, 'searchQuery' => $f['q'] ?? '']);
    }

    public function books(Request $req): Response
    {
        $f = $this->filters($req) + ['type' => 'book'];
        $cat = $req->query('category') !== '' ? Catalog::categoryBySlug($req->query('category')) : null;
        $f['category'] = $cat;
        return $this->listing($req, $f, [
            'title' => $f['condition'] === 'used' ? t('catalog.usedTitle') : t('catalog.booksTitle'),
            'heading' => $f['condition'] === 'used' ? t('catalog.usedTitle') : t('catalog.booksTitle'),
            'intro' => t('catalog.booksIntro'),
            'tree' => Catalog::tree('book'),
            'activeCategory' => $cat,
            'baseUrl' => 'books',
            'description' => t('catalog.booksIntro'),
        ]);
    }

    public function general(Request $req): Response
    {
        $f = $this->filters($req) + ['type' => 'general'];
        $cat = $req->query('category') !== '' ? Catalog::categoryBySlug($req->query('category')) : null;
        $f['category'] = $cat;
        return $this->listing($req, $f, [
            'title' => t('catalog.generalTitle'),
            'heading' => t('catalog.generalTitle'),
            'intro' => t('catalog.generalIntro'),
            'tree' => Catalog::tree('general'),
            'activeCategory' => $cat,
            'baseUrl' => 'products',
            'isGeneral' => true,
            'description' => t('catalog.generalIntro'),
        ]);
    }

    public function categories(Request $req): Response
    {
        return view('catalog/categories', ['title' => t('catalog.categoriesTitle'), 'book' => Catalog::tree('book'), 'general' => Catalog::tree('general')]);
    }

    public function category(Request $req, string $slug): Response
    {
        $cat = Catalog::categoryBySlug($slug) ?? throw new HttpException(404);
        $f = $this->filters($req) + ['type' => $cat['kind'], 'category' => $cat];
        $trail = Catalog::trail((int) $cat['id']);
        $children = array_values(array_filter(Catalog::categories(), static fn ($c) => (int) $c['parent_id'] === (int) $cat['id']));
        return $this->listing($req, $f, [
            'title' => lf($cat, 'name'),
            'heading' => lf($cat, 'name'),
            'intro' => '',
            'tree' => Catalog::tree($cat['kind']),
            'activeCategory' => $cat,
            'trail' => $trail,
            'children' => $children,
            'baseUrl' => 'categories/' . $cat['slug'],
            'fixedCategory' => true,
            'isGeneral' => $cat['kind'] === 'general',
            'description' => t('catalog.categoryDescription', ['name' => lf($cat, 'name')]),
        ]);
    }

    public function search(Request $req): Response
    {
        $q = mb_substr($req->query('q'), 0, 120);
        if ($q === '') {
            return redirect(url('books'));
        }
        $f = $this->filters($req);
        [$rows, $pager] = Catalog::browse($f);
        $authors = DB::all('SELECT id, slug, name_bn, name_en, photo_path FROM authors WHERE name_bn LIKE ? OR name_en LIKE ? ORDER BY name_bn LIMIT 6', ['%' . Catalog::likeEscape($q) . '%', '%' . Catalog::likeEscape($q) . '%']);
        return view('catalog/list', [
            'title' => t('catalog.searchTitle', ['q' => $q]),
            'heading' => t('catalog.searchTitle', ['q' => $q]),
            'intro' => '',
            'products' => $rows,
            'pager' => $pager,
            'f' => $f,
            'tree' => [],
            'activeCategory' => null,
            'baseUrl' => 'search',
            'isSearch' => true,
            'authors' => $authors,
            'searchQuery' => $q,
            'robots' => 'noindex',
        ]);
    }

    public function product(Request $req, string $slug): Response
    {
        $p = Catalog::product($slug) ?? throw new HttpException(404);
        $isBooksPath = str_starts_with($req->path, '/books/');
        if ($isBooksPath !== ($p['type'] === 'book')) {
            return redirect(Catalog::productUrl($p), 301);
        }
        $reviews = DB::all("SELECT r.*, u.name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? AND r.status = 'published' ORDER BY r.created_at DESC LIMIT 30", [$p['id']]);
        $dist = array_fill(1, 5, 0);
        foreach (DB::all("SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? AND status = 'published' GROUP BY rating", [$p['id']]) as $row) {
            $dist[(int) $row['rating']] = (int) $row['n'];
        }
        $uid = Auth::id();
        $canReview = false;
        $myReview = null;
        $wished = false;
        if ($uid) {
            $myReview = DB::one('SELECT * FROM reviews WHERE product_id = ? AND user_id = ?', [$p['id'], $uid]);
            $canReview = (bool) DB::val("SELECT 1 FROM order_items i JOIN seller_orders so ON so.id = i.seller_order_id JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? AND o.user_id = ? AND so.status = 'delivered' LIMIT 1", [$p['id'], $uid]);
            $wished = (bool) DB::val('SELECT 1 FROM wishlist_items WHERE user_id = ? AND product_id = ?', [$uid, $p['id']]);
        }
        $authorIds = array_map(static fn ($a) => (int) $a['id'], array_filter($p['authors'], static fn ($a) => $a['role'] === 'author'));
        $more = $authorIds ? Catalog::section('by_author', 10, ['product_id' => $p['id'], 'author_ids' => $authorIds]) : [];
        $related = $p['category_id'] ? Catalog::section('related', 10, ['product_id' => $p['id'], 'category_id' => $p['category_id']]) : [];
        $trail = Catalog::trail($p['category_id'] ? (int) $p['category_id'] : null);
        $cover = $p['cover_path'] ? abs_url('') : null;

        $offersLd = array_map(static fn ($o) => [
            '@type' => 'Offer',
            'price' => Money::toDecimal(Money::toPoisha($o['price'])),
            'priceCurrency' => 'BDT',
            'availability' => 'https://schema.org/InStock',
            'itemCondition' => $o['item_condition'] === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
            'seller' => ['@type' => 'Organization', 'name' => $o['store_name']],
        ], $p['offers']);
        $ld = [
            '@context' => 'https://schema.org',
            '@type' => $p['type'] === 'book' ? ['Book', 'Product'] : 'Product',
            'name' => $p['title'],
            'url' => abs_url(ltrim($req->path, '/')),
            'description' => Markdown::plain($p['description'], 300),
        ];
        if ($p['cover_path']) {
            $ld['image'] = rtrim((string) \App\Core\App::config('url'), '/') . '/uploads/' . $p['cover_path'];
        }
        if ($p['isbn']) {
            $ld['isbn'] = $p['isbn'];
        }
        if ($authorIds) {
            $ld['author'] = array_values(array_map(static fn ($a) => ['@type' => 'Person', 'name' => lf($a, 'name')], array_filter($p['authors'], static fn ($a) => $a['role'] === 'author')));
        }
        if ($offersLd) {
            $ld['offers'] = $offersLd;
        }
        if ((int) $p['rating_count'] > 0) {
            $ld['aggregateRating'] = ['@type' => 'AggregateRating', 'ratingValue' => $p['rating_avg'], 'reviewCount' => (int) $p['rating_count']];
        }
        return view('catalog/product', [
            'title' => $p['title'],
            'description' => Markdown::plain($p['description']) ?: t('catalog.productDescription', ['title' => $p['title']]),
            'p' => $p,
            'reviews' => $reviews,
            'dist' => $dist,
            'canReview' => $canReview,
            'myReview' => $myReview,
            'wished' => $wished,
            'more' => $more,
            'related' => $related,
            'trail' => $trail,
            'ogType' => $p['type'] === 'book' ? 'book' : 'product',
            'ogImage' => $p['cover_path'] ? rtrim((string) \App\Core\App::config('url'), '/') . '/uploads/' . $p['cover_path'] : null,
            'jsonLd' => $ld,
        ]);
    }

    public function authors(Request $req): Response
    {
        $q = mb_substr($req->query('q'), 0, 80);
        $where = '1=1';
        $params = [];
        if ($q !== '') {
            $where = '(a.name_bn LIKE ? OR a.name_en LIKE ?)';
            $params = ['%' . Catalog::likeEscape($q) . '%', '%' . Catalog::likeEscape($q) . '%'];
        }
        $total = (int) DB::val("SELECT COUNT(*) FROM authors a WHERE {$where}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT a.*, (SELECT COUNT(*) FROM product_authors pa JOIN products p ON p.id = pa.product_id WHERE pa.author_id = a.id AND p.status = 'active' AND p.offer_count > 0) AS books
            FROM authors a WHERE {$where} ORDER BY books DESC, a.name_bn" . $pager->sql(), $params);
        return view('catalog/people', ['title' => t('catalog.authorsTitle'), 'heading' => t('catalog.authorsTitle'), 'rows' => $rows, 'pager' => $pager, 'kind' => 'authors', 'q' => $q]);
    }

    public function author(Request $req, string $slug): Response
    {
        $a = DB::one('SELECT * FROM authors WHERE slug = ?', [$slug]) ?? throw new HttpException(404);
        [$rows, $pager] = Catalog::browse(['author_id' => (int) $a['id'], 'sort' => $req->query('sort')]);
        return view('catalog/person', ['title' => lf($a, 'name'), 'person' => $a, 'kind' => 'author', 'products' => $rows, 'pager' => $pager, 'description' => Markdown::plain(lf($a, 'bio')) ?: t('catalog.authorDescription', ['name' => lf($a, 'name')])]);
    }

    public function publishers(Request $req): Response
    {
        $q = mb_substr($req->query('q'), 0, 80);
        $where = '1=1';
        $params = [];
        if ($q !== '') {
            $where = '(p.name_bn LIKE ? OR p.name_en LIKE ?)';
            $params = ['%' . Catalog::likeEscape($q) . '%', '%' . Catalog::likeEscape($q) . '%'];
        }
        $total = (int) DB::val("SELECT COUNT(*) FROM publishers p WHERE {$where}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT p.*, (SELECT COUNT(*) FROM products x WHERE x.publisher_id = p.id AND x.status = 'active' AND x.offer_count > 0) AS books
            FROM publishers p WHERE {$where} ORDER BY books DESC, p.name_bn" . $pager->sql(), $params);
        return view('catalog/people', ['title' => t('catalog.publishersTitle'), 'heading' => t('catalog.publishersTitle'), 'rows' => $rows, 'pager' => $pager, 'kind' => 'publishers', 'q' => $q]);
    }

    public function publisher(Request $req, string $slug): Response
    {
        $p = DB::one('SELECT * FROM publishers WHERE slug = ?', [$slug]) ?? throw new HttpException(404);
        [$rows, $pager] = Catalog::browse(['publisher_id' => (int) $p['id'], 'sort' => $req->query('sort')]);
        return view('catalog/person', ['title' => lf($p, 'name'), 'person' => $p, 'kind' => 'publisher', 'products' => $rows, 'pager' => $pager, 'description' => Markdown::plain(lf($p, 'description')) ?: t('catalog.publisherDescription', ['name' => lf($p, 'name')])]);
    }

    public function store(Request $req, string $slug): Response
    {
        $s = DB::one("SELECT * FROM sellers WHERE slug = ? AND status = 'approved'", [$slug]) ?? throw new HttpException(404);
        [$rows, $pager] = Catalog::browse(['seller_id' => (int) $s['id'], 'sort' => $req->query('sort'), 'q' => mb_substr($req->query('q'), 0, 120)]);
        $stats = DB::one("SELECT COUNT(*) AS delivered FROM seller_orders WHERE seller_id = ? AND status = 'delivered'", [$s['id']]);
        return view('catalog/store', ['title' => $s['store_name'], 'store' => $s, 'products' => $rows, 'pager' => $pager, 'stats' => $stats, 'description' => Markdown::plain($s['description']) ?: t('catalog.storeDescription', ['name' => $s['store_name']])]);
    }
}
