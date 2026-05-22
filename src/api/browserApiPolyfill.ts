/**
 * عند فتح التطبيق من المتصفح (مثلاً من الجوال عبر 192.168.x.x:5173) لا يوجد Electron.
 * نوفّر استدعاء dbQuery عبر خادم API محلي أو عبر بوابة PHP البعيدة عند استخدام Hostinger.
 */
import { API_SESSION_TOKEN_KEY } from './apiSessionToken';
import type { ArchiveRestoreResource, ElectronAPI, EmployeeStatusUpdatePayload, TaxPaymentWrite } from '../types/electron';

if (typeof window !== 'undefined' && !window.electronAPI?.dbQuery) {
  const rawBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '';
  const apiBase = typeof rawBase === 'string' ? rawBase.replace(/\/+$/, '') : '';

  function getApiSessionToken(): string | null {
    try {
      return sessionStorage.getItem(API_SESSION_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  function setApiSessionToken(token: string | null) {
    try {
      if (token) sessionStorage.setItem(API_SESSION_TOKEN_KEY, token);
      else sessionStorage.removeItem(API_SESSION_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }

  async function postJson(path: string, body: unknown, opts?: { skipAuth?: boolean }) {
    const url = `${apiBase}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!opts?.skipAuth) {
      const tok = getApiSessionToken();
      if (tok) headers.Authorization = `Bearer ${tok}`;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  }

  async function putJson(path: string, body: unknown) {
    const url = `${apiBase}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const tok = getApiSessionToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  }

  async function deleteJson(path: string) {
    const url = `${apiBase}${path}`;
    const headers: Record<string, string> = {};
    const tok = getApiSessionToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const res = await fetch(url, { method: 'DELETE', headers });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  }

  async function getJson(path: string) {
    const url = `${apiBase}${path}`;
    const headers: Record<string, string> = {};
    const tok = getApiSessionToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const res = await fetch(url, { method: 'GET', headers });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  }

  function isPreviewablePath(relativePath: string): boolean {
    const ext = relativePath.split('.').pop()?.toLowerCase() || '';
    return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'txt', 'html'].includes(ext);
  }

  function buildFileOpenUrl(kind: 'document' | 'image', relativePath: string): string | null {
    const tok = getApiSessionToken();
    if (!tok) return null;
    const q = new URLSearchParams({ kind, path: relativePath, token: tok });
    return `${apiBase}/api/files/open?${q.toString()}`;
  }

  const browserShim: Pick<
    ElectronAPI,
    | 'dbQuery'
    | 'syncPermissionCatalog'
    | 'permissionsGetUserPermissions'
    | 'permissionsSetUserPermissions'
    | 'archiveRecord'
    | 'archiveRestore'
    | 'archiveDeletePermanent'
    | 'taxPaymentCreate'
    | 'taxPaymentDelete'
    | 'taxEntityBranchesReplace'
    | 'employeeStatusUpdate'
    | 'authLogin'
    | 'authChangeOwnPassword'
    | 'documentList'
    | 'documentDelete'
    | 'documentGetUrl'
    | 'fileGetImageUrl'
    | 'documentOpenExternal'
  > = {
    syncPermissionCatalog: async () => ({ success: true }),
    permissionsGetUserPermissions: async (_sessionToken: string | null | undefined, userId: number) => {
      try {
        const { res, json } = await getJson(`/api/users/${userId}/permissions`);
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, data: json.data || [], error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    permissionsSetUserPermissions: async (_sessionToken: string | null | undefined, userId: number, permissionIds: number[]) => {
      try {
        const { res, json } = await putJson(`/api/users/${userId}/permissions`, { permissionIds });
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, data: json.data, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    archiveRestore: async (_sessionToken: string | null | undefined, resource: ArchiveRestoreResource, id: number) => {
      try {
        const { res, json } = await postJson(`/api/${resource}/${id}/restore`, {});
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, data: json.data, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    archiveRecord: async (_sessionToken: string | null | undefined, resource: ArchiveRestoreResource, id: number) => {
      try {
        const { res, json } = await postJson(`/api/${resource}/${id}/archive`, {});
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, data: json.data, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    archiveDeletePermanent: async (_sessionToken: string | null | undefined, resource: ArchiveRestoreResource, id: number) => {
      try {
        const { res, json } = await deleteJson(`/api/${resource}/${id}/permanent`);
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, data: json.data, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    taxPaymentCreate: async (_sessionToken: string | null | undefined, payment: TaxPaymentWrite) => {
      try {
        const { res, json } = await postJson('/api/tax/payments', payment);
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, id: json.id, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    taxPaymentDelete: async (_sessionToken: string | null | undefined, id: number) => {
      try {
        const { res, json } = await deleteJson(`/api/tax/payments/${id}`);
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    taxEntityBranchesReplace: async (_sessionToken: string | null | undefined, entityId: number, branchIds: number[]) => {
      try {
        const { res, json } = await putJson(`/api/tax/entity-branches/${entityId}`, { branchIds });
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, data: json.data, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    employeeStatusUpdate: async (_sessionToken: string | null | undefined, employeeId: number, payload: EmployeeStatusUpdatePayload) => {
      try {
        const { res, json } = await putJson(`/api/employees/${employeeId}/status`, payload);
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    dbQuery: async (query: string, params?: unknown[]) => {
      try {
        const { res, json } = await postJson('/api/db/query', { query, params: params || [] });
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, data: json.data, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('API db/query error:', msg);
        return { success: false, error: msg };
      }
    },
    authLogin: async (username: string, password: string) => {
      try {
        const { res, json } = await postJson('/api/auth/login', { username, password }, { skipAuth: true });
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        if (json.success && typeof json.token === 'string' && json.token.length > 0) {
          setApiSessionToken(json.token);
        } else {
          setApiSessionToken(null);
        }
        return { success: json.success !== false, user: json.user, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('API auth/login error:', msg);
        return { success: false, error: msg };
      }
    },
    authChangeOwnPassword: async (userId: number, currentPassword: string, newPassword: string) => {
      try {
        const { res, json } = await postJson('/api/auth/change-own-password', { userId, currentPassword, newPassword });
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('API auth/change-own-password error:', msg);
        return { success: false, error: msg };
      }
    },
    documentList: async (entityType?: string, entityId?: number, section?: string) => {
      try {
        const q = new URLSearchParams();
        if (entityType) q.set('entityType', entityType);
        if (entityId != null) q.set('entityId', String(entityId));
        if (section != null && section !== '') q.set('section', section);
        const suffix = q.toString();
        const { res, json } = await getJson(`/api/files/list${suffix ? `?${suffix}` : ''}`);
        if (!res.ok) return { success: false, data: [], error: json.error || res.statusText };
        return { success: json.success !== false, data: json.data || [], error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, data: [], error: msg };
      }
    },
    documentDelete: async (id: number) => {
      try {
        const { res, json } = await postJson('/api/files/delete', { id });
        if (!res.ok) return { success: false, error: json.error || res.statusText };
        return { success: json.success !== false, error: json.error };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }
    },
    documentGetUrl: async (relativePath: string) => {
      const url = buildFileOpenUrl('document', relativePath);
      if (!url) return { success: false, error: 'NO_SESSION' };
      return { success: true, url: isPreviewablePath(relativePath) ? url : null, canPreview: isPreviewablePath(relativePath) };
    },
    fileGetImageUrl: async (imagePath: string) => {
      const url = buildFileOpenUrl('image', imagePath);
      if (!url) return { success: false, error: 'NO_SESSION' };
      return { success: true, url };
    },
    documentOpenExternal: async (relativePath: string) => {
      const url = buildFileOpenUrl('document', relativePath);
      if (!url) return { success: false, error: 'NO_SESSION' };
      window.open(url, '_blank', 'noopener,noreferrer');
      return { success: true };
    },
  };

  window.electronAPI = { ...(window.electronAPI || {}), ...browserShim } as ElectronAPI;
}

export {};
