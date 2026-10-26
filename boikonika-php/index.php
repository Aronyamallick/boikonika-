<?php
/**
 * Boikonika — front controller. Every page request that isn't a real file comes here (see .htaccess).
 * Developed by Arieskonex Technologies.
 */
declare(strict_types=1);

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    exit('Boikonika needs PHP 8.1 or newer.');
}

require __DIR__ . '/app/bootstrap.php';

App\Core\App::run();
