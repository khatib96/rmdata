import type { DocumentListItem } from '../types/documents';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;

export function normalizeDocumentPath(value: string): string {
  return value.replace(/\\/g, '/');
}

export function getDocumentBaseName(relativePath: string): string {
  const normalized = normalizeDocumentPath(relativePath);
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'file';
}

export function getDocumentDisplayName(customName: string | null | undefined, relativePath: string): string {
  return customName || getDocumentBaseName(relativePath);
}

export function getDocumentDisplayNameFromItem(item: Pick<DocumentListItem, 'customName' | 'relativePath'>): string {
  return getDocumentDisplayName(item.customName, item.relativePath);
}

export function getDocumentExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function isImageDocumentName(fileName: string): boolean {
  return IMAGE_EXTENSIONS.includes(getDocumentExtension(fileName) as (typeof IMAGE_EXTENSIONS)[number]);
}

export function isPdfDocumentName(fileName: string): boolean {
  return getDocumentExtension(fileName) === 'pdf';
}

export function isImagePreviewSource(fileName: string, previewUrl?: string | null): boolean {
  return isImageDocumentName(fileName) || Boolean(previewUrl?.startsWith('data:image'));
}

export function sanitizeDocumentCustomName(name: string): string {
  return name.trim().replace(/[/\\:*?"<>|]/g, '_');
}

export function buildSavedDocumentFileName(sourcePath: string, customName: string): string {
  const baseName = getDocumentBaseName(sourcePath);
  const ext = baseName.includes('.') ? baseName.slice(baseName.lastIndexOf('.')) : '';
  return customName.trim() ? sanitizeDocumentCustomName(customName) + ext : baseName;
}
