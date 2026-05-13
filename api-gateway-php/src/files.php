<?php

declare(strict_types=1);

function normalize_relative_path(string $relativePath): string
{
    $clean = str_replace('\\', '/', trim($relativePath));
    $clean = preg_replace('#/+#', '/', $clean ?? '');
    $clean = ltrim((string) $clean, '/');
    if ($clean === '' || str_contains($clean, '..')) {
        throw new InvalidArgumentException('INVALID_RELATIVE_PATH');
    }
    return $clean;
}

function resolve_storage_path(string $relativePath): string
{
    $normalized = normalize_relative_path($relativePath);
    $full = storage_root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $normalized);
    $root = realpath(storage_root()) ?: storage_root();
    $dir = dirname($full);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $realDir = realpath($dir) ?: $dir;
    if (!str_starts_with($realDir, $root)) {
        throw new InvalidArgumentException('INVALID_RELATIVE_PATH');
    }
    return $full;
}

function supported_image_extensions(): array
{
    $raw = env_value('ALLOWED_IMAGE_EXTENSIONS', 'jpg,jpeg,png,gif,webp,svg') ?? '';
    return array_values(array_filter(array_map('trim', explode(',', strtolower($raw)))));
}

function supported_document_extensions(): array
{
    $raw = env_value('ALLOWED_DOCUMENT_EXTENSIONS', 'pdf,jpg,jpeg,png,gif,webp,svg,txt,doc,docx,xls,xlsx,ppt,pptx') ?? '';
    return array_values(array_filter(array_map('trim', explode(',', strtolower($raw)))));
}

function assert_allowed_extension(string $filename, string $kind): string
{
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $allowed = $kind === 'image' ? supported_image_extensions() : supported_document_extensions();
    if ($ext === '' || !in_array($ext, $allowed, true)) {
        throw new InvalidArgumentException('UNSUPPORTED_FILE_TYPE');
    }
    return $ext;
}

function max_upload_bytes(): int
{
    return max(1, (int) (env_value('MAX_UPLOAD_MB', '20') ?? '20')) * 1024 * 1024;
}

function previewable_path(string $relativePath): bool
{
    $ext = strtolower(pathinfo($relativePath, PATHINFO_EXTENSION));
    return in_array($ext, ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'txt', 'html'], true);
}

function file_mime_type(string $filePath, ?string $fallbackName = null): string
{
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? finfo_file($finfo, $filePath) : false;
    if ($finfo) {
        finfo_close($finfo);
    }
    if (is_string($mime) && $mime !== '') {
        return $mime;
    }
    $name = $fallbackName ?: $filePath;
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    return match ($ext) {
        'pdf' => 'application/pdf',
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'txt' => 'text/plain; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
        default => 'application/octet-stream',
    };
}

function stream_storage_file(string $relativePath): never
{
    $full = resolve_storage_path($relativePath);
    if (!is_file($full)) {
        json_response(['success' => false, 'error' => 'FILE_NOT_FOUND'], 404);
    }
    header('Content-Type: ' . file_mime_type($full, $relativePath));
    header('Content-Length: ' . (string) filesize($full));
    header('Cache-Control: private, max-age=3600');
    readfile($full);
    exit;
}
