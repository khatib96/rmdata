import type {
  DocumentExplorerFile as SharedDocumentExplorerFile,
  DocumentExplorerFolder as SharedDocumentExplorerFolder,
  DocumentListItem as SharedDocumentListItem,
} from './documents';

export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface QueryResult<T = unknown> extends IpcResult<T> {
  lastInsertId?: number;
}

export type DocumentListItem = SharedDocumentListItem;

export type ExplorerFolder = SharedDocumentExplorerFolder;

export type ExplorerFile = SharedDocumentExplorerFile;

export interface AuthLoginResult {
  success: boolean;
  user?: {
    id: number;
    remoteUserId?: number;
    username: string;
    fullName: string;
    email: string;
    roleId: number;
    roleName: string;
    userType: 'free' | 'linked';
    linkedEntityType?: 'employee' | 'employer';
    linkedEntityId?: number;
    linkedEntityName?: string;
    linkedEntityImagePath?: string;
    linkedBranchName?: string;
    linkedProfession?: string;
    mustChangePassword: boolean;
    isDevAccount?: boolean;
  };
  error?: string;
  /** Present when error === 'TOO_MANY_ATTEMPTS' */
  remainingSec?: number;
  sessionToken?: string;
}

export interface DatabaseConnectionConfig {
  mode: 'local' | 'remote';
  apiBaseUrl?: string;
  apiUsername?: string;
  apiPassword?: string;
  /** Present when main process has a valid API token for remote mode */
  authenticated?: boolean;
}

export type UpdateStatus =
  | { stage: 'checking' }
  | { stage: 'available'; version: string; notes?: string }
  | { stage: 'none' }
  | { stage: 'downloading'; percent: number; transferred: number; total: number }
  | { stage: 'downloaded'; version: string }
  | { stage: 'error'; message: string };

export type ArchiveRestoreResource =
  | 'employees'
  | 'branches'
  | 'vehicles'
  | 'housing'
  | 'phones'
  | 'entities'
  | 'employers';

export interface TaxPaymentWrite {
  entityId: number;
  type: 'vat' | 'corporate';
  financialYear: number;
  quarter?: number | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  amount: number;
  paymentDate: string;
}

export interface EmployeeStatusUpdatePayload {
  employeeUpdate: {
    status: string;
    workBranchId?: number | null;
    profession?: string | null;
    professionKeys?: string | null;
    professionCustomTitle?: string | null;
    actualSalary?: number | null;
    loanType?: string | null;
    loanBranchId?: number | null;
    loanProfession?: string | null;
    loanSubStatus?: string | null;
    loanExpiryDate?: string | null;
    tempContractNumber?: string | null;
    loanSalary?: number | null;
    targetEntityName?: string | null;
    loanLeaveStartDate?: string | null;
    loanLeaveEndDate?: string | null;
  };
  statusChanged?: boolean;
  previousStatus?: string | null;
  effectiveDate?: string | null;
  dateCorrection?: {
    mainDateChanged?: boolean;
    actionDate?: string | null;
  } | null;
  performedByUserId?: number | null;
  performedByUsername?: string | null;
}

export interface ElectronAPI {
  /** Phase 0: verify IPC/preload is available */
  ping?: () => Promise<string>;
  getAppVersion?: () => Promise<string>;
  getDatabaseConnection?: () => Promise<DatabaseConnectionConfig>;
  setDatabaseConnection?: (config: DatabaseConnectionConfig) => Promise<{ success: boolean; authenticated?: boolean }>;
  testApiConnection?: (apiBaseUrl: string, username?: string, password?: string) => Promise<{ success: boolean; ok?: boolean; database?: boolean; error?: string }>;
  checkForUpdates?: () => Promise<{ success: boolean; hasUpdate?: boolean; error?: string }>;
  downloadUpdate?: () => Promise<{ success: boolean; error?: string }>;
  quitAndInstallUpdate?: () => Promise<{ success: boolean; error?: string }>;
  getAutoUpdateCheckEnabled?: () => Promise<{ success: boolean; enabled?: boolean; error?: string }>;
  setAutoUpdateCheckEnabled?: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void;
  dbQuery: (query: string, params?: any[]) => Promise<QueryResult<any>>;
  /** يملأ جدول permissions من الكتالوج (محلي أو بعيد) */
  syncPermissionCatalog?: () => Promise<{ success: boolean; error?: string }>;
  permissionsGetUserPermissions?: (
    sessionToken: string | null | undefined,
    userId: number,
  ) => Promise<{ success: boolean; data?: { permissionId: number }[]; error?: string }>;
  permissionsSetUserPermissions?: (
    sessionToken: string | null | undefined,
    userId: number,
    permissionIds: number[],
  ) => Promise<{ success: boolean; data?: { permissionIds: number[] }; error?: string }>;
  archiveRestore?: (
    sessionToken: string | null | undefined,
    resource: ArchiveRestoreResource,
    id: number,
  ) => Promise<{ success: boolean; data?: { entityType: string }; error?: string }>;
  archiveRecord?: (
    sessionToken: string | null | undefined,
    resource: ArchiveRestoreResource,
    id: number,
  ) => Promise<{ success: boolean; data?: { entityType: string }; error?: string }>;
  archiveDeletePermanent?: (
    sessionToken: string | null | undefined,
    resource: ArchiveRestoreResource,
    id: number,
  ) => Promise<{ success: boolean; data?: { entityType: string }; error?: string }>;
  taxPaymentCreate?: (
    sessionToken: string | null | undefined,
    payment: TaxPaymentWrite,
  ) => Promise<{ success: boolean; id?: number; error?: string }>;
  taxPaymentDelete?: (
    sessionToken: string | null | undefined,
    id: number,
  ) => Promise<{ success: boolean; error?: string }>;
  taxEntityBranchesReplace?: (
    sessionToken: string | null | undefined,
    entityId: number,
    branchIds: number[],
  ) => Promise<{ success: boolean; data?: { entityId: number; branchIds: number[] }; error?: string }>;
  employeeStatusUpdate?: (
    sessionToken: string | null | undefined,
    employeeId: number,
    payload: EmployeeStatusUpdatePayload,
  ) => Promise<{ success: boolean; error?: string }>;
  authLogin?: (username: string, password: string) => Promise<AuthLoginResult>;
  devicePing?: (
    token: string,
    gpsCoords: string | null,
    locationCity?: string | null
  ) => Promise<{ forceLogout: boolean; error?: string }>;
  deviceLogout?: (token: string) => Promise<{ success: boolean; error?: string }>;
  getWindowsLocation?: () => Promise<{ success: boolean; lat?: number; lng?: number; error?: string }>;
  checkNeedsSetup?: () => Promise<{ needsSetup: boolean; error?: string }>;
  firstRunSetup?: (adminPassword: string) => Promise<{ success: boolean; error?: string }>;
  authEmergencyReset?: () => Promise<{ success: boolean; password?: string; username?: string; error?: string }>;
  authCreateUser?: (
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
  ) => Promise<{ success: boolean; error?: string }>;
  authSetPassword?: (
    sessionToken: string | null | undefined,
    userId: number,
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  authUpdateUser?: (
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
  ) => Promise<{ success: boolean; error?: string }>;
  authDeleteUser?: (sessionToken: string | null | undefined, userId: number) => Promise<{ success: boolean; error?: string }>;
  authSetUserActive?: (
    sessionToken: string | null | undefined,
    userId: number,
    isActive: number,
  ) => Promise<{ success: boolean; error?: string }>;
  authSearchLinkableEntities?: (query: string) => Promise<{ employees: { type: 'employee'; id: number; code: string; name: string; imagePath?: string; branchName?: string; profession?: string }[]; employers: { type: 'employer'; id: number; code: string; name: string; imagePath?: string }[] }>;
  authChangeOwnPassword?: (userId: number, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  authRefreshLinkedImage?: (userId: number) => Promise<{ success: boolean; linkedEntityImagePath?: string | null; error?: string }>;
  backupCreate?: (options?: { toDedicatedFolder?: boolean; includeDocuments?: boolean }) => Promise<{ success: boolean; canceled?: boolean; path?: string; name?: string; isFull?: boolean; error?: string }>;
  backupList?: () => Promise<{ success: boolean; data: { name: string; path: string; size: number; createdAt: string; isFull: boolean }[] }>;
  backupDelete?: (name: string) => Promise<{ success: boolean; error?: string }>;
  backupRestoreFromPath?: (backupPath: string) => Promise<{ success: boolean; error?: string }>;
  backupRestore?: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
  fileSelectImage: () => Promise<{ 
    success: boolean; 
    base64Data?: string; 
    filename?: string;
    canceled?: boolean;
    error?: string 
  }>;
  fileSaveImage: (base64Data: string, filename: string) => Promise<{ 
    success: boolean; 
    path?: string;
    relativePath?: string;
    fullPath?: string;
    error?: string 
  }>;
  fileGetImageUrl: (imagePath: string) => Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }>;
  fileSelectDocument: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  documentSave: (args: {
    sourceFilePath: string;
    relativePath: string;
    customName?: string;
    entityType: string;
    entityId?: number;
    section?: string;
  }) => Promise<{ success: boolean; id?: number; error?: string }>;
  documentList: (entityType?: string, entityId?: number, section?: string) => Promise<IpcResult<DocumentListItem[]>>;
  documentGetUrl: (relativePath: string) => Promise<{
    success: boolean;
    url?: string | null;
    canPreview?: boolean;
    fullPath?: string;
    error?: string;
  }>;
  documentOpenExternal: (relativePath: string) => Promise<{ success: boolean; error?: string }>;
  documentDelete: (id: number) => Promise<{ success: boolean; error?: string }>;
  documentListExplorer: (folderPath: string) => Promise<IpcResult<never> & {
    folders?: ExplorerFolder[];
    files?: ExplorerFile[];
  }>;
  documentListArchiveExplorer: (folderPath: string) => Promise<IpcResult<never> & {
    folders?: ExplorerFolder[];
    files?: ExplorerFile[];
  }>;
  documentCreateFolder: (folderName: string, parentPath?: string) => Promise<{ success: boolean; error?: string }>;
  documentDeleteFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  notificationsLoad?: () => Promise<{ success: boolean; data?: any[] }>;
  notificationsEnsureLeaseReminders?: () => Promise<{ success: boolean }>;
  notificationsEnsureAllExpiryReminders?: () => Promise<{ success: boolean }>;
  notificationsMarkRead?: (id: number) => Promise<{ success: boolean }>;
  notificationsMarkAllRead?: () => Promise<{ success: boolean }>;
  notificationsDelete?: (id: number) => Promise<{ success: boolean }>;
  notificationsArchive?: (id: number) => Promise<{ success: boolean }>;
  /** Subscribe to new alerts (from background check). Returns unsubscribe. */
  onNotificationNewAlerts?: (callback: (count: number) => void) => () => void;
  // ---- أصحاب العمل ----
  employerList?: (filter?: { status?: string; search?: string }) => Promise<any[]>;
  employerGet?: (id: number) => Promise<any>;
  employerSave?: (data: Record<string, unknown>) => Promise<{ success: boolean; id?: number; error?: string }>;
  employerArchive?: (id: number) => Promise<{ success: boolean; error?: string }>;
  employerRestore?: (id: number) => Promise<{ success: boolean; error?: string }>;
  employerDelete?: (id: number) => Promise<{ success: boolean; error?: string }>;
  employerLinkBranch?: (data: { employerId: number; branchId: number; role: string; ownershipPercent?: number }) => Promise<{ success: boolean; error?: string }>;
  employerUnlinkBranch?: (data: { employerId: number; branchId: number; role?: string }) => Promise<{ success: boolean; error?: string }>;
  employerGetByBranch?: (branchId: number) => Promise<any[]>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
