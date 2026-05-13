import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { sharedState } from './shared-state';
import { DbQueryInternalResult } from './db-query-internal';

const DB_CONNECTION_FILE = 'db-connection.json';
const REMOTE_CRED_FILE = 'remote-cred.dat';

export function getDbConnectionPath() {
  return path.join(app.getPath('userData'), DB_CONNECTION_FILE);
}

export function getDbConnectionConfig(): { mode: 'local' | 'remote'; apiBaseUrl?: string; apiUsername?: string; apiToken?: string } {
  try {
    const p = getDbConnectionPath();
    if (!fs.existsSync(p)) return { mode: 'local' };
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw) as { mode?: string; apiBaseUrl?: string; apiUsername?: string; apiToken?: string };
    return {
      mode: data.mode === 'remote' ? 'remote' : 'local',
      apiBaseUrl: data.apiBaseUrl || undefined,
      apiUsername: data.apiUsername || undefined,
      apiToken: data.apiToken || undefined,
    };
  } catch {
    return { mode: 'local' };
  }
}

export function setDbConnectionConfig(config: { mode: 'local' | 'remote'; apiBaseUrl?: string; apiUsername?: string; apiToken?: string }) {
  const p = getDbConnectionPath();
  fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8');
}

export function storeRemotePassword(password: string) {
  try {
    if (!safeStorage.isEncryptionAvailable()) return;
    const encrypted = safeStorage.encryptString(password);
    fs.writeFileSync(path.join(app.getPath('userData'), REMOTE_CRED_FILE), encrypted);
  } catch { /* best-effort */ }
}

export function loadRemotePassword(): string | null {
  try {
    const p = path.join(app.getPath('userData'), REMOTE_CRED_FILE);
    if (!fs.existsSync(p)) return null;
    const encrypted = fs.readFileSync(p);
    return safeStorage.decryptString(encrypted);
  } catch { return null; }
}

export function clearRemotePassword() {
  try {
    const p = path.join(app.getPath('userData'), REMOTE_CRED_FILE);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch { /* ignore */ }
}

export function normalizeApiBaseUrl(raw?: string): string | null {
  let base = String(raw || '').trim().replace(/\/+$/, '');
  if (!base) return null;
  if (!base.startsWith('http')) base = `https://${base}`;
  base = base.replace(/\/api$/i, '');
  return base;
}

export function getRemoteApiBaseUrl(): string | null {
  const config = getDbConnectionConfig();
  if (config.mode !== 'remote') return null;
  return normalizeApiBaseUrl(config.apiBaseUrl);
}

export function isRemoteFilesMode(): boolean {
  return !!getRemoteApiBaseUrl();
}

export function clearRemoteApiSession() {
  sharedState.remoteApiSession = null;
}

export function truncateForLog(s: string, maxLen: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

export async function remoteApiJson<T>(pathname: string, init?: RequestInit): Promise<T> {
  const base = getRemoteApiBaseUrl();
  if (!base) throw new Error('REMOTE_MODE_NOT_ENABLED');
  const conf = getDbConnectionConfig();
  const headers = new Headers(init?.headers || {});
  const token = sharedState.remoteApiSession?.token || conf.apiToken;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const url = `${base}${pathname}`;
  const res = await fetch(url, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json: T & { error?: string };
  try {
    json = text ? JSON.parse(text) as T & { error?: string } : {} as T & { error?: string };
  } catch {
    if (!res.ok) {
      console.warn(`remoteApiJson: ${res.status} ${pathname} non-JSON response (${truncateForLog(text, 240)})`);
      if (res.status === 413) throw new Error('FILE_TOO_LARGE');
      throw new Error(res.statusText || `HTTP_${res.status}`);
    }
    throw new Error('INVALID_JSON_RESPONSE');
  }
  if (!res.ok) {
    if (res.status === 413) {
      console.warn(`remoteApiJson failed: ${res.status} ${pathname} | error=FILE_TOO_LARGE`);
      throw new Error('FILE_TOO_LARGE');
    }
    const errMsg = (json as { error?: string }).error || res.statusText || `HTTP_${res.status}`;
    console.warn(`remoteApiJson failed: ${res.status} ${pathname} | error=${errMsg} | body=${truncateForLog(text, 400)}`);
    throw new Error(errMsg);
  }
  return json as T;
}

export async function executeRemoteDbQueryOnce(query: string, params?: unknown[]): Promise<DbQueryInternalResult> {
  const json = await remoteApiJson<{
    success: boolean;
    data?: unknown[];
    lastInsertId?: number | null;
    error?: string;
  }>('/api/db/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, params: params ?? [] }),
  });
  if (!json.success) {
    return { success: false, error: json.error || 'REMOTE_QUERY_FAILED' };
  }
  return {
    success: true,
    data: json.data,
    lastInsertId: json.lastInsertId ?? undefined,
  };
}

export async function fetchPublicIpOptional(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { ip?: string };
    return j.ip || null;
  } catch {
    return null;
  }
}

export function absoluteToRelativeImagePath(imgPath: string): string {
  const normalized = imgPath.replace(/\\/g, '/');
  const userDataNorm = app.getPath('userData').replace(/\\/g, '/');
  if (normalized.startsWith(userDataNorm + '/')) {
    return normalized.slice(userDataNorm.length + 1);
  }
  const knownAppDirs = ['RMDATA.System', 'alredaa-erp-system'];
  for (const dirName of knownAppDirs) {
    const marker = `/${dirName}/`;
    const idx = normalized.indexOf(marker);
    if (idx !== -1) {
      return normalized.slice(idx + marker.length);
    }
  }
  if (/^[A-Z]:\//i.test(normalized)) {
    const parts = normalized.split('/');
    const imagesIdx = parts.findIndex(p => p.toLowerCase() === 'images' || p.toLowerCase() === 'employers' || p.toLowerCase() === 'documents');
    if (imagesIdx !== -1) return parts.slice(imagesIdx).join('/');
  }
  return normalized;
}

export function buildRemoteFileOpenUrl(kind: 'document' | 'image', relativePath: string): string {
  const base = getRemoteApiBaseUrl();
  const conf = getDbConnectionConfig();
  const token = sharedState.remoteApiSession?.token || conf.apiToken;
  if (!base || !token) {
    throw new Error('REMOTE_SESSION_REQUIRED');
  }
  const q = new URLSearchParams({ kind, path: relativePath, token });
  return `${base}/api/files/open?${q.toString()}`;
}

export function isPreviewableDocumentPath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.txt', '.html'].includes(ext);
}

export function mimeFromFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export async function uploadRemoteFile(params: {
  kind: 'document' | 'image';
  relativePath: string;
  fileName: string;
  fileBuffer: Buffer;
  customName?: string;
  entityType?: string;
  entityId?: number;
  section?: string;
}) {
  const conf = getDbConnectionConfig();
  const token = sharedState.remoteApiSession?.token || conf.apiToken;
  if (!token) throw new Error('REMOTE_SESSION_REQUIRED');
  const form = new FormData();
  const blob = new Blob([new Uint8Array(params.fileBuffer)], { type: mimeFromFilename(params.fileName) });
  form.append('kind', params.kind);
  form.append('relativePath', params.relativePath);
  form.append('file', blob, params.fileName);
  if (params.customName) form.append('customName', params.customName);
  if (params.entityType) form.append('entityType', params.entityType);
  if (params.entityId != null) form.append('entityId', String(params.entityId));
  if (params.section != null && params.section !== '') form.append('section', params.section);
  return remoteApiJson<{ success: boolean; id?: number; relativePath?: string; mimeType?: string; sizeBytes?: number; error?: string }>(
    '/api/files/upload',
    { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` } }
  );
}
