<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Audit;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Core\Upload;
use App\Core\Validator;
use App\Services\Catalog;

/** Categories, authors, publishers and review moderation. */
final class TaxonomyController
{
    use AdminPage;

    public function categories(Request $req): Response
    {
        $all = DB::all('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS products FROM categories c ORDER BY c.kind, c.parent_id IS NOT NULL, c.position, c.id');
        $edit = $req->query('edit') !== '' ? DB::one('SELECT * FROM categories WHERE id = ?', [(int) $req->query('edit')]) : null;
        $parents = DB::all('SELECT id, kind, name_bn, name_en FROM categories WHERE parent_id IS NULL ORDER BY kind, position');
        return $this->page('categories', ['title' => t('admin.categories'), 'all' => $all, 'edit' => $edit, 'parents' => $parents]);
    }

    public function saveCategory(Request $req): Response
    {
        $id = $req->int('id');
        $data = $req->only(['name_bn', 'name_en', 'slug', 'parent_id', 'kind', 'position', 'icon']);
        $errors = Validator::make($data, ['name_bn' => 'required|max:120', 'name_en' => 'required|max:120', 'slug' => 'nullable|slug|max:120', 'kind' => 'required|in:book,general', 'position' => 'nullable|int', 'icon' => 'nullable|max:40']);
        $slug = $data['slug'] ?: slugify($data['name_en'] ?: $data['name_bn']);
        if (!isset($errors['slug']) && DB::val('SELECT 1 FROM categories WHERE slug = ? AND id <> ?', [$slug, $id])) {
            $errors['slug'] = t('validation.unique');
        }
        $parent = $data['parent_id'] ? DB::one('SELECT * FROM categories WHERE id = ? AND parent_id IS NULL', [(int) $data['parent_id']]) : null;
        if ($data['parent_id'] && (!$parent || (int) $parent['id'] === $id || $parent['kind'] !== $data['kind'])) {
            $errors['parent_id'] = t('validation.in');
        }
        if ($errors) {
            return redirect(url('admin/categories', $id ? ['edit' => $id] : []))->withErrors($errors)->withInput();
        }
        $row = ['name_bn' => $data['name_bn'], 'name_en' => $data['name_en'], 'slug' => $slug, 'parent_id' => $parent['id'] ?? null, 'kind' => $data['kind'], 'position' => (int) ($data['position'] ?: 0), 'icon' => $data['icon'] ?: null, 'is_active' => $req->bool('is_active') ? 1 : 0];
        if ($id) {
            DB::update('categories', $row, 'id = ?', [$id]);
        } else {
            $id = DB::insert('categories', $row);
        }
        Audit::log('category.saved', 'category', $id);
        return redirect(url('admin/categories'))->with('success', t('common.saved'));
    }

    public function deleteCategory(Request $req, string $id): Response
    {
        $id = (int) $id;
        if (DB::val('SELECT 1 FROM products WHERE category_id = ? LIMIT 1', [$id]) || DB::val('SELECT 1 FROM categories WHERE parent_id = ? LIMIT 1', [$id])) {
            return back()->with('error', t('admin.categoryInUse'));
        }
        DB::exec('DELETE FROM categories WHERE id = ?', [$id]);
        Audit::log('category.deleted', 'category', $id);
        return redirect(url('admin/categories'))->with('success', t('common.deleted'));
    }

    private function people(Request $req, string $table, string $view, string $titleKey): Response
    {
        $q = mb_substr($req->query('q'), 0, 80);
        $where = '1=1';
        $params = [];
        if ($q !== '') {
            $where = '(name_bn LIKE ? OR name_en LIKE ?)';
            $params = ['%' . Catalog::likeEscape($q) . '%', '%' . Catalog::likeEscape($q) . '%'];
        }
        $total = (int) DB::val("SELECT COUNT(*) FROM `{$table}` WHERE {$where}", $params);
        $pager = new Paginator($total, 40);
        $count = $table === 'authors' ? '(SELECT COUNT(*) FROM product_authors pa WHERE pa.author_id = t.id)' : '(SELECT COUNT(*) FROM products p WHERE p.publisher_id = t.id)';
        $rows = DB::all("SELECT t.*, {$count} AS books FROM `{$table}` t WHERE {$where} ORDER BY t.id DESC" . $pager->sql(), $params);
        return $this->page('people', ['title' => t($titleKey), 'rows' => $rows, 'pager' => $pager, 'q' => $q, 'kind' => $table, 'edit' => null]);
    }

    public function authors(Request $req): Response
    {
        return $this->people($req, 'authors', 'people', 'admin.authors');
    }

    public function publishers(Request $req): Response
    {
        return $this->people($req, 'publishers', 'people', 'admin.publishers');
    }

    public function editAuthor(Request $req, string $id): Response
    {
        $row = DB::one('SELECT * FROM authors WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        return $this->page('person-form', ['title' => lf($row, 'name'), 'row' => $row, 'kind' => 'authors']);
    }

    public function editPublisher(Request $req, string $id): Response
    {
        $row = DB::one('SELECT * FROM publishers WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        return $this->page('person-form', ['title' => lf($row, 'name'), 'row' => $row, 'kind' => 'publishers']);
    }

    public function newAuthor(Request $req): Response
    {
        return $this->page('person-form', ['title' => t('admin.newAuthor'), 'row' => [], 'kind' => 'authors']);
    }

    public function newPublisher(Request $req): Response
    {
        return $this->page('person-form', ['title' => t('admin.newPublisher'), 'row' => [], 'kind' => 'publishers']);
    }

    public function saveAuthor(Request $req): Response
    {
        return $this->savePerson($req, 'authors', ['bio_bn', 'bio_en'], 'photo_path');
    }

    public function savePublisher(Request $req): Response
    {
        return $this->savePerson($req, 'publishers', ['description_bn', 'description_en'], 'logo_path');
    }

    private function savePerson(Request $req, string $table, array $textFields, string $imageField): Response
    {
        $id = $req->int('id');
        $existing = $id ? DB::one("SELECT * FROM `{$table}` WHERE id = ?", [$id]) : null;
        $data = $req->only(array_merge(['name_bn', 'name_en', 'slug', 'website'], $textFields));
        $rules = ['name_bn' => 'required|max:160', 'name_en' => 'nullable|max:160', 'slug' => 'nullable|slug|max:160', $textFields[0] => 'nullable|max:5000', $textFields[1] => 'nullable|max:5000'];
        if ($table === 'publishers') {
            $rules['website'] = 'nullable|url|max:255';
        }
        $errors = Validator::make($data, $rules);
        $slug = $data['slug'] ?: ($existing['slug'] ?? Catalog::uniqueSlug($table, $data['name_en'] ?: $data['name_bn']));
        if (!isset($errors['slug']) && DB::val("SELECT 1 FROM `{$table}` WHERE slug = ? AND id <> ?", [$slug, $id])) {
            $errors['slug'] = t('validation.unique');
        }
        $img = $req->file('image');
        if ($img && ($err = Upload::check($img))) {
            $errors['image'] = $err;
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $row = ['name_bn' => $data['name_bn'], 'name_en' => $data['name_en'] ?: null, 'slug' => $slug, $textFields[0] => $data[$textFields[0]] ?: null, $textFields[1] => $data[$textFields[1]] ?: null, 'updated_at' => DB::now()];
        if ($table === 'publishers') {
            $row['website'] = $data['website'] ?: null;
        }
        if ($img) {
            $row[$imageField] = Upload::image($img, $table, 600, 600);
            Upload::delete($existing[$imageField] ?? null);
        }
        if ($existing) {
            DB::update($table, $row, 'id = ?', [$id]);
        } else {
            $id = DB::insert($table, $row + ['created_at' => DB::now()]);
        }
        // Names are part of the search text of their books.
        $pids = $table === 'authors' ? DB::col('SELECT product_id FROM product_authors WHERE author_id = ?', [$id]) : DB::col('SELECT id FROM products WHERE publisher_id = ?', [$id]);
        Catalog::refresh(array_map('intval', $pids));
        Audit::log(rtrim($table, 's') . '.saved', rtrim($table, 's'), $id);
        return redirect(url('admin/' . $table . '/' . $id))->with('success', t('common.saved'));
    }

    public function reviews(Request $req): Response
    {
        $status = in_array($req->query('status'), ['published', 'hidden'], true) ? $req->query('status') : '';
        $where = $status !== '' ? 'r.status = ?' : '1=1';
        $params = $status !== '' ? [$status] : [];
        $total = (int) DB::val("SELECT COUNT(*) FROM reviews r WHERE {$where}", $params);
        $pager = new Paginator($total, 40);
        $rows = DB::all("SELECT r.*, u.name, p.title, p.slug, p.type FROM reviews r JOIN users u ON u.id = r.user_id JOIN products p ON p.id = r.product_id WHERE {$where} ORDER BY r.id DESC" . $pager->sql(), $params);
        return $this->page('reviews', ['title' => t('admin.reviews'), 'rows' => $rows, 'pager' => $pager, 'status' => $status]);
    }

    public function moderateReview(Request $req, string $id): Response
    {
        $r = DB::one('SELECT * FROM reviews WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        $to = $req->str('status') === 'hidden' ? 'hidden' : 'published';
        DB::exec('UPDATE reviews SET status = ? WHERE id = ?', [$to, $r['id']]);
        Catalog::refreshRating((int) $r['product_id']);
        Audit::log('review.' . $to, 'review', $r['id']);
        return back()->with('success', t('common.saved'));
    }
}
