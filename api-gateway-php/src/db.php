<?php

declare(strict_types=1);

/**
 * Translate common SQLite-specific SQL to MySQL equivalents.
 * Covers the patterns used by the Electron app's db:query calls.
 */
function sqlite_to_mysql(string $sql): string
{
    // datetime('now') → NOW()
    $sql = preg_replace("/datetime\s*\(\s*'now'\s*\)/i", 'NOW()', $sql);

    // datetime('now', '-7 days') → DATE_SUB(NOW(), INTERVAL 7 DAY)
    $sql = preg_replace_callback(
        "/datetime\s*\(\s*'now'\s*,\s*'(-?\d+)\s+(day|days|hour|hours|minute|minutes|month|months|year|years)'\s*\)/i",
        function ($m) {
            $n = (int) $m[1];
            $unit = strtoupper(rtrim($m[2], 's'));
            if ($n < 0) {
                return 'DATE_SUB(NOW(), INTERVAL ' . abs($n) . ' ' . $unit . ')';
            }
            return 'DATE_ADD(NOW(), INTERVAL ' . $n . ' ' . $unit . ')';
        },
        $sql
    );

    // date('now') → CURDATE()
    $sql = preg_replace("/date\s*\(\s*'now'\s*\)/i", 'CURDATE()', $sql);

    // date('now', '-7 days') → DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    $sql = preg_replace_callback(
        "/date\s*\(\s*'now'\s*,\s*'(-?\d+)\s+(day|days|hour|hours|minute|minutes|month|months|year|years)'\s*\)/i",
        function ($m) {
            $n = (int) $m[1];
            $unit = strtoupper(rtrim($m[2], 's'));
            if ($n < 0) {
                return 'DATE_SUB(CURDATE(), INTERVAL ' . abs($n) . ' ' . $unit . ')';
            }
            return 'DATE_ADD(CURDATE(), INTERVAL ' . $n . ' ' . $unit . ')';
        },
        $sql
    );

    // datetime(columnName) → columnName  (العمود في MySQL نوعه DATETIME بالفعل، لا حاجة للغلاف)
    $sql = preg_replace(
        "/\bdatetime\s*\(\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\)/i",
        '$1',
        $sql
    );

    // INSERT OR IGNORE → INSERT IGNORE
    $sql = preg_replace('/\bINSERT\s+OR\s+IGNORE\b/i', 'INSERT IGNORE', $sql);

    // INSERT OR REPLACE → REPLACE
    $sql = preg_replace('/\bINSERT\s+OR\s+REPLACE\b/i', 'REPLACE', $sql);

    // AUTOINCREMENT → AUTO_INCREMENT
    $sql = preg_replace('/\bAUTOINCREMENT\b/i', 'AUTO_INCREMENT', $sql);

    // INTEGER PRIMARY KEY AUTOINCREMENT → INT PRIMARY KEY AUTO_INCREMENT  (CREATE TABLE)
    $sql = preg_replace('/\bINTEGER\s+PRIMARY\s+KEY\s+AUTO_INCREMENT\b/i', 'INT PRIMARY KEY AUTO_INCREMENT', $sql);

    // IFNULL → IFNULL (same in MySQL, no change needed)
    // GROUP_CONCAT works in both

    // last_insert_rowid() → LAST_INSERT_ID()
    $sql = preg_replace('/\blast_insert_rowid\s*\(\s*\)/i', 'LAST_INSERT_ID()', $sql);

    // GLOB → LIKE (approximate — GLOB uses * and ?, LIKE uses % and _)
    // Only handle simple cases: column GLOB '*pattern*' → column LIKE '%pattern%'
    $sql = preg_replace_callback(
        "/(\w+)\s+GLOB\s+'([^']+)'/i",
        function ($m) {
            $pattern = str_replace(['*', '?'], ['%', '_'], $m[2]);
            return $m[1] . " LIKE '" . $pattern . "'";
        },
        $sql
    );

    // sqlite_master → information_schema.tables (for table existence checks)
    if (preg_match('/\bsqlite_master\b/i', $sql)) {
        // SELECT name FROM sqlite_master WHERE type='table' AND name='xxx'
        // → SELECT TABLE_NAME as name FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='xxx'
        $sql = preg_replace(
            "/SELECT\s+name\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'\s+AND\s+name\s*=\s*\?/i",
            "SELECT TABLE_NAME as name FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
            $sql
        );
    }

    // Quote MySQL reserved words used as bare column/alias names.
    // `key` is the most common offender (settings table), but we also handle
    // `value`, `order`, `group`, `index`, `status` to be safe.
    // Only include words actually used as column names in this app.
    // Do NOT add 'order' or 'group' — they collide with ORDER BY / GROUP BY.
    $reserved = ['key', 'value', 'index'];
    foreach ($reserved as $word) {
        // Match the word when it appears as a bare identifier (not already backtick-quoted,
        // not inside a string literal, not part of a longer identifier).
        // Lookbehind: not preceded by ` or alphanumeric or underscore
        // Lookahead:  not followed by ` or alphanumeric or underscore or (
        $sql = preg_replace(
            '/(?<!`)(?<![A-Za-z0-9_.])\b' . $word . '\b(?!`)(?![A-Za-z0-9_(])/i',
            '`' . $word . '`',
            $sql
        );
    }

    return $sql;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = env_value('DB_HOST', 'localhost');
    $port = env_value('DB_PORT', '3306');
    $name = env_value('DB_NAME');
    $user = env_value('DB_USER');
    $pass = env_value('DB_PASSWORD');

    if (!$name || !$user) {
        throw new RuntimeException('Database environment variables are missing');
    }

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);
    $pdo = new PDO($dsn, $user, $pass ?: '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}
