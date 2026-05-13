import { ipcMain } from 'electron';
import { AppDataSource, initializeDatabase } from '../../src/database/data-source';
import { runDbQueryInternal } from '../db-query-internal';
import { getLocalSetting } from '../local-settings-store';

async function qrQuery(sql: string, params?: unknown[]): Promise<any[]> {
  const r = await runDbQueryInternal(sql, params);
  if (!r.success) throw new Error(r.error || 'QUERY_FAILED');
  return r.data ?? [];
}

function remoteAwareQr() {
  return { query: qrQuery, release: async () => {} };
}

async function upsertExpiryNotification(
  qr: any,
  entityType: string,
  entityId: number,
  relatedField: string,
  title: string,
  message: string,
  dueDate: string,
  severity: string
) {
  const existing = await qr.query(
    'SELECT id FROM notifications WHERE entityType=? AND entityId=? AND relatedField=? LIMIT 1',
    [entityType, entityId, relatedField]
  );
  const rows = Array.isArray(existing) ? existing : [];
  if (rows.length === 0) {
    return qr.query(
      `INSERT INTO notifications (entityType, entityId, title, message, dueDate, severity, isRead, relatedField)
       VALUES (?,?,?,?,?,?,?,?)`,
      [entityType, entityId, title, message, dueDate, severity, 0, relatedField]
    );
  }
  return qr.query(
    'UPDATE notifications SET title=?, message=?, dueDate=?, severity=? WHERE id=?',
    [title, message, dueDate, severity, (rows[0] as { id: number }).id]
  );
}

/** ظٹظڈط³طھط¯ط¹ظ‰ ظ…ظ† ط§ظ„ظ€ renderer ط¹ط¨ط± IPC ط£ظˆ ظ…ظ† ط§ظ„ظ€ main ظ„ظ„ظپط­طµ ط§ظ„ط¯ظˆط±ظٹ */
export async function runEnsureExpiryReminders(): Promise<boolean> {
  try {
    if (!AppDataSource.isInitialized) await initializeDatabase();
    const qr = remoteAwareQr();
    // Read notificationsEnabled from local store (device-specific)
    const enabled = getLocalSetting('notificationsEnabled') ?? '1';
    if (enabled === '0') {
      await qr.release();
      return true;
    }
    const todayMs = Date.now();
    const today = new Date(todayMs).toISOString().slice(0, 10);
    const in90 = new Date(todayMs + 90 * 86_400_000).toISOString().slice(0, 10);
    const in7 = new Date(todayMs + 7 * 86_400_000).toISOString().slice(0, 10);
    const calcDays = (dueStr: string) =>
      Math.ceil((new Date(dueStr).getTime() - new Date(today).getTime()) / 86_400_000);
    const sev = (days: number) => (days < 0 ? 'danger' : days <= 30 ? 'warning' : 'info');
    const statusF = (days: number) => (days < 0 ? 'expired' : days <= 30 ? 'expiringSoon' : 'expiry');
    const statusM = (days: number) => (days < 0 ? 'expiredMale' : days <= 30 ? 'expiringSoonMale' : 'expiry');
    const upsert = (
      entityType: string, entityId: number, relatedField: string,
      title: string, message: string, dueStr: string, severity: string
    ) => upsertExpiryNotification(qr, entityType, entityId, relatedField, title, message, dueStr, severity);

    const inst = await qr.query(
      `SELECT li.id, li.amount, li.dueDate, b.name as branchName, b.id as branchId
       FROM lease_installments li JOIN branch_leases bl ON bl.id = li.leaseId JOIN branches b ON b.id = bl.branchId
       WHERE date(li.dueDate) >= ? AND date(li.dueDate) <= ?`, [today, in7]
    );
    for (const i of inst || []) {
      const d = String(i.dueDate).slice(0, 10);
      await upsert('branch', i.branchId, `installment-${i.id}`, 'leaseInstallment::expiry',
        `installmentMsg::${Number(i.amount || 0).toLocaleString()}::${d}::${i.branchName || ''}`, d, 'info');
    }
    const branchLicenses = await qr.query(
      `SELECT bl.id, bl.branchId, bl.expiryDate, bl.tradeName, b.name as branchName
       FROM branch_licenses bl JOIN branches b ON b.id = bl.branchId
       WHERE bl.expiryDate IS NOT NULL AND date(bl.expiryDate) <= ?`, [in90]
    );
    for (const row of branchLicenses || []) {
      const d = String(row.expiryDate).slice(0, 10);
      const days = calcDays(d);
      const docKey = row.tradeName ? `tradeLicenseNamed::${row.tradeName}` : 'tradeLicense';
      await upsert('branch', row.branchId, `branch-license-${row.id}`, `${docKey}::${statusF(days)}`,
        `branchMsg::${row.branchName || ''}::${d}`, d, sev(days));
    }
    const branchLeases = await qr.query(
      `SELECT bl.id, bl.branchId, bl.expiryDate, b.name as branchName
       FROM branch_leases bl JOIN branches b ON b.id = bl.branchId
       WHERE bl.expiryDate IS NOT NULL AND date(bl.expiryDate) <= ?`, [in90]
    );
    for (const row of branchLeases || []) {
      const d = String(row.expiryDate).slice(0, 10);
      const days = calcDays(d);
      await upsert('branch', row.branchId, `branch-lease-${row.id}`, `leaseAgreement::${statusM(days)}`,
        `branchMsg::${row.branchName || ''}::${d}`, d, sev(days));
    }
    const branchEst = await qr.query(
      `SELECT be.id, be.branchId, be.immigrationCardExpiryDate, be.gdrfaExpiryDate, b.name as branchName
       FROM branch_establishments be JOIN branches b ON b.id = be.branchId
       WHERE (be.immigrationCardExpiryDate IS NOT NULL AND date(be.immigrationCardExpiryDate) <= ?)
          OR (be.gdrfaExpiryDate IS NOT NULL AND date(be.gdrfaExpiryDate) <= ?)`, [in90, in90]
    );
    for (const row of branchEst || []) {
      if (row.immigrationCardExpiryDate) {
        const d = String(row.immigrationCardExpiryDate).slice(0, 10);
        await upsert('branch', row.branchId, `branch-establishment-${row.id}`, `establishmentCard::${statusF(calcDays(d))}`,
          `branchMsg::${row.branchName || ''}::${d}`, d, sev(calcDays(d)));
      }
      if (row.gdrfaExpiryDate) {
        const d = String(row.gdrfaExpiryDate).slice(0, 10);
        await upsert('branch', row.branchId, `branch-gdrfa-${row.id}`, `gdrfa::${statusF(calcDays(d))}`,
          `branchMsg::${row.branchName || ''}::${d}`, d, sev(calcDays(d)));
      }
    }
    try {
      const branchCustom = await qr.query(
        `SELECT cf.id, cf.branchId, cf.alertDate, cf.title as cfTitle, b.name as branchName
         FROM branch_custom_fields cf JOIN branches b ON b.id = cf.branchId
         WHERE cf.enableAlert = 1 AND cf.alertDate IS NOT NULL AND date(cf.alertDate) <= ?`, [in90]
      );
      for (const row of branchCustom || []) {
        const d = String(row.alertDate).slice(0, 10);
        const days = calcDays(d);
        await upsert('branch', row.branchId, `branch-custom-${row.id}`, `customField::${statusM(days)}::${row.cfTitle || ''}`,
          `branchMsg::${row.branchName || ''}::${d}`, d, sev(days));
      }
    } catch { /* ignore */ }
    const empFields: Array<[string, string, string]> = [
      ['passportExpiry', 'passport', 'employee-passport'],
      ['emiratesIdExpiry', 'emiratesId', 'employee-emiratesId'],
      ['workCardExpiry', 'workCard', 'employee-workCard'],
      ['healthInsuranceExpiryDate', 'healthInsurance', 'employee-healthInsurance'],
      ['contractExpiryDate', 'workContract', 'employee-contract'],
      ['loanExpiryDate', 'loan', 'employee-loan'],
      ['unemploymentInsuranceExpiryDate', 'unemploymentInsurance', 'employee-unemployment'],
    ];
    const employees = await qr.query(
      `SELECT id, name, passportExpiry, emiratesIdExpiry, workCardExpiry,
              healthInsuranceExpiryDate, contractExpiryDate, loanExpiryDate, unemploymentInsuranceExpiryDate
       FROM employees WHERE status IS NULL OR status != 'archived'`
    );
    for (const emp of employees || []) {
      for (const [col, docKey, rfPrefix] of empFields) {
        const raw = emp[col];
        if (!raw) continue;
        const d = String(raw).slice(0, 10);
        if (d > in90) continue;
        const days = calcDays(d);
        await upsert('employee', emp.id, `${rfPrefix}-${emp.id}`, `${docKey}::${statusM(days)}`,
          `entityMsg::${emp.name || ''}::${d}`, d, sev(days));
      }
    }
    const vehicles = await qr.query(
      `SELECT id, plateNumber, licenseExpiryDate, insuranceExpiryDate FROM vehicles`
    );
    const vehFields: Array<[string, string, string]> = [
      ['licenseExpiryDate', 'vehicleLicense', 'vehicle-license'],
      ['insuranceExpiryDate', 'vehicleInsurance', 'vehicle-insurance'],
    ];
    for (const v of vehicles || []) {
      for (const [col, docKey, rfPrefix] of vehFields) {
        const raw = v[col];
        if (!raw) continue;
        const d = String(raw).slice(0, 10);
        if (d > in90) continue;
        const days = calcDays(d);
        await upsert('vehicle', v.id, `${rfPrefix}-${v.id}`, `${docKey}::${statusF(days)}`,
          `entityMsg::${v.plateNumber || ''}::${d}`, d, sev(days));
      }
    }
    try {
      const vehCustom = await qr.query(
        `SELECT cf.id, cf.vehicleId, cf.alertDate, cf.title as cfTitle, v.plateNumber
         FROM vehicle_custom_fields cf JOIN vehicles v ON v.id = cf.vehicleId
         WHERE cf.enableAlert = 1 AND cf.alertDate IS NOT NULL AND date(cf.alertDate) <= ?`, [in90]
      );
      for (const row of vehCustom || []) {
        const d = String(row.alertDate).slice(0, 10);
        const days = calcDays(d);
        await upsert('vehicle', row.vehicleId, `vehicle-custom-${row.id}`, `customField::${statusM(days)}::${row.cfTitle || ''}`,
          `entityMsg::${row.plateNumber || ''}::${d}`, d, sev(days));
      }
    } catch { /* ignore */ }
    const housing = await qr.query(
      `SELECT id, name, contractExpiry FROM housing_units
       WHERE (status IS NULL OR status != 'archived') AND contractExpiry IS NOT NULL AND date(contractExpiry) <= ?`, [in90]
    );
    for (const h of housing || []) {
      const d = String(h.contractExpiry).slice(0, 10);
      const days = calcDays(d);
      await upsert('housing', h.id, `housing-contract-${h.id}`, `housingContract::${statusM(days)}`,
        `entityMsg::${h.name || ''}::${d}`, d, sev(days));
    }
    try {
      const housingCustom = await qr.query(
        `SELECT cf.id, cf.housingUnitId, cf.alertDate, cf.title as cfTitle, hu.name
         FROM housing_custom_fields cf JOIN housing_units hu ON hu.id = cf.housingUnitId
         WHERE cf.enableAlert = 1 AND cf.alertDate IS NOT NULL AND date(cf.alertDate) <= ?`, [in90]
      );
      for (const row of housingCustom || []) {
        const d = String(row.alertDate).slice(0, 10);
        const days = calcDays(d);
        await upsert('housing', row.housingUnitId, `housing-custom-${row.id}`, `customField::${statusM(days)}::${row.cfTitle || ''}`,
          `entityMsg::${row.name || ''}::${d}`, d, sev(days));
      }
    } catch { /* ignore */ }
    const employers = await qr.query(
      `SELECT id, fullName, passportExpiry, emiratesIdExpiry FROM employers WHERE status IS NULL OR status != 'archived'`
    );
    const emplerFields: Array<[string, string, string]> = [
      ['passportExpiry', 'employerPassport', 'employer-passport'],
      ['emiratesIdExpiry', 'employerEmiratesId', 'employer-emiratesId'],
    ];
    for (const emp of employers || []) {
      for (const [col, docKey, rfPrefix] of emplerFields) {
        const raw = emp[col];
        if (!raw) continue;
        const d = String(raw).slice(0, 10);
        if (d > in90) continue;
        const days = calcDays(d);
        await upsert('employer', emp.id, `${rfPrefix}-${emp.id}`, `${docKey}::${statusM(days)}`,
          `entityMsg::${emp.fullName || ''}::${d}`, d, sev(days));
      }
    }
    const entities = await qr.query(
      `SELECT id, name, tradeLicenseExpiry FROM entities
       WHERE (status IS NULL OR status != 'archived') AND tradeLicenseExpiry IS NOT NULL AND date(tradeLicenseExpiry) <= ?`, [in90]
    );
    for (const ent of entities || []) {
      const d = String(ent.tradeLicenseExpiry).slice(0, 10);
      const days = calcDays(d);
      await upsert('entity', ent.id, `entity-tradeLicense-${ent.id}`, `entityTradeLicense::${statusF(days)}`,
        `entityMsg::${ent.name || ''}::${d}`, d, sev(days));
    }
    // Cleanup old read notifications (Run in background job)
    const yesterdayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    await qr.query(
      `DELETE FROM notifications WHERE isRead = 1 AND readAt IS NOT NULL AND readAt < ?`, 
      [yesterdayISO]
    );

    await qr.release();
    return true;
  } catch (e) {
    console.warn('runEnsureExpiryReminders', e);
    return false;
  }
}

/** ط¹ط¯ط¯ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ط؛ظٹط± ط§ظ„ظ…ظ‚ط±ظˆط،ط© â€” ظ„ظ„ط§ط³طھط®ط¯ط§ظ… ظ…ظ† ط§ظ„ظ€ main (ط®ظ„ظپظٹط©) ط£ظˆ ظ…ظ† ط§ظ„ظ€ renderer ط¹ط¨ط± IPC */
export async function getUnreadCount(): Promise<number> {
  try {
    if (!AppDataSource.isInitialized) await initializeDatabase();
    const rows = await qrQuery(
      `SELECT COUNT(*) as c FROM notifications WHERE (isArchived = 0 OR isArchived IS NULL) AND isRead = 0`
    );
    return Number((rows?.[0] as { c?: number })?.c ?? 0);
  } catch {
    return 0;
  }
}

/** تشغيل تحديث الإشعارات ثم إرجاع عدد غير المقروء — للفحص الدوري من main */
export async function runCheckAndGetUnreadCount(): Promise<number> {
  await runEnsureExpiryReminders();
  return getUnreadCount();
}

/** هل إشعارات سطح المكتب مفعّلة من الإعدادات المحلية */
export async function isDesktopNotificationsEnabled(): Promise<boolean> {
  try {
    const v = getLocalSetting('desktopNotificationsEnabled');
    return (v ?? '1') === '1';
  } catch {
    return true;
  }
}

/** فترة الفحص الدوري للإشعارات (ميلي ثانية) — ساعة */
export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function registerNotificationHandlers() {
  ipcMain.handle('notifications:ensureAllExpiryReminders', async () => ({
    success: await runEnsureExpiryReminders(),
  }));

  ipcMain.handle('notifications:load', async () => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = remoteAwareQr();
      await qr.query("UPDATE notifications SET readAt = datetime('now') WHERE isRead = 1 AND readAt IS NULL");
      const rows = await qr.query(
        `SELECT id, entityType, entityId, title, message, dueDate, severity, isRead, relatedField, createdAt
         FROM notifications
         WHERE (isArchived = 0 OR isArchived IS NULL)
         ORDER BY isRead ASC, dueDate ASC, createdAt DESC
         LIMIT 100`
      );
      await qr.release();
      return { success: true, data: rows || [] };
    } catch (e) {
      console.error('notifications:load', e);
      return { success: false, data: [] };
    }
  });

  ipcMain.handle('notifications:markRead', async (_event, id: number) => {
    try {
      const qr = remoteAwareQr();
      await qr.query("UPDATE notifications SET isRead = 1, readAt = datetime('now') WHERE id = ?", [id]);
      await qr.release();
      return { success: true };
    } catch (e) {
      console.error('notifications:markRead', e);
      return { success: false };
    }
  });

  ipcMain.handle('notifications:markAllRead', async () => {
    try {
      const qr = remoteAwareQr();
      await qr.query("UPDATE notifications SET isRead = 1, readAt = datetime('now') WHERE (isArchived = 0 OR isArchived IS NULL)");
      await qr.release();
      return { success: true };
    } catch (e) {
      console.error('notifications:markAllRead', e);
      return { success: false };
    }
  });

  ipcMain.handle('notifications:delete', async (_event, id: number) => {
    try {
      const qr = remoteAwareQr();
      await qr.query('DELETE FROM notifications WHERE id = ?', [id]);
      await qr.release();
      return { success: true };
    } catch (e) {
      console.error('notifications:delete', e);
      return { success: false };
    }
  });

  ipcMain.handle('notifications:archive', async (_event, id: number) => {
    try {
      const qr = remoteAwareQr();
      await qr.query('UPDATE notifications SET isArchived = 1 WHERE id = ?', [id]);
      await qr.release();
      return { success: true };
    } catch (e) {
      console.error('notifications:archive', e);
      return { success: false };
    }
  });

  ipcMain.handle('notifications:ensureLeaseReminders', async () => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = remoteAwareQr();
      const today = new Date().toISOString().slice(0, 10);
      const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      const inst = await qr.query(
        `SELECT li.id, li.amount, li.dueDate, b.name as branchName, b.id as branchId
         FROM lease_installments li
         JOIN branch_leases bl ON bl.id = li.leaseId
         JOIN branches b ON b.id = bl.branchId
         WHERE date(li.dueDate) >= ? AND date(li.dueDate) <= ?`,
        [today, in7]
      );
      for (const i of inst || []) {
        const rf = `installment-${i.id}`;
        const existing = await qr.query(
          'SELECT id FROM notifications WHERE entityType=? AND entityId=? AND relatedField=? LIMIT 1',
          ['branch', i.branchId, rf]
        );
        if (!existing?.length) {
          const d = String(i.dueDate).slice(0, 10);
          await qr.query(
            `INSERT INTO notifications (entityType, entityId, title, message, dueDate, severity, isRead, relatedField)
             VALUES (?,?,?,?,?,?,?,?)`,
            [
              'branch',
              i.branchId,
              'leaseInstallment::expiry',
              `installmentMsg::${Number(i.amount || 0).toLocaleString()}::${d}::${i.branchName || ''}`,
              i.dueDate,
              'info',
              0,
              rf,
            ]
          );
        }
      }
      await qr.release();
      return { success: true };
    } catch (e) {
      console.warn('Lease reminders:', e);
      return { success: false };
    }
  });
}
