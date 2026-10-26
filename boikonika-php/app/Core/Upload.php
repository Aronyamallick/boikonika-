<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Image uploads. Files are checked by their contents (not the name or browser type), re-encoded with
 * GD — which also removes location and camera metadata — and resized. Public images go to /uploads;
 * private ones (identity documents) to storage/private, which the web server never serves.
 */
final class Upload
{
    public const MAX_BYTES = 5 * 1024 * 1024;
    private const TYPES = [IMAGETYPE_JPEG => 'jpeg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];

    /** Returns an error message, or null when the file is an acceptable image. */
    public static function check(?array $file): ?string
    {
        if ($file === null) {
            return I18n::t('validation.required');
        }
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? I18n::t('validation.fileTooBig', ['size' => I18n::number(5)]) : I18n::t('validation.uploadFailed');
        }
        if ((int) $file['size'] > self::MAX_BYTES) {
            return I18n::t('validation.fileTooBig', ['size' => I18n::number(5)]);
        }
        if (!is_uploaded_file($file['tmp_name']) && !defined('BK_TESTING')) {
            return I18n::t('validation.uploadFailed');
        }
        $info = @getimagesize($file['tmp_name']);
        if (!$info || !isset(self::TYPES[$info[2]])) {
            return I18n::t('validation.image');
        }
        if ($info[0] * $info[1] > 40_000_000) {
            return I18n::t('validation.imageTooLarge');
        }
        return null;
    }

    /**
     * Saves a public image under uploads/{folder}/YYYY/MM and returns its path relative to uploads/.
     * @throws \RuntimeException when the image can't be read
     */
    public static function image(array $file, string $folder, int $maxW = 1600, int $maxH = 1600): string
    {
        $dir = BK_ROOT . '/uploads/' . $folder . '/' . date('Y/m');
        $name = Crypto::token(12);
        $path = self::reencode($file['tmp_name'], $dir, $name, $maxW, $maxH);
        return $folder . '/' . date('Y/m') . '/' . basename($path);
    }

    /** Saves a private image under storage/private/{folder}; returns the path relative to storage/private/. */
    public static function privateImage(array $file, string $folder): string
    {
        $dir = BK_STORAGE . '/private/' . $folder;
        $path = self::reencode($file['tmp_name'], $dir, Crypto::token(16), 2400, 2400);
        return $folder . '/' . basename($path);
    }

    private static function reencode(string $tmp, string $dir, string $name, int $maxW, int $maxH): string
    {
        if (!function_exists('imagecreatetruecolor')) {
            throw new \RuntimeException('The PHP GD extension is required for image uploads.');
        }
        $info = getimagesize($tmp);
        $src = match ($info[2] ?? 0) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($tmp),
            IMAGETYPE_PNG => @imagecreatefrompng($tmp),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($tmp) : false,
            IMAGETYPE_GIF => @imagecreatefromgif($tmp),
            default => false,
        };
        if (!$src) {
            throw new \RuntimeException('Unreadable image');
        }
        if (($info[2] ?? 0) === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
            $src = self::orient($src, $tmp);
        }
        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1, $maxW / $w, $maxH / $h);
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));
        $dst = imagecreatetruecolor($nw, $nh);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 255, 255, 255, 127));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imagedestroy($src);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new \RuntimeException('Cannot create ' . $dir);
        }
        if (function_exists('imagewebp')) {
            $path = $dir . '/' . $name . '.webp';
            imagewebp($dst, $path, 82);
        } else {
            $path = $dir . '/' . $name . '.jpg';
            $flat = imagecreatetruecolor($nw, $nh);
            imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
            imagecopy($flat, $dst, 0, 0, 0, 0, $nw, $nh);
            imagejpeg($flat, $path, 85);
            imagedestroy($flat);
        }
        imagedestroy($dst);
        return $path;
    }

    /** Applies the camera's rotation before the metadata is thrown away. */
    private static function orient(\GdImage $img, string $tmp): \GdImage
    {
        $exif = @exif_read_data($tmp);
        $o = (int) ($exif['Orientation'] ?? 1);
        $rotated = match ($o) {
            3 => imagerotate($img, 180, 0),
            6 => imagerotate($img, -90, 0),
            8 => imagerotate($img, 90, 0),
            default => false,
        };
        if ($rotated) {
            imagedestroy($img);
            return $rotated;
        }
        return $img;
    }

    public static function delete(?string $relative): void
    {
        if (!$relative || str_contains($relative, '..')) {
            return;
        }
        $file = BK_ROOT . '/uploads/' . $relative;
        if (is_file($file)) {
            @unlink($file);
        }
    }

    public static function deletePrivate(?string $relative): void
    {
        if (!$relative || str_contains($relative, '..')) {
            return;
        }
        $file = BK_STORAGE . '/private/' . $relative;
        if (is_file($file)) {
            @unlink($file);
        }
    }
}
