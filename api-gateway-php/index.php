<?php
/**
 * Single entry point: show decoy page at root, forward /api/* to API.
 */

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH);
$path = $path ?: '/';
$path = rtrim($path, '/') ?: '/';

if ($path === '/' || $path === '/index.php') {
    require __DIR__ . '/decoy.php';
    exit;
}

if (strpos($path, '/api') === 0) {
    $_SERVER['API_PATH'] = substr($path, 4) ?: '/';
    require __DIR__ . '/api/index.php';
    exit;
}

http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404</title></head><body><p>Not Found</p></body></html>';
