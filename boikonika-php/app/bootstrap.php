<?php
declare(strict_types=1);

define('BK_ROOT', dirname(__DIR__));
define('BK_APP', __DIR__);
define('BK_STORAGE', BK_ROOT . '/storage');
define('BK_VERSION', '1.0.0');

spl_autoload_register(static function (string $class): void {
    if (strncmp($class, 'App\\', 4) !== 0) {
        return;
    }
    $file = BK_APP . '/' . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

require BK_APP . '/helpers.php';
require BK_APP . '/forms.php';
