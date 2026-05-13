<?php
/**
 * GET /api/branches and GET /api/branches/:id
 */

require_once __DIR__ . '/../require_permission.php';

function handleBranches(PDO $pdo, array $user, array $config, string $method, array $pathParts, string $path): void {
    requirePermission($pdo, $user, 'branches', 'view');

    if (count($pathParts) === 1) {
        $stmt = $pdo->query('SELECT id, code, name, nameEn, emirate, city, status, branchType, createdAt FROM branches ORDER BY name');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        jsonResponse($rows);
        return;
    }

    $id = (int) ($pathParts[1] ?? 0);
    if ($id <= 0) {
        jsonError('Invalid id', '', 400);
        return;
    }
    $stmt = $pdo->prepare('SELECT * FROM branches WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        jsonError('Not found', '', 404);
        return;
    }
    jsonResponse($row);
}
