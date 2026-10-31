<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\DB;
use App\Core\Request;
use App\Core\Response;
use App\Core\Settings;

final class DashboardController
{
    use AdminPage;

    public function index(Request $req): Response
    {
        $k = [];
        $k['ordersToday'] = (int) DB::val("SELECT COUNT(*) FROM orders WHERE created_at >= CURDATE() AND status <> 'awaiting_payment'");
        $k['orders7'] = (int) DB::val("SELECT COUNT(*) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND status <> 'awaiting_payment'");
        $k['gmv30'] = (string) DB::val("SELECT COALESCE(SUM(total), 0) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND status IN ('placed', 'completed')");
        $k['commission30'] = (string) DB::val("SELECT COALESCE(SUM(commission_amount), 0) FROM seller_orders WHERE status = 'delivered' AND delivered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
        $k['users'] = (int) DB::val("SELECT COUNT(*) FROM users WHERE status = 'active'");
        $k['newUsers7'] = (int) DB::val('SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
        $k['sellers'] = (int) DB::val("SELECT COUNT(*) FROM sellers WHERE status = 'approved'");
        $k['liveProducts'] = (int) DB::val("SELECT COUNT(*) FROM products WHERE status = 'active' AND offer_count > 0");
        $todo = [
            ['admin/sellers?status=pending', 'store', 'adminDash.pendingSellers', (int) DB::val("SELECT COUNT(*) FROM sellers WHERE status = 'pending'"), 'sellers.review'],
            ['admin/products?status=pending', 'book', 'adminDash.pendingProducts', (int) DB::val("SELECT COUNT(*) FROM products WHERE status = 'pending'"), 'catalog.manage'],
            ['admin/refunds', 'undo', 'adminDash.refunds', (int) DB::val("SELECT COUNT(*) FROM refunds WHERE status IN ('requested', 'processing')"), 'refunds.manage'],
            ['admin/returns', 'package', 'adminDash.returns', (int) DB::val("SELECT COUNT(*) FROM returns WHERE status IN ('requested', 'approved', 'received')"), 'refunds.manage'],
            ['admin/payouts', 'wallet', 'adminDash.payouts', (int) DB::val("SELECT COUNT(*) FROM payouts WHERE status IN ('requested', 'processing')"), 'payouts.manage'],
            ['admin/messages', 'message', 'adminDash.messages', (int) DB::val("SELECT COUNT(*) FROM contact_messages WHERE status = 'new'"), 'messages.manage'],
            ['admin/orders?stuck=1', 'alert', 'adminDash.stuck', (int) DB::val("SELECT COUNT(*) FROM seller_orders WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 2 DAY)"), 'orders.manage'],
        ];
        $recent = DB::all("SELECT o.*, u.name AS buyer FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 10");
        $daily = DB::all("SELECT DATE(created_at) AS d, COUNT(*) AS n, COALESCE(SUM(total), 0) AS amount FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND status IN ('placed', 'completed') GROUP BY DATE(created_at) ORDER BY d");
        $warnings = [];
        if (!str_starts_with((string) \App\Core\App::config('url'), 'https://')) {
            $warnings[] = 'adminDash.warnHttps';
        }
        if (is_dir(BK_ROOT . '/install')) {
            $warnings[] = 'adminDash.warnInstall';
        }
        if (Settings::get('mail.driver') === 'log') {
            $warnings[] = 'adminDash.warnMail';
        }
        if (\App\Core\App::config('debug')) {
            $warnings[] = 'adminDash.warnDebug';
        }
        $lastCron = (int) Settings::get('cron.last_run', '0');
        if ($lastCron < time() - 3600) {
            $warnings[] = 'adminDash.warnCron';
        }
        if ((new \App\Core\Migrator(DB::pdo()))->pending()) {
            $warnings[] = 'adminDash.warnMigrations';
        }
        return $this->page('dashboard', ['title' => t('nav.admin'), 'k' => $k, 'todo' => $todo, 'recent' => $recent, 'daily' => $daily, 'warnings' => $warnings]);
    }
}
