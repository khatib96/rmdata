/**
 * Set the database path BEFORE data-source is loaded.
 * Use userData in both dev and production so data persists when closing/reopening.
 * Migrate from old project database if it exists and userData db is new.
 * Must be imported first in main.ts.
 */
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const userDataPath = app.getPath('userData');
const newDbPath = path.join(userDataPath, 'uniform_base.db');
const appPath = app.getAppPath();
const isDev = process.env.NODE_ENV === 'development';
// مسارات قديمة محتملة (قبل التعديل كانت القاعدة في dist-electron أو project/database)
const legacyPaths = [
  path.join(app.getPath('appData'), 'alredaa-erp-system', 'uniform_base.db'), // Original app data
  path.join(app.getPath('appData'), 'RMDATA.System', 'uniform_base.db'), // Interim app data when renaming
  // On packaged builds we intentionally do NOT copy the bundled DB from appPath.
  // Otherwise "users" table may already exist (from the bundled file) and our
  // first-run admin bootstrap + initial-admin-password.txt won't be created.
  ...(isDev
    ? [
        path.join(appPath, 'dist-electron', 'database', 'uniform_base.db'),
        path.join(appPath, 'database', 'uniform_base.db'),
      ]
    : []),
];

// استعادة البيانات من قاعدة قديمة فقط عندما userData فاضية أو غير موجودة
try {
  const newExists = fs.existsSync(newDbPath);
  const newSize = newExists ? fs.statSync(newDbPath).size : 0;
  const userDataEmpty = !newExists || newSize < 1024;

  if (userDataEmpty) {
    let bestLegacy: { path: string; size: number } | null = null;
    for (const lp of legacyPaths) {
      if (fs.existsSync(lp)) {
        const sz = fs.statSync(lp).size;
        if (sz > 1024 && (!bestLegacy || sz > bestLegacy.size)) bestLegacy = { path: lp, size: sz };
      }
    }
    if (bestLegacy) {
      fs.mkdirSync(path.dirname(newDbPath), { recursive: true });
      fs.copyFileSync(bestLegacy.path, newDbPath);
      console.log('✅ تم استعادة البيانات من', bestLegacy.path);
    }
  }
} catch (e) {
  console.warn('Migration copy:', e);
}

process.env.ELECTRON_DB_PATH = newDbPath;
