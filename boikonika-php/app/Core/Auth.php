<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Sign-in state. Each sign-in is a row in user_sessions (shown under Account → Security, can be
 * signed out remotely). "Keep me signed in" adds a rotating selector/validator cookie.
 */
final class Auth
{
    public const STAFF_ROLES = ['super_admin', 'admin', 'catalog_manager', 'support'];

    /** Staff permissions by role. super_admin has every permission. */
    public const PERMISSIONS = [
        'admin' => ['admin.access', 'users.view', 'users.manage', 'sellers.review', 'catalog.manage', 'orders.manage', 'refunds.manage', 'payouts.manage', 'coupons.manage', 'shipping.manage', 'content.manage', 'messages.manage', 'reviews.moderate', 'audit.view'],
        'catalog_manager' => ['admin.access', 'catalog.manage', 'reviews.moderate'],
        'support' => ['admin.access', 'users.view', 'orders.manage', 'messages.manage'],
    ];

    private const REMEMBER_COOKIE = 'bk_remember';
    private const REMEMBER_DAYS = 30;

    private static ?array $user = null;
    private static ?array $roles = null;
    private static array|false|null $seller = null;

    public static function boot(): void
    {
        $uid = (int) Session::get('uid', 0);
        $sid = (int) Session::get('sid', 0);
        if ($uid && $sid) {
            $row = DB::one('SELECT u.*, s.last_seen_at AS _seen FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > NOW() AND u.status = ?', [$sid, $uid, 'active']);
            if ($row) {
                self::$user = $row;
                if (strtotime((string) $row['_seen']) < time() - 300) {
                    DB::exec('UPDATE user_sessions SET last_seen_at = NOW(), ip = ? WHERE id = ?', [App::$request->ip(), $sid]);
                }
                return;
            }
            Session::forget('uid');
            Session::forget('sid');
        }
        self::fromRememberCookie();
    }

    private static function fromRememberCookie(): void
    {
        $cookie = (string) ($_COOKIE[self::REMEMBER_COOKIE] ?? '');
        if (!preg_match('/^([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/', $cookie, $m)) {
            return;
        }
        $row = DB::one('SELECT s.id AS sid, s.token_hash, u.* FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.selector = ? AND s.revoked_at IS NULL AND s.expires_at > NOW()', [$m[1]]);
        if (!$row) {
            self::clearRememberCookie();
            return;
        }
        if (!hash_equals((string) $row['token_hash'], Crypto::hash($m[2]))) {
            // A stolen, already-rotated cookie: end that sign-in everywhere.
            DB::exec('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?', [$row['sid']]);
            self::clearRememberCookie();
            return;
        }
        if ($row['status'] !== 'active') {
            self::clearRememberCookie();
            return;
        }
        $validator = Crypto::token(32);
        DB::exec('UPDATE user_sessions SET token_hash = ?, last_seen_at = NOW(), ip = ? WHERE id = ?', [Crypto::hash($validator), App::$request->ip(), $row['sid']]);
        self::setRememberCookie($m[1] . '.' . $validator);
        Session::regenerate();
        Session::put('uid', (int) $row['id']);
        Session::put('sid', (int) $row['sid']);
        unset($row['sid'], $row['token_hash']);
        self::$user = $row;
    }

    public static function login(array $user, bool $remember = false): void
    {
        Session::regenerate();
        $req = App::$request;
        $selector = $remember ? Crypto::token(18) : null;
        $validator = $remember ? Crypto::token(32) : null;
        $sid = DB::insert('user_sessions', [
            'user_id' => $user['id'],
            'selector' => $selector,
            'token_hash' => $validator ? Crypto::hash($validator) : null,
            'ip' => $req->ip(),
            'user_agent' => $req->userAgent(),
            'created_at' => DB::now(),
            'last_seen_at' => DB::now(),
            'expires_at' => date('Y-m-d H:i:s', time() + ($remember ? self::REMEMBER_DAYS * 86400 : 86400)),
        ]);
        Session::put('uid', (int) $user['id']);
        Session::put('sid', $sid);
        if ($remember) {
            self::setRememberCookie($selector . '.' . $validator);
        }
        DB::exec('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = ? WHERE id = ?', [$req->ip(), $user['id']]);
        DB::insert('login_events', ['user_id' => $user['id'], 'ip' => $req->ip(), 'user_agent' => $req->userAgent(), 'success' => 1, 'created_at' => DB::now()]);
        self::$user = DB::one('SELECT * FROM users WHERE id = ?', [$user['id']]);
        self::$roles = null;
        self::$seller = null;
    }

    public static function logout(): void
    {
        $sid = (int) Session::get('sid', 0);
        if ($sid) {
            DB::exec('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?', [$sid]);
        }
        self::clearRememberCookie();
        Session::destroy();
        self::$user = null;
        self::$roles = null;
        self::$seller = null;
    }

    /** Signs out every other device of the current user. */
    public static function logoutOthers(): int
    {
        return DB::exec('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND id <> ? AND revoked_at IS NULL', [self::id(), (int) Session::get('sid', 0)]);
    }

    public static function currentSessionId(): int
    {
        return (int) Session::get('sid', 0);
    }

    private static function setRememberCookie(string $value): void
    {
        setcookie(self::REMEMBER_COOKIE, $value, [
            'expires' => time() + self::REMEMBER_DAYS * 86400,
            'path' => (App::$request->basePath ?: '') . '/',
            'secure' => str_starts_with((string) App::config('url', ''), 'https://'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private static function clearRememberCookie(): void
    {
        if (isset($_COOKIE[self::REMEMBER_COOKIE])) {
            setcookie(self::REMEMBER_COOKIE, '', ['expires' => time() - 3600, 'path' => (App::$request->basePath ?: '') . '/', 'httponly' => true, 'samesite' => 'Lax']);
        }
    }

    public static function user(): ?array
    {
        return self::$user;
    }

    public static function id(): ?int
    {
        return self::$user ? (int) self::$user['id'] : null;
    }

    public static function check(): bool
    {
        return self::$user !== null;
    }

    public static function refresh(): void
    {
        if (self::$user) {
            self::$user = DB::one('SELECT * FROM users WHERE id = ?', [self::$user['id']]);
        }
    }

    /** @return list<string> */
    public static function roles(): array
    {
        if (!self::$user) {
            return [];
        }
        return self::$roles ??= DB::col('SELECT role FROM user_roles WHERE user_id = ?', [self::$user['id']]);
    }

    public static function hasRole(string $role): bool
    {
        return in_array($role, self::roles(), true);
    }

    public static function can(string $permission): bool
    {
        $roles = self::roles();
        if (in_array('super_admin', $roles, true)) {
            return true;
        }
        foreach ($roles as $r) {
            if (in_array($permission, self::PERMISSIONS[$r] ?? [], true)) {
                return true;
            }
        }
        return false;
    }

    public static function isStaff(): bool
    {
        return self::can('admin.access');
    }

    /** The current user's store (any status), or null. */
    public static function seller(): ?array
    {
        if (!self::$user) {
            return null;
        }
        if (self::$seller === null) {
            self::$seller = DB::one('SELECT * FROM sellers WHERE user_id = ?', [self::$user['id']]) ?? false;
        }
        return self::$seller ?: null;
    }

    public static function isSeller(): bool
    {
        return (self::seller()['status'] ?? '') === 'approved';
    }

    /** Records a failed password attempt; locks the account for 15 minutes after 5. */
    public static function recordFailure(?array $user): void
    {
        $req = App::$request;
        if ($user) {
            $expired = $user['locked_until'] !== null && strtotime((string) $user['locked_until']) <= time();
            $count = $expired ? 1 : (int) $user['failed_logins'] + 1;
            $lockedUntil = $count >= 5 ? date('Y-m-d H:i:s', time() + 900) : null;
            DB::exec('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', [$count, $lockedUntil, $user['id']]);
            DB::insert('login_events', ['user_id' => $user['id'], 'ip' => $req->ip(), 'user_agent' => $req->userAgent(), 'success' => 0, 'created_at' => DB::now()]);
        }
    }

    public static function isLocked(array $user): bool
    {
        return $user['locked_until'] !== null && strtotime((string) $user['locked_until']) > time();
    }
}
