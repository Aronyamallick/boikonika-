<?php
declare(strict_types=1);

namespace App\Controllers\Seller;

use App\Core\DB;
use App\Core\HttpException;
use App\Core\Money;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Core\Settings;
use App\Core\Upload;
use App\Core\Validator;
use App\Services\Catalog;
use App\Services\Notify;

/** A seller's offers: sell an existing catalogue book, add a new book, or add a general product. */
final class ListingsController
{
    use SellerPage;

    public const CONDITIONS = ['new', 'like_new', 'good', 'acceptable'];

    public function index(Request $req): Response
    {
        $sid = $this->sid();
        $status = in_array($req->query('status'), ['active', 'paused', 'suspended', 'empty', 'review'], true) ? $req->query('status') : '';
        $q = mb_substr($req->query('q'), 0, 80);
        $where = ['l.seller_id = ?'];
        $params = [$sid];
        if ($status === 'empty') {
            $where[] = 'l.stock = 0';
        } elseif ($status === 'review') {
            $where[] = "p.status IN ('pending', 'rejected')";
        } elseif ($status !== '') {
            $where[] = 'l.status = ?';
            $params[] = $status;
        }
        if ($q !== '') {
            $where[] = '(p.title LIKE ? OR p.isbn = ? OR l.sku = ?)';
            array_push($params, '%' . Catalog::likeEscape($q) . '%', $q, $q);
        }
        $w = implode(' AND ', $where);
        $total = (int) DB::val("SELECT COUNT(*) FROM listings l JOIN products p ON p.id = l.product_id WHERE {$w}", $params);
        $pager = new Paginator($total, 25);
        $rows = DB::all("SELECT l.*, p.title, p.slug, p.type, p.cover_path, p.status AS product_status, p.review_note FROM listings l JOIN products p ON p.id = l.product_id WHERE {$w} ORDER BY l.updated_at DESC" . $pager->sql(), $params);
        return $this->page('listings', ['title' => t('seller.listings'), 'rows' => $rows, 'pager' => $pager, 'status' => $status, 'q' => $q]);
    }

    public function create(Request $req): Response
    {
        return $this->page('listing-start', ['title' => t('seller.addListing')]);
    }

    /** Search the catalogue first so the same edition isn't added twice. */
    public function newBook(Request $req): Response
    {
        $q = mb_substr($req->query('q'), 0, 120);
        $results = [];
        if ($q !== '') {
            $isbn = Validator::isbn($q);
            $results = $isbn
                ? DB::all("SELECT p.*, (SELECT GROUP_CONCAT(a.name_bn SEPARATOR ', ') FROM product_authors pa JOIN authors a ON a.id = pa.author_id WHERE pa.product_id = p.id) AS author_names FROM products p WHERE p.isbn = ? AND p.type = 'book' AND p.status IN ('active', 'pending')", [$isbn])
                : DB::all("SELECT p.*, (SELECT GROUP_CONCAT(a.name_bn SEPARATOR ', ') FROM product_authors pa JOIN authors a ON a.id = pa.author_id WHERE pa.product_id = p.id) AS author_names FROM products p WHERE p.type = 'book' AND p.status IN ('active', 'pending') AND p.search_text LIKE ? ORDER BY p.sold_count DESC LIMIT 20", ['%' . Catalog::likeEscape(Catalog::normalize($q)) . '%']);
        }
        return $this->page('listing-book', [
            'title' => t('seller.addBook'),
            'q' => $q,
            'results' => $results,
            'categories' => Catalog::categoryOptions('book'),
            'searched' => $q !== '',
        ]);
    }

    private function offerInput(Request $req, bool $general): array
    {
        $data = $req->only(['item_condition', 'condition_note', 'price', 'compare_at_price', 'stock', 'sku']);
        if ($general && ($data['item_condition'] ?? '') === '') {
            $data['item_condition'] = 'new';
        }
        $errors = Validator::make($data, [
            'item_condition' => 'required|in:' . implode(',', self::CONDITIONS),
            'condition_note' => 'nullable|max:255',
            'price' => 'required|money_positive',
            'compare_at_price' => 'nullable|money',
            'stock' => 'required|int|gte:0|lte:100000',
            'sku' => 'nullable|max:60',
        ]);
        if (!$errors && $data['compare_at_price'] !== '' && $data['compare_at_price'] !== null && Money::toPoisha($data['compare_at_price']) <= Money::toPoisha($data['price'])) {
            $errors['compare_at_price'] = t('seller.compareHigher');
        }
        if (!$errors && $data['item_condition'] !== 'new' && trim((string) $data['condition_note']) === '') {
            $errors['condition_note'] = t('seller.describeCondition');
        }
        return [$data, $errors];
    }

    private function offerRow(array $data, int $productId): array
    {
        return [
            'product_id' => $productId,
            'seller_id' => $this->sid(),
            'item_condition' => $data['item_condition'],
            'condition_note' => $data['condition_note'] ?: null,
            'price' => Money::toDecimal(Money::toPoisha($data['price'])),
            'compare_at_price' => $data['compare_at_price'] !== '' && $data['compare_at_price'] !== null ? Money::toDecimal(Money::toPoisha($data['compare_at_price'])) : null,
            'stock' => (int) to_ascii_digits((string) $data['stock']),
            'sku' => $data['sku'] ?: null,
            'status' => 'active',
            'updated_at' => DB::now(),
        ];
    }

    /** @return list<array> checked listing photos (used copies) */
    private function photos(Request $req, array &$errors, int $max = 5): array
    {
        $files = $req->files('photos', $max);
        foreach ($files as $f) {
            if ($err = Upload::check($f)) {
                $errors['photos'] = $err;
            }
        }
        return $files;
    }

    private function savePhotos(int $listingId, array $files): void
    {
        $pos = (int) DB::val('SELECT COALESCE(MAX(position), 0) FROM listing_images WHERE listing_id = ?', [$listingId]);
        $have = (int) DB::val('SELECT COUNT(*) FROM listing_images WHERE listing_id = ?', [$listingId]);
        foreach ($files as $f) {
            if ($have++ >= 5) {
                break;
            }
            DB::insert('listing_images', ['listing_id' => $listingId, 'path' => Upload::image($f, 'listings'), 'position' => ++$pos]);
        }
    }

    public function offerForm(Request $req, string $productId): Response
    {
        $p = DB::one("SELECT * FROM products WHERE id = ? AND status IN ('active', 'pending')", [(int) $productId]) ?? throw new HttpException(404);
        return $this->page('listing-offer', ['title' => t('seller.sellThis'), 'product' => $p]);
    }

    public function storeOffer(Request $req, string $productId): Response
    {
        $p = DB::one("SELECT * FROM products WHERE id = ? AND status IN ('active', 'pending')", [(int) $productId]) ?? throw new HttpException(404);
        [$data, $errors] = $this->offerInput($req, $p['type'] === 'general');
        $files = $this->photos($req, $errors);
        if (!$req->bool('genuine')) {
            $errors['genuine'] = t('validation.accept');
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $id = DB::insert('listings', $this->offerRow($data, (int) $p['id']) + ['created_at' => DB::now()]);
        $this->savePhotos($id, $files);
        Catalog::refresh((int) $p['id']);
        return redirect(url('seller/listings'))->with('success', t('seller.offerAdded'));
    }

    private function findOrCreate(string $table, string $name): int
    {
        $name = trim(preg_replace('/\s+/u', ' ', $name));
        $id = DB::val("SELECT id FROM `{$table}` WHERE name_bn = ? OR name_en = ? LIMIT 1", [$name, $name]);
        if ($id) {
            return (int) $id;
        }
        $isLatin = !preg_match('/[\x{0980}-\x{09FF}]/u', $name);
        return DB::insert($table, [
            'slug' => Catalog::uniqueSlug($table, $name),
            'name_bn' => $name,
            'name_en' => $isLatin ? $name : null,
            'created_at' => DB::now(),
            'updated_at' => DB::now(),
        ]);
    }

    /** @return list<string> */
    private static function names(?string $list): array
    {
        $parts = preg_split('/[,،;]|\s+ও\s+|\s+and\s+/u', (string) $list) ?: [];
        $parts = array_values(array_filter(array_map(static fn ($s) => trim((string) $s), $parts), static fn ($s) => $s !== '' && mb_strlen($s) <= 160));
        return array_slice(array_unique($parts), 0, 5);
    }

    public function storeBook(Request $req): Response
    {
        $data = $req->only(['title', 'title_alt', 'subtitle', 'isbn', 'authors', 'translators', 'publisher', 'category_id', 'language', 'edition', 'pages', 'binding', 'published_year', 'description']);
        $errors = Validator::make($data, [
            'title' => 'required|max:255',
            'title_alt' => 'nullable|max:255',
            'subtitle' => 'nullable|max:255',
            'isbn' => 'nullable|isbn',
            'authors' => 'required|max:500',
            'translators' => 'nullable|max:500',
            'publisher' => 'nullable|max:160',
            'category_id' => 'required|int',
            'language' => 'required|in:bn,en,ar,other',
            'edition' => 'nullable|max:80',
            'pages' => 'nullable|int|gte:1|lte:20000',
            'binding' => 'nullable|in:hardcover,paperback,other',
            'published_year' => 'nullable|year',
            'description' => 'nullable|max:10000',
        ]);
        $isbn = $data['isbn'] ? Validator::isbn($data['isbn']) : null;
        if ($isbn && !isset($errors['isbn']) && ($existing = DB::val('SELECT id FROM products WHERE isbn = ?', [$isbn]))) {
            $errors['isbn'] = t('seller.isbnExists');
        }
        $cat = Catalog::category((int) $data['category_id']);
        if (!isset($errors['category_id']) && (!$cat || $cat['kind'] !== 'book')) {
            $errors['category_id'] = t('validation.in');
        }
        if (!isset($errors['authors']) && !self::names($data['authors'])) {
            $errors['authors'] = t('validation.required');
        }
        $cover = $req->file('cover');
        if ($cover && ($err = Upload::check($cover))) {
            $errors['cover'] = $err;
        }
        [$offer, $offerErrors] = $this->offerInput($req, false);
        $errors += $offerErrors;
        $files = $this->photos($req, $errors);
        if (!$req->bool('genuine')) {
            $errors['genuine'] = t('validation.accept');
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $review = Settings::bool('catalog.review_new_products');
        $coverPath = $cover ? Upload::image($cover, 'covers', 900, 1200) : null;
        $productId = DB::tx(function () use ($data, $isbn, $coverPath, $review, $offer, $files): int {
            $pid = DB::insert('products', [
                'type' => 'book',
                'slug' => Catalog::uniqueSlug('products', $data['title'] . ($data['edition'] ? ' ' . $data['edition'] : '')),
                'title' => $data['title'],
                'title_alt' => $data['title_alt'] ?: null,
                'subtitle' => $data['subtitle'] ?: null,
                'isbn' => $isbn,
                'language' => $data['language'],
                'edition' => $data['edition'] ?: null,
                'pages' => $data['pages'] ? (int) to_ascii_digits($data['pages']) : null,
                'binding' => $data['binding'] ?: null,
                'published_year' => $data['published_year'] ? (int) to_ascii_digits($data['published_year']) : null,
                'publisher_id' => $data['publisher'] ? $this->findOrCreate('publishers', $data['publisher']) : null,
                'category_id' => (int) $data['category_id'],
                'description' => $data['description'] ?: null,
                'cover_path' => $coverPath,
                'status' => $review ? 'pending' : 'active',
                'created_by' => \App\Core\Auth::id(),
                'seller_id' => $this->sid(),
                'created_at' => DB::now(),
                'updated_at' => DB::now(),
            ]);
            $pos = 0;
            foreach (self::names($data['authors']) as $n) {
                DB::exec('INSERT IGNORE INTO product_authors (product_id, author_id, role, position) VALUES (?, ?, ?, ?)', [$pid, $this->findOrCreate('authors', $n), 'author', $pos++]);
            }
            foreach (self::names($data['translators']) as $n) {
                DB::exec('INSERT IGNORE INTO product_authors (product_id, author_id, role, position) VALUES (?, ?, ?, ?)', [$pid, $this->findOrCreate('authors', $n), 'translator', $pos++]);
            }
            $lid = DB::insert('listings', $this->offerRow($offer, $pid) + ['created_at' => DB::now()]);
            $this->savePhotos($lid, $files);
            return $pid;
        });
        Catalog::refresh($productId);
        if ($review) {
            Notify::staff('catalog.manage', 'staffProductSubmitted', ['title' => $data['title']], 'admin/products?status=pending');
        }
        return redirect(url('seller/listings'))->with('success', $review ? t('seller.bookSubmitted') : t('seller.offerAdded'));
    }

    public function newProduct(Request $req): Response
    {
        return $this->page('listing-product', ['title' => t('seller.addProduct'), 'categories' => Catalog::categoryOptions('general')]);
    }

    public function storeProduct(Request $req): Response
    {
        $data = $req->only(['title', 'brand', 'category_id', 'description']);
        $errors = Validator::make($data, [
            'title' => 'required|max:255',
            'brand' => 'nullable|max:120',
            'category_id' => 'required|int',
            'description' => 'required|min:20|max:10000',
        ]);
        $cat = Catalog::category((int) $data['category_id']);
        if (!isset($errors['category_id']) && (!$cat || $cat['kind'] !== 'general')) {
            $errors['category_id'] = t('validation.in');
        }
        $images = $req->files('images', 5);
        if (!$images) {
            $errors['images'] = t('seller.imageRequired');
        }
        foreach ($images as $f) {
            if ($err = Upload::check($f)) {
                $errors['images'] = $err;
            }
        }
        [$offer, $offerErrors] = $this->offerInput($req, true);
        $errors += $offerErrors;
        if (!$req->bool('genuine')) {
            $errors['genuine'] = t('validation.accept');
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $review = Settings::bool('catalog.review_new_products');
        $paths = array_map(static fn ($f) => Upload::image($f, 'products', 1200, 1200), $images);
        $productId = DB::tx(function () use ($data, $paths, $review, $offer): int {
            $pid = DB::insert('products', [
                'type' => 'general',
                'slug' => Catalog::uniqueSlug('products', $data['title']),
                'title' => $data['title'],
                'brand' => $data['brand'] ?: null,
                'category_id' => (int) $data['category_id'],
                'description' => $data['description'],
                'cover_path' => $paths[0],
                'status' => $review ? 'pending' : 'active',
                'created_by' => \App\Core\Auth::id(),
                'seller_id' => $this->sid(),
                'created_at' => DB::now(),
                'updated_at' => DB::now(),
            ]);
            foreach (array_slice($paths, 1) as $i => $path) {
                DB::insert('product_images', ['product_id' => $pid, 'path' => $path, 'position' => $i + 1]);
            }
            DB::insert('listings', $this->offerRow($offer, $pid) + ['created_at' => DB::now()]);
            return $pid;
        });
        Catalog::refresh($productId);
        if ($review) {
            Notify::staff('catalog.manage', 'staffProductSubmitted', ['title' => $data['title']], 'admin/products?status=pending');
        }
        return redirect(url('seller/listings'))->with('success', $review ? t('seller.productSubmitted') : t('seller.offerAdded'));
    }

    private function mine(int $id): array
    {
        return DB::one('SELECT l.*, p.title, p.slug, p.type, p.cover_path, p.status AS product_status, p.review_note, p.seller_id AS product_seller_id, p.description, p.subtitle FROM listings l JOIN products p ON p.id = l.product_id WHERE l.id = ? AND l.seller_id = ?', [$id, $this->sid()]) ?? throw new HttpException(404);
    }

    public function edit(Request $req, string $id): Response
    {
        $l = $this->mine((int) $id);
        $images = DB::all('SELECT * FROM listing_images WHERE listing_id = ? ORDER BY position', [$l['id']]);
        $editable = (int) $l['product_seller_id'] === $this->sid() && in_array($l['product_status'], ['pending', 'rejected'], true);
        return $this->page('listing-edit', ['title' => t('seller.editListing'), 'l' => $l, 'images' => $images, 'productEditable' => $editable]);
    }

    public function update(Request $req, string $id): Response
    {
        $l = $this->mine((int) $id);
        [$data, $errors] = $this->offerInput($req, $l['type'] === 'general');
        $files = $this->photos($req, $errors);
        $editable = (int) $l['product_seller_id'] === $this->sid() && in_array($l['product_status'], ['pending', 'rejected'], true);
        $product = [];
        if ($editable) {
            $product = $req->only(['p_title', 'p_subtitle', 'p_description']);
            $errors += Validator::make($product, ['p_title' => 'required|max:255', 'p_subtitle' => 'nullable|max:255', 'p_description' => 'nullable|max:10000']);
            $cover = $req->file('p_cover');
            if ($cover && ($err = Upload::check($cover))) {
                $errors['p_cover'] = $err;
            }
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $row = $this->offerRow($data, (int) $l['product_id']);
        unset($row['product_id'], $row['seller_id']);
        $row['status'] = $l['status'] === 'suspended' ? 'suspended' : ($req->str('status') === 'paused' ? 'paused' : 'active');
        DB::update('listings', $row, 'id = ?', [$l['id']]);
        $this->savePhotos((int) $l['id'], $files);
        if ($editable) {
            $set = ['title' => $product['p_title'], 'subtitle' => $product['p_subtitle'] ?: null, 'description' => $product['p_description'] ?: null, 'status' => 'pending', 'review_note' => null, 'updated_at' => DB::now()];
            if (!empty($cover)) {
                $set['cover_path'] = Upload::image($cover, $l['type'] === 'general' ? 'products' : 'covers', 1200, 1200);
                Upload::delete($l['cover_path']);
            }
            DB::update('products', $set, 'id = ?', [$l['product_id']]);
            if ($l['product_status'] === 'rejected') {
                Notify::staff('catalog.manage', 'staffProductSubmitted', ['title' => $product['p_title']], 'admin/products?status=pending');
            }
        }
        Catalog::refresh((int) $l['product_id']);
        return redirect(url('seller/listings/' . $l['id']))->with('success', t('common.saved'));
    }

    public function deleteImage(Request $req, string $id, string $imageId): Response
    {
        $l = $this->mine((int) $id);
        $img = DB::one('SELECT * FROM listing_images WHERE id = ? AND listing_id = ?', [(int) $imageId, $l['id']]);
        if ($img) {
            DB::exec('DELETE FROM listing_images WHERE id = ?', [$img['id']]);
            Upload::delete($img['path']);
        }
        return redirect(url('seller/listings/' . $l['id']));
    }
}
