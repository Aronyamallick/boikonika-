<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\App;
use App\Core\Audit;
use App\Core\Auth;
use App\Core\DB;
use App\Core\Migrator;
use App\Core\Money;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Core\Settings;
use App\Core\Validator;
use App\Services\Cron;
use App\Services\Mail;

/** Site, order, payment and email settings; system health; audit log. Super admins only. */
final class SettingsController
{
    use AdminPage;

    private const TABS = [
        'general' => ['site.name_bn', 'site.name_en', 'site.tagline_bn', 'site.tagline_en', 'site.email', 'site.phone', 'site.address', 'site.facebook', 'site.youtube', 'site.indexing'],
        'orders' => ['orders.commission_percent', 'orders.payment_window_minutes', 'orders.cod_enabled', 'orders.cod_max', 'orders.return_window_days', 'orders.min_payout', 'catalog.review_new_products'],
        'payments' => ['payments.bkash.enabled', 'payments.bkash.sandbox', 'payments.bkash.username', 'payments.bkash.password', 'payments.bkash.app_key', 'payments.bkash.app_secret', 'payments.ssl.enabled', 'payments.ssl.sandbox', 'payments.ssl.store_id', 'payments.ssl.store_password'],
        'email' => ['mail.driver', 'mail.from_email', 'mail.from_name', 'mail.smtp_host', 'mail.smtp_port', 'mail.smtp_encryption', 'mail.smtp_username', 'mail.smtp_password'],
    ];
    private const BOOLS = ['site.indexing', 'orders.cod_enabled', 'catalog.review_new_products', 'payments.bkash.enabled', 'payments.bkash.sandbox', 'payments.ssl.enabled', 'payments.ssl.sandbox'];

    public function edit(Request $req): Response
    {
        $tab = array_key_exists($req->query('tab'), self::TABS) ? $req->query('tab') : 'general';
        $values = [];
        foreach (self::TABS[$tab] as $k) {
            $values[$k] = in_array($k, Settings::SECRETS, true) ? '' : (string) Settings::get($k);
        }
        $secretsSet = [];
        foreach (Settings::SECRETS as $k) {
            $secretsSet[$k] = Settings::hasSecret($k);
        }
        return $this->page('settings', ['title' => t('admin.settings'), 'tab' => $tab, 'v' => $values, 'secretsSet' => $secretsSet, 'urls' => [
            'bkash' => abs_url('payment/bkash/callback', [], 'bn'),
            'ssl_ipn' => abs_url('payment/sslcommerz/ipn', [], 'bn'),
        ]]);
    }

    public function update(Request $req): Response
    {
        $tab = array_key_exists($req->str('tab'), self::TABS) ? $req->str('tab') : 'general';
        $in = [];
        foreach (self::TABS[$tab] as $k) {
            $field = str_replace('.', '__', $k);
            $in[$k] = in_array($k, self::BOOLS, true) ? ($req->bool($field) ? '1' : '0') : trim((string) ($_POST[$field] ?? ''));
        }
        $errors = [];
        $rules = [
            'site.name_bn' => 'required|max:60', 'site.name_en' => 'required|max:60', 'site.tagline_bn' => 'nullable|max:160', 'site.tagline_en' => 'nullable|max:160',
            'site.email' => 'nullable|email', 'site.phone' => 'nullable|max:30', 'site.address' => 'nullable|max:500', 'site.facebook' => 'nullable|url', 'site.youtube' => 'nullable|url',
            'orders.payment_window_minutes' => 'required|int|gte:5|lte:1440', 'orders.cod_max' => 'required|money', 'orders.return_window_days' => 'required|int|gte:0|lte:60', 'orders.min_payout' => 'required|money',
            'mail.driver' => 'required|in:mail,smtp,log', 'mail.from_email' => 'nullable|email', 'mail.from_name' => 'nullable|max:80', 'mail.smtp_port' => 'nullable|int|gte:1|lte:65535', 'mail.smtp_encryption' => 'nullable|in:tls,ssl,none',
        ];
        foreach ($in as $k => $v) {
            if (isset($rules[$k]) && ($e = Validator::make(['x' => $v], ['x' => $rules[$k]]))) {
                $errors[str_replace('.', '__', $k)] = $e['x'];
            }
        }
        if (isset($in['orders.commission_percent']) && !preg_match('/^\d{1,2}(\.\d{1,2})?$/', to_ascii_digits($in['orders.commission_percent']))) {
            $errors['orders__commission_percent'] = t('admin.percentInvalid');
        }
        if ($errors) {
            return redirect(url('admin/settings', ['tab' => $tab]))->withErrors($errors)->withInput();
        }
        foreach ($in as $k => $v) {
            if (in_array($k, Settings::SECRETS, true) && $v === '') {
                continue; // blank = keep the stored secret
            }
            if (in_array($k, ['orders.cod_max', 'orders.min_payout'], true)) {
                $v = Money::toDecimal(Money::toPoisha($v));
            }
            if (in_array($k, ['orders.commission_percent', 'orders.payment_window_minutes', 'orders.return_window_days', 'mail.smtp_port'], true)) {
                $v = to_ascii_digits($v);
            }
            Settings::set($k, $v);
        }
        foreach ((array) ($_POST['clear'] ?? []) as $k) {
            if (in_array($k, Settings::SECRETS, true)) {
                Settings::set($k, '');
            }
        }
        if ($tab === 'payments') {
            Settings::set('payments.bkash.token_cache', '');
        }
        if ($tab === 'general') {
            @unlink(BK_STORAGE . '/cache/sitemap.xml');
        }
        Audit::log('settings.updated', 'settings', $tab, ['keys' => array_keys($in)]);
        return redirect(url('admin/settings', ['tab' => $tab]))->with('success', t('common.saved'));
    }

    public function testMail(Request $req): Response
    {
        $to = (string) Auth::user()['email'];
        if ($to === '') {
            return back()->with('error', t('validation.email'));
        }
        [$subject, $html, $text] = Mail::render('test', [], locale());
        try {
            Mail::deliver($to, Auth::user()['name'], $subject, $html, $text);
        } catch (\Throwable $e) {
            return redirect(url('admin/settings', ['tab' => 'email']))->with('error', t('admin.mailFailed', ['error' => mb_substr($e->getMessage(), 0, 200)]));
        }
        return redirect(url('admin/settings', ['tab' => 'email']))->with('success', t('admin.mailSent', ['email' => $to]));
    }

    public function system(Request $req): Response
    {
        $m = new Migrator(DB::pdo());
        $dirs = [];
        foreach (['uploads' => BK_ROOT . '/uploads', 'storage/logs' => BK_STORAGE . '/logs', 'storage/cache' => BK_STORAGE . '/cache', 'storage/private' => BK_STORAGE . '/private'] as $label => $dir) {
            $dirs[$label] = is_dir($dir) && is_writable($dir);
        }
        $mail = DB::one("SELECT SUM(status = 'queued') AS queued, SUM(status = 'failed') AS failed, SUM(status = 'sent' AND sent_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)) AS sent FROM mail_queue");
        $failedMails = DB::all("SELECT to_email, subject, last_error, created_at FROM mail_queue WHERE status = 'failed' ORDER BY id DESC LIMIT 5");
        $logs = glob(BK_STORAGE . '/logs/app-*.log') ?: [];
        rsort($logs);
        $tail = '';
        if ($logs) {
            $lines = @file($logs[0], FILE_IGNORE_NEW_LINES) ?: [];
            $tail = implode("\n", array_slice(array_filter($lines, static fn ($l) => str_starts_with($l, '[')), -15));
        }
        return $this->page('system', [
            'title' => t('admin.system'),
            'version' => BK_VERSION,
            'php' => PHP_VERSION,
            'db' => (string) DB::val('SELECT VERSION()'),
            'applied' => $m->applied(),
            'pending' => $m->pending(),
            'cronLast' => (int) Settings::get('cron.last_run', '0'),
            'cronKey' => (string) App::config('cron_key', ''),
            'dirs' => $dirs,
            'mail' => $mail,
            'failedMails' => $failedMails,
            'logTail' => $tail,
            'extensions' => ['pdo_mysql', 'mbstring', 'openssl', 'gd', 'curl', 'intl', 'fileinfo', 'sodium'],
        ]);
    }

    public function migrate(Request $req): Response
    {
        $done = (new Migrator(DB::pdo()))->migrate();
        Audit::log('system.migrated', 'system', null, ['versions' => $done]);
        return redirect(url('admin/system'))->with('success', $done ? t('admin.migrated', ['list' => implode(', ', $done)]) : t('admin.nothingToMigrate'));
    }

    public function runCron(Request $req): Response
    {
        $report = Cron::run();
        return redirect(url('admin/system'))->with('success', t('admin.cronDone', ['orders' => num($report['expired_orders']), 'emails' => num($report['emails_sent'])]));
    }

    public function audit(Request $req): Response
    {
        $q = mb_substr($req->query('q'), 0, 80);
        $where = '1=1';
        $params = [];
        if ($q !== '') {
            $where = '(a.action LIKE ? OR a.entity_type = ? OR u.email LIKE ?)';
            $params = ['%' . $q . '%', $q, '%' . $q . '%'];
        }
        $total = (int) DB::val("SELECT COUNT(*) FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id WHERE {$where}", $params);
        $pager = new Paginator($total, 50);
        $rows = DB::all("SELECT a.*, u.name AS actor, u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id WHERE {$where} ORDER BY a.id DESC" . $pager->sql(), $params);
        return $this->page('audit', ['title' => t('admin.audit'), 'rows' => $rows, 'pager' => $pager, 'q' => $q]);
    }
}
