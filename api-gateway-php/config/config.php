<?php
/**
 * Configuration - load from environment or .env file above document root.
 * Do not put real credentials in this file.
 */

$configDir = __DIR__;
$rootDir = dirname($configDir);
$envFile = $rootDir . DIRECTORY_SEPARATOR . '.env';

if (file_exists($envFile) && is_readable($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value, " \t\"'");
            if (!getenv($key)) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }
}

return [
    'db' => [
        'host' => getenv('DB_HOST') ?: 'localhost',
        'port' => (int) (getenv('DB_PORT') ?: 3306),
        'user' => getenv('DB_USER') ?: '',
        'password' => getenv('DB_PASSWORD') ?: '',
        'database' => getenv('DB_NAME') ?: '',
        'charset' => 'utf8mb4',
    ],
    'jwt_secret' => getenv('JWT_SECRET') ?: '',
    'jwt_expires' => getenv('JWT_EXPIRES_IN') ?: '7d',
    'cors_origins' => array_filter(array_map('trim', explode(',', getenv('CORS_ORIGINS') ?: ''))),
];
