<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if (request_method() === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = request_path();
$method = request_method();

try {
    if ($path === '/health' && $method === 'GET') {
        db()->query('SELECT 1');
        json_response(['ok' => true, 'database' => true, 'timestamp' => gmdate(DATE_ATOM)]);
    }

    if ($path === '/auth/login' && $method === 'POST') {
        $body = json_input();
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        if ($username === '' || $password === '') {
            json_response(['success' => false, 'error' => 'INVALID_CREDENTIALS'], 400);
        }
        json_response(remote_login_payload($username, $password));
    }

    if ($path === '/auth/change-own-password' && $method === 'POST') {
        $user = current_user();
        $body = json_input();
        $userId = (int) ($body['userId'] ?? 0);
        $currentPassword = (string) ($body['currentPassword'] ?? '');
        $newPassword = (string) ($body['newPassword'] ?? '');
        if ($userId <= 0 || $currentPassword === '' || strlen($newPassword) < 4) {
            json_response(['success' => false, 'error' => 'INVALID_REQUEST'], 400);
        }
        if ($userId !== (int) $user['id']) {
            json_response(['success' => false, 'error' => 'FORBIDDEN'], 403);
        }
        if (!password_verify($currentPassword, (string) $user['passwordHash'])) {
            json_response(['success' => false, 'error' => 'INVALID_CURRENT_PASSWORD'], 400);
        }
        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        db()->prepare('UPDATE users SET passwordHash = ?, mustChangePassword = 0, updatedAt = NOW() WHERE id = ?')->execute([$hash, $userId]);
        json_response(['success' => true]);
    }

    if ($path === '/files/list' && $method === 'GET') {
        current_user();
        $entityType = isset($_GET['entityType']) ? trim((string) $_GET['entityType']) : null;
        $entityId = isset($_GET['entityId']) && $_GET['entityId'] !== '' ? (int) $_GET['entityId'] : null;
        $section = isset($_GET['section']) ? trim((string) $_GET['section']) : null;
        $includeArchived = isset($_GET['includeArchived']) && $_GET['includeArchived'] === '1';

        $sql = 'SELECT id, relativePath, customName, entityType, entityId, section, isArchived, createdAt FROM documents WHERE 1=1';
        $params = [];
        if (!$includeArchived) {
            $sql .= ' AND (isArchived = 0 OR isArchived IS NULL)';
        }
        if ($entityType !== null && $entityType !== '') {
            $sql .= ' AND entityType = ?';
            $params[] = $entityType;
        }
        if ($entityId !== null) {
            $sql .= ' AND entityId = ?';
            $params[] = $entityId;
        }
        if ($section !== null && $section !== '') {
            $sql .= ' AND section = ?';
            $params[] = $section;
        }
        $sql .= ' ORDER BY createdAt DESC';
        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        json_response(['success' => true, 'data' => $stmt->fetchAll() ?: []]);
    }

    if ($path === '/files/upload' && $method === 'POST') {
        $user = current_user();
        $kind = strtolower(trim((string) ($_POST['kind'] ?? 'document')));
        $relativePath = normalize_relative_path((string) ($_POST['relativePath'] ?? ''));
        $customName = isset($_POST['customName']) ? trim((string) $_POST['customName']) : null;
        $entityType = isset($_POST['entityType']) ? trim((string) $_POST['entityType']) : null;
        $entityId = isset($_POST['entityId']) && $_POST['entityId'] !== '' ? (int) $_POST['entityId'] : null;
        $section = isset($_POST['section']) && $_POST['section'] !== '' ? trim((string) $_POST['section']) : null;
        $isArchived = isset($_POST['isArchived']) && in_array((string) $_POST['isArchived'], ['1', 'true'], true);
        $skipDbInsert = isset($_POST['skipDbInsert']) && in_array((string) $_POST['skipDbInsert'], ['1', 'true'], true);

        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            json_response(['success' => false, 'error' => 'MISSING_FILE'], 400);
        }
        $file = $_FILES['file'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $uploadError = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
            if ($uploadError === UPLOAD_ERR_INI_SIZE || $uploadError === UPLOAD_ERR_FORM_SIZE) {
                json_response(['success' => false, 'error' => 'FILE_TOO_LARGE'], 413);
            }
            if ($uploadError === UPLOAD_ERR_NO_FILE) {
                json_response(['success' => false, 'error' => 'MISSING_FILE'], 400);
            }
            json_response(['success' => false, 'error' => 'UPLOAD_FAILED'], 400);
        }
        if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > max_upload_bytes()) {
            json_response(['success' => false, 'error' => 'FILE_TOO_LARGE'], 400);
        }

        assert_allowed_extension((string) $file['name'], $kind === 'image' ? 'image' : 'document');
        $tmpPath = (string) $file['tmp_name'];
        $targetPath = resolve_storage_path($relativePath);

        // Image uploads, or bulk sync of existing DB rows (skipDbInsert) — store file only, no documents row
        if ($kind === 'image' || $skipDbInsert) {
            if (!move_uploaded_file($tmpPath, $targetPath)) {
                json_response(['success' => false, 'error' => 'FAILED_TO_STORE_FILE'], 500);
            }
            json_response([
                'success' => true,
                'relativePath' => $relativePath,
                'mimeType' => file_mime_type($targetPath, (string) $file['name']),
                'sizeBytes' => filesize($targetPath),
            ]);
        }

        if (!$entityType) {
            json_response(['success' => false, 'error' => 'MISSING_ENTITY_TYPE'], 400);
        }

        $pdo = db();
        $pdo->beginTransaction();
        $stored = false;
        try {
            $archiveDate = gmdate('Y_m_d');
            $existing = null;
            if (!$isArchived) {
                $stmt = $pdo->prepare('SELECT id, relativePath, customName FROM documents WHERE entityType = ? AND ((? IS NULL AND entityId IS NULL) OR entityId = ?) AND ((? IS NULL AND section IS NULL) OR section = ?) AND (isArchived = 0 OR isArchived IS NULL) ORDER BY id DESC LIMIT 1');
                $stmt->execute([$entityType, $entityId, $entityId, $section, $section]);
                $existing = $stmt->fetch();
            }

            if ($existing) {
                $oldRelative = (string) $existing['relativePath'];
                $oldFull = resolve_storage_path($oldRelative);
                if (is_file($oldFull)) {
                    $dirPart = trim(str_replace('\\', '/', dirname($oldRelative)), '.');
                    $base = basename($oldRelative);
                    $ext = pathinfo($base, PATHINFO_EXTENSION);
                    $nameWithoutExt = pathinfo($base, PATHINFO_FILENAME) ?: 'doc';
                    $archiveRelative = trim('Archive/' . ($dirPart !== '' ? $dirPart . '/' : '') . 'Old_' . $nameWithoutExt . '_' . $archiveDate . ($ext !== '' ? '.' . $ext : ''), '/');
                    $archiveFull = resolve_storage_path($archiveRelative);
                    if (!is_dir(dirname($archiveFull))) {
                        mkdir(dirname($archiveFull), 0775, true);
                    }
                    rename($oldFull, $archiveFull);
                    $pdo->prepare('UPDATE documents SET relativePath = ?, customName = ?, isArchived = 1 WHERE id = ?')->execute([
                        $archiveRelative,
                        (($existing['customName'] ?: $base) . ' (Archived)'),
                        (int) $existing['id'],
                    ]);
                }
            }

            if (!move_uploaded_file($tmpPath, $targetPath)) {
                throw new RuntimeException('FAILED_TO_STORE_FILE');
            }
            $stored = true;

            // Match SQLite / mysql-import.sql schema: documents has no mimeType/sizeBytes columns
            $pdo->prepare('INSERT INTO documents (relativePath, customName, entityType, entityId, section, isArchived) VALUES (?,?,?,?,?,?)')->execute([
                $relativePath,
                $customName ?: basename($relativePath),
                $entityType,
                $entityId,
                $section,
                $isArchived ? 1 : 0,
            ]);
            $id = (int) $pdo->lastInsertId();
            $pdo->commit();
            $mimeType = file_mime_type($targetPath, (string) $file['name']);
            $sizeBytes = (int) filesize($targetPath);
            json_response(['success' => true, 'id' => $id, 'relativePath' => $relativePath, 'mimeType' => $mimeType, 'sizeBytes' => $sizeBytes]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($stored && is_file($targetPath)) {
                @unlink($targetPath);
            }
            throw $e;
        }
    }

    if ($path === '/files/open' && $method === 'GET') {
        current_user();
        $relativePath = normalize_relative_path((string) ($_GET['path'] ?? ''));
        stream_storage_file($relativePath);
    }

    if ($path === '/files/delete' && $method === 'POST') {
        current_user();
        $body = json_input();
        $id = (int) ($body['id'] ?? 0);
        if ($id <= 0) {
            json_response(['success' => false, 'error' => 'INVALID_ID'], 400);
        }
        $pdo = db();
        $stmt = $pdo->prepare('SELECT relativePath FROM documents WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            json_response(['success' => false, 'error' => 'NOT_FOUND'], 404);
        }
        $pdo->prepare('DELETE FROM documents WHERE id = ?')->execute([$id]);
        $full = resolve_storage_path((string) $row['relativePath']);
        if (is_file($full)) {
            @unlink($full);
        }
        json_response(['success' => true]);
    }

    // POST /db/query — proxy raw SQL (same interface as Electron's db:query IPC)
    if ($path === '/db/query' && $method === 'POST') {
        current_user();
        $body = json_input();
        $query = trim((string) ($body['query'] ?? ''));
        $params = isset($body['params']) && is_array($body['params']) ? $body['params'] : [];

        if ($query === '') {
            json_response(['success' => false, 'error' => 'Empty query'], 400);
        }
        // Block dangerous operations
        if (preg_match('/\b(ATTACH|DETACH|VACUUM|REINDEX|PRAGMA)\b/i', $query)) {
            json_response(['success' => false, 'error' => 'This SQL operation is not allowed'], 403);
        }

        // SQLite → MySQL syntax translation
        $query = sqlite_to_mysql($query);

        $pdo = db();
        $upper = strtoupper(ltrim($query));
        $isSelect = str_starts_with($upper, 'SELECT') || str_starts_with($upper, 'WITH');

        if ($isSelect) {
            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            $rows = $stmt->fetchAll() ?: [];
            json_response(['success' => true, 'data' => $rows]);
        } else {
            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            $lastId = str_starts_with($upper, 'INSERT') ? (int) $pdo->lastInsertId() : null;
            json_response([
                'success' => true,
                'data' => [],
                'lastInsertId' => $lastId,
                'changes' => $stmt->rowCount(),
            ]);
        }
    }

    json_response(['success' => false, 'error' => 'NOT_FOUND'], 404);
} catch (InvalidArgumentException $e) {
    json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    $debug = env_value('APP_DEBUG', 'false') === 'true';
    json_response([
        'success' => false,
        'error' => $debug ? $e->getMessage() : 'SERVER_ERROR',
    ], 500);
}
