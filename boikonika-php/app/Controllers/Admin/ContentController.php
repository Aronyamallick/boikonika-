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
use App\Services\Mail;

/** Information pages, home-page banners and contact messages. */
final class ContentController
{
    use AdminPage;

    public function pages(Request $req): Response
    {
        return $this->page('pages', ['title' => t('admin.pages'), 'rows' => DB::all('SELECT id, slug, title_bn, title_en, is_published, footer_group, updated_at FROM pages ORDER BY footer_group, position, id')]);
    }

    public function editPage(Request $req, ?string $id = null): Response
    {
        $page = $id ? (DB::one('SELECT * FROM pages WHERE id = ?', [(int) $id]) ?? throw new HttpException(404)) : [];
        return $this->page('page-form', ['title' => $page ? lf($page, 'title') : t('admin.newPage'), 'p' => $page]);
    }

    public function savePage(Request $req): Response
    {
        $id = $req->int('id');
        $data = $req->only(['slug', 'title_bn', 'title_en', 'body_bn', 'body_en', 'footer_group', 'position']);
        $errors = Validator::make($data, ['slug' => 'required|slug|max:80', 'title_bn' => 'required|max:160', 'title_en' => 'required|max:160', 'body_bn' => 'nullable|max:100000', 'body_en' => 'nullable|max:100000', 'footer_group' => 'required|in:none,company,support,policies', 'position' => 'nullable|int']);
        if (!isset($errors['slug']) && DB::val('SELECT 1 FROM pages WHERE slug = ? AND id <> ?', [$data['slug'], $id])) {
            $errors['slug'] = t('validation.unique');
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $row = ['slug' => $data['slug'], 'title_bn' => $data['title_bn'], 'title_en' => $data['title_en'], 'body_bn' => $data['body_bn'] ?: null, 'body_en' => $data['body_en'] ?: null, 'footer_group' => $data['footer_group'], 'position' => (int) ($data['position'] ?: 0), 'is_published' => $req->bool('is_published') ? 1 : 0, 'updated_by' => Auth::id(), 'updated_at' => DB::now()];
        if ($id) {
            DB::update('pages', $row, 'id = ?', [$id]);
        } else {
            $id = DB::insert('pages', $row + ['created_at' => DB::now()]);
        }
        @unlink(BK_STORAGE . '/cache/sitemap.xml');
        Audit::log('page.saved', 'page', $id);
        return redirect(url('admin/pages/' . $id))->with('success', t('common.saved'));
    }

    public function banners(Request $req): Response
    {
        $edit = $req->query('edit') !== '' ? DB::one('SELECT * FROM banners WHERE id = ?', [(int) $req->query('edit')]) : null;
        return $this->page('banners', ['title' => t('admin.banners'), 'rows' => DB::all('SELECT * FROM banners ORDER BY position, id'), 'edit' => $edit]);
    }

    public function saveBanner(Request $req): Response
    {
        $id = $req->int('id');
        $existing = $id ? DB::one('SELECT * FROM banners WHERE id = ?', [$id]) : null;
        $data = $req->only(['title_bn', 'title_en', 'subtitle_bn', 'subtitle_en', 'link_url', 'position', 'starts_at', 'ends_at']);
        $errors = Validator::make($data, ['title_bn' => 'required|max:160', 'title_en' => 'required|max:160', 'subtitle_bn' => 'nullable|max:255', 'subtitle_en' => 'nullable|max:255', 'link_url' => 'nullable|max:255', 'position' => 'nullable|int', 'starts_at' => 'nullable|datetime', 'ends_at' => 'nullable|datetime']);
        if (!isset($errors['link_url']) && $data['link_url'] && !preg_match('#^(/(?!/)|https://)#', $data['link_url'])) {
            $errors['link_url'] = t('admin.linkFormat');
        }
        $img = $req->file('image');
        if ($img && ($err = Upload::check($img))) {
            $errors['image'] = $err;
        }
        if ($errors) {
            return redirect(url('admin/banners', $id ? ['edit' => $id] : []))->withErrors($errors)->withInput();
        }
        $row = ['title_bn' => $data['title_bn'], 'title_en' => $data['title_en'], 'subtitle_bn' => $data['subtitle_bn'] ?: null, 'subtitle_en' => $data['subtitle_en'] ?: null,
            'link_url' => $data['link_url'] ?: null, 'position' => (int) ($data['position'] ?: 0), 'is_active' => $req->bool('is_active') ? 1 : 0,
            'starts_at' => $data['starts_at'] ? str_replace('T', ' ', $data['starts_at']) . ':00' : null, 'ends_at' => $data['ends_at'] ? str_replace('T', ' ', $data['ends_at']) . ':00' : null];
        if ($img) {
            $row['image_path'] = Upload::image($img, 'banners', 1600, 700);
            Upload::delete($existing['image_path'] ?? null);
        }
        if ($existing) {
            DB::update('banners', $row, 'id = ?', [$id]);
        } else {
            $id = DB::insert('banners', $row + ['created_at' => DB::now()]);
        }
        Audit::log('banner.saved', 'banner', $id);
        return redirect(url('admin/banners'))->with('success', t('common.saved'));
    }

    public function deleteBanner(Request $req, string $id): Response
    {
        $b = DB::one('SELECT * FROM banners WHERE id = ?', [(int) $id]);
        if ($b) {
            DB::exec('DELETE FROM banners WHERE id = ?', [$b['id']]);
            Upload::delete($b['image_path']);
            Audit::log('banner.deleted', 'banner', $b['id']);
        }
        return redirect(url('admin/banners'))->with('success', t('common.deleted'));
    }

    public function messages(Request $req): Response
    {
        $status = in_array($req->query('status'), ['new', 'open', 'replied', 'closed'], true) ? $req->query('status') : '';
        $where = $status !== '' ? 'status = ?' : "status IN ('new', 'open')";
        $params = $status !== '' ? [$status] : [];
        $total = (int) DB::val("SELECT COUNT(*) FROM contact_messages WHERE {$where}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT * FROM contact_messages WHERE {$where} ORDER BY id DESC" . $pager->sql(), $params);
        return $this->page('messages', ['title' => t('admin.messages'), 'rows' => $rows, 'pager' => $pager, 'status' => $status]);
    }

    public function message(Request $req, string $id): Response
    {
        $m = DB::one('SELECT * FROM contact_messages WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        if ($m['status'] === 'new') {
            DB::exec("UPDATE contact_messages SET status = 'open' WHERE id = ?", [$m['id']]);
        }
        return $this->page('message', ['title' => $m['subject'], 'm' => $m]);
    }

    public function replyMessage(Request $req, string $id): Response
    {
        $m = DB::one('SELECT * FROM contact_messages WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        if ($req->str('action') === 'close') {
            DB::exec("UPDATE contact_messages SET status = 'closed' WHERE id = ?", [$m['id']]);
            return redirect(url('admin/messages'))->with('success', t('common.saved'));
        }
        $reply = trim($req->str('reply'));
        if (mb_strlen($reply) < 2) {
            return back()->withErrors(['reply' => t('validation.required')]);
        }
        $locale = (string) (DB::val('SELECT locale FROM users WHERE id = ?', [$m['user_id']]) ?: 'bn');
        Mail::queue($m['email'], 'contact-reply', ['name' => $m['name'], 'subject' => $m['subject'], 'reply' => $reply, 'original' => $m['message']], $locale, $m['name']);
        DB::exec("UPDATE contact_messages SET status = 'replied', reply = ?, replied_by = ?, replied_at = NOW() WHERE id = ?", [$reply, Auth::id(), $m['id']]);
        Audit::log('message.replied', 'contact_message', $m['id']);
        return redirect(url('admin/messages'))->with('success', t('admin.replySent'));
    }
}
