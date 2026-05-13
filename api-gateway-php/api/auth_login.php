<?php
/**
 * POST /api/auth/login - validate input, verify password, return JWT + user.
 */

use Firebase\JWT\JWT;

function authLogin(PDO $pdo, array $config, array $body): void {
    $username = isset($body['username']) ? trim((string) $body['username']) : '';
    $password = $body['password'] ?? '';

    if ($username === '' || $password === '') {
        jsonError('Validation failed', 'Username and password required', 400);
        return;
    }
    if (strlen($username) > 100) {
        jsonError('Validation failed', 'Invalid username', 400);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, username, passwordHash, fullName, email, roleId, isActive FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || empty($user['isActive'])) {
        jsonError('Invalid credentials', '', 401);
        return;
    }
    if (!password_verify($password, $user['passwordHash'])) {
        jsonError('Invalid credentials', '', 401);
        return;
    }

    $secret = $config['jwt_secret'] ?? '';
    if ($secret === '') {
        jsonError('Server configuration error', '', 500);
        return;
    }

    $expires = $config['jwt_expires'] ?? '7d';
    $seconds = 604800;
    if (preg_match('/^(\d+)d$/', $expires, $m)) {
        $seconds = (int) $m[1] * 86400;
    } elseif (preg_match('/^(\d+)h$/', $expires, $m)) {
        $seconds = (int) $m[1] * 3600;
    }

    $payload = [
        'userId' => (int) $user['id'],
        'username' => $user['username'],
        'iat' => time(),
        'exp' => time() + $seconds,
    ];
    $token = JWT::encode($payload, $secret, 'HS256');

    $update = $pdo->prepare('UPDATE users SET lastLoginAt = NOW() WHERE id = ?');
    $update->execute([$user['id']]);

    jsonResponse([
        'token' => $token,
        'user' => [
            'id' => (int) $user['id'],
            'username' => $user['username'],
            'fullName' => $user['fullName'],
            'email' => $user['email'],
            'roleId' => (int) $user['roleId'],
        ],
    ]);
}
