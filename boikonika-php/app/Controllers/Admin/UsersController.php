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
use App\Services\Catalog;
use App\Services\Notify;

final class UsersController
{
    use AdminPage;

    public function index(Request $req): Response
    {
        $q = mb_substr($req->query('q'), 0, 80);
        $role = $req->query('role');
        $status = in_array($req->query('status'), ['active', 'suspended', 'deleted'], true) ? $req->query('status') : '';
        $where = ['1=1'];
        $params = [];
        if ($q !== '') {
            $where[] = '(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
            $like = '%' . Catalog::likeEscape($q) . '%';
            array_push($params, $like, $like, '%' . Catalog::likeEscape(to_ascii_digits($q)) . '%');
        }
        if ($status !== '') {
            $where[] = 'u.status = ?';
            $params[] = $status;
        }
        if ($role === 'staff') {
            $where[] = 'EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id)';
        } elseif ($role === 'seller') {
            $where[] = "EXISTS (SELECT 1 FROM sellers s WHERE s.user_id = u.id AND s.status = 'approved')";
        }
        $w = implode(' AND ', $where);
        $total = (int) DB::val("SELECT COUNT(*) FROM users u WHERE {$w}", $params);
        $pager = new Paginator($total, 30);
        $rows = DB::all("SELECT u.*, (SELECT GROUP_CONCAT(role) FROM user_roles r WHERE r.user_id = u.id) AS roles, (SELECT s.store_name FROM sellers s WHERE s.user_id = u.id) AS store,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders FROM users u WHERE {$w} ORDER BY u.id DESC" . $pager->sql(), $params);
        return $this->page('users', ['title' => t('admin.users'), 'rows' => $rows, 'pager' => $pager, 'q' => $q, 'role' => $role, 'status' => $status]);
    }

    public function show(Request $req, string $id): Response
    {
        $u = DB::one('SELECT * FROM users WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        $roles = DB::col('SELECT role FROM user_roles WHERE user_id = ?', [$u['id']]);
        $orders = DB::all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 10', [$u['id']]);
        $seller = DB::one('SELECT * FROM sellers WHERE user_id = ?', [$u['id']]);
        $logins = DB::all('SELECT * FROM login_events WHERE user_id = ? ORDER BY id DESC LIMIT 10', [$u['id']]);
        return $this->page('user', ['title' => $u['name'], 'u' => $u, 'roles' => $roles, 'orders' => $orders, 'seller' => $seller, 'logins' => $logins]);
    }

    public function status(Request $req, string $id): Response
    {
        $u = DB::one('SELECT * FROM users WHERE id = ?', [(int) $id]) ?? throw new HttpException(404);
        if ((int) $u['id'] === Auth::id() || (DB::val("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'super_admin'", [$u['id']]) && !Auth::hasRole('super_admin'))) {
            return back()->with('error', t('admin.cannotChangeUser'));
        }
        $to = $req->str('status') === 'suspended' ? 'suspended' : 'active';
        $reason = mb_substr($req->str('reason'), 0, 255);
        if ($to === 'suspended' && $reason === '') {
            return back()->with('error', t('seller.reasonRequired'));
        }
        DB::exec('UPDATE users SET status = ?, suspended_reason = ?, updated_at = NOW() WHERE id = ? AND status <> ?', [$to, $to === 'suspended' ? $reason : null, $u['id'], 'deleted']);
        if ($to === 'suspended') {
            DB::exec('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [$u['id']]);
        }
        Audit::log('user.' . $to, 'user', $u['id'], ['reason' => $reason]);
        return back()->with('success', t('common.saved'));
    }

    public function roles(Request $req, string $id): Response
    {
        $u = DB::one("SELECT * FROM users WHERE id = ? AND status = 'active'", [(int) $id]) ?? throw new HttpException(404);
        $wanted = array_values(array_intersect((array) ($_POST['roles'] ?? []), Auth::STAFF_ROLES));
        if ((int) $u['id'] === Auth::id() && !in_array('super_admin', $wanted, true)) {
            return back()->with('error', t('admin.cannotDemoteSelf'));
        }
        DB::tx(static function () use ($u, $wanted): void {
            DB::exec('DELETE FROM user_roles WHERE user_id = ?', [$u['id']]);
            foreach ($wanted as $r) {
                DB::insert('user_roles', ['user_id' => $u['id'], 'role' => $r, 'created_at' => DB::now()]);
            }
        });
        Audit::log('user.roles', 'user', $u['id'], ['roles' => $wanted]);
        if ($wanted) {
            Notify::user((int) $u['id'], 'staffAccess', [], 'admin', true, true);
        }
        return back()->with('success', t('common.saved'));
    }

    public function unlock(Request $req, string $id): Response
    {
        DB::exec('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', [(int) $id]);
        Audit::log('user.unlocked', 'user', (int) $id);
        return back()->with('success', t('common.saved'));
    }
}
