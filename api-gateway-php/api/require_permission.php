<?php
/**
 * Check permission for current user; send 403 and exit if denied.
 */

function requirePermission(PDO $pdo, array $user, string $module, string $action): void {
    if (($user['role'] ?? '') === 'Admin') {
        return;
    }
    $stmt = $pdo->prepare(
        'SELECT 1 FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permissionId
         WHERE rp.roleId = ? AND p.module = ? AND p.action = ? LIMIT 1'
    );
    $stmt->execute([$user['roleId'], $module, $action]);
    if ($stmt->fetch()) {
        return;
    }
    jsonError('Forbidden', "Permission $module.$action required", 403);
    exit;
}
