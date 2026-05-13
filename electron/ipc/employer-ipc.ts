import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { runDbQueryInternal } from '../db-query-internal';
import { isRemoteFilesMode, uploadRemoteFile } from '../remote-api-utils';
import { sharedState } from '../shared-state';

async function generateEmployerCode(): Promise<string> {
  const r = await runDbQueryInternal(`SELECT code FROM employers WHERE code LIKE 'RMO%' ORDER BY code DESC LIMIT 1`);
  const result = r.success ? (r.data ?? []) : [];
  if (!result.length) return 'RMO0001';
  const last = (result[0] as { code: string }).code;
  const num = parseInt(last.replace('RMO', ''), 10);
  return `RMO${String(num + 1).padStart(4, '0')}`;
}

export function registerEmployerHandlers() {
  ipcMain.handle('employer:list', async (_event, filter: { status?: string; search?: string } = {}) => {
    try {
      let query = `SELECT * FROM employers WHERE 1=1`;
      const params: unknown[] = [];
      if (filter.status) { query += ` AND status = ?`; params.push(filter.status); }
      if (filter.search) { 
        query += ` AND (fullName LIKE ? OR fullNameEn LIKE ? OR code LIKE ? OR phone LIKE ?)`; 
        const s = `%${filter.search}%`; 
        params.push(s, s, s, s); 
      }
      query += ` ORDER BY createdAt DESC`;
      const r = await runDbQueryInternal(query, params);
      return r.success ? (r.data ?? []) : [];
    } catch (e: unknown) { return []; }
  });

  ipcMain.handle('employer:get', async (_event, id: number) => {
    try {
      const empRes = await runDbQueryInternal(`SELECT * FROM employers WHERE id = ?`, [id]);
      const rows = (empRes.success ? empRes.data : []) as Record<string, unknown>[] | undefined;
      const employer = rows?.[0];
      if (!employer) return null;
      const brRes = await runDbQueryInternal(
        `SELECT be.*, b.name as branchName, b.code as branchCode,
                (SELECT bl.tradeName FROM branch_licenses bl WHERE bl.branchId = b.id LIMIT 1) as branchTradeName
         FROM branch_employers be
         JOIN branches b ON b.id = be.branchId
         WHERE be.employerId = ?`,
        [id]
      );
      const branches = brRes.success ? (brRes.data ?? []) : [];
      return { ...employer, branches };
    } catch (e: unknown) { return null; }
  });

  ipcMain.handle('employer:save', async (_event, data: Record<string, unknown>) => {
    try {
      const id = data.id as number | undefined;
      let photoPath: string | undefined = data.photoPath as string | undefined;
      
      if (data.newPhotoData && data.newPhotoName) {
        const ext = path.extname(data.newPhotoName as string) || '.jpg';
        const destName = `employer_${Date.now()}${ext}`;
        const relativePath = `images/employers/${destName}`;
        const base64 = (data.newPhotoData as string).replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');

        if (isRemoteFilesMode() && sharedState.remoteApiSession?.token) {
          const saved = await uploadRemoteFile({
            kind: 'image',
            relativePath,
            fileName: destName,
            fileBuffer: buffer,
          });
          if (saved.success) {
            photoPath = saved.relativePath || relativePath;
          } else {
            console.warn('Remote employer photo upload failed:', saved.error);
            photoPath = relativePath;
          }
        } else {
          const dataDir = app.getPath('userData');
          const imagesDir = path.join(dataDir, 'images', 'employers');
          fs.mkdirSync(imagesDir, { recursive: true });
          const destPath = path.join(imagesDir, destName);
          fs.writeFileSync(destPath, buffer);
          photoPath = relativePath;
        }
      }

      const fields: Record<string, unknown> = {
        fullName: data.fullName,
        fullNameEn: data.fullNameEn || null,
        nationality: data.nationality || null,
        phone: data.phone || null,
        email: data.email || null,
        passportNumber: data.passportNumber || null,
        passportIssueDate: data.passportIssueDate || null,
        passportExpiry: data.passportExpiry || null,
        passportCountry: data.passportCountry || null,
        emiratesId: data.emiratesId || null,
        emiratesIdIssueDate: data.emiratesIdIssueDate || null,
        emiratesIdExpiry: data.emiratesIdExpiry || null,
        occupation: data.occupation || null,
        notes: data.notes || null,
      };
      if (photoPath !== undefined) fields.photoPath = photoPath;

      if (!id) {
        fields.code = await generateEmployerCode();
        fields.status = 'active';
        const cols = Object.keys(fields).join(', ');
        const placeholders = Object.keys(fields).map(() => '?').join(', ');
        const ins = await runDbQueryInternal(
          `INSERT INTO employers (${cols}) VALUES (${placeholders})`,
          Object.values(fields)
        );
        if (!ins.success) return { success: false, error: ins.error ?? 'INSERT_FAILED' };
        const newId = ins.lastInsertId ?? (ins.data?.[0] as { id?: number } | undefined)?.id ?? null;
        return { success: true, id: newId };
      }
      
      const setParts = Object.keys(fields).map((k) => `${k} = ?`).join(', ');
      const upd = await runDbQueryInternal(
        `UPDATE employers SET ${setParts}, updatedAt = datetime('now') WHERE id = ?`,
        [...Object.values(fields), id]
      );
      if (!upd.success) return { success: false, error: upd.error ?? 'UPDATE_FAILED' };
      return { success: true, id };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('employer:archive', async (_event, id: number) => {
    try {
      const r = await runDbQueryInternal(`UPDATE employers SET status = 'archived', updatedAt = datetime('now') WHERE id = ?`, [id]);
      if (!r.success) return { success: false, error: r.error ?? 'UPDATE_FAILED' };
      return { success: true };
    } catch (e: unknown) { return { success: false, error: e instanceof Error ? e.message : String(e) }; }
  });

  ipcMain.handle('employer:restore', async (_event, id: number) => {
    try {
      const r = await runDbQueryInternal(`UPDATE employers SET status = 'active', updatedAt = datetime('now') WHERE id = ?`, [id]);
      if (!r.success) return { success: false, error: r.error ?? 'UPDATE_FAILED' };
      return { success: true };
    } catch (e: unknown) { return { success: false, error: e instanceof Error ? e.message : String(e) }; }
  });

  ipcMain.handle('employer:delete', async (_event, id: number) => {
    try {
      const d1 = await runDbQueryInternal(`DELETE FROM branch_employers WHERE employerId = ?`, [id]);
      if (!d1.success) return { success: false, error: d1.error ?? 'DELETE_FAILED' };
      const d2 = await runDbQueryInternal(`DELETE FROM employers WHERE id = ?`, [id]);
      if (!d2.success) return { success: false, error: d2.error ?? 'DELETE_FAILED' };
      return { success: true };
    } catch (e: unknown) { return { success: false, error: e instanceof Error ? e.message : String(e) }; }
  });

  ipcMain.handle('employer:link-branch', async (_event, data: { employerId: number; branchId: number; role: string; ownershipPercent?: number }) => {
    try {
      const role = String(data.role || '').trim();
      if (!['owner', 'partner', 'manager', 'agent'].includes(role)) return { success: false, error: 'INVALID_ROLE' };

      let normalizedShare: number;
      if (role === 'owner') normalizedShare = 100;
      else if (role === 'manager' || role === 'agent') normalizedShare = 0;
      else normalizedShare = Number(data.ownershipPercent ?? 0);

      if (!Number.isFinite(normalizedShare) || normalizedShare < 0 || normalizedShare > 100) {
        return { success: false, error: 'INVALID_SHARE' };
      }

      const roleStateRes = await runDbQueryInternal(
        `SELECT role, COALESCE(ownershipPercent, 0) as ownershipPercent FROM branch_employers WHERE branchId = ?`,
        [data.branchId]
      );
      if (!roleStateRes.success) return { success: false, error: roleStateRes.error ?? 'RULES_LOAD_FAILED' };
      const roleState = (roleStateRes.data ?? []) as { role: string; ownershipPercent: number }[];

      const hasOwner = roleState.some((r) => r.role === 'owner');
      const hasPartner = roleState.some((r) => r.role === 'partner');
      const partnersTotal = roleState.filter((r) => r.role === 'partner').reduce((sum, r) => sum + Number(r.ownershipPercent || 0), 0);

      if (role === 'owner') {
        if (hasOwner || hasPartner) return { success: false, error: 'OWNER_CONFLICT' };
      } else if (role === 'partner') {
        if (hasOwner) return { success: false, error: 'PARTNER_BLOCKED_BY_OWNER' };
        if (partnersTotal + normalizedShare > 100) return { success: false, error: 'PARTNER_TOTAL_EXCEEDED' };
      }

      const ex = await runDbQueryInternal(`SELECT id FROM branch_employers WHERE employerId = ? AND branchId = ? AND role = ?`, [data.employerId, data.branchId, role]);
      const existing = ex.success ? (ex.data ?? []) : [];
      if (existing.length > 0) {
        const u = await runDbQueryInternal(`UPDATE branch_employers SET ownershipPercent = ? WHERE employerId = ? AND branchId = ? AND role = ?`, [normalizedShare, data.employerId, data.branchId, role]);
        if (!u.success) return { success: false, error: u.error ?? 'UPDATE_FAILED' };
      } else {
        const i = await runDbQueryInternal(`INSERT INTO branch_employers (employerId, branchId, role, ownershipPercent) VALUES (?, ?, ?, ?)`, [data.employerId, data.branchId, role, normalizedShare]);
        if (!i.success) return { success: false, error: i.error ?? 'INSERT_FAILED' };
      }
      return { success: true };
    } catch (e: unknown) { return { success: false, error: e instanceof Error ? e.message : String(e) }; }
  });

  ipcMain.handle('employer:unlink-branch', async (_event, data: { employerId: number; branchId: number; role?: string }) => {
    try {
      const role = typeof data.role === 'string' ? data.role.trim() : '';
      const r = role
        ? await runDbQueryInternal(`DELETE FROM branch_employers WHERE employerId = ? AND branchId = ? AND role = ?`, [data.employerId, data.branchId, role])
        : await runDbQueryInternal(`DELETE FROM branch_employers WHERE employerId = ? AND branchId = ?`, [data.employerId, data.branchId]);
      if (!r.success) return { success: false, error: r.error ?? 'DELETE_FAILED' };
      return { success: true };
    } catch (e: unknown) { return { success: false, error: e instanceof Error ? e.message : String(e) }; }
  });

  ipcMain.handle('employer:get-by-branch', async (_event, branchId: number) => {
    try {
      const r = await runDbQueryInternal(
        `SELECT e.*, be.role, be.ownershipPercent FROM employers e JOIN branch_employers be ON be.employerId = e.id WHERE be.branchId = ? ORDER BY be.ownershipPercent DESC`,
        [branchId]
      );
      return r.success ? (r.data ?? []) : [];
    } catch (e: unknown) { return []; }
  });
  console.log("Employer IPC loaded");
}
