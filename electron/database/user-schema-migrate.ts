import type { QueryRunner } from 'typeorm';

/** Add users columns introduced after early SQLite schemas (required before remote login sync). */
export async function ensureUsersSchemaColumns(qr: QueryRunner): Promise<void> {
  const uInfo = await qr.query('PRAGMA table_info(users)') as { name: string }[];
  if (!uInfo?.length) return;

  const uCols = uInfo.map((c) => c.name?.toLowerCase());

  if (!uCols.includes('roleid')) {
    await qr.query('ALTER TABLE users ADD COLUMN roleId INTEGER REFERENCES roles(id)');
    await qr.query('UPDATE users SET roleId = 1 WHERE roleId IS NULL');
  }
  if (!uCols.includes('passwordhash')) {
    await qr.query('ALTER TABLE users ADD COLUMN passwordHash TEXT');
    if (uCols.includes('password')) {
      await qr.query("UPDATE users SET passwordHash = password WHERE passwordHash IS NULL OR passwordHash = ''");
    }
  }
  if (!uCols.includes('usertype')) {
    await qr.query("ALTER TABLE users ADD COLUMN userType TEXT DEFAULT 'free'");
  }
  if (!uCols.includes('linkedentitytype')) {
    await qr.query('ALTER TABLE users ADD COLUMN linkedEntityType TEXT');
  }
  if (!uCols.includes('linkedentityid')) {
    await qr.query('ALTER TABLE users ADD COLUMN linkedEntityId INTEGER');
  }
  if (!uCols.includes('mustchangepassword')) {
    await qr.query('ALTER TABLE users ADD COLUMN mustChangePassword INTEGER DEFAULT 0');
  }
  if (!uCols.includes('passwordchangedat')) {
    await qr.query('ALTER TABLE users ADD COLUMN passwordChangedAt TEXT');
  }
  if (!uCols.includes('avatarpath')) {
    await qr.query('ALTER TABLE users ADD COLUMN avatarPath TEXT');
  }
  if (!uCols.includes('lastloginat')) {
    await qr.query('ALTER TABLE users ADD COLUMN lastLoginAt TEXT');
  }
  if (!uCols.includes('updatedat')) {
    await qr.query("ALTER TABLE users ADD COLUMN updatedAt TEXT DEFAULT (datetime('now'))");
  }

  await qr.query("UPDATE users SET userType = 'free' WHERE userType IS NULL");
}
