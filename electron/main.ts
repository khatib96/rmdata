import './set-geolocation-flags';
import './set-db-path';
import { app, BrowserWindow, protocol, Notification, Tray, nativeImage, Menu, screen, ipcMain, session } from 'electron';
import { warmUpMacOSLocation } from './device-location';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { autoUpdater } from 'electron-updater';
import { initializeDatabase, closeDatabase, AppDataSource } from '../src/database/data-source';
import { runMigrations } from './database/migrations';
import { registerNotificationHandlers, runCheckAndGetUnreadCount, isDesktopNotificationsEnabled, CHECK_INTERVAL_MS } from './ipc/notifications-ipc';
import { isPathInsideDirectory } from './path-security';
import { setDbQueryInternalImpl, DbQueryInternalResult } from './db-query-internal';
import { validateInsertSql } from '../src/utils/sqlInsertValidator';
import { assertDbQueryAllowed, inspectDbQuery } from './sql-query-guard';

// Extracted Modules
import { sharedState, setMainWindow, setSplashWindow, setTray, setLastUnreadCount, setUpdateDownloaded, setCurrentSessionToken } from './shared-state';
import { getDbConnectionConfig, executeRemoteDbQueryOnce, getRemoteApiBaseUrl, remoteApiJson } from './remote-api-utils';
import { runDbQueryInternal } from './db-query-internal';
import { getLocalSetting, setLocalSetting } from './local-settings-store';

// Handlers
import { registerAuthHandlers } from './ipc/auth-ipc';
import { registerBackupHandlers } from './ipc/backup-ipc';
import { registerEmployerHandlers } from './ipc/employer-ipc';
import { registerFileHandlers } from './ipc/file-ipc';
import { registerDocumentHandlers } from './ipc/document-ipc';
import { registerSettingsHandlers } from './ipc/settings-ipc';

const APP_DISPLAY_NAME = 'RMDATA';
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
function updaterPlatformSlug(): string {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'win';
  return 'linux';
}

const DEFAULT_UPDATER_URL = `https://api.rmdata.tech/updates/${updaterPlatformSlug()}`;
const AUTO_UPDATE_CHECK_KEY = 'autoUpdateCheckEnabled';

function sendUpdateStatus(status: any) {
  sharedState.mainWindow?.webContents?.send('app:update-status', status);
}

function lastNotifiedUpdateVersionPath() {
  return path.join(app.getPath('userData'), 'last-notified-update-version.txt');
}

function readLastNotifiedUpdateVersion(): string {
  try {
    const p = lastNotifiedUpdateVersionPath();
    if (!fs.existsSync(p)) return '';
    return fs.readFileSync(p, 'utf8').trim();
  } catch { return ''; }
}

function writeLastNotifiedUpdateVersion(v: string) {
  try { fs.writeFileSync(lastNotifiedUpdateVersionPath(), v, 'utf8'); } catch (e) { console.warn('write:', e); }
}

function setupAutoUpdater() {
  if (sharedState.isDev) return;
  const remoteBase = getRemoteApiBaseUrl();
  const updaterUrl = remoteBase
    ? `${remoteBase.replace(/\/+$/, '')}/updates/${updaterPlatformSlug()}`
    : DEFAULT_UPDATER_URL;
  autoUpdater.setFeedURL({ provider: 'generic', url: updaterUrl });
  autoUpdater.channel = 'latest';
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.requestHeaders = { 'Cache-Control': 'no-cache', Pragma: 'no-cache' };
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  console.log('[updater] feed url:', updaterUrl);

  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ stage: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    const notes = Array.isArray(info.releaseNotes) ? info.releaseNotes.map(n => typeof n === 'string' ? n : String((n as any).note || '')).join('\\n') : typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined;
    sendUpdateStatus({ stage: 'available', version: info.version, notes });

    void (async () => {
      const remoteV = info.version;
      if (!remoteV || readLastNotifiedUpdateVersion() === remoteV) return;
      const showDesktop = await isDesktopNotificationsEnabled();
      if (!showDesktop || !Notification.isSupported()) return;
      writeLastNotifiedUpdateVersion(remoteV);
      const n = new Notification({
        title: `${APP_DISPLAY_NAME} — تحديث جديد`,
        body: `يتوفر الإصدار ${remoteV}. يمكنك التحميل من الإعدادات (حول النظام).`,
      });
      n.on('click', () => { sharedState.mainWindow?.show(); sharedState.mainWindow?.focus(); });
      n.show();
    })();
  });
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ stage: 'none' }));
  autoUpdater.on('download-progress', (progress) => sendUpdateStatus({ stage: 'downloading', percent: progress.percent, transferred: progress.transferred, total: progress.total }));
  autoUpdater.on('update-downloaded', (info) => {
    setUpdateDownloaded(true);
    sendUpdateStatus({ stage: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', (err) => sendUpdateStatus({ stage: 'error', message: err?.message || String(err) }));
}

function isAutoUpdateCheckEnabled(): boolean {
  return (getLocalSetting(AUTO_UPDATE_CHECK_KEY) ?? '1') !== '0';
}

protocol.registerSchemesAsPrivileged([{ scheme: 'local-file', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } }]);

function setupGeolocationPermissions() {
  const allow = (permission: string) =>
    permission === 'geolocation' || permission === 'notifications' || permission === 'media';

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'geolocation') console.log('[location] permission requested — granting');
    callback(allow(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allow(permission));
}

function createSplashWindow() {
  const win = new BrowserWindow({
    width: 600, height: 600, transparent: true, frame: false, alwaysOnTop: true, resizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const splashPath = sharedState.isDev ? path.join(__dirname, '../../public/splash.html') : path.join(__dirname, '../../dist/splash.html');
  win.loadFile(splashPath).catch(err => console.error('Failed to load splash', err));
  win.on('closed', () => setSplashWindow(null));
  setSplashWindow(win);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1200, minHeight: 800, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, webviewTag: true, plugins: true, webSecurity: true },
    titleBarStyle: 'default', backgroundColor: '#F6F5F3',
  });
  win.webContents.once('did-finish-load', () => {
    void warmUpMacOSLocation();
  });
  win.once('ready-to-show', () => {
    if (sharedState.splashWindow) sharedState.splashWindow.close();
    win.show();
  });
  if (sharedState.isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
  win.on('closed', () => setMainWindow(null));
  setMainWindow(win);
}

// Set up DbQueryInternalImpl
setDbQueryInternalImpl(async (query: string, params?: unknown[]): Promise<DbQueryInternalResult> => {
  try {
    assertDbQueryAllowed(query);
    validateInsertSql(query, params);
    const inspected = inspectDbQuery(query);
    if (inspected.isMutation) {
      console.warn(`[legacy-db-query] internal mutation: ${inspected.operation} ${inspected.table || 'unknown'}`);
    }
    const conf = getDbConnectionConfig();
    if (conf.mode === 'remote') {
      const res = await executeRemoteDbQueryOnce(query, params);
      return res;
    }
    if (!AppDataSource.isInitialized) await initializeDatabase();
    const qr = AppDataSource.createQueryRunner();
    const data = await qr.query(query, params);
    await qr.release();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

app.whenReady().then(async () => {
  app.setName(APP_DISPLAY_NAME);
  app.setAppUserModelId('RMDATA.System');
  setupGeolocationPermissions();
  setupAutoUpdater();

  protocol.handle('local-file', async (request) => {
    try {
      const urlText = request.url.replace('local-file:', 'file:'); 
      const filePath = fileURLToPath(decodeURIComponent(urlText));
      const userDataRoot = app.getPath('userData');
      if (!isPathInsideDirectory(userDataRoot, filePath)) return new Response('Forbidden', { status: 403 });
      if (!fs.existsSync(filePath)) return new Response('File not found', { status: 404 });
      const stats = fs.statSync(filePath);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.html': 'text/html' };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      return new Response(buffer, { headers: { 'Content-Type': mimeType, 'Content-Length': stats.size.toString(), 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' } });
    } catch (e) {
      return new Response(`Error loading file: ${e}`, { status: 500 });
    }
  });

  createSplashWindow();

  try {
    await initializeDatabase();
    await runMigrations();
    try {
      if (AppDataSource.isInitialized) {
        const qr = AppDataSource.createQueryRunner();
        await qr.query('SELECT 1 FROM settings LIMIT 1');
        await qr.release();
      }
    } catch (settingsErr) {
      console.warn('Settings table check failed:', settingsErr);
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  // Register Extracted IPC Handlers
  registerAuthHandlers();
  registerBackupHandlers();
  registerEmployerHandlers();
  registerFileHandlers();
  registerDocumentHandlers();
  registerSettingsHandlers();
  registerNotificationHandlers();

  createWindow();

  function runUpdateCheck(options?: { silent?: boolean }) {
    if (sharedState.isDev) return;
    if (!isAutoUpdateCheckEnabled()) return;
    autoUpdater.checkForUpdates().catch((err) => {
      if (!options?.silent) sendUpdateStatus({ stage: 'error', message: err instanceof Error ? err.message : String(err) });
    });
  }
  setTimeout(() => runUpdateCheck({ silent: false }), 5000);
  setInterval(() => runUpdateCheck({ silent: true }), UPDATE_CHECK_INTERVAL_MS);

  async function runTerminatedArchiveScheduler() {
    try {
      if (!AppDataSource.isInitialized) return;
      const qr = AppDataSource.createQueryRunner();
      const rows = await qr.query(
        `SELECT e.id, e.name, e.code FROM employees e
         INNER JOIN status_history sh ON sh.entityType = 'employee' AND sh.entityId = e.id AND sh.status = 'terminated' AND sh.endDate IS NULL
         WHERE e.status = 'terminated' AND date(sh.startDate) <= date('now', '-7 days')`
      );
      for (const row of rows || []) {
        const r = row as { id: number; name?: string; code?: string };
        await qr.query('UPDATE employees SET status = ? WHERE id = ?', ['archived', r.id]);
        const label = r.name || r.code || `موظف ${r.id}`;
        await qr.query(
          `INSERT INTO activity_logs (module, action, entityType, entityId, details, performedByUserId, performedByUsername, performedByUserCode)
           VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)`,
          ['archive', 'archive', 'employee', r.id, `autoArchived::employee::${label}`, 'النظام']
        );
      }
      await qr.release();
    } catch (e) { console.warn('Terminated archive scheduler:', e); }
  }
  runTerminatedArchiveScheduler();
  setInterval(runTerminatedArchiveScheduler, 24 * 60 * 60 * 1000);

  async function runNotificationCheck() {
    try {
      const count = await runCheckAndGetUnreadCount();
      const increased = sharedState.lastUnreadCount >= 0 && count > sharedState.lastUnreadCount;
      if (increased) {
        const showDesktop = await isDesktopNotificationsEnabled();
        if (showDesktop && sharedState.mainWindow && !sharedState.mainWindow.isFocused?.()) {
          const n = new Notification({
            title: 'تنبيهات جديدة',
            body: count === 1 ? 'إشعار واحد غير مقروء' : `${count} إشعارات غير مقروءة`,
          });
          n.on('click', () => { sharedState.mainWindow?.show(); sharedState.mainWindow?.focus(); });
          n.show();
        }
        sharedState.mainWindow?.webContents?.send('notification:newAlerts', count);
      }
      setLastUnreadCount(count);
    } catch (e) { console.warn('notification check', e); }
  }
  setTimeout(() => runNotificationCheck(), 5000);
  setInterval(runNotificationCheck, CHECK_INTERVAL_MS);

  const AUTO_BACKUP_INTERVAL_MS = 60 * 60 * 1000;
  const lastAutoBackupFile = path.join(app.getPath('userData'), 'lastAutoBackup.json');
  async function runAutoBackupIfDue() {
    try {
      const enabled = getLocalSetting('autoBackupEnabled') ?? '0';
      if (enabled !== '1') return;
      let lastRun = 0;
      if (fs.existsSync(lastAutoBackupFile)) {
        const data = JSON.parse(fs.readFileSync(lastAutoBackupFile, 'utf8'));
        lastRun = data.lastRun ?? 0;
      }
      if (Date.now() - lastRun < 24 * 60 * 60 * 1000) return;
      const dbPath = process.env.ELECTRON_DB_PATH;
      if (!dbPath || !fs.existsSync(dbPath)) return;
      
      const backupsDir = path.join(app.getPath('userData'), 'backups');
      if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
      const dateStr = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
      const fileName = `backup_auto_${dateStr}.db`;
      const destPath = path.join(backupsDir, fileName);
      fs.copyFileSync(dbPath, destPath);
      fs.writeFileSync(lastAutoBackupFile, JSON.stringify({ lastRun: Date.now() }), 'utf8');
      console.log('Auto-backup created:', fileName);
    } catch (e) { console.warn('Auto-backup check:', e); }
  }
  setTimeout(() => runAutoBackupIfDue(), 60000);
  setInterval(runAutoBackupIfDue, AUTO_BACKUP_INTERVAL_MS);

  const trayIconPath = path.join(__dirname, '../../public/icons/tray-icon.png');
  const trayIconRaw = fs.existsSync(trayIconPath) ? nativeImage.createFromPath(trayIconPath) : nativeImage.createEmpty();
  if (!trayIconRaw.isEmpty()) {
    const scaleFactor = Math.max(1, screen.getPrimaryDisplay().scaleFactor || 1);
    const traySize = Math.max(16, Math.round(16 * scaleFactor));
    const trayIcon = trayIconRaw.resize({ width: traySize, height: traySize, quality: 'best' });
    const trayInstance = new Tray(trayIcon);
    trayInstance.setToolTip(APP_DISPLAY_NAME);
    trayInstance.on('click', () => { sharedState.mainWindow?.show(); sharedState.mainWindow?.focus(); });
    trayInstance.setContextMenu(Menu.buildFromTemplate([
      { label: 'فتح', type: 'normal', click: () => { sharedState.mainWindow?.show(); sharedState.mainWindow?.focus(); } },
      { type: 'separator' },
      { label: 'خروج', type: 'normal', click: () => app.quit() },
    ]));
    setTray(trayInstance);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', async () => {
  if (sharedState.currentSessionToken) {
    try { await runDbQueryInternal('DELETE FROM connected_devices WHERE token = ?', [sharedState.currentSessionToken]); } catch (e) { console.warn('cleanup device session', e); }
    setCurrentSessionToken(null);
  }
});

app.on('window-all-closed', async () => {
  try { await closeDatabase(); } catch (error) { console.error('Failed to close DB:', error); }
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:get-platform', () => process.platform);
ipcMain.handle('app:check-update', () => { if (!sharedState.isDev) autoUpdater.checkForUpdates(); });
ipcMain.handle('app:download-update', () => { if (!sharedState.isDev) autoUpdater.downloadUpdate(); });
ipcMain.handle('app:quit-and-install', () => { if (!sharedState.isDev && sharedState.updateDownloaded) autoUpdater.quitAndInstall(); });
// Backward-compatible channels used by preload/renderer.
ipcMain.handle('app:update/check', () => { if (!sharedState.isDev) autoUpdater.checkForUpdates(); });
ipcMain.handle('app:update/download', () => { if (!sharedState.isDev) autoUpdater.downloadUpdate(); });
ipcMain.handle('app:update/quit-and-install', () => { if (!sharedState.isDev && sharedState.updateDownloaded) autoUpdater.quitAndInstall(); });
ipcMain.handle('app:update/get-auto-check', () => ({ success: true, enabled: isAutoUpdateCheckEnabled() }));
ipcMain.handle('app:update/set-auto-check', (_event, enabled: boolean) => {
  setLocalSetting(AUTO_UPDATE_CHECK_KEY, enabled ? '1' : '0');
  return { success: true };
});
