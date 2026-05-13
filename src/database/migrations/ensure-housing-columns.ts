/**
 * Migration: ensure housing_units has new columns (code, landlordName, tenantDisplayName, address, status)
 * and housing_occupants table exists. Backfill RMH code for units missing code.
 */
export async function ensureHousingColumns(queryRunner: any) {
  try {
    const tableExists = await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='housing_units'"
    );
    if (tableExists.length === 0) return;

    const tableInfo = await queryRunner.query('PRAGMA table_info(housing_units)');
    const existingColumns = tableInfo.map((col: any) => col.name.toLowerCase());

    const add = async (col: string, def: string) => {
      if (existingColumns.includes(col.toLowerCase())) return;
      try {
        await queryRunner.query(def);
        console.log(`✅ housing_units: added column ${col}`);
      } catch (e) {
        console.warn(`⚠️ housing_units column ${col}:`, e);
      }
    };

    await add('code', 'ALTER TABLE housing_units ADD COLUMN code VARCHAR(20)');
    await add('landlordName', 'ALTER TABLE housing_units ADD COLUMN landlordName VARCHAR(200)');
    await add('tenantDisplayName', 'ALTER TABLE housing_units ADD COLUMN tenantDisplayName VARCHAR(200)');
    await add('address', 'ALTER TABLE housing_units ADD COLUMN address TEXT');
    await add('status', "ALTER TABLE housing_units ADD COLUMN status VARCHAR(20) DEFAULT 'active'");

    const occExists = await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='housing_occupants'"
    );
    if (occExists.length === 0) {
      await queryRunner.query(`
        CREATE TABLE housing_occupants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          housingUnitId INTEGER NOT NULL,
          employeeId INTEGER,
          name VARCHAR(200),
          role VARCHAR(100),
          fromDate DATE,
          toDate DATE,
          createdAt DATETIME DEFAULT (datetime('now')),
          FOREIGN KEY (housingUnitId) REFERENCES housing_units(id) ON DELETE CASCADE,
          FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE SET NULL
        )
      `);
      console.log('✅ Created table housing_occupants');
    }

    const customExists = await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='housing_custom_fields'"
    );
    if (customExists.length === 0) {
      await queryRunner.query(`
        CREATE TABLE housing_custom_fields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          housingUnitId INTEGER NOT NULL,
          title VARCHAR(200),
          content TEXT,
          enableAlert INTEGER DEFAULT 0,
          alertDate DATE,
          daysBeforeExpiry INTEGER,
          createdAt DATETIME DEFAULT (datetime('now')),
          updatedAt DATETIME DEFAULT (datetime('now')),
          FOREIGN KEY (housingUnitId) REFERENCES housing_units(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Created table housing_custom_fields');
    }

    const withCode = await queryRunner.query(
      "SELECT code FROM housing_units WHERE code IS NOT NULL AND code LIKE 'RMH%'"
    );
    let maxNum = 0;
    for (const row of withCode || []) {
      const code = row?.code || '';
      const numPart = code.replace(/^RMH/, '');
      const n = parseInt(numPart, 10);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
    const withoutCode = await queryRunner.query(
      "SELECT id FROM housing_units WHERE code IS NULL OR code = '' ORDER BY id"
    );
    for (const row of withoutCode || []) {
      maxNum += 1;
      const code = 'RMH' + String(maxNum).padStart(4, '0');
      await queryRunner.query('UPDATE housing_units SET code = ? WHERE id = ?', [code, row.id]);
    }
  } catch (error) {
    console.error('ensureHousingColumns error:', error);
    throw error;
  }
}
