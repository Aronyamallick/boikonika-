<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

/**
 * Schema changes only happen through numbered files in database/migrations, each applied once and
 * recorded in schema_migrations. After uploading a new version, apply pending ones from
 * Admin → System (or the installer on a fresh install).
 */
final class Migrator
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return list<string> e.g. ["001_initial", "002_…"] */
    public static function available(): array
    {
        $files = glob(BK_ROOT . '/database/migrations/*.sql') ?: [];
        sort($files, SORT_STRING);
        return array_map(static fn (string $f): string => basename($f, '.sql'), $files);
    }

    public function applied(): array
    {
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
        return $this->pdo->query('SELECT version FROM schema_migrations ORDER BY version')->fetchAll(PDO::FETCH_COLUMN);
    }

    public function pending(): array
    {
        return array_values(array_diff(self::available(), $this->applied()));
    }

    /** @return list<string> versions applied now */
    public function migrate(): array
    {
        $done = [];
        foreach ($this->pending() as $version) {
            $sql = (string) file_get_contents(BK_ROOT . '/database/migrations/' . $version . '.sql');
            foreach (self::statements($sql) as $stmt) {
                $this->pdo->exec($stmt);
            }
            $st = $this->pdo->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, NOW())');
            $st->execute([$version]);
            $done[] = $version;
        }
        return $done;
    }

    /** Splits a SQL file on semicolons at line ends, skipping comments. */
    public static function statements(string $sql): array
    {
        $sql = preg_replace('/^\s*--.*$/m', '', $sql);
        $parts = preg_split('/;\s*\n/', (string) $sql);
        return array_values(array_filter(array_map('trim', $parts), static fn (string $s): bool => $s !== ''));
    }
}
