<?php

declare(strict_types=1);

use Firebase\JWT\BeforeValidException;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function issue_auth_token(array $user): string
{
    $secret = env_value('JWT_SECRET');
    if (!$secret) {
        throw new RuntimeException('JWT_SECRET is missing');
    }

    $ttl = (int) (env_value('JWT_TTL_SECONDS', '43200') ?? '43200');
    $now = time();
    $payload = [
        'iss' => current_origin(),
        'iat' => $now,
        'nbf' => $now - 5,
        'exp' => $now + max($ttl, 300),
        'sub' => (int) $user['id'],
        'username' => (string) $user['username'],
        'roleId' => (int) ($user['roleId'] ?? 0),
        'roleName' => (string) ($user['roleName'] ?? ''),
    ];

    return JWT::encode($payload, $secret, 'HS256');
}

function current_user(bool $required = true): ?array
{
    static $cached = false;
    static $user = null;

    if ($cached) {
        return $user;
    }

    $cached = true;
    $token = bearer_token();
    if (!$token) {
        if ($required) {
            json_response(['success' => false, 'error' => 'UNAUTHORIZED'], 401);
        }
        return null;
    }

    try {
        $decoded = JWT::decode($token, new Key((string) env_value('JWT_SECRET', ''), 'HS256'));
        $uid = (int) ($decoded->sub ?? 0);
        if ($uid <= 0) {
            throw new UnexpectedValueException('Invalid subject');
        }

        $stmt = db()->prepare(
            'SELECT u.id, u.username, u.passwordHash, u.fullName, u.email, u.roleId, u.isActive, u.userType, u.linkedEntityType, u.linkedEntityId, u.mustChangePassword, r.name AS roleName
             FROM users u
             LEFT JOIN roles r ON r.id = u.roleId
             WHERE u.id = ? LIMIT 1'
        );
        $stmt->execute([$uid]);
        $user = $stmt->fetch() ?: null;
        if (!$user || (int) $user['isActive'] !== 1) {
            throw new UnexpectedValueException('Inactive or missing user');
        }
        return $user;
    } catch (ExpiredException|BeforeValidException|UnexpectedValueException $e) {
        if ($required) {
            json_response(['success' => false, 'error' => 'UNAUTHORIZED'], 401);
        }
        return null;
    }
}

function remote_login_payload(string $username, string $password): array
{
    $login = trim($username);
    // Match by username (case-insensitive) OR by linked employee/employer code (so users can type RME0001 even if stored username differs slightly).
    $stmt = db()->prepare(
        'SELECT u.id, u.username, u.passwordHash, u.fullName, u.email, u.roleId, u.isActive, u.userType, u.linkedEntityType, u.linkedEntityId, u.mustChangePassword, u.avatarPath,
                r.name AS roleName
         FROM users u
         LEFT JOIN roles r ON r.id = u.roleId
         LEFT JOIN employees e ON u.linkedEntityType = \'employee\' AND e.id = u.linkedEntityId
         LEFT JOIN employers em ON u.linkedEntityType = \'employer\' AND em.id = u.linkedEntityId
         WHERE LOWER(TRIM(u.username)) = LOWER(?)
            OR (e.id IS NOT NULL AND LOWER(TRIM(e.code)) = LOWER(?))
            OR (em.id IS NOT NULL AND LOWER(TRIM(em.code)) = LOWER(?))
         LIMIT 1'
    );
    $stmt->execute([$login, $login, $login]);
    $user = $stmt->fetch();
    if (!$user || empty($user['passwordHash'])) {
        return ['success' => false, 'error' => 'INVALID_CREDENTIALS'];
    }
    if ((int) $user['isActive'] !== 1) {
        return ['success' => false, 'error' => 'ACCOUNT_DISABLED'];
    }
    if (!password_verify($password, (string) $user['passwordHash'])) {
        return ['success' => false, 'error' => 'INVALID_CREDENTIALS'];
    }

    db()->prepare('UPDATE users SET lastLoginAt = NOW(), updatedAt = NOW() WHERE id = ?')->execute([(int) $user['id']]);

    $linkedEntityName = null;
    $linkedEntityImagePath = null;
    $linkedBranchName = null;
    $linkedProfession = null;

    if (($user['linkedEntityType'] ?? null) === 'employee' && !empty($user['linkedEntityId'])) {
        $emp = db()->prepare('SELECT e.name, e.imagePath, e.profession, b.name AS branchName FROM employees e LEFT JOIN branches b ON b.id = e.workBranchId WHERE e.id = ? LIMIT 1');
        $emp->execute([(int) $user['linkedEntityId']]);
        $row = $emp->fetch();
        if ($row) {
            $linkedEntityName = $row['name'] ?? null;
            $linkedEntityImagePath = $row['imagePath'] ?? null;
            $linkedBranchName = $row['branchName'] ?? null;
            $linkedProfession = $row['profession'] ?? null;
        }
    } elseif (($user['linkedEntityType'] ?? null) === 'employer' && !empty($user['linkedEntityId'])) {
        $emp = db()->prepare('SELECT fullName AS name, photoPath AS imagePath FROM employers WHERE id = ? LIMIT 1');
        $emp->execute([(int) $user['linkedEntityId']]);
        $row = $emp->fetch();
        if ($row) {
            $linkedEntityName = $row['name'] ?? null;
            $linkedEntityImagePath = $row['imagePath'] ?? null;
        }
    }

    return [
        'success' => true,
        'token' => issue_auth_token($user),
        'user' => [
            'id' => (int) $user['id'],
            'username' => (string) $user['username'],
            'fullName' => (string) $user['fullName'],
            'email' => (string) ($user['email'] ?? ''),
            'roleId' => (int) $user['roleId'],
            'roleName' => (string) ($user['roleName'] ?? 'Admin'),
            'userType' => ($user['userType'] ?? 'free') === 'linked' ? 'linked' : 'free',
            'linkedEntityType' => $user['linkedEntityType'] ?: null,
            'linkedEntityId' => $user['linkedEntityId'] !== null ? (int) $user['linkedEntityId'] : null,
            'linkedEntityName' => $linkedEntityName,
            'linkedEntityImagePath' => $linkedEntityImagePath,
            'linkedBranchName' => $linkedBranchName,
            'linkedProfession' => $linkedProfession,
            'mustChangePassword' => (int) ($user['mustChangePassword'] ?? 0) === 1,
            'avatarPath' => $user['avatarPath'] ?? null,
        ],
    ];
}
