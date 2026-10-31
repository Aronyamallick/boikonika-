<?php
/**
 * Scheduled tasks. Add to cPanel → Cron Jobs (every 5 minutes):
 *     php /home/USER/public_html/cron.php
 * or, if the host only allows URLs:
 *     wget -q -O - "https://your-site/cron.php?key=YOUR_CRON_KEY"
 * (the key is in app/config.php and shown in Admin → System).
 */
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

use App\Core\App;
use App\Services\Cron;

if (!App::installed()) {
    http_response_code(503);
    exit("Not installed\n");
}
$config = require BK_APP . '/config.php';
$cli = PHP_SAPI === 'cli';
if (!$cli) {
    $key = (string) ($_GET['key'] ?? '');
    if ($key === '' || empty($config['cron_key']) || !hash_equals((string) $config['cron_key'], $key)) {
        http_response_code(403);
        exit("Forbidden\n");
    }
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
}
App::bootCli($config);
$report = Cron::run();
foreach ($report as $k => $v) {
    echo $k, ': ', $v, "\n";
}
