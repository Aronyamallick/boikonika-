<?php
declare(strict_types=1);

namespace App\Core;

/** Plain PHP templates in app/Views. Escape every value with e() or __(). */
final class View
{
    public static function render(string $template, array $data = [], ?string $layout = 'layouts/main'): string
    {
        $content = self::partial($template, $data);
        if ($layout === null) {
            return $content;
        }
        return self::partial($layout, ['content' => $content] + $data);
    }

    public static function partial(string $template, array $data = []): string
    {
        $file = BK_APP . '/Views/' . $template . '.php';
        if (!is_file($file)) {
            throw new \RuntimeException('View not found: ' . $template);
        }
        $level = ob_get_level();
        ob_start();
        try {
            (static function (string $__file, array $__data): void {
                extract($__data, EXTR_SKIP);
                include $__file;
            })($file, $data);
        } catch (\Throwable $e) {
            while (ob_get_level() > $level) {
                ob_end_clean();
            }
            throw $e;
        }
        return (string) ob_get_clean();
    }
}
