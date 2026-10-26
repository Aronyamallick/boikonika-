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
use App\Services\Cart;
use App\Services\Mail;
use App\Services\Notify;
use App\Services\Totp;

final class AuthController
{
    private const CODE_TTL = 900;

    public function loginForm(Request $req): Response
    {
        return view('auth/login', ['title' => t('auth.loginTitle'), 'robots' => 'noindex']);
    }

    public function login(Request $req): Response
    {
        $ip = $req->ip();
        RateLimit::enforce('login-ip:' . $ip, 20, 600);
        $identifier = mb_substr($req->str('identifier'), 0, 191);
        $password = (string) ($_POST['password'] ?? '');
        if ($identifier === '' || $password === '') {
            return back()->withErrors(array_filter(['identifier' => $identifier === '' ? t('validation.required') : null, 'password' => $password === '' ? t('validation.required') : null]))->withInput();
        }
        if (!RateLimit::hit('login-id:' . mb_strtolower($identifier), 10, 900)) {
            return back()->with('error', t('auth.tooManyAttempts'))->withInput();
        }
        $user = self::findUser($identifier);
        if (!$user || $user['status'] === 'deleted') {
            password_verify($password, '$2y$12$CSUdXuNrmm0hutJVPiOFh.MHOT43Srft980Htp1sV7/ow9/rpgXWK'); // same work as a real check
            return back()->with('error', t('auth.invalidLogin'))->withInput();
        }
        if (Auth::isLocked($user)) {
            $minutes = max(1, (int) ceil((strtotime($user['locked_until']) - time()) / 60));
            return back()->with('error', tn('auth.locked', $minutes))->withInput();
        }
        if (!password_verify($password, $user['password_hash'])) {
            Auth::recordFailure($user);
            return back()->with('error', t('auth.invalidLogin'))->withInput();
        }
        if ($user['status'] === 'suspended') {
            return back()->with('error', t('auth.suspended'))->withInput();
        }
        $algo = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
        if (password_needs_rehash($user['password_hash'], $algo)) {
            DB::exec('UPDATE users SET password_hash = ? WHERE id = ?', [Crypto::passwordHash($password), $user['id']]);
        }
        $remember = $req->bool('remember');
        if ($user['totp_enabled_at']) {
            Session::regenerate();
            Session::put('2fa', ['uid' => (int) $user['id'], 'remember' => $remember, 'at' => time(), 'tries' => 0]);
            return redirect(url('login/two-step'));
        }
        return $this->complete($user, $remember);
    }

    private function complete(array $user, bool $remember): Response
    {
        Auth::login($user, $remember);
        Cart::mergeGuestInto((int) $user['id']);
        DB::exec('UPDATE users SET locale = ? WHERE id = ?', [locale(), $user['id']]);
        $intended = (string) Session::get('intended', '');
        Session::forget('intended');
        flash('success', t('auth.welcomeBack', ['name' => $user['name']]));
        if ($intended !== '' && str_starts_with($intended, '/') && !str_starts_with($intended, '//')) {
            return redirect(\App\Core\App::$request->basePath . $intended);
        }
        return redirect(url('account'));
    }

    public static function findUser(string $identifier): ?array
    {
        $phone = Validator::phone($identifier);
        if ($phone !== null) {
            return DB::one('SELECT * FROM users WHERE phone = ?', [$phone]);
        }
        return DB::one('SELECT * FROM users WHERE email = ?', [mb_strtolower(trim($identifier))]);
    }

    public function twoStepForm(Request $req): Response
    {
        $pending = Session::get('2fa');
        if (!$pending || $pending['at'] < time() - 600) {
            return redirect(url('login'));
        }
        return view('auth/two-step', ['title' => t('auth.twoStepTitle'), 'robots' => 'noindex']);
    }

    public function twoStep(Request $req): Response
    {
        $pending = Session::get('2fa');
        if (!$pending || $pending['at'] < time() - 600) {
            Session::forget('2fa');
            return redirect(url('login'))->with('error', t('auth.codeExpired'));
        }
        $pending['tries']++;
        Session::put('2fa', $pending);
        if ($pending['tries'] > 5) {
            Session::forget('2fa');
            return redirect(url('login'))->with('error', t('auth.tooManyAttempts'));
        }
        $user = DB::one("SELECT * FROM users WHERE id = ? AND status = 'active'", [$pending['uid']]);
        if (!$user || !$user['totp_enabled_at']) {
            Session::forget('2fa');
            return redirect(url('login'));
        }
        $code = trim($req->str('code'));
        $ok = false;
        if (preg_match('/^\d{6}$/', to_ascii_digits(str_replace(' ', '', $code)))) {
            $ok = Totp::verify((string) Crypto::decrypt($user['totp_secret_enc']), $code);
        } elseif ($code !== '') {
            $hash = Crypto::hash(strtoupper(str_replace(['-', ' '], '', $code)));
            $rc = DB::one('SELECT id FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL', [$user['id'], $hash]);
            if ($rc) {
                DB::exec('UPDATE recovery_codes SET used_at = NOW() WHERE id = ?', [$rc['id']]);
                $ok = true;
                Notify::user((int) $user['id'], 'recoveryCodeUsed', [], 'account/security', true, true);
            }
        }
        if (!$ok) {
            Auth::recordFailure($user);
            return back()->withErrors(['code' => t('auth.wrongCode')]);
        }
        Session::forget('2fa');
        return $this->complete($user, (bool) $pending['remember']);
    }

    public function registerForm(Request $req): Response
    {
        return view('auth/register', ['title' => t('auth.registerTitle'), 'robots' => 'noindex']);
    }

    public function register(Request $req): Response
    {
        RateLimit::enforce('register-ip:' . $req->ip(), 8, 3600);
        $data = $req->only(['name', 'email', 'phone']) + ['password' => (string) ($_POST['password'] ?? ''), 'password_confirmation' => (string) ($_POST['password_confirmation'] ?? '')];
        $data['email'] = mb_strtolower((string) $data['email']);
        $errors = Validator::make($data, [
            'name' => 'required|min:2|max:120',
            'email' => 'required|email',
            'phone' => 'nullable|phone',
            'password' => 'required|password|confirmed',
        ]);
        if (!$req->bool('agree')) {
            $errors['agree'] = t('validation.accept');
        }
        $phone = $data['phone'] ? Validator::phone($data['phone']) : null;
        if (!isset($errors['email']) && DB::val('SELECT 1 FROM users WHERE email = ?', [$data['email']])) {
            $errors['email'] = t('auth.emailTaken');
        }
        if ($phone && !isset($errors['phone']) && DB::val('SELECT 1 FROM users WHERE phone = ?', [$phone])) {
            $errors['phone'] = t('auth.phoneTaken');
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        if (!RateLimit::hit('code:' . $data['email'], 5, 3600)) {
            return back()->with('error', t('auth.tooManyCodes'))->withInput();
        }
        $payload = ['name' => $data['name'], 'email' => $data['email'], 'phone' => $phone, 'password_hash' => Crypto::passwordHash($data['password']), 'locale' => locale()];
        $id = $this->issueCode('register', $data['email'], $payload, $req->ip(), $data['name']);
        if ($id === null) {
            return back()->with('error', t('auth.emailFailed'))->withInput();
        }
        Session::put('verify_id', $id);
        return redirect(url('register/verify'));
    }

    /** Creates and emails a 6-digit code; returns the code row id, or null if the email couldn't be sent. */
    private function issueCode(string $purpose, string $email, ?array $payload, string $ip, string $name): ?int
    {
        $code = Crypto::code(6);
        DB::exec('UPDATE verification_codes SET consumed_at = NOW() WHERE purpose = ? AND target = ? AND consumed_at IS NULL', [$purpose, $email]);
        $id = DB::insert('verification_codes', [
            'purpose' => $purpose,
            'target' => $email,
            'code_hash' => Crypto::hash($code),
            'payload' => $payload ? Crypto::encrypt(json_encode($payload)) : null,
            'ip' => $ip,
            'expires_at' => date('Y-m-d H:i:s', time() + self::CODE_TTL),
            'created_at' => DB::now(),
        ]);
        $sent = Mail::sendNow($email, 'code', ['code' => $code, 'purpose' => $purpose, 'name' => $name, 'minutes' => intdiv(self::CODE_TTL, 60)], locale(), $name);
        return $sent ? $id : null;
    }

    public function verifyForm(Request $req): Response
    {
        $row = DB::one('SELECT * FROM verification_codes WHERE id = ? AND consumed_at IS NULL', [(int) Session::get('verify_id', 0)]);
        if (!$row) {
            return redirect(url('register'));
        }
        return view('auth/verify', ['title' => t('auth.verifyTitle'), 'target' => mask_email($row['target']), 'robots' => 'noindex']);
    }

    public function verify(Request $req): Response
    {
        $row = DB::one("SELECT * FROM verification_codes WHERE id = ? AND purpose = 'register' AND consumed_at IS NULL", [(int) Session::get('verify_id', 0)]);
        if (!$row || strtotime($row['expires_at']) < time()) {
            return redirect(url('register'))->with('error', t('auth.codeExpired'));
        }
        if ((int) $row['attempts'] >= 5) {
            DB::exec('UPDATE verification_codes SET consumed_at = NOW() WHERE id = ?', [$row['id']]);
            return redirect(url('register'))->with('error', t('auth.tooManyAttempts'));
        }
        $code = preg_replace('/\D/', '', to_ascii_digits($req->str('code')));
        if (!hash_equals($row['code_hash'], Crypto::hash((string) $code))) {
            DB::exec('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?', [$row['id']]);
            return back()->withErrors(['code' => t('auth.wrongCode')]);
        }
        $p = json_decode((string) Crypto::decrypt($row['payload']), true);
        if (!is_array($p) || DB::val('SELECT 1 FROM users WHERE email = ?', [$p['email']]) || ($p['phone'] && DB::val('SELECT 1 FROM users WHERE phone = ?', [$p['phone']]))) {
            DB::exec('UPDATE verification_codes SET consumed_at = NOW() WHERE id = ?', [$row['id']]);
            return redirect(url('login'))->with('info', t('auth.alreadyRegistered'));
        }
        $uid = DB::insert('users', [
            'name' => $p['name'],
            'email' => $p['email'],
            'phone' => $p['phone'],
            'password_hash' => $p['password_hash'],
            'locale' => $p['locale'] === 'en' ? 'en' : 'bn',
            'email_verified_at' => DB::now(),
            'created_at' => DB::now(),
            'updated_at' => DB::now(),
        ]);
        DB::exec('UPDATE verification_codes SET consumed_at = NOW() WHERE id = ?', [$row['id']]);
        Session::forget('verify_id');
        $user = DB::one('SELECT * FROM users WHERE id = ?', [$uid]);
        Auth::login($user, false);
        Cart::mergeGuestInto($uid);
        Notify::user($uid, 'welcome', ['name' => $p['name']], 'books', false);
        flash('success', t('auth.registered'));
        $intended = (string) Session::get('intended', '');
        Session::forget('intended');
        if ($intended !== '' && str_starts_with($intended, '/') && !str_starts_with($intended, '//')) {
            return redirect(\App\Core\App::$request->basePath . $intended);
        }
        return redirect(url('account'));
    }

    public function resend(Request $req): Response
    {
        $row = DB::one("SELECT * FROM verification_codes WHERE id = ? AND purpose = 'register' AND consumed_at IS NULL", [(int) Session::get('verify_id', 0)]);
        if (!$row) {
            return redirect(url('register'));
        }
        if (strtotime($row['created_at']) > time() - 60 || !RateLimit::hit('code:' . $row['target'], 5, 3600)) {
            return back()->with('error', t('auth.waitBeforeResend'));
        }
        $payload = json_decode((string) Crypto::decrypt($row['payload']), true) ?: null;
        $id = $this->issueCode('register', $row['target'], $payload, $req->ip(), (string) ($payload['name'] ?? ''));
        if ($id === null) {
            return back()->with('error', t('auth.emailFailed'));
        }
        Session::put('verify_id', $id);
        return back()->with('success', t('auth.codeResent'));
    }

    public function forgotForm(Request $req): Response
    {
        return view('auth/forgot', ['title' => t('auth.forgotTitle'), 'robots' => 'noindex']);
    }

    public function forgot(Request $req): Response
    {
        RateLimit::enforce('forgot-ip:' . $req->ip(), 10, 3600);
        $identifier = mb_substr($req->str('identifier'), 0, 191);
        if ($identifier === '') {
            return back()->withErrors(['identifier' => t('validation.required')]);
        }
        $user = self::findUser($identifier);
        $id = null;
        if ($user && $user['status'] === 'active' && $user['email'] && RateLimit::hit('code:' . $user['email'], 5, 3600)) {
            $id = $this->issueCode('reset', $user['email'], ['uid' => (int) $user['id']], $req->ip(), $user['name']);
        }
        // Same answer whether or not the account exists.
        Session::put('reset_id', $id ?? 0);
        Session::put('reset_target', $user && $user['email'] ? mask_email($user['email']) : '');
        return redirect(url('reset-password'))->with('info', t('auth.resetSent'));
    }

    public function resetForm(Request $req): Response
    {
        if (!Session::get('reset_target') && !Session::get('reset_id')) {
            return redirect(url('forgot-password'));
        }
        return view('auth/reset', ['title' => t('auth.resetTitle'), 'robots' => 'noindex']);
    }

    public function reset(Request $req): Response
    {
        $data = ['code' => $req->str('code'), 'password' => (string) ($_POST['password'] ?? ''), 'password_confirmation' => (string) ($_POST['password_confirmation'] ?? '')];
        $errors = Validator::make($data, ['code' => 'required', 'password' => 'required|password|confirmed']);
        if ($errors) {
            return back()->withErrors($errors);
        }
        $row = DB::one("SELECT * FROM verification_codes WHERE id = ? AND purpose = 'reset' AND consumed_at IS NULL", [(int) Session::get('reset_id', 0)]);
        if (!$row || strtotime($row['expires_at']) < time() || (int) $row['attempts'] >= 5) {
            return back()->withErrors(['code' => t('auth.wrongCode')]);
        }
        $code = preg_replace('/\D/', '', to_ascii_digits($data['code']));
        if (!hash_equals($row['code_hash'], Crypto::hash((string) $code))) {
            DB::exec('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?', [$row['id']]);
            return back()->withErrors(['code' => t('auth.wrongCode')]);
        }
        $p = json_decode((string) Crypto::decrypt($row['payload']), true);
        $uid = (int) ($p['uid'] ?? 0);
        if ($uid === 0) {
            return back()->withErrors(['code' => t('auth.wrongCode')]);
        }
        DB::exec('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL, updated_at = NOW() WHERE id = ?', [Crypto::passwordHash($data['password']), $uid]);
        DB::exec('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [$uid]);
        DB::exec('UPDATE verification_codes SET consumed_at = NOW() WHERE id = ?', [$row['id']]);
        Session::forget('reset_id');
        Session::forget('reset_target');
        Notify::user($uid, 'passwordChanged', [], 'account/security', true, true);
        Audit::log('auth.password_reset', 'user', $uid);
        return redirect(url('login'))->with('success', t('auth.resetDone'));
    }

    public function logout(Request $req): Response
    {
        Auth::logout();
        return redirect(url());
    }
}
