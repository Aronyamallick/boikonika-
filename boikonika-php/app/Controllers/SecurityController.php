<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Audit;
use App\Core\Auth;
use App\Core\Crypto;
use App\Core\DB;
use App\Core\RateLimit;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\Validator;
use App\Services\Notify;
use App\Services\Totp;

/** Password, signed-in devices, two-step verification, data download and account deletion. */
final class SecurityController
{
    public function show(Request $req): Response
    {
        $uid = (int) Auth::id();
        $sessions = DB::all('SELECT * FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW() ORDER BY last_seen_at DESC LIMIT 20', [$uid]);
        $history = DB::all('SELECT * FROM login_events WHERE user_id = ? ORDER BY id DESC LIMIT 10', [$uid]);
        $pending = Session::get('totp_setup');
        $recovery = Session::get('recovery_codes');
        Session::forget('recovery_codes');
        $codesLeft = (int) DB::val('SELECT COUNT(*) FROM recovery_codes WHERE user_id = ? AND used_at IS NULL', [$uid]);
        return view('account/security', [
            'title' => t('security.title'),
            'area' => 'account',
            'user' => Auth::user(),
            'sessions' => $sessions,
            'history' => $history,
            'current' => Auth::currentSessionId(),
            'setupSecret' => $pending['secret'] ?? null,
            'setupUri' => isset($pending['secret']) ? Totp::uri($pending['secret'], (string) (Auth::user()['email'] ?? Auth::user()['phone']), (string) setting('site.name_en')) : null,
            'recovery' => $recovery,
            'codesLeft' => $codesLeft,
        ], 'layouts/dash');
    }

    private function checkPassword(Request $req): bool
    {
        RateLimit::enforce('reauth:' . Auth::id(), 10, 900);
        return password_verify((string) ($_POST['current_password'] ?? ''), (string) Auth::user()['password_hash']);
    }

    public function password(Request $req): Response
    {
        $data = ['password' => (string) ($_POST['password'] ?? ''), 'password_confirmation' => (string) ($_POST['password_confirmation'] ?? '')];
        $errors = Validator::make($data, ['password' => 'required|password|confirmed']);
        if (!$this->checkPassword($req)) {
            $errors['current_password'] = t('security.wrongPassword');
        }
        if ($errors) {
            return back()->withErrors($errors);
        }
        DB::exec('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [Crypto::passwordHash($data['password']), Auth::id()]);
        $n = Auth::logoutOthers();
        Notify::user((int) Auth::id(), 'passwordChanged', [], 'account/security', true, true);
        Audit::log('auth.password_changed', 'user', Auth::id());
        return redirect(url('account/security'))->with('success', t('security.passwordChanged', ['count' => num($n)]));
    }

    public function revoke(Request $req, string $id): Response
    {
        DB::exec('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ? AND user_id = ? AND id <> ?', [(int) $id, Auth::id(), Auth::currentSessionId()]);
        return redirect(url('account/security'))->with('success', t('security.deviceSignedOut'));
    }

    public function revokeOthers(Request $req): Response
    {
        $n = Auth::logoutOthers();
        return redirect(url('account/security'))->with('success', tn('security.othersSignedOut', $n));
    }

    public function twoStepStart(Request $req): Response
    {
        if (Auth::user()['totp_enabled_at']) {
            return redirect(url('account/security'));
        }
        Session::put('totp_setup', ['secret' => Totp::secret(), 'at' => time()]);
        return redirect(url('account/security') . '#two-step');
    }

    public function twoStepConfirm(Request $req): Response
    {
        $pending = Session::get('totp_setup');
        if (!$pending || $pending['at'] < time() - 1800) {
            Session::forget('totp_setup');
            return redirect(url('account/security'))->with('error', t('auth.codeExpired'));
        }
        RateLimit::enforce('totp-setup:' . Auth::id(), 10, 900);
        if (!Totp::verify($pending['secret'], $req->str('code'))) {
            return redirect(url('account/security') . '#two-step')->withErrors(['code' => t('auth.wrongCode')]);
        }
        $uid = (int) Auth::id();
        DB::exec('UPDATE users SET totp_secret_enc = ?, totp_enabled_at = NOW() WHERE id = ?', [Crypto::encrypt($pending['secret']), $uid]);
        DB::exec('DELETE FROM recovery_codes WHERE user_id = ?', [$uid]);
        $codes = [];
        for ($i = 0; $i < 10; $i++) {
            $c = strtoupper(bin2hex(random_bytes(5)));
            $codes[] = substr($c, 0, 5) . '-' . substr($c, 5);
            DB::insert('recovery_codes', ['user_id' => $uid, 'code_hash' => Crypto::hash($c), 'created_at' => DB::now()]);
        }
        Session::forget('totp_setup');
        Session::put('recovery_codes', $codes);
        Notify::user($uid, 'twoStepOn', [], 'account/security', true, true);
        Audit::log('auth.2fa_enabled', 'user', $uid);
        return redirect(url('account/security') . '#two-step')->with('success', t('security.twoStepOn'));
    }

    public function twoStepDisable(Request $req): Response
    {
        if (!$this->checkPassword($req)) {
            return redirect(url('account/security') . '#two-step')->withErrors(['current_password_2fa' => t('security.wrongPassword')]);
        }
        $uid = (int) Auth::id();
        DB::exec('UPDATE users SET totp_secret_enc = NULL, totp_enabled_at = NULL WHERE id = ?', [$uid]);
        DB::exec('DELETE FROM recovery_codes WHERE user_id = ?', [$uid]);
        Notify::user($uid, 'twoStepOff', [], 'account/security', true, true);
        Audit::log('auth.2fa_disabled', 'user', $uid);
        return redirect(url('account/security'))->with('success', t('security.twoStepOff'));
    }

    public function privacy(Request $req): Response
    {
        $uid = (int) Auth::id();
        return view('account/privacy', ['title' => t('privacy.title'), 'area' => 'account', 'blockers' => self::deletionBlockers($uid)], 'layouts/dash');
    }

    /** A JSON copy of everything Boikonika keeps about the account. */
    public function export(Request $req): Response
    {
        $uid = (int) Auth::id();
        RateLimit::enforce('export:' . $uid, 5, 3600);
        $u = DB::one('SELECT id, name, email, phone, locale, email_verified_at, notify_email, created_at, last_login_at FROM users WHERE id = ?', [$uid]);
        $data = [
            'exported_at' => date('c'),
            'account' => $u,
            'two_step_verification' => (bool) Auth::user()['totp_enabled_at'],
            'addresses' => DB::all('SELECT label, name, phone, division, district, area, address_line, postcode, created_at FROM addresses WHERE user_id = ?', [$uid]),
            'orders' => array_map(static function (array $o): array {
                $o['items'] = DB::all('SELECT title, item_condition, unit_price, quantity, line_total FROM order_items WHERE order_id = ?', [$o['id']]);
                unset($o['id'], $o['idempotency_key'], $o['ip']);
                return $o;
            }, DB::all('SELECT * FROM orders WHERE user_id = ? ORDER BY id', [$uid])),
            'reviews' => DB::all('SELECT r.rating, r.body, r.created_at, p.title FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.user_id = ?', [$uid]),
            'wishlist' => DB::col('SELECT p.title FROM wishlist_items w JOIN products p ON p.id = w.product_id WHERE w.user_id = ?', [$uid]),
            'notifications' => DB::all('SELECT title, body, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 500', [$uid]),
            'sign_ins' => DB::all('SELECT ip, user_agent, success, created_at FROM login_events WHERE user_id = ? ORDER BY id DESC LIMIT 100', [$uid]),
            'messages' => DB::all('SELECT subject, message, created_at, reply FROM contact_messages WHERE user_id = ?', [$uid]),
        ];
        $seller = Auth::seller();
        if ($seller) {
            $data['store'] = array_diff_key($seller, array_flip(['id', 'user_id', 'commission_percent']));
        }
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return new Response((string) $json, 200, [
            'Content-Type' => 'application/json; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="boikonika-my-data-' . date('Y-m-d') . '.json"',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /** @return list<string> translation keys of reasons the account can't be deleted yet */
    public static function deletionBlockers(int $uid): array
    {
        $b = [];
        if (DB::val("SELECT 1 FROM orders WHERE user_id = ? AND status IN ('awaiting_payment', 'placed') LIMIT 1", [$uid])) {
            $b[] = 'privacy.blockOrders';
        }
        if (DB::val("SELECT 1 FROM refunds r JOIN orders o ON o.id = r.order_id WHERE o.user_id = ? AND r.status IN ('requested', 'processing') LIMIT 1", [$uid])) {
            $b[] = 'privacy.blockRefunds';
        }
        $seller = DB::one('SELECT id FROM sellers WHERE user_id = ?', [$uid]);
        if ($seller) {
            if (DB::val("SELECT 1 FROM seller_orders WHERE seller_id = ? AND status IN ('pending', 'confirmed', 'processing', 'shipped') LIMIT 1", [$seller['id']])) {
                $b[] = 'privacy.blockSellerOrders';
            }
            if (\App\Services\Sellers::balance((int) $seller['id'])['withdrawable'] > 0 || DB::val("SELECT 1 FROM payouts WHERE seller_id = ? AND status IN ('requested', 'processing')", [$seller['id']])) {
                $b[] = 'privacy.blockBalance';
            }
        }
        if (DB::val("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'super_admin'", [$uid]) && (int) DB::val("SELECT COUNT(*) FROM user_roles WHERE role = 'super_admin'") <= 1) {
            $b[] = 'privacy.blockLastAdmin';
        }
        return $b;
    }

    public function deleteAccount(Request $req): Response
    {
        $uid = (int) Auth::id();
        if (!$this->checkPassword($req)) {
            return back()->withErrors(['current_password' => t('security.wrongPassword')]);
        }
        if (self::deletionBlockers($uid) || $req->str('confirm') !== 'DELETE') {
            return back()->withErrors(['confirm' => t('privacy.typeDelete')]);
        }
        $user = Auth::user();
        DB::tx(static function () use ($uid, $user): void {
            DB::exec("UPDATE users SET name = 'Deleted user', email = NULL, phone = NULL, avatar_path = NULL, password_hash = ?, status = 'deleted', totp_secret_enc = NULL, totp_enabled_at = NULL, notify_email = 0, updated_at = NOW() WHERE id = ?", [Crypto::passwordHash(Crypto::token(24)), $uid]);
            foreach (['addresses', 'wishlist_items', 'notifications', 'recovery_codes', 'login_events', 'user_roles'] as $table) {
                DB::exec("DELETE FROM `{$table}` WHERE user_id = ?", [$uid]);
            }
            DB::exec('DELETE FROM carts WHERE user_id = ?', [$uid]);
            DB::exec('UPDATE reviews SET status = ? WHERE user_id = ?', ['hidden', $uid]);
            DB::exec('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ?', [$uid]);
            $seller = DB::one('SELECT * FROM sellers WHERE user_id = ?', [$uid]);
            if ($seller) {
                DB::exec("UPDATE sellers SET status = 'suspended', review_note = 'account deleted', updated_at = NOW() WHERE id = ?", [$seller['id']]);
                DB::exec("UPDATE listings SET status = 'paused' WHERE seller_id = ?", [$seller['id']]);
                foreach (DB::all('SELECT * FROM seller_documents WHERE seller_id = ?', [$seller['id']]) as $d) {
                    \App\Core\Upload::deletePrivate($d['front_path']);
                    \App\Core\Upload::deletePrivate($d['back_path']);
                }
                DB::exec('DELETE FROM seller_documents WHERE seller_id = ?', [$seller['id']]);
                DB::exec('DELETE FROM payout_accounts WHERE seller_id = ?', [$seller['id']]);
            }
            \App\Core\Upload::delete($user['avatar_path']);
        });
        if ($seller = DB::one('SELECT id FROM sellers WHERE user_id = ?', [$uid])) {
            \App\Services\Catalog::refreshSeller((int) $seller['id']);
        }
        Audit::log('account.deleted', 'user', $uid);
        Auth::logout();
        return redirect(url())->with('success', t('privacy.deleted'));
    }
}
