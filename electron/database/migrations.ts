import { AppDataSource } from '../../src/database/data-source';
import { syncPermissionCatalog } from './permission-catalog-sync';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { app } from 'electron';
import * as bcrypt from 'bcryptjs';

export async function runMigrations() {
  if (!AppDataSource.isInitialized) return;
  console.log('Running database migrations...');
  
  // Ensure city column exists (critical for edit/save)
  try {
    const qr = AppDataSource.createQueryRunner();
    const info = await qr.query('PRAGMA table_info(branches)');
    const hasCity = info?.some((c: { name: string }) => c.name?.toLowerCase() === 'city');
    if (!hasCity) {
      await qr.query('ALTER TABLE branches ADD COLUMN city VARCHAR(100)');
      console.log('✅ Added city column to branches');
    }
    const hasAttachedToId = info?.some((c: { name: string }) => c.name?.toLowerCase() === 'attachedtoid');
    if (!hasAttachedToId) {
      await qr.query('ALTER TABLE branches ADD COLUMN attachedToId INTEGER REFERENCES branches(id)');
      console.log('✅ Added attachedToId column to branches');
    }
    const hasGoogleMapUrl = info?.some((c: { name: string }) => c.name?.toLowerCase() === 'googlemapurl');
    if (!hasGoogleMapUrl) {
      await qr.query('ALTER TABLE branches ADD COLUMN googleMapUrl TEXT');
      console.log('✅ Added googleMapUrl column to branches');
    }
    await qr.release();
  } catch (colErr) {
    console.warn('City column migration:', colErr);
  }

  try {
    const qrEnt = AppDataSource.createQueryRunner();
    const entInfo = await qrEnt.query('PRAGMA table_info(entities)');
    const entCols = (entInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!entCols.includes('registeredaddress')) {
      await qrEnt.query('ALTER TABLE entities ADD COLUMN registeredAddress TEXT');
      console.log('Added registeredAddress to entities');
    }
    if (!entCols.includes('contactnumber')) {
      await qrEnt.query('ALTER TABLE entities ADD COLUMN contactNumber VARCHAR(50)');
      console.log('Added contactNumber to entities');
    }
    if (!entCols.includes('financialyearend')) {
      await qrEnt.query('ALTER TABLE entities ADD COLUMN financialYearEnd VARCHAR(20)');
      console.log('Added financialYearEnd to entities');
    }
    if (!entCols.includes('entitynickname')) {
      await qrEnt.query('ALTER TABLE entities ADD COLUMN entityNickname VARCHAR(200)');
      console.log('Added entityNickname to entities');
    }
    await qrEnt.release();
  } catch (entErr) {
    console.warn('Entity columns migration:', entErr);
  }

  try {
    const qrTbl = AppDataSource.createQueryRunner();
    await qrTbl.query(
      `CREATE TABLE IF NOT EXISTS tax_entity_branches (
        entityId INTEGER NOT NULL,
        branchId INTEGER NOT NULL,
        PRIMARY KEY (entityId, branchId),
        FOREIGN KEY (entityId) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE
      )`
    );
    await qrTbl.release();
  } catch (tblErr) {
    console.warn('tax_entity_branches:', tblErr);
  }

  try {
    const qrLic = AppDataSource.createQueryRunner();
    const licInfo = await qrLic.query('PRAGMA table_info(branch_licenses)');
    const licCols = (licInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!licCols.includes('tradenameen')) {
      await qrLic.query('ALTER TABLE branch_licenses ADD COLUMN tradeNameEn VARCHAR(200)');
      console.log('Added tradeNameEn to branch_licenses');
    }
    await qrLic.release();
  } catch (licErr) {
    console.warn('branch_licenses tradeNameEn:', licErr);
  }

  // ── Critical tables: ensure they exist before anything else ──
  try {
    const qrCrit = AppDataSource.createQueryRunner();
    await qrCrit.query(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updatedAt TEXT DEFAULT (datetime('now'))
    )`);
    await qrCrit.query(`CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      isSystem INTEGER DEFAULT 0
    )`);
    const adminExists = await qrCrit.query("SELECT id FROM roles WHERE name = 'Admin' LIMIT 1");
    if (!adminExists?.length) {
      await qrCrit.query("INSERT INTO roles (name, description, isSystem) VALUES ('Admin', 'مدير النظام', 1)");
    }
    await qrCrit.query(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT,
      roleId INTEGER NOT NULL REFERENCES roles(id),
      isActive INTEGER DEFAULT 1,
      lastLoginAt TEXT,
      mustChangePassword INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )`);
    await qrCrit.query(`CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      labelKey TEXT,
      UNIQUE(module, action)
    )`);
    await qrCrit.query(`CREATE TABLE IF NOT EXISTS role_permissions (
      roleId INTEGER NOT NULL REFERENCES roles(id),
      permissionId INTEGER NOT NULL REFERENCES permissions(id),
      PRIMARY KEY (roleId, permissionId)
    )`);
    await qrCrit.query(`CREATE TABLE IF NOT EXISTS user_permissions (
      userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permissionId INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (userId, permissionId)
    )`);
    await qrCrit.query(`CREATE TABLE IF NOT EXISTS user_permission_overrides (
      userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permissionId INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      isAllowed INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (userId, permissionId)
    )`);
    await qrCrit.release();
    console.log('✅ Critical tables verified/created');
  } catch (critErr) {
    console.error('Critical tables creation failed:', critErr);
  }

  try {
    const qrCode = AppDataSource.createQueryRunner();
    const brInfo = await qrCode.query('PRAGMA table_info(branches)');
    const brCols = (brInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!brCols.includes('code')) {
      await qrCode.query('ALTER TABLE branches ADD COLUMN code VARCHAR(20)');
    }
    const brRows = (await qrCode.query('SELECT id, code FROM branches ORDER BY id ASC')) as { id: number; code?: string }[] || [];
    let brUpdated = 0;
    for (let i = 0; i < brRows.length; i++) {
        if (!brRows[i]?.code || String(brRows[i].code).trim() === '') {
        await qrCode.query('UPDATE branches SET code = ? WHERE id = ?', [`RMB${String(i + 1).padStart(4, '0')}`, brRows[i].id]);
        brUpdated++;
        }
    }
    if (brUpdated > 0) console.log('Assigned branch codes (retroactive):', brUpdated);

    const empInfoCode = await qrCode.query('PRAGMA table_info(employees)');
    const empColsCode = (empInfoCode || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!empColsCode.includes('code')) {
      await qrCode.query('ALTER TABLE employees ADD COLUMN code VARCHAR(20)');
    }
    const empRows = (await qrCode.query('SELECT id, code FROM employees ORDER BY id ASC')) as { id: number; code?: string }[] || [];
    let empUpdated = 0;
    for (let i = 0; i < empRows.length; i++) {
        if (!empRows[i]?.code || String(empRows[i].code).trim() === '') {
        await qrCode.query('UPDATE employees SET code = ? WHERE id = ?', [`RME${String(i + 1).padStart(4, '0')}`, empRows[i].id]);
        empUpdated++;
        }
    }
    if (empUpdated > 0) console.log('Assigned employee codes (retroactive):', empUpdated);

    const phoneInfoCode = await qrCode.query('PRAGMA table_info(phones)');
    const phoneColsCode = (phoneInfoCode || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!phoneColsCode.includes('code')) {
      await qrCode.query('ALTER TABLE phones ADD COLUMN code VARCHAR(20)');
    }
    const phoneRows = (await qrCode.query('SELECT id, code FROM phones ORDER BY id ASC')) as { id: number; code?: string }[] || [];
    let phoneUpdated = 0;
    for (let i = 0; i < phoneRows.length; i++) {
        if (!phoneRows[i]?.code || String(phoneRows[i].code).trim() === '') {
        await qrCode.query('UPDATE phones SET code = ? WHERE id = ?', [`RMP${String(i + 1).padStart(4, '0')}`, phoneRows[i].id]);
        phoneUpdated++;
        }
    }
    if (phoneUpdated > 0) console.log('Assigned phone codes (retroactive):', phoneUpdated);

    try {
        await qrCode.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_code ON branches(code) WHERE code IS NOT NULL');
        await qrCode.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_code ON employees(code) WHERE code IS NOT NULL');
        await qrCode.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_phones_code ON phones(code) WHERE code IS NOT NULL');
    } catch (idxErr) {
        console.warn('Unique index on code:', idxErr);
    }

    const phoneAssign = await qrCode.query('PRAGMA table_info(phones)');
    const phoneAssignCols = (phoneAssign || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!phoneAssignCols.includes('assignedemployerid')) {
      await qrCode.query('ALTER TABLE phones ADD COLUMN assignedEmployerId INTEGER REFERENCES employers(id)');
      console.log('✅ Added assignedEmployerId to phones');
    }
    const empTableInfo = await qrCode.query('PRAGMA table_info(employers)');
    const empTableCols = (empTableInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!empTableCols.includes('primaryphoneid')) {
      await qrCode.query('ALTER TABLE employers ADD COLUMN primaryPhoneId INTEGER REFERENCES phones(id)');
      console.log('✅ Added primaryPhoneId to employers');
    }

    const huInfo = await qrCode.query('PRAGMA table_info(housing_units)');
    const huCols = (huInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!huCols.includes('employerid')) {
      await qrCode.query('ALTER TABLE housing_units ADD COLUMN employerId INTEGER REFERENCES employers(id)');
      console.log('✅ Added employerId to housing_units');
    }
    const occInfo = await qrCode.query('PRAGMA table_info(housing_occupants)');
    const occCols = (occInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!occCols.includes('employerid')) {
      await qrCode.query('ALTER TABLE housing_occupants ADD COLUMN employerId INTEGER REFERENCES employers(id)');
      console.log('✅ Added employerId to housing_occupants');
    }
    const vhInfo = await qrCode.query('PRAGMA table_info(vehicles)');
    const vhCols = (vhInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!vhCols.includes('responsibleemployerid')) {
      await qrCode.query('ALTER TABLE vehicles ADD COLUMN responsibleEmployerId INTEGER REFERENCES employers(id)');
      console.log('✅ Added responsibleEmployerId to vehicles');
    }

    const settingsExists = await qrCode.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
    );
    const settingsTableCreated = !settingsExists?.length;
    if (settingsTableCreated) {
      await qrCode.query(`
        CREATE TABLE settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          updatedAt TEXT DEFAULT (datetime('now'))
        )
      `);
      console.log('✅ Created table settings');
    }

    const rolesExists = await qrCode.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='roles'"
    );
    if (!rolesExists?.length) {
      await qrCode.query(`
        CREATE TABLE roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          isSystem INTEGER DEFAULT 0
        )
      `);
      await qrCode.query(
        `INSERT INTO roles (name, description, isSystem) VALUES ('Admin', 'مدير النظام', 1)`
      );
      console.log('✅ Created table roles and seed Admin');
    }

    const usersExists = await qrCode.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    );
    const usersTableCreated = !usersExists?.length;
    let seededAdmin = false;
    if (usersTableCreated) {
      await qrCode.query(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          passwordHash TEXT NOT NULL,
          fullName TEXT NOT NULL,
          email TEXT,
          roleId INTEGER NOT NULL REFERENCES roles(id),
          isActive INTEGER DEFAULT 1,
          lastLoginAt TEXT,
          mustChangePassword INTEGER DEFAULT 1,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        )
      `);
      const initialPlainPassword = randomBytes(18).toString('base64url');
      const defaultPasswordHash = bcrypt.hashSync(initialPlainPassword, 10);
      await qrCode.query(
        `INSERT INTO users (username, passwordHash, fullName, email, roleId, isActive, mustChangePassword, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 1, 1, 1, datetime('now'), datetime('now'))`,
        ['admin', defaultPasswordHash, 'مدير النظام', 'admin@alredaa.com']
      );
      try {
        const credPath = path.join(app.getPath('userData'), 'initial-admin-password.txt');
        const credText = [
          'RMDATA — initial administrator credentials (first run only).',
          'Delete this file after you sign in and change the password.',
          '',
          'Username: admin',
          `Password: ${initialPlainPassword}`,
          '',
        ].join('\n');
        fs.writeFileSync(credPath, credText, 'utf8');
        try {
          fs.chmodSync(credPath, 0o600);
        } catch {
          /* Windows may ignore chmod */
        }
      } catch (credErr) {
        console.warn('Could not write initial-admin-password.txt:', credErr);
      }
      console.log('✅ Created table users and seeded admin (one-time password in userData/initial-admin-password.txt)');
      seededAdmin = true;
    }

    // Safety: if users table already exists but the initial admin credential file
    // is missing (e.g. DB was copied from a packaged build), generate a new
    // one-time password and write it so the device remains recoverable.
    try {
      const credPath = path.join(app.getPath('userData'), 'initial-admin-password.txt');
      if (!fs.existsSync(credPath)) {
        const adminRow = await qrCode.query(
          'SELECT id FROM users WHERE username = ? LIMIT 1',
          ['admin']
        ) as { id: number }[];

        const admin = adminRow?.[0];
        if (admin?.id) {
          const initialPlainPassword = randomBytes(18).toString('base64url');
          const defaultPasswordHash = bcrypt.hashSync(initialPlainPassword, 10);

          await qrCode.query(
            'UPDATE users SET passwordHash = ?, mustChangePassword = 1, updatedAt = datetime(\'now\') WHERE id = ?',
            [defaultPasswordHash, admin.id]
          );

          const credText = [
            'RMDATA — initial administrator credentials (first run / recover).',
            'Delete this file after you sign in and change the password.',
            '',
            'Username: admin',
            `Password: ${initialPlainPassword}`,
            '',
          ].join('\n');
          fs.writeFileSync(credPath, credText, 'utf8');
          try {
            fs.chmodSync(credPath, 0o600);
          } catch {
            /* Windows may ignore chmod */
          }
          console.log('✅ Wrote missing initial-admin-password.txt (recovery path)');
        }
      }
    } catch (credRecoverErr) {
      console.warn('Initial admin credential recovery:', credRecoverErr);
    }

    const permExists = await qrCode.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='permissions'"
    );
    if (!permExists?.length) {
      await qrCode.query(`
        CREATE TABLE permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          module TEXT NOT NULL,
          action TEXT NOT NULL,
          labelKey TEXT,
          UNIQUE(module, action)
        )
      `);
      const modules = ['employees', 'branches', 'housing', 'vehicles', 'employers', 'phones', 'entities', 'documents', 'settings', 'users', 'logs', 'devices'];
      const actions = ['view', 'create', 'edit', 'delete', 'archive', 'manage'];
      for (const mod of modules) {
        for (const act of actions) {
          await qrCode.query('INSERT OR IGNORE INTO permissions (module, action, labelKey) VALUES (?, ?, ?)', [mod, act, `${mod}.${act}`]);
        }
      }
      console.log('✅ Created table permissions and seed');
    }
    // Ensure connected-devices permission entries exist for existing databases too.
    try {
      const actions = ['view', 'create', 'edit', 'delete', 'archive', 'manage'];
      for (const act of actions) {
        await qrCode.query('INSERT OR IGNORE INTO permissions (module, action, labelKey) VALUES (?, ?, ?)', ['devices', act, `devices.${act}`]);
      }
    } catch (devicesPermErr) {
      console.warn('Devices permissions seed:', devicesPermErr);
    }

    const rpExists = await qrCode.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='role_permissions'"
    );
    if (!rpExists?.length) {
      await qrCode.query(`
        CREATE TABLE role_permissions (
          roleId INTEGER NOT NULL REFERENCES roles(id),
          permissionId INTEGER NOT NULL REFERENCES permissions(id),
          PRIMARY KEY (roleId, permissionId)
        )
      `);
      const allPerms = await qrCode.query('SELECT id FROM permissions') as { id: number }[];
      for (const p of allPerms || []) {
        await qrCode.query('INSERT OR IGNORE INTO role_permissions (roleId, permissionId) VALUES (1, ?)', [p.id]);
      }
      await qrCode.query(`INSERT OR IGNORE INTO roles (name, description, isSystem) VALUES ('Manager', 'مدير عمليات', 1), ('Staff', 'موظف إدخال', 1), ('Viewer', 'عرض فقط', 1)`);
      console.log('✅ Created role_permissions and seeded Admin with all; added Manager, Staff, Viewer roles');
    }

    const upExists = await qrCode.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_permissions'"
    );
    if (!upExists?.length) {
      await qrCode.query(`
        CREATE TABLE user_permissions (
          userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          permissionId INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
          PRIMARY KEY (userId, permissionId)
        )
      `);
      console.log('✅ Created user_permissions');
    }

    const uoExists = await qrCode.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_permission_overrides'"
    );
    if (!uoExists?.length) {
      await qrCode.query(`
        CREATE TABLE user_permission_overrides (
          userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          permissionId INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
          isAllowed INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (userId, permissionId)
        )
      `);
      console.log('✅ Created user_permission_overrides');
    }

    // Seed default permissions for Manager (2), Staff (3), Viewer (4) if they have none
    try {
      const managerCount = await qrCode.query('SELECT COUNT(*) as c FROM role_permissions WHERE roleId = 2') as { c: number }[];
      if (managerCount?.[0]?.c === 0) {
        const perms = await qrCode.query('SELECT id, module, action FROM permissions') as { id: number; module: string; action: string }[];
        const managerActions = ['view', 'create', 'edit', 'archive'];
        const staffActions = ['view', 'create', 'edit'];
        for (const p of perms || []) {
          if (p.action === 'view') await qrCode.query('INSERT OR IGNORE INTO role_permissions (roleId, permissionId) VALUES (4, ?)', [p.id]);
          if (staffActions.includes(p.action)) await qrCode.query('INSERT OR IGNORE INTO role_permissions (roleId, permissionId) VALUES (3, ?)', [p.id]);
          if (managerActions.includes(p.action) || (p.module === 'settings' && p.action === 'view')) await qrCode.query('INSERT OR IGNORE INTO role_permissions (roleId, permissionId) VALUES (2, ?)', [p.id]);
        }
        console.log('✅ Seeded default permissions for Manager, Staff, Viewer');
      }
    } catch (seedErr) {
      console.warn('Default role permissions seed:', seedErr);
    }

    // Reports module removed: strip permissions and role/user links if they exist
    try {
      const reportPerms = await qrCode.query("SELECT id FROM permissions WHERE module = 'reports'") as { id: number }[];
      for (const p of reportPerms || []) {
        await qrCode.query('DELETE FROM role_permissions WHERE permissionId = ?', [p.id]);
        await qrCode.query('DELETE FROM user_permissions WHERE permissionId = ?', [p.id]);
      }
      await qrCode.query("DELETE FROM permissions WHERE module = 'reports'");
      if (reportPerms?.length) console.log('✅ Removed retired Reports module permissions');
    } catch (reportCleanupErr) {
      console.warn('Reports permissions cleanup:', reportCleanupErr);
    }

    // Normalize users table: ensure passwordHash exists (table may have been created by TypeORM with "password" column)
    try {
      const uInfoNorm = await qrCode.query('PRAGMA table_info(users)') as { name: string }[];
      const uColsNorm = (uInfoNorm || []).map((c) => c.name?.toLowerCase());
      const hasPasswordHash = uColsNorm.includes('passwordhash');
      const hasPassword = uColsNorm.includes('password');
      if (!hasPasswordHash && hasPassword) {
        await qrCode.query('ALTER TABLE users ADD COLUMN passwordHash TEXT');
        await qrCode.query('UPDATE users SET passwordHash = password WHERE passwordHash IS NULL OR passwordHash = \'\'');
        console.log('✅ Added passwordHash to users and copied from password');
      } else if (!hasPasswordHash) {
        await qrCode.query('ALTER TABLE users ADD COLUMN passwordHash TEXT');
        console.log('✅ Added passwordHash to users');
      }
    } catch (normErr) {
      console.warn('Users passwordHash normalization:', normErr);
    }

    // Normalize users table: ensure roleId exists (table may have been created by TypeORM with "role" column only)
    try {
      const uInfoRole = await qrCode.query('PRAGMA table_info(users)') as { name: string }[];
      const uColsRole = (uInfoRole || []).map((c) => c.name?.toLowerCase());
      if (!uColsRole.includes('roleid')) {
        await qrCode.query('ALTER TABLE users ADD COLUMN roleId INTEGER REFERENCES roles(id)');
        await qrCode.query('UPDATE users SET roleId = 1 WHERE roleId IS NULL');
        console.log('✅ Added roleId to users (default 1 = Admin)');
      }
    } catch (roleNormErr) {
      console.warn('Users roleId normalization:', roleNormErr);
    }

    // V1.2: user-employee/employer link columns
    try {
      const uInfo = await qrCode.query('PRAGMA table_info(users)') as { name: string }[];
      const uCols = (uInfo || []).map((c) => c.name?.toLowerCase());
      if (!uCols.includes('usertype')) {
        await qrCode.query("ALTER TABLE users ADD COLUMN userType TEXT DEFAULT 'free'");
        console.log('Added userType to users');
      }
      if (!uCols.includes('linkedentitytype')) {
        await qrCode.query('ALTER TABLE users ADD COLUMN linkedEntityType TEXT');
        console.log('Added linkedEntityType to users');
      }
      if (!uCols.includes('linkedentityid')) {
        await qrCode.query('ALTER TABLE users ADD COLUMN linkedEntityId INTEGER');
        console.log('Added linkedEntityId to users');
      }
      if (!uCols.includes('mustchangepassword')) {
        await qrCode.query('ALTER TABLE users ADD COLUMN mustChangePassword INTEGER DEFAULT 0');
        console.log('Added mustChangePassword to users');
      }
      if (!uCols.includes('passwordchangedat')) {
        await qrCode.query('ALTER TABLE users ADD COLUMN passwordChangedAt TEXT');
        console.log('Added passwordChangedAt to users');
      }
      if (!uCols.includes('avatarpath')) {
        await qrCode.query('ALTER TABLE users ADD COLUMN avatarPath TEXT');
        console.log('Added avatarPath to users');
      }
      await qrCode.query("UPDATE users SET userType = 'free' WHERE userType IS NULL");
      const empInfo = await qrCode.query('PRAGMA table_info(employees)') as { name: string }[];
      const empCols = (empInfo || []).map((c) => c.name?.toLowerCase());
      if (!empCols.includes('userid')) {
        await qrCode.query('ALTER TABLE employees ADD COLUMN userId INTEGER REFERENCES users(id)');
        await qrCode.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_userId ON employees(userId) WHERE userId IS NOT NULL');
        console.log('Added userId to employees');
      }
      const emprInfo = await qrCode.query('PRAGMA table_info(employers)') as { name: string }[];
      const emprCols = (emprInfo || []).map((c) => c.name?.toLowerCase());
      if (!emprCols.includes('userid')) {
        await qrCode.query('ALTER TABLE employers ADD COLUMN userId INTEGER REFERENCES users(id)');
        await qrCode.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_employers_userId ON employers(userId) WHERE userId IS NOT NULL');
        console.log('Added userId to employers');
      }
      try {
        await qrCode.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_linked ON users(linkedEntityType, linkedEntityId) WHERE linkedEntityId IS NOT NULL');
      } catch { /* may already exist */ }
    } catch (v12Err) {
      console.warn('V1.2 user-employee link migration:', v12Err);
    }

    // Fix users.email NOT NULL constraint (schema may have been created by TypeORM with email NOT NULL)
    try {
      const qrUsers = AppDataSource.createQueryRunner();
      const uInfoEmail = await qrUsers.query('PRAGMA table_info(users)') as { name: string; notnull: number }[];
      const emailCol = uInfoEmail?.find((c) => c.name?.toLowerCase() === 'email');
      if (emailCol && emailCol.notnull === 1) {
        const uCols = (uInfoEmail || []).map((c) => c.name?.toLowerCase());
        const hasPasswordHash = uCols.includes('passwordhash');
        const hasPassword = uCols.includes('password');
        const hashSource = hasPasswordHash && hasPassword ? 'COALESCE(passwordHash, password)' : hasPasswordHash ? 'passwordHash' : hasPassword ? 'password' : "''";
        const hasPasswordChangedAt = uCols.includes('passwordchangedat');
        const hasAvatarPath = uCols.includes('avatarpath');
        await qrUsers.query('DROP TABLE IF EXISTS users_new');
        await qrUsers.query(`CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          passwordHash TEXT NOT NULL,
          fullName TEXT NOT NULL,
          email TEXT,
          roleId INTEGER NOT NULL REFERENCES roles(id),
          isActive INTEGER DEFAULT 1,
          lastLoginAt TEXT,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now')),
          userType TEXT DEFAULT 'free',
          linkedEntityType TEXT,
          linkedEntityId INTEGER,
          mustChangePassword INTEGER DEFAULT 0,
          passwordChangedAt TEXT,
          avatarPath TEXT
        )`);
        await qrUsers.query(`
          INSERT INTO users_new (id, username, passwordHash, fullName, email, roleId, isActive, lastLoginAt, createdAt, updatedAt, userType, linkedEntityType, linkedEntityId, mustChangePassword, passwordChangedAt, avatarPath)
          SELECT id, username, ${hashSource}, fullName, NULLIF(email,''), roleId, isActive, lastLoginAt, createdAt, updatedAt, COALESCE(userType,'free'), linkedEntityType, linkedEntityId, COALESCE(mustChangePassword,0), ${hasPasswordChangedAt ? 'passwordChangedAt' : 'NULL'}, ${hasAvatarPath ? 'avatarPath' : 'NULL'} FROM users
        `);
        await qrUsers.query('PRAGMA foreign_keys = OFF');
        await qrUsers.query('DROP TABLE users');
        await qrUsers.query('ALTER TABLE users_new RENAME TO users');
        await qrUsers.query('PRAGMA foreign_keys = ON');
        try {
          await qrUsers.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_linked ON users(linkedEntityType, linkedEntityId) WHERE linkedEntityId IS NOT NULL');
        } catch { /* may already exist */ }
        console.log('✅ Relaxed users.email NOT NULL constraint (table rebuilt)');
      }
      await qrUsers.release();
    } catch (emailFixErr) {
      console.warn('users.email NOT NULL fix:', emailFixErr);
    }

    const actInfo = await qrCode.query('PRAGMA table_info(activity_logs)');
    const actCols = (actInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!actCols.includes('performedbyusercode')) {
      await qrCode.query('ALTER TABLE activity_logs ADD COLUMN performedByUserCode VARCHAR(20)');
      console.log('Added performedByUserCode to activity_logs');
    }
    const shInfo = await qrCode.query('PRAGMA table_info(status_history)');
    const shCols = (shInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    if (!shCols.includes('performedbyusercode')) {
      await qrCode.query('ALTER TABLE status_history ADD COLUMN performedByUserCode VARCHAR(20)');
      console.log('Added performedByUserCode to status_history');
    }

    /** مزامنة كتالوج الصلاحيات (تبويبات/حقول/إجراءات) — idempotent */
    try {
      await syncPermissionCatalog((sql, p) => qrCode.query(sql, p));
    } catch (permSyncErr) {
      console.warn('Permission catalog sync:', permSyncErr);
    }

    await qrCode.release();
  } catch (codeErr) {
    console.warn('code / performedByUserCode migration:', codeErr);
  }

  try {
    const qrEmp = AppDataSource.createQueryRunner();
    const empInfo = await qrEmp.query('PRAGMA table_info(employees)');
    const empCols = (empInfo || []).map((c: { name: string }) => c.name?.toLowerCase());
    const empMigrations: { col: string; sql: string }[] = [
        { col: 'passportissuedate', sql: 'ALTER TABLE employees ADD COLUMN passportIssueDate DATE' },
        { col: 'issueemirate', sql: 'ALTER TABLE employees ADD COLUMN issueEmirate VARCHAR(50)' },
        { col: 'employername', sql: 'ALTER TABLE employees ADD COLUMN employerName VARCHAR(200)' },
        { col: 'establishmentnumber', sql: 'ALTER TABLE employees ADD COLUMN establishmentNumber VARCHAR(100)' },
        { col: 'loantype', sql: 'ALTER TABLE employees ADD COLUMN loanType VARCHAR(20)' },
        { col: 'targetentityname', sql: 'ALTER TABLE employees ADD COLUMN targetEntityName VARCHAR(200)' },
        { col: 'loanexpirydate', sql: 'ALTER TABLE employees ADD COLUMN loanExpiryDate DATE' },
        { col: 'tempcontractnumber', sql: 'ALTER TABLE employees ADD COLUMN tempContractNumber VARCHAR(50)' },
        { col: 'loansalary', sql: 'ALTER TABLE employees ADD COLUMN loanSalary DECIMAL(10,2)' },
        { col: 'professioncustomtitle', sql: 'ALTER TABLE employees ADD COLUMN professionCustomTitle VARCHAR(200)' },
        { col: 'professionkeys', sql: 'ALTER TABLE employees ADD COLUMN professionKeys TEXT' },
        { col: 'healthinsuranceenabled', sql: 'ALTER TABLE employees ADD COLUMN healthInsuranceEnabled INTEGER DEFAULT 0' },
        { col: 'healthinsuranceprovider', sql: 'ALTER TABLE employees ADD COLUMN healthInsuranceProvider VARCHAR(200)' },
        { col: 'healthinsuranceissuedate', sql: 'ALTER TABLE employees ADD COLUMN healthInsuranceIssueDate DATE' },
        { col: 'healthinsuranceexpirydate', sql: 'ALTER TABLE employees ADD COLUMN healthInsuranceExpiryDate DATE' },
        { col: 'unemploymentinsuranceenabled', sql: 'ALTER TABLE employees ADD COLUMN unemploymentInsuranceEnabled INTEGER DEFAULT 0' },
        { col: 'unemploymentinsuranceprovider', sql: 'ALTER TABLE employees ADD COLUMN unemploymentInsuranceProvider VARCHAR(200)' },
        { col: 'unemploymentinsuranceissuedate', sql: 'ALTER TABLE employees ADD COLUMN unemploymentInsuranceIssueDate DATE' },
        { col: 'unemploymentinsuranceexpirydate', sql: 'ALTER TABLE employees ADD COLUMN unemploymentInsuranceExpiryDate DATE' },
        { col: 'professionpercontract', sql: 'ALTER TABLE employees ADD COLUMN professionPerContract VARCHAR(200)' },
        { col: 'loanbranchid', sql: 'ALTER TABLE employees ADD COLUMN loanBranchId INTEGER' },
        { col: 'loanprofession', sql: 'ALTER TABLE employees ADD COLUMN loanProfession VARCHAR(200)' },
        { col: 'loansubstatus', sql: 'ALTER TABLE employees ADD COLUMN loanSubStatus VARCHAR(20)' },
        { col: 'loanleavestartdate', sql: 'ALTER TABLE employees ADD COLUMN loanLeaveStartDate DATE' },
        { col: 'loanleaveenddate', sql: 'ALTER TABLE employees ADD COLUMN loanLeaveEndDate DATE' },
        { col: 'immigrationestablishmentnumber', sql: 'ALTER TABLE employees ADD COLUMN immigrationEstablishmentNumber VARCHAR(100)' },
        { col: 'emiratesidissuedate', sql: 'ALTER TABLE employees ADD COLUMN emiratesIdIssueDate DATE' },
    ];
    for (const m of empMigrations) {
        try {
        await qrEmp.query(m.sql);
        console.log('Added', m.col, 'to employees');
        } catch (addErr: unknown) {
        const msg = String(addErr instanceof Error ? addErr.message : addErr);
        if (!msg.includes('duplicate column')) console.warn('Migration', m.col, msg);
        }
    }
    await qrEmp.release();
  } catch (empErr) {
    console.warn('Employees migration:', empErr);
  }

  try {
    const qrPay = AppDataSource.createQueryRunner();
    await qrPay.query(
        `CREATE TABLE IF NOT EXISTS tax_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entityId INTEGER NOT NULL,
        type TEXT NOT NULL,
        financialYear INTEGER NOT NULL,
        quarter INTEGER,
        periodFrom TEXT,
        periodTo TEXT,
        amount REAL NOT NULL,
        paymentDate TEXT NOT NULL,
        FOREIGN KEY (entityId) REFERENCES entities(id) ON DELETE CASCADE
        )`
    );
    await qrPay.release();
  } catch (payErr) {
    console.warn('tax_payments:', payErr);
  }

  // Documents table for DMS
  try {
    const qrDoc = AppDataSource.createQueryRunner();
    await qrDoc.query(
        `CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        relativePath TEXT NOT NULL,
        customName TEXT,
        entityType TEXT NOT NULL,
        entityId INTEGER,
        section TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
        )`
    );
    const docInfo = await qrDoc.query('PRAGMA table_info(documents)');
    const hasArchived = docInfo?.some((c: { name: string }) => c.name === 'isArchived');
    if (!hasArchived) {
        await qrDoc.query('ALTER TABLE documents ADD COLUMN isArchived INTEGER DEFAULT 0');
        console.log('Added isArchived to documents');
    }

    // DMS Refactor Migration: Rename Employee/Name paths to Employee/ID paths
    try {
      const allEmps = await qrDoc.query('SELECT id, name FROM employees');
      const docRoot = app.isReady() ? path.join(app.getPath('userData'), 'documents') : '';
      let movedCount = 0;
      
      for (const emp of allEmps || []) {
        const safeName = (emp.name || '').replace(/[/\\:*?"<>|]/g, '_').trim() || `emp_${emp.id}`;
        const oldPrefix = `Employees/${safeName}/`;
        const newPrefix = `Employees/${emp.id}/`;
        
        const docsToRename = await qrDoc.query(
          "SELECT id, relativePath FROM documents WHERE entityType = 'employee' AND entityId = ? AND relativePath LIKE ?",
          [emp.id, `${oldPrefix}%`]
        );

        if (docsToRename && docsToRename.length > 0) {
           for (const doc of docsToRename) {
              const newRelativePath = doc.relativePath.replace(oldPrefix, newPrefix);
              
              if (docRoot) {
                  const oldFullPath = path.join(docRoot, doc.relativePath);
                  const newFullPath = path.join(docRoot, newRelativePath);
                  
                  if (fs.existsSync(oldFullPath)) {
                     const newDir = path.dirname(newFullPath);
                     if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
                     fs.renameSync(oldFullPath, newFullPath);
                  }
              }

              await qrDoc.query("UPDATE documents SET relativePath = ? WHERE id = ?", [newRelativePath, doc.id]);
              movedCount++;
           }
        }
      }
      if (movedCount > 0) console.log(`Migrated ${movedCount} employee documents to ID-based paths.`);
    } catch (migErr) {
      console.warn('DMS Employee Path Migration Error:', migErr);
    }

    await qrDoc.release();
  } catch (docErr) {
    console.warn('documents table:', docErr);
  }

  // Connected Devices
  try {
    const qrDevices = AppDataSource.createQueryRunner();
    await qrDevices.query(
        `CREATE TABLE IF NOT EXISTS connected_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        username VARCHAR(100),
        deviceName VARCHAR(200),
        ipAddress VARCHAR(50),
        locationCity VARCHAR(100),
        gpsCoordinates TEXT,
        appVersion VARCHAR(50),
        token VARCHAR(255),
        lastActive TEXT DEFAULT (datetime('now')),
        createdAt TEXT DEFAULT (datetime('now'))
        )`
    );
    for (const col of [
      'ALTER TABLE connected_devices ADD COLUMN deviceId TEXT',
      'ALTER TABLE connected_devices ADD COLUMN deviceLabel TEXT',
      'ALTER TABLE connected_devices ADD COLUMN publicIp TEXT',
    ]) {
      try {
        await qrDevices.query(col);
      } catch {
        /* column may already exist */
      }
    }
    try {
      await qrDevices.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_devices_user_device ON connected_devices(userId, deviceId) WHERE deviceId IS NOT NULL`
      );
    } catch {
      /* ignore */
    }
    await qrDevices.release();
    console.log('✅ Created connected_devices table');
  } catch (deviceErr) {
    console.warn('connected_devices migration:', deviceErr);
  }

  // Activity logs (global audit) and employee status history
  try {
    const qrAct = AppDataSource.createQueryRunner();
    await qrAct.query(
        `CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        createdAt TEXT DEFAULT (datetime('now')),
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        entityType TEXT NOT NULL,
        entityId INTEGER,
        details TEXT,
        performedByUserId INTEGER,
        performedByUsername TEXT
        )`
    );
    await qrAct.query(
        `CREATE TABLE IF NOT EXISTS employee_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        status TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT,
        durationDays INTEGER,
        performedByUserId INTEGER,
        performedByUsername TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        )`
    );
    // Generic status_history: entity_id + entity_type (employees, branches, vehicles)
    await qrAct.query(
        `CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entityType TEXT NOT NULL,
        entityId INTEGER NOT NULL,
        status TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT,
        durationDays INTEGER,
        performedByUserId INTEGER,
        performedByUsername TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
        )`
    );
    // One-time migration: copy employee_status_history → status_history
    try {
        await qrAct.query(
        `INSERT INTO status_history (entityType, entityId, status, startDate, endDate, durationDays, performedByUserId, performedByUsername, createdAt)
        SELECT 'employee', employeeId, status, startDate, endDate, durationDays, performedByUserId, performedByUsername, createdAt
        FROM employee_status_history esh
        WHERE NOT EXISTS (SELECT 1 FROM status_history sh WHERE sh.entityType='employee' AND sh.entityId=esh.employeeId AND sh.startDate=esh.startDate AND sh.status=esh.status)`
        );
    } catch {}
    try {
      await qrAct.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created ON activity_logs(entityType, entityId, createdAt)');
      await qrAct.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_createdAt ON activity_logs(createdAt)');
      await qrAct.query('CREATE INDEX IF NOT EXISTS idx_status_history_entity_start ON status_history(entityType, entityId, startDate)');
      console.log('Ensured activity_logs/status_history indexes');
    } catch (idxErr) {
      console.warn('activity/status indexes:', idxErr);
    }
    await qrAct.release();
  } catch (actErr) {
    console.warn('activity_logs / employee_status_history:', actErr);
  }

  try {
    const qr2 = AppDataSource.createQueryRunner();
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const inst = await qr2.query(
        `SELECT li.id, li.leaseId, li.amount, li.dueDate, b.name as branchName
        FROM lease_installments li
        JOIN branch_leases bl ON bl.id = li.leaseId
        JOIN branches b ON b.id = bl.branchId
        WHERE date(li.dueDate) >= ? AND date(li.dueDate) <= ?`,
        [today, in7]
    );
    for (const i of inst || []) {
        const rf = `installment-${i.id}`;
        const existing = await qr2.query(
        'SELECT id FROM notifications WHERE entityType=? AND entityId=? AND relatedField=? LIMIT 1',
        ['lease', i.leaseId, rf]
        );
        if (!existing?.length) {
        await qr2.query(
            `INSERT INTO notifications (entityType, entityId, title, message, dueDate, severity, isRead, relatedField)
            VALUES (?,?,?,?,?,?,?,?)`,
            [
            'lease',
            i.leaseId,
            'استحقاق دفعة إيجار',
            `دفعة بمبلغ ${Number(i.amount || 0).toLocaleString()} درهم تستحق بتاريخ ${String(i.dueDate).slice(0, 10)} - فرع ${i.branchName || ''}`,
            i.dueDate,
            'info',
            0,
            rf,
            ]
        );
        }
    }
    await qr2.release();
  } catch (remErr) {
    console.warn('Lease reminders:', remErr);
  }

  try {
    const qrNotif = AppDataSource.createQueryRunner();
    const notifInfo = await qrNotif.query('PRAGMA table_info(notifications)');
    const cols = (notifInfo || []).map((c: { name: string }) => c.name);
    if (!cols.includes('isArchived')) {
        await qrNotif.query('ALTER TABLE notifications ADD COLUMN isArchived INTEGER DEFAULT 0');
        console.log('Added isArchived to notifications');
    }
    if (!cols.includes('readAt')) {
        await qrNotif.query('ALTER TABLE notifications ADD COLUMN readAt TEXT');
        console.log('Added readAt to notifications');
    }
    await qrNotif.release();
  } catch (notifErr) {
    console.warn('notifications migration:', notifErr);
  }

  try {
    const qrPerf = AppDataSource.createQueryRunner();
    await qrPerf.query('CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status)');
    await qrPerf.query('CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status)');
    await qrPerf.query('CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)');
    await qrPerf.query('CREATE INDEX IF NOT EXISTS idx_housing_units_status ON housing_units(status)');
    await qrPerf.query('CREATE INDEX IF NOT EXISTS idx_phones_status ON phones(status)');
    await qrPerf.query('CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status)');
    await qrPerf.release();
    console.log('Ensured status column indexes for list filters');
  } catch (perfIdxErr) {
    console.warn('Status column indexes:', perfIdxErr);
  }

  /** يضمن إدراج المفاتيح الجديدة حتى لو فشلت مزامنة سابقة داخل كتلة أخرى (SQLite محلي فقط هنا) */
  try {
    if (AppDataSource.isInitialized) {
      const qrFinal = AppDataSource.createQueryRunner();
      try {
        await syncPermissionCatalog((sql, p) => qrFinal.query(sql, p));
      } finally {
        await qrFinal.release();
      }
    }
  } catch (finalPermErr) {
    console.warn('Final permission catalog sync:', finalPermErr);
  }
}
