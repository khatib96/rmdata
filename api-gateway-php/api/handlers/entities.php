<?php
/**
 * GET /api/entities and GET /api/entities/:id
 */

require_once __DIR__ . '/../require_permission.php';

function handleEntities(PDO $pdo, array $user, array $config, string $method, array $pathParts, string $path): void {
    requirePermission($pdo, $user, 'entities', 'view');

    if (count($pathParts) === 1) {
        $stmt = $pdo->query('SELECT id, entityNickname, name, nameEn, status, mainBranchId, createdAt FROM entities ORDER BY name');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        jsonResponse($rows);
        return;
    }

    $id = (int) ($pathParts[1] ?? 0);
    if ($id <= 0) {
        jsonError('Invalid id', '', 400);
        return;
    }
    $stmt = $pdo->prepare('SELECT * FROM entities WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        jsonError('Not found', '', 404);
        return;
    }
    jsonResponse($row);
}
