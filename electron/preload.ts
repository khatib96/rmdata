/**
 * Preload script - runs in isolated context before renderer loads.
 * Only Electron APIs (contextBridge, ipcRenderer) are used - no Node.js modules.
 * The renderer receives only what is exposed via electronAPI.
 */
import { contextBridge, ipcRenderer } from 'electron';

export interface DatabaseConnectionConfig {
  mode: 'local' | 'remote';
  apiBaseUrl?: string;
  apiUsername?: string;
  apiPassword?: string;
  authenticated?: boolean;
}

export type UpdateStatus =
  | { stage: 'checking' }
  | { stage: 'available'; version: string; notes?: string }
  | { stage: 'none' }
  | { stage: 'downloading'; percent: number; transferred: number; total: number }
  | { stage: 'downloaded'; version: string }
  | { stage: 'error'; message: string };

contextBridge.exposeInMainWorld('electronAPI', {
  /** Phase 0: ping to verify IPC/preload is available in renderer */
  ping: () => ipcRenderer.invoke('settings:ping'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
  getDatabaseConnection: () => ipcRenderer.invoke('settings:getDatabaseConnection') as Promise<DatabaseConnectionConfig>,
  setDatabaseConnection: (config: DatabaseConnectionConfig) => ipcRenderer.invoke('settings:setDatabaseConnection', config) as Promise<{ success: boolean }>,
  testApiConnection: (apiBaseUrl: string, username?: string, password?: string) =>
    ipcRenderer.invoke('settings:testApiConnection', apiBaseUrl, username, password) as Promise<{ success: boolean; ok?: boolean; database?: boolean; error?: string }>,
  checkForUpdates: () => ipcRenderer.invoke('app:update/check') as Promise<{ success: boolean; hasUpdate?: boolean; error?: string }>,
  downloadUpdate: () => ipcRenderer.invoke('app:update/download') as Promise<{ success: boolean; error?: string }>,
  quitAndInstallUpdate: () => ipcRenderer.invoke('app:update/quit-and-install') as Promise<{ success: boolean; error?: string }>,
  getAutoUpdateCheckEnabled: () => ipcRenderer.invoke('app:update/get-auto-check') as Promise<{ success: boolean; enabled?: boolean; error?: string }>,
  setAutoUpdateCheckEnabled: (enabled: boolean) => ipcRenderer.invoke('app:update/set-auto-check', enabled) as Promise<{ success: boolean; error?: string }>,
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_: unknown, status: UpdateStatus) => callback(status);
    ipcRenderer.on('app:update-status', handler);
    return () => ipcRenderer.removeListener('app:update-status', handler);
  },
  dbQuery: (query: string, params?: unknown[]) =>
    ipcRenderer.invoke('db:query', query, params),
  syncPermissionCatalog: () =>
    ipcRenderer.invoke('permissions:syncCatalog') as Promise<{ success: boolean; error?: string }>,
  permissionsGetUserPermissions: (sessionToken: string | null | undefined, userId: number) =>
    ipcRenderer.invoke('permissions:getUserPermissions', { sessionToken: sessionToken ?? undefined, userId }) as Promise<{ success: boolean; data?: { permissionId: number }[]; error?: string }>,
  permissionsSetUserPermissions: (sessionToken: string | null | undefined, userId: number, permissionIds: number[]) =>
    ipcRenderer.invoke('permissions:setUserPermissions', { sessionToken: sessionToken ?? undefined, userId, permissionIds }) as Promise<{ success: boolean; data?: { permissionIds: number[] }; error?: string }>,
  archiveRecord: (sessionToken: string | null | undefined, resource: string, id: number) =>
    ipcRenderer.invoke('archive:archive', { sessionToken: sessionToken ?? undefined, resource, id }) as Promise<{ success: boolean; data?: { entityType: string }; error?: string }>,
  archiveRestore: (sessionToken: string | null | undefined, resource: string, id: number) =>
    ipcRenderer.invoke('archive:restore', { sessionToken: sessionToken ?? undefined, resource, id }) as Promise<{ success: boolean; data?: { entityType: string }; error?: string }>,
  archiveDeletePermanent: (sessionToken: string | null | undefined, resource: string, id: number) =>
    ipcRenderer.invoke('archive:deletePermanent', { sessionToken: sessionToken ?? undefined, resource, id }) as Promise<{ success: boolean; data?: { entityType: string }; error?: string }>,
  authLogin: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),
  devicePing: (token: string, gpsCoords: string | null, locationCity?: string | null) =>
    ipcRenderer.invoke('device:ping', token, gpsCoords, locationCity ?? null),
  deviceLogout: (token: string) =>
    ipcRenderer.invoke('device:logout', token) as Promise<{ success: boolean; error?: string }>,
  getWindowsLocation: () =>
    ipcRenderer.invoke('get-windows-location') as Promise<{ success: boolean; lat?: number; lng?: number; error?: string }>,
  checkNeedsSetup: () =>
    ipcRenderer.invoke('app:checkNeedsSetup') as Promise<{ needsSetup: boolean; error?: string }>,
  firstRunSetup: (adminPassword: string) =>
    ipcRenderer.invoke('app:firstRunSetup', adminPassword) as Promise<{ success: boolean; error?: string }>,
  authEmergencyReset: () =>
    ipcRenderer.invoke('auth:emergencyReset') as Promise<{ success: boolean; password?: string; username?: string; error?: string }>,
  authCreateUser: (
    sessionToken: string | null | undefined,
    data: {
      username: string;
      password: string;
      fullName: string;
      email?: string;
      roleId: number;
      userType?: 'free' | 'linked';
      linkedEntityType?: 'employee' | 'employer';
      linkedEntityId?: number;
      mustChangePassword?: boolean;
    },
  ) => ipcRenderer.invoke('auth:createUser', { sessionToken: sessionToken ?? undefined, ...data }),
  authSetPassword: (sessionToken: string | null | undefined, userId: number, newPassword: string) =>
    ipcRenderer.invoke('auth:setPassword', { sessionToken: sessionToken ?? undefined, userId, newPassword }),
  authUpdateUser: (
    sessionToken: string | null | undefined,
    userId: number,
    data: {
      fullName?: string;
      email?: string;
      roleId?: number;
      userType?: 'free' | 'linked';
      linkedEntityType?: 'employee' | 'employer' | null;
      linkedEntityId?: number | null;
      avatarPath?: string;
    },
  ) => ipcRenderer.invoke('auth:updateUser', { sessionToken: sessionToken ?? undefined, userId, data }),
  authDeleteUser: (sessionToken: string | null | undefined, userId: number) =>
    ipcRenderer.invoke('auth:deleteUser', { sessionToken: sessionToken ?? undefined, userId }),
  authSetUserActive: (sessionToken: string | null | undefined, userId: number, isActive: number) =>
    ipcRenderer.invoke('auth:setUserActive', { sessionToken: sessionToken ?? undefined, userId, isActive }),
  authSearchLinkableEntities: (query: string) =>
    ipcRenderer.invoke('auth:searchLinkableEntities', query),
  authChangeOwnPassword: (userId: number, currentPassword: string, newPassword: string) =>
    ipcRenderer.invoke('auth:changeOwnPassword', userId, currentPassword, newPassword),
  authRefreshLinkedImage: (userId: number) =>
    ipcRenderer.invoke('auth:refreshLinkedImage', userId) as Promise<{ success: boolean; linkedEntityImagePath?: string | null; error?: string }>,
  backupCreate: (options?: { toDedicatedFolder?: boolean; includeDocuments?: boolean }) =>
    ipcRenderer.invoke('backup:create', options),
  backupList: () => ipcRenderer.invoke('backup:list') as Promise<{ success: boolean; data: { name: string; path: string; size: number; createdAt: string; isFull: boolean }[] }>,
  backupDelete: (name: string) => ipcRenderer.invoke('backup:delete', name) as Promise<{ success: boolean; error?: string }>,
  backupRestoreFromPath: (backupPath: string) => ipcRenderer.invoke('backup:restoreFromPath', backupPath) as Promise<{ success: boolean; error?: string }>,
  backupRestore: () => ipcRenderer.invoke('backup:restore'),
  notificationsLoad: () => ipcRenderer.invoke('notifications:load'),
  notificationsEnsureLeaseReminders: () => ipcRenderer.invoke('notifications:ensureLeaseReminders'),
  notificationsEnsureAllExpiryReminders: () => ipcRenderer.invoke('notifications:ensureAllExpiryReminders'),
  notificationsMarkRead: (id: number) => ipcRenderer.invoke('notifications:markRead', id),
  notificationsMarkAllRead: () => ipcRenderer.invoke('notifications:markAllRead'),
  notificationsDelete: (id: number) => ipcRenderer.invoke('notifications:delete', id),
  notificationsArchive: (id: number) => ipcRenderer.invoke('notifications:archive', id),
  /** Subscribe to new-alerts event from main (for sound). Returns unsubscribe. */
  onNotificationNewAlerts: (callback: (count: number) => void) => {
    const handler = (_: unknown, count: number) => callback(count);
    ipcRenderer.on('notification:newAlerts', handler);
    return () => ipcRenderer.removeListener('notification:newAlerts', handler);
  },
  fileSelectImage: () => ipcRenderer.invoke('file:select-image'),
  fileSaveImage: (base64Data: string, filename: string) =>
    ipcRenderer.invoke('file:save-image', base64Data, filename),
  fileGetImageUrl: (imagePath: string) =>
    ipcRenderer.invoke('file:get-image-url', imagePath),
  fileSelectDocument: () => ipcRenderer.invoke('file:select-document'),
  documentSave: (args: {
    sourceFilePath: string;
    relativePath: string;
    customName?: string;
    entityType: string;
    entityId?: number;
    section?: string;
  }) => ipcRenderer.invoke('document:save', args),
  documentList: (entityType?: string, entityId?: number, section?: string) =>
    ipcRenderer.invoke('document:list', entityType, entityId, section),
  documentGetUrl: (relativePath: string) =>
    ipcRenderer.invoke('document:get-url', relativePath),
  documentOpenExternal: (relativePath: string) =>
    ipcRenderer.invoke('document:open-external', relativePath),
  documentDelete: (id: number) => ipcRenderer.invoke('document:delete', id),
  documentListExplorer: (folderPath: string) =>
    ipcRenderer.invoke('document:list-explorer', folderPath),
  documentListArchiveExplorer: (folderPath: string) =>
    ipcRenderer.invoke('document:list-archive-explorer', folderPath),
  documentCreateFolder: (folderName: string, parentPath?: string) =>
    ipcRenderer.invoke('document:create-folder', folderName, parentPath),
  documentDeleteFolder: (folderPath: string) =>
    ipcRenderer.invoke('document:delete-folder', folderPath),

  // ---- أصحاب العمل ----
  employerList: (filter?: { status?: string; search?: string }) =>
    ipcRenderer.invoke('employer:list', filter),
  employerGet: (id: number) => ipcRenderer.invoke('employer:get', id),
  employerSave: (data: Record<string, unknown>) => ipcRenderer.invoke('employer:save', data),
  employerArchive: (id: number) => ipcRenderer.invoke('employer:archive', id),
  employerRestore: (id: number) => ipcRenderer.invoke('employer:restore', id),
  employerDelete: (id: number) => ipcRenderer.invoke('employer:delete', id),
  employerLinkBranch: (data: { employerId: number; branchId: number; role: string; ownershipPercent?: number }) =>
    ipcRenderer.invoke('employer:link-branch', data),
  employerUnlinkBranch: (data: { employerId: number; branchId: number }) =>
    ipcRenderer.invoke('employer:unlink-branch', data),
  employerGetByBranch: (branchId: number) => ipcRenderer.invoke('employer:get-by-branch', branchId),

  // ---- Local Settings (device-specific, NOT synced to remote DB) ----
  localSettingsGet: (key: string) =>
    ipcRenderer.invoke('localSettings:get', key) as Promise<{ success: boolean; value?: string }>,
  localSettingsGetAll: () =>
    ipcRenderer.invoke('localSettings:getAll') as Promise<{ success: boolean; data: Record<string, string> }>,
  localSettingsSet: (entries: Record<string, string>) =>
    ipcRenderer.invoke('localSettings:setAll', entries) as Promise<{ success: boolean; error?: string }>,
});
