<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Audit;
use App\Core\Crypto;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Services\Catalog;
use App\Services\Notify;
use App\Services\Sellers;

/** Seller verification (KYC), suspension and commission. Documents are private; every view is logged. */
final class SellersController
{
    use AdminPage;

    public function index(Request $req): Response
    {
        $status = in_array($req->query('status'), ['pending', 'approved', 'rejected', 'suspended'], true) ? $req->query('status') : '';
        $q = mb_substr($req->query('q'), 0, 80);
        $where = '1=1';
        $params = [];
        if ($status !== '') {
            $where .= ' AND s.status = ?';
            $params[] = $status;
        }
        if ($q !== '') {
            $where .= ' AND (s.store_name LIKE ? OR u.email LIKE ? OR s.phone LIKE ?)';
            $like = '%' . Catalog::likeEscape($q) . '%';
            array_push($params, $like, $like, $like);
        }
        $total = (int) DB::val("SELECT COUNT(*) FROM sellers s JOIN users u ON u.id = s.user_id WHERE {$where}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT s.*, u.name AS owner, u.email AS owner_email, (SELECT COUNT(*) FROM listings l WHERE l.seller_id = s.id AND l.status = 'active') AS listings
            FROM sellers s JOIN users u ON u.id = s.user_id WHERE {$where} ORDER BY s.status = 'pending' DESC, s.updated_at DESC" . $pager->sql(), $params);
        $counts = [];
        foreach (DB::all('SELECT status, COUNT(*) AS n FROM sellers GROUP BY status') as $c) {
            $counts[$c['status']] = (int) $c['n'];
        }
        return $this->page('sellers', ['title' => t('admin.sellers'), 'rows' => $rows, 'pager' => $pager, 'status' => $status, 'q' => $q, 'counts' => $counts]);
    }

    public function show(Request $req, string $id): Response
    {
        $s = DB::one('SELECT s.*, u.name AS owner, u.email AS owner_email, u.phone AS owner_phone, u.created_at AS joined FROM sellers s JOIN users u ON u.id = s.user_id WHERE s.id = ?', [(int) $id]) ?? throw new HttpException(404);
        $docs = DB::all('SELECT * FROM seller_documents WHERE seller_id = ? ORDER BY id DESC', [$s['id']]);
        $reveal = $req->query('reveal') !== '' ? (int) $req->query('reveal') : 0;
        foreach ($docs as &$d) {
            $d['number'] = null;
            if ($reveal === (int) $d['id']) {
                $d['number'] = Crypto::decrypt($d['number_enc']);
                Audit::log('kyc.number_viewed', 'seller_document', $d['id']);
            }
        }
        $stats = DB::one("SELECT COUNT(*) AS parcels, SUM(status = 'delivered') AS delivered, SUM(status = 'cancelled') AS cancelled, SUM(status = 'returned') AS returned FROM seller_orders WHERE seller_id = ?", [$s['id']]);
        $history = DB::all("SELECT a.*, u.name AS actor FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id WHERE (a.entity_type = 'seller' AND a.entity_id = ?) OR (a.entity_type = 'user' AND a.entity_id = ? AND a.action LIKE 'seller.%') ORDER BY a.id DESC LIMIT 20", [(string) $s['id'], (string) $s['user_id']]);
        return $this->page('seller', ['title' => $s['store_name'], 's' => $s, 'docs' => $docs, 'stats' => $stats, 'balance' => Sellers::balance((int) $s['id']), 'history' => $history]);
    }

    /** Serves a document image to staff only, never cached. */
    public function document(Request $req, string $id, string $side): Response
    {
        $d = DB::one('SELECT * FROM seller_documents WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        $rel = $side === 'back' ? $d['back_path'] : $d['front_path'];
        $file = $rel ? BK_STORAGE . '/private/' . $rel : null;
        if (!$file || str_contains((string) $rel, '..') || !is_file($file)) {
            throw new HttpException(404);
        }
        Audit::log('kyc.document_viewed', 'seller_document', $d['id'], ['side' => $side === 'back' ? 'back' : 'front']);
        $mime = str_ends_with($file, '.webp') ? 'image/webp' : 'image/jpeg';
        $r = Response::file($file, $mime);
        $r->headers['Content-Security-Policy'] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
        $r->headers['X-Robots-Tag'] = 'noindex, nofollow';
        return $r;
    }

    public function review(Request $req, string $id): Response
    {
        $s = DB::one('SELECT * FROM sellers WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        $action = $req->str('action');
        $note = mb_substr($req->str('note'), 0, 500);
        $map = ['approve' => 'approved', 'reject' => 'rejected', 'suspend' => 'suspended', 'reinstate' => 'approved'];
        $allowedFrom = ['approve' => ['pending', 'rejected'], 'reject' => ['pending'], 'suspend' => ['approved'], 'reinstate' => ['suspended']];
        if (!isset($map[$action]) || !in_array($s['status'], $allowedFrom[$action], true)) {
            return back()->with('error', t('orders.cannotChange'));
        }
        if (in_array($action, ['reject', 'suspend'], true) && $note === '') {
            return back()->with('error', t('seller.reasonRequired'));
        }
        $to = $map[$action];
        DB::exec('UPDATE sellers SET status = ?, review_note = ?, approved_at = IF(? = \'approved\' AND approved_at IS NULL, NOW(), approved_at), updated_at = NOW() WHERE id = ?', [$to, $note !== '' ? $note : null, $to, $s['id']]);
        Catalog::refreshSeller((int) $s['id']);
        Audit::log('seller.' . $action, 'seller', $s['id'], ['note' => $note]);
        $key = ['approve' => 'sellerApproved', 'reject' => 'sellerRejected', 'suspend' => 'sellerSuspended', 'reinstate' => 'sellerReinstated'][$action];
        Notify::user((int) $s['user_id'], $key, ['store' => $s['store_name'], 'note' => $note], $to === 'approved' ? 'seller' : 'seller/apply', true, true);
        return back()->with('success', t('admin.sellerUpdated'));
    }

    public function commission(Request $req, string $id): Response
    {
        $s = DB::one('SELECT * FROM sellers WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        $value = $req->str('commission_percent');
        if ($value !== '' && (!preg_match('/^\d{1,2}(\.\d{1,2})?$/', to_ascii_digits($value)))) {
            return back()->with('error', t('admin.percentInvalid'));
        }
        DB::exec('UPDATE sellers SET commission_percent = ?, updated_at = NOW() WHERE id = ?', [$value === '' ? null : to_ascii_digits($value), $s['id']]);
        Audit::log('seller.commission', 'seller', $s['id'], ['percent' => $value === '' ? 'default' : $value]);
        return back()->with('success', t('common.saved'));
    }
}
