import { app, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { initializeDatabase, AppDataSource } from '../../src/database/data-source';
import { isRemoteFilesMode, uploadRemoteFile, executeRemoteDbQueryOnce, buildRemoteFileOpenUrl, remoteApiJson, isPreviewableDocumentPath } from '../remote-api-utils';
import { resolveSafePathUnderRoot } from '../path-security';

function createRemoteAwareExplorerQr() {
  if (isRemoteFilesMode()) {
    return {
      query: async (q: string, p?: unknown[]) => {
        const res = await executeRemoteDbQueryOnce(q, p);
        if (!res.success) throw new Error(res.error || 'REMOTE_QUERY_FAILED');
        return res.data;
      },
      release: async () => {},
    } as any;
  }
  return AppDataSource.createQueryRunner();
}

function getDocumentsRoot(): string {
  const root = path.join(app.getPath('userData'), 'documents');
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

type ExplorerFolderItem = { type: 'folder'; name: string; label: string; isDeletable?: boolean };
type ExplorerFileRow = { id: number; relativePath: string; customName?: string | null; createdAt: string };
type ExplorerFileItem = { id: number; name: string; relativePath: string; createdAt: string };
type ExplorerResult = { success: boolean; folders: ExplorerFolderItem[]; files: ExplorerFileItem[] };
type ExplorerHandler = (qr: any, parts: string[], folderPath: string) => Promise<ExplorerResult>;

const DOCUMENT_ROOT_LABELS: Record<string, string> = { Branches: 'الأفرع', Employees: 'الموظفين', Employers: 'أصحاب العمل', Housing: 'السكن', Phones: 'الهواتف', Vehicles: 'المركبات', Taxes: 'الضرائب' };
const TAX_SECTION_FOLDERS: ExplorerFolderItem[] = [{ type: 'folder', name: 'vat_cert', label: 'شهادة ضريبة القيمة المضافة' }, { type: 'folder', name: 'corporate_tax_cert', label: 'شهادة ضريبة الشركات' }, { type: 'folder', name: 'payments', label: 'وصلات وفواتير الضرائب' }];
const VEHICLE_SECTION_FOLDERS: ExplorerFolderItem[] = [{ type: 'folder', name: 'license', label: 'رخصة المركبة' }, { type: 'folder', name: 'insurance', label: 'التأمين' }, { type: 'folder', name: 'permits', label: 'الموافقات الإضافية' }, { type: 'folder', name: 'other', label: 'أخرى' }];

function normalizeVehicleSection(section: unknown): 'license' | 'insurance' | 'permits' | 'other' {
  const raw = String(section || '').trim().toLowerCase();
  if (!raw || raw === 'general' || raw === 'other') return 'other';
  if (['license', 'mulkiya', 'ownership', 'ownership_type', 'license_expiry'].includes(raw)) return 'license';
  if (raw.startsWith('insurance')) return 'insurance';
  if (['permits', 'permit'].includes(raw)) return 'permits';
  if (/^\d+$/.test(raw) || raw.startsWith('section_')) return 'permits';
  return 'other';
}

function mapExplorerFolder(name: string, label: string, isDeletable = false): ExplorerFolderItem { return isDeletable ? { type: 'folder', name, label, isDeletable: true } : { type: 'folder', name, label }; }
function intIdsForInClause(ids: unknown[]): number[] { return (ids || []).filter((id): id is number => typeof id === 'number' && Number.isInteger(id)); }
function mapExplorerFile(row: ExplorerFileRow): ExplorerFileItem { return { id: row.id, name: row.customName || path.basename(row.relativePath), relativePath: row.relativePath, createdAt: row.createdAt }; }
function mapExplorerFiles(rows: ExplorerFileRow[] | undefined | null): ExplorerFileItem[] { return (rows || []).map((row) => mapExplorerFile(row)); }
function mapDirectoryEntriesToFolders(entries: fs.Dirent[], isDeletable = false): ExplorerFolderItem[] { return entries.filter((entry) => entry.isDirectory()).map((entry) => mapExplorerFolder(entry.name, entry.name, isDeletable)); }

export function registerDocumentHandlers() {
  ipcMain.handle('document:save', async (_event, args: { sourceFilePath: string; relativePath: string; customName?: string; entityType: string; entityId?: number; section?: string }) => {
    let fileCopiedTo = ''; let archivedOldFull = ''; let archivedFromOldFull = '';
    try {
      const { sourceFilePath, relativePath, customName, entityType, entityId, section } = args;
      if (!sourceFilePath || !fs.existsSync(sourceFilePath)) return { success: false, error: 'الملف المصدري غير موجود' };
      if (isRemoteFilesMode()) {
        const saved = await uploadRemoteFile({ kind: 'document', relativePath, fileName: path.basename(sourceFilePath), fileBuffer: fs.readFileSync(sourceFilePath), customName, entityType, entityId, section });
        if (!saved.success) return { success: false, error: saved.error || 'REMOTE_UPLOAD_FAILED' };
        return { success: true, id: saved.id };
      }
      const root = getDocumentsRoot();
      const safeDest = resolveSafePathUnderRoot(root, relativePath);
      if (!safeDest) return { success: false, error: 'مسار المستند غير صالح' };
      if (!AppDataSource.isInitialized) await initializeDatabase();
      let resultId: number | undefined;
      await AppDataSource.transaction(async (manager) => {
        const archiveDate = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
        const existing = await manager.query(`SELECT id, relativePath, customName FROM documents WHERE entityType = ? AND ( (? IS NULL AND entityId IS NULL) OR entityId = ? ) AND ( (? IS NULL AND section IS NULL) OR section = ? ) AND (isArchived = 0 OR isArchived IS NULL) ORDER BY id DESC LIMIT 1`, [entityType, entityId ?? null, entityId ?? null, section ?? null, section ?? null]).catch(() => []);
        let oldIdToArchive: number | null = null; let archivedRelative = ''; let archivedCustomName = '';
        if (existing && existing.length > 0) {
          const old = existing[0] as { id: number; relativePath: string; customName: string | null };
          const oldFullResolved = resolveSafePathUnderRoot(root, old.relativePath);
          if (oldFullResolved && fs.existsSync(oldFullResolved)) {
            const dirPart = path.dirname(old.relativePath);
            const base = path.basename(old.relativePath);
            const ext = path.extname(base);
            const archivedDir = resolveSafePathUnderRoot(root, normalizeFilePath(path.join('Archive', dirPart)));
            if (!archivedDir) throw new Error('مسار الأرشفة غير صالح');
            if (!fs.existsSync(archivedDir)) fs.mkdirSync(archivedDir, { recursive: true });
            archivedRelative = normalizeFilePath(path.join('Archive', dirPart, `Old_${path.basename(base, ext) || 'doc'}_${archiveDate}${ext}`));
            archivedOldFull = resolveSafePathUnderRoot(root, archivedRelative) || '';
            archivedFromOldFull = oldFullResolved;
            fs.renameSync(oldFullResolved, archivedOldFull);
            oldIdToArchive = old.id; archivedCustomName = (old.customName || base) + ' (مؤرشف)';
          }
        }
        if (!fs.existsSync(path.dirname(safeDest))) fs.mkdirSync(path.dirname(safeDest), { recursive: true });
        fs.copyFileSync(sourceFilePath, safeDest); fileCopiedTo = safeDest;
        if (oldIdToArchive !== null) await manager.query('UPDATE documents SET relativePath = ?, customName = ?, isArchived = 1 WHERE id = ?', [archivedRelative, archivedCustomName, oldIdToArchive]);
        await manager.query(`INSERT INTO documents (relativePath, customName, entityType, entityId, section, isArchived) VALUES (?,?,?,?,?, 0)`, [relativePath, customName || path.basename(relativePath), entityType, entityId ?? null, section ?? null]);
        const idRes = await manager.query('SELECT last_insert_rowid() as id');
        resultId = idRes?.[0]?.id;
      });
      return { success: true, id: resultId };
    } catch (e: unknown) {
      if (fileCopiedTo && fs.existsSync(fileCopiedTo)) fs.unlinkSync(fileCopiedTo);
      if (archivedOldFull && archivedFromOldFull && fs.existsSync(archivedOldFull)) fs.renameSync(archivedOldFull, archivedFromOldFull);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('document:list', async (_event, entityType?: string, entityId?: number, section?: string) => {
    try {
      if (isRemoteFilesMode()) {
        const q = new URLSearchParams();
        if (entityType) q.set('entityType', entityType);
        if (entityId != null) q.set('entityId', String(entityId));
        if (section != null && section !== '') q.set('section', section);
        const remote = await remoteApiJson<{ success: boolean; data?: unknown[]; error?: string }>(q.toString() ? '/api/files/list?' + q.toString() : '/api/files/list');
        return { success: remote.success !== false, data: remote.data || [] };
      }
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      let query = 'SELECT id, relativePath, customName, entityType, entityId, section, createdAt FROM documents WHERE (isArchived = 0 OR isArchived IS NULL)';
      const params: unknown[] = [];
      if (entityType) { query += ' AND entityType = ?'; params.push(entityType); }
      if (entityId != null) { query += ' AND entityId = ?'; params.push(entityId); }
      if (section != null && section !== '') { query += ' AND section = ?'; params.push(section); }
      query += ' ORDER BY createdAt DESC';
      const rows = await qr.query(query, params);
      await qr.release();
      return { success: true, data: rows || [] };
    } catch (e: unknown) { return { success: false, data: [] }; }
  });

  ipcMain.handle('document:get-url', async (_event, relativePath: string) => {
    try {
      if (isRemoteFilesMode()) {
        if (!isPreviewableDocumentPath(relativePath)) return { success: true, url: null, canPreview: false };
        return { success: true, url: buildRemoteFileOpenUrl('document', relativePath), canPreview: true };
      }
      const fullPath = resolveSafePathUnderRoot(getDocumentsRoot(), relativePath);
      if (!fullPath || !fs.existsSync(fullPath)) return { success: false, error: 'الملف غير موجود أو المسار غير صالح' };
      const ext = path.extname(fullPath).toLowerCase();
      const mimeMap: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8' };
      if (!mimeMap[ext]) return { success: true, url: null, fullPath, canPreview: false };
      return { success: true, url: `data:${mimeMap[ext]};base64,${fs.readFileSync(fullPath).toString('base64')}`, canPreview: true };
    } catch (e: unknown) { return { success: false, error: e instanceof Error ? e.message : String(e) }; }
  });

  ipcMain.handle('document:open-external', async (_event, relativePath: string) => {
    try {
      if (isRemoteFilesMode()) { await shell.openExternal(buildRemoteFileOpenUrl('document', relativePath)); return { success: true }; }
      const fullPath = resolveSafePathUnderRoot(getDocumentsRoot(), relativePath);
      if (!fullPath || !fs.existsSync(fullPath)) return { success: false, error: 'الملف غير موجود' };
      await shell.openPath(fullPath);
      return { success: true };
    } catch (e: unknown) { return { success: false, error: e instanceof Error ? e.message : String(e) }; }
  });

  ipcMain.handle('document:delete', async (_event, id: number) => {
    try {
      if (isRemoteFilesMode()) {
        const remote = await remoteApiJson<{ success: boolean; error?: string }>('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        return { success: remote.success !== false, error: remote.error };
      }
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      const rows = await qr.query('SELECT relativePath FROM documents WHERE id = ?', [id]);
      await qr.query('DELETE FROM documents WHERE id = ?', [id]);
      await qr.release();
      if (rows?.[0]?.relativePath) {
        const fullPath = resolveSafePathUnderRoot(getDocumentsRoot(), rows[0].relativePath);
        if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      return { success: true };
    } catch (e: unknown) { return { success: false, error: e instanceof Error ? e.message : String(e) }; }
  });

  const explorerHandlers: Record<string, ExplorerHandler> = {
    Taxes: async (qr, parts) => {
      if (parts.length === 1) return { success: true, folders: ((await qr.query('SELECT id, name, entityNickname FROM entities ORDER BY name').catch(() => [])) || []).map((e: any) => mapExplorerFolder(String(e.id), (e.entityNickname || e.name || `كيان ${e.id}`).trim())), files: [] };
      if (parts.length === 2) return { success: true, folders: TAX_SECTION_FOLDERS, files: [] };
      if (parts.length === 3) return { success: true, folders: [], files: mapExplorerFiles(await qr.query('SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND entityId = ? AND section = ? AND (isArchived = 0 OR isArchived IS NULL) ORDER BY createdAt', ['entity', parseInt(parts[1], 10) || parts[1], parts[2]])) };
      return { success: true, folders: [], files: [] };
    },
    Housing: async (qr, parts, folderPath) => {
      const fullPath = path.join(getDocumentsRoot(), folderPath);
      if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
      const folders = mapDirectoryEntriesToFolders(fs.readdirSync(fullPath, { withFileTypes: true }), true);
      const prefix = folderPath + '/';
      const files = mapExplorerFiles(await qr.query("SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND relativePath LIKE ? AND relativePath NOT LIKE ? AND (isArchived = 0 OR isArchived IS NULL) ORDER BY createdAt", ['housing', prefix + '%', prefix + '%/%']).catch(() => []));
      return { success: true, folders, files };
    },
    Branches: async (qr, parts) => {
      if (parts.length === 1) return { success: true, folders: ((await qr.query('SELECT id, name FROM branches WHERE status != ? ORDER BY name', ['archived'])) || []).map((b: any) => mapExplorerFolder(String(b.id), b.name)), files: [] };
      if (parts.length === 2) {
        const rows = await qr.query('SELECT id, relativePath, customName, section, createdAt FROM documents WHERE entityType = ? AND entityId = ? AND (isArchived = 0 OR isArchived IS NULL) ORDER BY section, createdAt', ['branch', parseInt(parts[1], 10) || parts[1]]);
        const secSet = new Set((rows || []).map((r: any) => r.section || 'other'));
        const labels: Record<string, string> = { trade_license: 'الرخصة التجارية', lease: 'عقد الإيجار', establishment: 'المنشأة', license_expiry: 'تجديد الرخصة', lease_expiry: 'تجديد عقد الإيجار', establishment_immigration_expiry: 'تجديد بطاقة الهجرة', other: 'مستندات أخرى' };
        return { success: true, folders: Array.from(secSet).map((sec: any) => mapExplorerFolder(sec, labels[sec] || sec)), files: [] };
      }
      if (parts.length === 3) return { success: true, folders: [], files: mapExplorerFiles(await qr.query('SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND entityId = ? AND section = ? AND (isArchived = 0 OR isArchived IS NULL) ORDER BY createdAt', ['branch', parseInt(parts[1], 10) || parts[1], parts[2]])) };
      return { success: true, folders: [], files: [] };
    },
    Employees: async (qr, parts) => {
      if (parts.length === 1) return { success: true, folders: ((await qr.query('SELECT id, name FROM employees ORDER BY name').catch(() => [])) || []).map((e: any) => mapExplorerFolder(String(e.id), (e.name || `موظف ${e.id}`).trim())), files: [] };
      if (parts.length === 2) {
        const rows = await qr.query('SELECT section FROM documents WHERE entityType = ? AND entityId = ? AND (isArchived = 0 OR isArchived IS NULL) GROUP BY section ORDER BY section', ['employee', parseInt(parts[1], 10) || parts[1]]).catch(() => []);
        const dbSections = new Set((rows || []).map((r: any) => r.section).filter(Boolean));
        const allSections = ['passport', 'residency', 'mohre_contract', 'photo', 'health_insurance', 'unemployment_insurance'];
        for (const sec of dbSections) if (!allSections.includes(sec as string)) allSections.push(sec as string);
        const labels: Record<string, string> = { passport: 'الجواز', residency: 'الإقامة والهوية', mohre_contract: 'عقد MOHRE', photo: 'الصورة الشخصية', health_insurance: 'التأمين الصحي', unemployment_insurance: 'تأمين التعطل عن العمل', other: 'مستندات أخرى' };
        return { success: true, folders: allSections.map(sec => mapExplorerFolder(sec, labels[sec] || sec)), files: [] };
      }
      if (parts.length === 3) return { success: true, folders: [], files: mapExplorerFiles(await qr.query("SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND entityId = ? AND section = ? AND (isArchived = 0 OR isArchived IS NULL) ORDER BY createdAt", ['employee', parseInt(parts[1], 10) || parts[1], parts[2]])) };
      return { success: true, folders: [], files: [] };
    },
    Phones: async (qr) => ({ success: true, folders: [], files: mapExplorerFiles(await qr.query('SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND (isArchived = 0 OR isArchived IS NULL) ORDER BY createdAt', ['phone']).catch(() => [])) }),
    Vehicles: async (qr, parts) => {
      if (parts.length === 1) return { success: true, folders: ((await qr.query("SELECT id, plateNumber, plateCode, vehicleType FROM vehicles WHERE (status IS NULL OR status != 'archived') ORDER BY id DESC").catch(() => [])) || []).map((v: any) => mapExplorerFolder(String(v.id), `${v.plateNumber || ''} - ${v.plateCode || ''} - ${v.vehicleType || ''}`.trim())), files: [] };
      if (parts.length === 2) {
        const rows = await qr.query('SELECT section FROM documents WHERE entityType = ? AND entityId = ? AND (isArchived = 0 OR isArchived IS NULL) GROUP BY section', ['vehicle', parseInt(parts[1], 10) || parts[1]]).catch(() => []);
        const discovered = new Set<'license' | 'insurance' | 'permits' | 'other'>((rows || []).map((r: any) => normalizeVehicleSection(r.section)));
        const ordered: Array<'license' | 'insurance' | 'permits' | 'other'> = ['license', 'insurance', 'permits', 'other'];
        for (const sec of ordered) discovered.add(sec);
        const labels: Record<string, string> = { license: 'الملكية', insurance: 'التأمين', permits: 'الموافقات الإضافية', other: 'مستندات أخرى' };
        return { success: true, folders: Array.from(discovered).sort((a, b) => ordered.indexOf(a) - ordered.indexOf(b)).map((sec) => mapExplorerFolder(sec, labels[sec] || sec)), files: [] };
      }
      if (parts.length === 3) {
        const entityId = parseInt(parts[1], 10) || parts[1];
        const wanted = String(parts[2] || '').trim().toLowerCase();
        const rows = await qr.query("SELECT id, relativePath, customName, createdAt, section FROM documents WHERE entityType = ? AND entityId = ? AND (isArchived = 0 OR isArchived IS NULL) ORDER BY createdAt", ['vehicle', entityId]).catch(() => []);
        return { success: true, folders: [], files: mapExplorerFiles((rows || []).filter((r: any) => normalizeVehicleSection(r.section) === wanted)) };
      }
      return { success: true, folders: [], files: [] };
    },
    Employers: async (qr, parts) => {
      if (parts.length === 1) return { success: true, folders: ((await qr.query("SELECT id, fullName FROM employers WHERE (status IS NULL OR status != ?) ORDER BY fullName", ['archived']).catch(() => [])) || []).map((e: any) => mapExplorerFolder(String(e.id), (e.fullName || `صاحب عمل ${e.id}`).trim())), files: [] };
      if (parts.length === 2) return { success: true, folders: [], files: mapExplorerFiles(await qr.query("SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND entityId = ? AND (isArchived = 0 OR isArchived IS NULL) ORDER BY createdAt", ['employer', parseInt(parts[1], 10) || parts[1]])) };
      return { success: true, folders: [], files: [] };
    }
  };

  ipcMain.handle('document:list-explorer', async (_event, folderPath: string) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = createRemoteAwareExplorerQr();
      if (!folderPath) {
        const roots = Object.keys(DOCUMENT_ROOT_LABELS).map(n => mapExplorerFolder(n, DOCUMENT_ROOT_LABELS[n]));
        const existing = fs.existsSync(getDocumentsRoot()) ? fs.readdirSync(getDocumentsRoot(), { withFileTypes: true }).filter(d => d.isDirectory()) : [];
        const manual = existing.filter(d => !Object.keys(DOCUMENT_ROOT_LABELS).includes(d.name)).map(d => mapExplorerFolder(d.name, d.name, true));
        await qr.release(); return { success: true, folders: [...roots, ...manual], files: [] };
      }
      const parts = normalizeFilePath(folderPath).split('/').filter(Boolean);
      if (parts.length > 0 && !Object.keys(DOCUMENT_ROOT_LABELS).includes(parts[0])) {
        const fullPath = path.join(getDocumentsRoot(), folderPath);
        const folders = fs.existsSync(fullPath) ? mapDirectoryEntriesToFolders(fs.readdirSync(fullPath, { withFileTypes: true }), true) : [];
        const prefix = folderPath + '/';
        const files = mapExplorerFiles(await qr.query("SELECT id, relativePath, customName, createdAt FROM documents WHERE relativePath LIKE ? AND relativePath NOT LIKE ? AND (isArchived = 0 OR isArchived IS NULL)", [prefix + '%', prefix + '%/%']));
        await qr.release(); return { success: true, folders, files };
      }
      if (explorerHandlers[parts[0]]) { const res = await explorerHandlers[parts[0]](qr, parts, folderPath); await qr.release(); return res; }
      await qr.release(); return { success: true, folders: [], files: [] };
    } catch (e) { return { success: false, error: String(e), folders: [], files: [] }; }
  });

  const archiveExplorerHandlers: Record<string, ExplorerHandler> = {
    Taxes: async (qr, parts) => {
      const ao = ' AND (isArchived = 1)';
      if (parts.length === 1) {
        const ids = intIdsForInClause(((await qr.query('SELECT DISTINCT entityId FROM documents WHERE entityType = ?' + ao + ' AND entityId IS NOT NULL ORDER BY entityId', ['entity']).catch(() => [])) || []).map((r: any) => r.entityId));
        const e = ids.length ? await qr.query(`SELECT id, name, entityNickname FROM entities WHERE id IN (${ids.map(()=>'?').join(',')}) ORDER BY name`, ids).catch(()=>[]) : [];
        const b = Object.fromEntries(e.map((x: any) => [x.id, x.entityNickname || x.name || `كيان ${x.id}`]));
        return { success: true, folders: ids.map(id => mapExplorerFolder(String(id), b[id] || `كيان ${id}`)), files: [] };
      }
      if (parts.length === 2) return { success: true, folders: TAX_SECTION_FOLDERS, files: [] };
      if (parts.length === 3) return { success: true, folders: [], files: mapExplorerFiles(await qr.query('SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND entityId = ? AND section = ?' + ao + ' ORDER BY createdAt', ['entity', parts[1], parts[2]])) };
      return { success: true, folders: [], files: [] };
    },
    Branches: async (qr, parts) => {
      const ao = ' AND (isArchived = 1)';
      if (parts.length === 1) {
        const ids = intIdsForInClause(((await qr.query('SELECT DISTINCT entityId FROM documents WHERE entityType = ?' + ao + ' AND entityId IS NOT NULL ORDER BY entityId', ['branch']).catch(() => [])) || []).map((r: any) => r.entityId));
        const br = ids.length ? await qr.query(`SELECT id, name FROM branches WHERE id IN (${ids.map(()=>'?').join(',')}) ORDER BY name`, ids).catch(()=>[]) : [];
        const b = Object.fromEntries(br.map((x: any) => [x.id, x.name]));
        return { success: true, folders: ids.map(id => mapExplorerFolder(String(id), b[id] || `فرع ${id}`)), files: [] };
      }
      if (parts.length === 2) {
        const rows = await qr.query('SELECT DISTINCT section FROM documents WHERE entityType = ? AND entityId = ?' + ao + ' AND section IS NOT NULL ORDER BY section', ['branch', parts[1]]);
        const labels: Record<string, string> = { trade_license: 'الرخصة التجارية', lease: 'عقد الإيجار', establishment: 'المنشأة' };
        return { success: true, folders: (rows||[]).map((r:any) => mapExplorerFolder(r.section, labels[r.section] || r.section)), files: [] };
      }
      if (parts.length === 3) return { success: true, folders: [], files: mapExplorerFiles(await qr.query('SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND entityId = ? AND section = ?' + ao + ' ORDER BY createdAt', ['branch', parts[1], parts[2]])) };
      return { success: true, folders: [], files: [] };
    },
    Employees: async (qr, parts) => {
      const ao = ' AND (isArchived = 1)';
      if (parts.length === 1) {
        const ids = intIdsForInClause(((await qr.query('SELECT DISTINCT entityId FROM documents WHERE entityType = ?' + ao + ' AND entityId IS NOT NULL ORDER BY entityId', ['employee']).catch(() => [])) || []).map((r: any) => r.entityId));
        const em = ids.length ? await qr.query(`SELECT id, name FROM employees WHERE id IN (${ids.map(()=>'?').join(',')}) ORDER BY name`, ids).catch(()=>[]) : [];
        const b = Object.fromEntries(em.map((x: any) => [x.id, x.name || `موظف ${x.id}`]));
        return { success: true, folders: ids.map(id => mapExplorerFolder(String(id), b[id] || `موظف ${id}`)), files: [] };
      }
      if (parts.length === 2) {
        const labels = { passport: 'الجواز', residency: 'الإقامة والهوية', mohre_contract: 'عقد MOHRE', photo: 'الصورة الشخصية', health_insurance: 'التأمين الصحي', unemployment_insurance: 'تأمين التعطل عن العمل' };
        return { success: true, folders: Object.entries(labels).map(([n, l]) => mapExplorerFolder(n, l)), files: [] };
      }
      if (parts.length === 3) return { success: true, folders: [], files: mapExplorerFiles(await qr.query('SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND entityId = ? AND section = ?' + ao + ' ORDER BY createdAt', ['employee', parts[1], parts[2]])) };
      return { success: true, folders: [], files: [] };
    },
    Phones: async (qr) => ({ success: true, folders: [], files: mapExplorerFiles(await qr.query('SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND (isArchived = 1) ORDER BY createdAt', ['phone']).catch(() => [])) }),
    Vehicles: async (qr, parts) => {
      const ao = ' AND (isArchived = 1)';
      if (parts.length === 1) {
        const ids = intIdsForInClause(((await qr.query('SELECT DISTINCT entityId FROM documents WHERE entityType = ?' + ao + ' AND entityId IS NOT NULL ORDER BY entityId', ['vehicle']).catch(() => [])) || []).map((r: any) => r.entityId));
        const veh = ids.length ? await qr.query(`SELECT id, plateNumber, code FROM vehicles WHERE id IN (${ids.map(()=>'?').join(',')}) ORDER BY plateNumber`, ids).catch(()=>[]) : [];
        const b = Object.fromEntries(veh.map((x: any) => [x.id, `${x.plateNumber}${x.code ? ` (${x.code})` : ''}`.trim()]));
        return { success: true, folders: ids.map(id => mapExplorerFolder(String(id), b[id] || `مركبة ${id}`)), files: [] };
      }
      if (parts.length === 2) return { success: true, folders: VEHICLE_SECTION_FOLDERS, files: [] };
      if (parts.length === 3) return { success: true, folders: [], files: mapExplorerFiles(await qr.query("SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND entityId = ? AND section = ?" + ao + " ORDER BY createdAt", ['vehicle', parts[1], parts[2]])) };
      return { success: true, folders: [], files: [] };
    },
    Housing: async (qr, parts, folderPath) => {
      const prefix = folderPath + '/';
      return { success: true, folders: [], files: mapExplorerFiles(await qr.query("SELECT id, relativePath, customName, createdAt FROM documents WHERE entityType = ? AND relativePath LIKE ? AND relativePath NOT LIKE ? AND (isArchived = 1) ORDER BY createdAt", ['housing', prefix + '%', prefix + '%/%']).catch(() => [])) };
    }
  };

  ipcMain.handle('document:list-archive-explorer', async (_event, folderPath: string) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = createRemoteAwareExplorerQr();
      if (!folderPath) { await qr.release(); return { success: true, folders: Object.entries(DOCUMENT_ROOT_LABELS).map(([n, l]) => mapExplorerFolder(n, l)), files: [] }; }
      const parts = normalizeFilePath(folderPath).split('/').filter(Boolean);
      if (archiveExplorerHandlers[parts[0]]) { const res = await archiveExplorerHandlers[parts[0]](qr, parts, folderPath); await qr.release(); return res; }
      await qr.release(); return { success: true, folders: [], files: [] };
    } catch (e) { return { success: false, error: String(e), folders: [], files: [] }; }
  });

  ipcMain.handle('document:create-folder', async (_event, folderName: string, parentPath?: string) => {
    try {
      const dir = path.join(parentPath ? path.join(getDocumentsRoot(), parentPath) : getDocumentsRoot(), folderName.replace(/[/\\:*?"<>|]/g, '_').trim() || 'folder');
      if (fs.existsSync(dir)) return { success: false, error: 'المجلد موجود مسبقاً' };
      fs.mkdirSync(dir, { recursive: true }); return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  function rmRecursive(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    for (const e of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, e.name);
      if (e.isDirectory()) rmRecursive(full); else fs.unlinkSync(full);
    }
    fs.rmdirSync(dirPath);
  }

  ipcMain.handle('document:delete-folder', async (_event, folderPath: string) => {
    try {
      const fullPath = path.join(getDocumentsRoot(), folderPath);
      if (!fs.existsSync(fullPath)) return { success: false, error: 'المجلد غير موجود' };
      if (['Branches', 'Employees', 'Employers', 'Housing', 'Phones', 'Vehicles', 'Taxes'].includes(folderPath.split('/')[0])) return { success: false, error: 'لا يمكن حذف هذا النوع من المجلدات' };
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      await qr.query('DELETE FROM documents WHERE relativePath = ? OR relativePath LIKE ?', [folderPath, folderPath + '/%']);
      await qr.release(); rmRecursive(fullPath); return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  });
  console.log("Document IPC loaded");
}
