/**
 * Migration: ensure vehicles table has RMV schema columns and vehicle_custom_fields exists.
 * Also backfill code (RMV0001, ...) for vehicles missing code.
 */
export async function ensureVehicleColumns(queryRunner: any) {
  try {
    const tableExists = await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vehicles'"
    );
    if (tableExists.length === 0) return;

    const tableInfo = await queryRunner.query('PRAGMA table_info(vehicles)');
    const existingColumns = tableInfo.map((col: any) => col.name.toLowerCase());

    const add = async (col: string, def: string) => {
      if (existingColumns.includes(col.toLowerCase())) return;
      try {
        await queryRunner.query(def);
        console.log(`✅ vehicles: added column ${col}`);
      } catch (e) {
        console.warn(`⚠️ vehicles column ${col}:`, e);
      }
    };

    await add('code', 'ALTER TABLE vehicles ADD COLUMN code VARCHAR(20)');
    await add('platecode', 'ALTER TABLE vehicles ADD COLUMN plateCode VARCHAR(20)');
    await add('vehiclename', 'ALTER TABLE vehicles ADD COLUMN vehicleName VARCHAR(200)');
    await add('photoPath', 'ALTER TABLE vehicles ADD COLUMN photoPath VARCHAR(255)');
    await add('brand', 'ALTER TABLE vehicles ADD COLUMN brand VARCHAR(100)');
    await add('vehicleType', 'ALTER TABLE vehicles ADD COLUMN vehicleType VARCHAR(20)');
    await add('ownershipType', 'ALTER TABLE vehicles ADD COLUMN ownershipType VARCHAR(20)');
    await add('ownerName', 'ALTER TABLE vehicles ADD COLUMN ownerName VARCHAR(200)');
    await add('issuePlace', 'ALTER TABLE vehicles ADD COLUMN issuePlace VARCHAR(100)');
    await add('trafficNo', 'ALTER TABLE vehicles ADD COLUMN trafficNo VARCHAR(100)');
    await add('chassisNo', 'ALTER TABLE vehicles ADD COLUMN chassisNo VARCHAR(100)');
    await add('engineNo', 'ALTER TABLE vehicles ADD COLUMN engineNo VARCHAR(100)');
    await add('licenseRegDate', 'ALTER TABLE vehicles ADD COLUMN licenseRegDate DATE');
    await add('licenseExpiryDate', 'ALTER TABLE vehicles ADD COLUMN licenseExpiryDate DATE');
    await add('insuranceType', 'ALTER TABLE vehicles ADD COLUMN insuranceType VARCHAR(50)');
    await add('insurancePolicyNo', 'ALTER TABLE vehicles ADD COLUMN insurancePolicyNo VARCHAR(100)');
    await add('responsibleEmployeeId', 'ALTER TABLE vehicles ADD COLUMN responsibleEmployeeId INTEGER');
    await add('responsibleName', 'ALTER TABLE vehicles ADD COLUMN responsibleName VARCHAR(200)');

    // Ensure unique index on plateNumber (ignore if exists)
    try {
      await queryRunner.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS IDX_vehicles_plateNumber ON vehicles(plateNumber)'
      );
    } catch (_) {}

    // Create vehicle_custom_fields if not exists
    const cfExists = await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vehicle_custom_fields'"
    );
    if (cfExists.length === 0) {
      await queryRunner.query(`
        CREATE TABLE vehicle_custom_fields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicleId INTEGER NOT NULL,
          title VARCHAR(200) NOT NULL,
          content TEXT,
          enableAlert BOOLEAN DEFAULT 0,
          alertDate DATE,
          daysBeforeExpiry INTEGER,
          createdAt DATETIME DEFAULT (datetime('now')),
          updatedAt DATETIME DEFAULT (datetime('now')),
          FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Created table vehicle_custom_fields');
    }

    // Backfill RMV code for vehicles that don't have one
    const withCode = await queryRunner.query(
      "SELECT code FROM vehicles WHERE code IS NOT NULL AND code LIKE 'RMV%'"
    );
    let maxNum = 0;
    for (const row of withCode || []) {
      const code = row?.code || '';
      const numPart = code.replace(/^RMV/, '');
      const n = parseInt(numPart, 10);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
    const withoutCode = await queryRunner.query(
      'SELECT id FROM vehicles WHERE code IS NULL OR code = "" ORDER BY id'
    );
    for (const row of withoutCode || []) {
      maxNum += 1;
      const code = 'RMV' + String(maxNum).padStart(4, '0');
      await queryRunner.query('UPDATE vehicles SET code = ? WHERE id = ?', [code, row.id]);
    }
  } catch (error) {
    console.error('ensureVehicleColumns error:', error);
    throw error;
  }
}
