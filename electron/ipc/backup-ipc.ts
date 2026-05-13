import { app, ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { initializeDatabase, closeDatabase } from '../../src/database/data-source';
import { runMigrations } from '../database/migrations';
import { isPathInsideDirectory } from '../path-security';
import { sharedState } from '../shared-state';

function getBackupsDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}

function ensureBackupsDir(): string {
  const dir = getBackupsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) size += getDirSize(full);
      else size += fs.statSync(full).size;
    }
  } catch { /* ignore */ }
  return size;
}

function restoreDbFromPath(sourcePath: string): boolean {
  const dbPath = process.env.ELECTRON_DB_PATH;
  if (!dbPath) return false;
  fs.copyFileSync(sourcePath, dbPath);
  return true;
}

export function registerBackupHandlers() {
  ipcMain.handle('backup:create', async (_event, options?: { toDedicatedFolder?: boolean; includeDocuments?: boolean }) => {
    const dbPath = process.env.ELECTRON_DB_PATH;
    if (!dbPath || !fs.existsSync(dbPath)) return { success: false, error: 'DB_NOT_FOUND' };
    
    const toDedicated = options?.toDedicatedFolder === true;
    const includeDocs = options?.includeDocuments === true && toDedicated;

    if (toDedicated) {
      const backupsDir = ensureBackupsDir();
      const dateStr = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
      try {
        if (includeDocs) {
          const folderName = `backup_full_${dateStr}`;
          const backupFolder = path.join(backupsDir, folderName);
          fs.mkdirSync(backupFolder, { recursive: true });
          const dbDest = path.join(backupFolder, 'backup.db');
          fs.copyFileSync(dbPath, dbDest);
          const docsSrc = path.join(app.getPath('userData'), 'documents');
          const docsDest = path.join(backupFolder, 'documents');
          if (fs.existsSync(docsSrc)) copyDirRecursive(docsSrc, docsDest);
          return { success: true, path: backupFolder, name: folderName, isFull: true };
        } else {
          const fileName = `backup_${dateStr}.db`;
          const destPath = path.join(backupsDir, fileName);
          fs.copyFileSync(dbPath, destPath);
          return { success: true, path: destPath, name: fileName, isFull: false };
        }
      } catch (err) {
        console.error('Backup to dedicated folder error:', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    const win = BrowserWindow.getFocusedWindow() || sharedState.mainWindow;
    const defaultName = `backup_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.db`;
    const opts = { title: 'حفظ نسخة احتياطية', defaultPath: path.join(getBackupsDir(), defaultName), filters: [{ name: 'SQLite Database', extensions: ['db'] }] };
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    
    try {
      fs.copyFileSync(dbPath, result.filePath);
      return { success: true, path: result.filePath };
    } catch (err) {
      console.error('Backup copy error:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('backup:list', async () => {
    const backupsDir = getBackupsDir();
    if (!fs.existsSync(backupsDir)) return { success: true, data: [] };
    const entries: { name: string; path: string; size: number; createdAt: string; isFull: boolean }[] = [];
    for (const name of fs.readdirSync(backupsDir)) {
      const fullPath = path.join(backupsDir, name);
      try {
        const stat = fs.statSync(fullPath);
        const isFull = stat.isDirectory();
        const size = isFull ? getDirSize(fullPath) : stat.size;
        entries.push({ name, path: fullPath, size, createdAt: stat.mtime.toISOString(), isFull });
      } catch { /* skip */ }
    }
    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { success: true, data: entries };
  });

  ipcMain.handle('backup:delete', async (_event, name: string) => {
    const backupsDir = path.resolve(getBackupsDir());
    const fullPath = path.resolve(path.join(backupsDir, name));
    if (!isPathInsideDirectory(backupsDir, fullPath) || !fs.existsSync(fullPath)) return { success: false, error: 'NOT_FOUND' };
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) fs.rmSync(fullPath, { recursive: true });
      else fs.unlinkSync(fullPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('backup:restoreFromPath', async (_event, backupPath: string) => {
    const backupsDir = path.resolve(getBackupsDir());
    const resolved = path.resolve(backupPath);
    if (!isPathInsideDirectory(backupsDir, resolved) || !fs.existsSync(resolved)) return { success: false, error: 'INVALID_PATH' };
    try {
      await closeDatabase();
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const dbSrc = path.join(resolved, 'backup.db');
        if (!fs.existsSync(dbSrc)) {
          await initializeDatabase();
          return { success: false, error: 'BACKUP_DB_NOT_FOUND' };
        }
        restoreDbFromPath(dbSrc);
        const docsSrc = path.join(resolved, 'documents');
        const docsDest = path.join(app.getPath('userData'), 'documents');
        if (fs.existsSync(docsSrc)) {
          if (fs.existsSync(docsDest)) fs.rmSync(docsDest, { recursive: true });
          copyDirRecursive(docsSrc, docsDest);
        }
      } else {
        restoreDbFromPath(resolved);
      }
      await initializeDatabase();
      await runMigrations();
      return { success: true };
    } catch (err) {
      try { await initializeDatabase(); } catch { /* ignore */ }
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('backup:restore', async () => {
    const dbPath = process.env.ELECTRON_DB_PATH;
    if (!dbPath) return { success: false, error: 'DB_NOT_FOUND' };
    const win = BrowserWindow.getFocusedWindow() || sharedState.mainWindow;
    const opts = {
      title: 'استعادة نسخة احتياطية',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile' as 'openFile'],
    };
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
    
    const sourcePath = result.filePaths[0];
    try {
      await closeDatabase();
      fs.copyFileSync(sourcePath, dbPath);
      await initializeDatabase();
      await runMigrations();
      return { success: true };
    } catch (err) {
      try { await initializeDatabase(); } catch { /* ignore */ }
      console.error('Backup restore error:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  console.log("Backup IPC loaded");
}
