<?php
/**
 * Verify JWT and return user array or null.
 */

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function authVerify(PDO $pdo, array $config, string $token): ?array {
    $secret = $config['jwt_secret'] ?? '';
    if ($secret === '') {
        return null;
    }
    try {
        $decoded = JWT::decode($token, new Key($secret, 'HS256'));
        $userId = $decoded->userId ?? null;
        if (!$userId) {
            return null;
        }
        $stmt = $pdo->prepare('SELECT id, username, fullName, email, roleId, isActive FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user || empty($user['isActive'])) {
            return null;
        }
        $stmtRole = $pdo->prepare('SELECT id, name FROM roles WHERE id = ? LIMIT 1');
        $stmtRole->execute([$user['roleId']]);
        $role = $stmtRole->fetch(PDO::FETCH_ASSOC);
        $user['role'] = $role['name'] ?? null;
        return $user;
    } catch (Throwable $e) {
        return null;
    }
}
