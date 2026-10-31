<?php
declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOStatement;

/** Thin PDO wrapper: prepared statements only, utf8mb4, Bangladesh time. */
final class DB
{
    private static ?PDO $pdo = null;
    private static int $depth = 0;

    public static function connect(array $c): PDO
    {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], (int) ($c['port'] ?? 3306), $c['name']);
        if (!empty($c['socket'])) {
            $dsn = sprintf('mysql:unix_socket=%s;dbname=%s;charset=utf8mb4', $c['socket'], $c['name']);
        }
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+06:00', sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
        return $pdo;
    }

    public static function pdo(): PDO
    {
        return self::$pdo ??= self::connect(App::config('db'));
    }

    public static function use(PDO $pdo): void
    {
        self::$pdo = $pdo;
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $st = self::pdo()->prepare($sql);
        $isList = array_is_list($params);
        foreach ($params as $k => $v) {
            if (is_bool($v)) {
                $v = (int) $v;
            }
            $st->bindValue($isList ? $k + 1 : ':' . ltrim((string) $k, ':'), $v, self::type($v));
        }
        $st->execute();
        return $st;
    }

    private static function type(mixed $v): int
    {
        return match (true) {
            is_int($v) => PDO::PARAM_INT,
            $v === null => PDO::PARAM_NULL,
            default => PDO::PARAM_STR,
        };
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public static function val(string $sql, array $params = []): mixed
    {
        $v = self::run($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    /** @return list<mixed> First column of every row. */
    public static function col(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function exec(string $sql, array $params = []): int
    {
        return self::run($sql, $params)->rowCount();
    }

    public static function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $sql = 'INSERT INTO `' . $table . '` (`' . implode('`,`', $cols) . '`) VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
        self::run($sql, array_values($data));
        return (int) self::pdo()->lastInsertId();
    }

    /** UPDATE `table` SET … WHERE $where (positional placeholders only). */
    public static function update(string $table, array $data, string $where, array $params = []): int
    {
        $set = implode(', ', array_map(static fn (string $c): string => '`' . $c . '` = ?', array_keys($data)));
        return self::exec('UPDATE `' . $table . '` SET ' . $set . ' WHERE ' . $where, [...array_values($data), ...$params]);
    }

    /** Runs $fn in a transaction (nested calls join the outer one). */
    public static function tx(callable $fn): mixed
    {
        $pdo = self::pdo();
        if (self::$depth > 0) {
            self::$depth++;
            try {
                return $fn();
            } finally {
                self::$depth--;
            }
        }
        self::$depth = 1;
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        } finally {
            self::$depth = 0;
        }
    }

    /** "?, ?, ?" for an IN (…) list. */
    public static function in(array $values): string
    {
        return implode(',', array_fill(0, max(1, count($values)), '?'));
    }

    public static function now(): string
    {
        return date('Y-m-d H:i:s');
    }
}
