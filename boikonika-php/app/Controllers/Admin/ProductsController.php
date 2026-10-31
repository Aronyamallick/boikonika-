<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Audit;
use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Core\Upload;
use App\Core\Validator;
use App\Services\Catalog;
use App\Services\Notify;

/** Catalogue entries (books and general products): review, edit, feature; and sellers' listings. */
final class ProductsController
{
    use AdminPage;

    public function index(Request $req): Response
    {
        $status = in_array($req->query('status'), ['pending', 'active', 'rejected', 'archived'], true) ? $req->query('status') : '';
        $type = in_array($req->query('type'), ['book', 'general'], true) ? $req->query('type') : '';
        $q = mb_substr($req->query('q'), 0, 120);
        $where = ['1=1'];
        $params = [];
        if ($status !== '') {
            $where[] = 'p.status = ?';
            $params[] = $status;
        }
        if ($type !== '') {
            $where[] = 'p.type = ?';
            $params[] = $type;
        }
        if ($q !== '') {
            $isbn = Validator::isbn($q);
            if ($isbn) {
                $where[] = 'p.isbn = ?';
                $params[] = $isbn;
            } else {
                $where[] = '(p.search_text LIKE ? OR p.title LIKE ?)';
                array_push($params, '%' . Catalog::likeEscape(Catalog::normalize($q)) . '%', '%' . Catalog::likeEscape($q) . '%');
            }
        }
        $w = implode(' AND ', $where);
        $total = (int) DB::val("SELECT COUNT(*) FROM products p WHERE {$w}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT p.*, s.store_name FROM products p LEFT JOIN sellers s ON s.id = p.seller_id WHERE {$w} ORDER BY p.status = 'pending' DESC, p.updated_at DESC" . $pager->sql(), $params);
        $counts = [];
        foreach (DB::all('SELECT status, COUNT(*) AS n FROM products GROUP BY status') as $c) {
            $counts[$c['status']] = (int) $c['n'];
        }
        return $this->page('products', ['title' => t('admin.products'), 'rows' => $rows, 'pager' => $pager, 'status' => $status, 'type' => $type, 'q' => $q, 'counts' => $counts]);
    }

    public function create(Request $req): Response
    {
        $type = $req->query('type') === 'general' ? 'general' : 'book';
        return $this->page('product-form', ['title' => t('admin.newProduct'), 'p' => ['type' => $type, 'status' => 'active'], 'authorsText' => '', 'translatorsText' => '', 'publisherName' => '', 'categories' => Catalog::categoryOptions($type), 'images' => []]);
    }

    public function edit(Request $req, string $id): Response
    {
        $p = DB::one('SELECT * FROM products WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        $contrib = Catalog::contributors((int) $p['id']);
        $names = static fn (string $role): string => implode(', ', array_map(static fn ($a) => $a['name_bn'], array_filter($contrib, static fn ($a) => $a['role'] === $role)));
        $offers = DB::all('SELECT l.*, s.store_name FROM listings l JOIN sellers s ON s.id = l.seller_id WHERE l.product_id = ? ORDER BY l.price', [$p['id']]);
        return $this->page('product-form', [
            'title' => $p['title'],
            'p' => $p,
            'authorsText' => $names('author'),
            'translatorsText' => $names('translator'),
            'publisherName' => $p['publisher_id'] ? (string) DB::val('SELECT name_bn FROM publishers WHERE id = ?', [$p['publisher_id']]) : '',
            'categories' => Catalog::categoryOptions($p['type']),
            'images' => DB::all('SELECT * FROM product_images WHERE product_id = ? ORDER BY position', [$p['id']]),
            'offers' => $offers,
        ]);
    }

    public function store(Request $req): Response
    {
        return $this->save($req, null);
    }

    public function update(Request $req, string $id): Response
    {
        $p = DB::one('SELECT * FROM products WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        return $this->save($req, $p);
    }

    private function findOrCreate(string $table, string $name): int
    {
        $name = trim(preg_replace('/\s+/u', ' ', $name));
        $id = DB::val("SELECT id FROM `{$table}` WHERE name_bn = ? OR name_en = ? LIMIT 1", [$name, $name]);
        return $id ? (int) $id : DB::insert($table, ['slug' => Catalog::uniqueSlug($table, $name), 'name_bn' => $name, 'name_en' => preg_match('/[\x{0980}-\x{09FF}]/u', $name) ? null : $name, 'created_at' => DB::now(), 'updated_at' => DB::now()]);
    }

    private function save(Request $req, ?array $p): Response
    {
        $type = $p['type'] ?? ($req->str('type') === 'general' ? 'general' : 'book');
        $data = $req->only(['title', 'title_alt', 'subtitle', 'slug', 'isbn', 'authors', 'translators', 'publisher', 'category_id', 'language', 'edition', 'pages', 'binding', 'published_year', 'brand', 'description', 'status']);
        $rules = [
            'title' => 'required|max:255', 'title_alt' => 'nullable|max:255', 'subtitle' => 'nullable|max:255', 'slug' => 'nullable|slug|max:191',
            'category_id' => 'required|int', 'description' => 'nullable|max:20000', 'status' => 'required|in:pending,active,rejected,archived',
        ];
        if ($type === 'book') {
            $rules += ['isbn' => 'nullable|isbn', 'authors' => 'required|max:500', 'translators' => 'nullable|max:500', 'publisher' => 'nullable|max:160', 'language' => 'required|in:bn,en,ar,other', 'edition' => 'nullable|max:80', 'pages' => 'nullable|int|gte:1|lte:20000', 'binding' => 'nullable|in:hardcover,paperback,other', 'published_year' => 'nullable|year'];
        } else {
            $rules += ['brand' => 'nullable|max:120'];
        }
        $errors = Validator::make($data, $rules);
        $isbn = $type === 'book' && $data['isbn'] ? Validator::isbn($data['isbn']) : null;
        if ($isbn && !isset($errors['isbn']) && DB::val('SELECT 1 FROM products WHERE isbn = ? AND id <> ?', [$isbn, $p['id'] ?? 0])) {
            $errors['isbn'] = t('validation.unique');
        }
        if (!isset($errors['slug']) && $data['slug'] && DB::val('SELECT 1 FROM products WHERE slug = ? AND id <> ?', [$data['slug'], $p['id'] ?? 0])) {
            $errors['slug'] = t('validation.unique');
        }
        $cat = Catalog::category((int) $data['category_id']);
        if (!isset($errors['category_id']) && (!$cat || $cat['kind'] !== $type)) {
            $errors['category_id'] = t('validation.in');
        }
        $cover = $req->file('cover');
        if ($cover && ($err = Upload::check($cover))) {
            $errors['cover'] = $err;
        }
        $extra = $req->files('images', 5);
        foreach ($extra as $f) {
            if ($err = Upload::check($f)) {
                $errors['images'] = $err;
            }
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $row = [
            'title' => $data['title'],
            'title_alt' => $data['title_alt'] ?: null,
            'subtitle' => $data['subtitle'] ?: null,
            'category_id' => (int) $data['category_id'],
            'description' => $data['description'] ?: null,
            'status' => $data['status'],
            'is_featured' => $req->bool('is_featured') ? 1 : 0,
            'updated_at' => DB::now(),
        ];
        if ($type === 'book') {
            $row += [
                'isbn' => $isbn,
                'language' => $data['language'],
                'edition' => $data['edition'] ?: null,
                'pages' => $data['pages'] ? (int) to_ascii_digits($data['pages']) : null,
                'binding' => $data['binding'] ?: null,
                'published_year' => $data['published_year'] ? (int) to_ascii_digits($data['published_year']) : null,
                'publisher_id' => $data['publisher'] ? $this->findOrCreate('publishers', $data['publisher']) : null,
            ];
        } else {
            $row['brand'] = $data['brand'] ?: null;
        }
        if ($cover) {
            $row['cover_path'] = Upload::image($cover, $type === 'book' ? 'covers' : 'products', 1200, 1200);
            Upload::delete($p['cover_path'] ?? null);
        }
        $id = DB::tx(function () use ($p, $row, $type, $data): int {
            if ($p) {
                if ($data['slug'] && $data['slug'] !== $p['slug']) {
                    $row['slug'] = $data['slug'];
                }
                DB::update('products', $row, 'id = ?', [$p['id']]);
                $id = (int) $p['id'];
            } else {
                $row += ['type' => $type, 'slug' => $data['slug'] ?: Catalog::uniqueSlug('products', $data['title']), 'created_by' => Auth::id(), 'created_at' => DB::now()];
                $id = DB::insert('products', $row);
            }
            if ($type === 'book') {
                DB::exec('DELETE FROM product_authors WHERE product_id = ?', [$id]);
                $pos = 0;
                foreach (['author' => $data['authors'], 'translator' => $data['translators']] as $role => $list) {
                    foreach (array_slice(array_filter(array_map('trim', preg_split('/[,،;]/u', (string) $list) ?: [])), 0, 8) as $n) {
                        DB::exec('INSERT IGNORE INTO product_authors (product_id, author_id, role, position) VALUES (?, ?, ?, ?)', [$id, $this->findOrCreate('authors', $n), $role, $pos++]);
                    }
                }
            }
            return $id;
        });
        $pos = (int) DB::val('SELECT COALESCE(MAX(position), 0) FROM product_images WHERE product_id = ?', [$id]);
        foreach ($extra as $f) {
            DB::insert('product_images', ['product_id' => $id, 'path' => Upload::image($f, 'products', 1200, 1200), 'position' => ++$pos]);
        }
        foreach ((array) ($_POST['delete_images'] ?? []) as $imgId) {
            $img = DB::one('SELECT * FROM product_images WHERE id = ? AND product_id = ?', [(int) $imgId, $id]);
            if ($img) {
                DB::exec('DELETE FROM product_images WHERE id = ?', [$img['id']]);
                Upload::delete($img['path']);
            }
        }
        Catalog::refresh($id);
        Audit::log($p ? 'product.updated' : 'product.created', 'product', $id);
        if ($p && $p['status'] !== $row['status'] && in_array($row['status'], ['active', 'rejected'], true)) {
            $this->tellCreator($p, $row['status'], null);
        }
        return redirect(url('admin/products/' . $id))->with('success', t('common.saved'));
    }

    public function review(Request $req, string $id): Response
    {
        $p = DB::one('SELECT * FROM products WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        $action = $req->str('action');
        $note = mb_substr($req->str('note'), 0, 500);
        if (!in_array($action, ['approve', 'reject'], true)) {
            return back();
        }
        if ($action === 'reject' && $note === '') {
            return back()->with('error', t('seller.reasonRequired'));
        }
        $to = $action === 'approve' ? 'active' : 'rejected';
        DB::exec('UPDATE products SET status = ?, review_note = ?, updated_at = NOW() WHERE id = ?', [$to, $note ?: null, $p['id']]);
        Catalog::refresh((int) $p['id']);
        Audit::log('product.' . $action, 'product', $p['id'], ['note' => $note]);
        $this->tellCreator($p, $to, $note);
        return back()->with('success', t('common.saved'));
    }

    private function tellCreator(array $p, string $to, ?string $note): void
    {
        if (!$p['seller_id']) {
            return;
        }
        $uid = (int) DB::val('SELECT user_id FROM sellers WHERE id = ?', [$p['seller_id']]);
        Notify::user($uid, $to === 'active' ? 'productApproved' : 'productRejected', ['title' => $p['title'], 'note' => (string) $note], 'seller/listings', true, false);
    }

    public function listings(Request $req): Response
    {
        $q = mb_substr($req->query('q'), 0, 120);
        $status = in_array($req->query('status'), ['active', 'paused', 'suspended'], true) ? $req->query('status') : '';
        $where = ['1=1'];
        $params = [];
        if ($status !== '') {
            $where[] = 'l.status = ?';
            $params[] = $status;
        }
        if ($q !== '') {
            $where[] = '(p.title LIKE ? OR s.store_name LIKE ?)';
            $like = '%' . Catalog::likeEscape($q) . '%';
            array_push($params, $like, $like);
        }
        $w = implode(' AND ', $where);
        $total = (int) DB::val("SELECT COUNT(*) FROM listings l JOIN products p ON p.id = l.product_id JOIN sellers s ON s.id = l.seller_id WHERE {$w}", $params);
        $pager = new Paginator($total, 40);
        $rows = DB::all("SELECT l.*, p.title, p.id AS product_id, s.store_name, s.id AS seller_id FROM listings l JOIN products p ON p.id = l.product_id JOIN sellers s ON s.id = l.seller_id WHERE {$w} ORDER BY l.updated_at DESC" . $pager->sql(), $params);
        return $this->page('listings', ['title' => t('admin.listings'), 'rows' => $rows, 'pager' => $pager, 'q' => $q, 'status' => $status]);
    }

    public function listingStatus(Request $req, string $id): Response
    {
        $l = DB::one('SELECT l.*, s.user_id, p.title FROM listings l JOIN sellers s ON s.id = l.seller_id JOIN products p ON p.id = l.product_id WHERE l.id = ?', [(int) $id]) ?? throw new HttpException(404);
        $suspend = $req->str('action') === 'suspend';
        $reason = mb_substr($req->str('reason'), 0, 255);
        if ($suspend && $reason === '') {
            return back()->with('error', t('seller.reasonRequired'));
        }
        DB::exec('UPDATE listings SET status = ?, suspended_reason = ?, updated_at = NOW() WHERE id = ?', [$suspend ? 'suspended' : 'paused', $suspend ? $reason : null, $l['id']]);
        Catalog::refresh((int) $l['product_id']);
        Audit::log($suspend ? 'listing.suspended' : 'listing.reinstated', 'listing', $l['id'], ['reason' => $reason]);
        Notify::user((int) $l['user_id'], $suspend ? 'listingSuspended' : 'listingReinstated', ['title' => $l['title'], 'reason' => $reason], 'seller/listings/' . $l['id'], true, true);
        return back()->with('success', t('common.saved'));
    }
}
