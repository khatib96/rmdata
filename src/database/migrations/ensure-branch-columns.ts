/**
 * Migration to ensure all branch columns exist
 * This runs after synchronize to add any missing columns
 */
export async function ensureBranchColumns(queryRunner: any) {
  try {
    // Check if branches table exists
    const tableExists = await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='branches'"
    );

    if (tableExists.length === 0) {
      console.log('Branches table does not exist, will be created by synchronize');
      return;
    }

    // Get existing columns
    const tableInfo = await queryRunner.query('PRAGMA table_info(branches)');
    const existingColumns = tableInfo.map((col: any) => col.name.toLowerCase());

    const columnsToAdd: Array<{ name: string; definition: string }> = [];

    // Check and add missing columns
    if (!existingColumns.includes('country')) {
      columnsToAdd.push({
        name: 'country',
        definition: "ALTER TABLE branches ADD COLUMN country VARCHAR(100) DEFAULT 'United Arab Emirates'",
      });
    }
    if (!existingColumns.includes('emirate')) {
      columnsToAdd.push({
        name: 'emirate',
        definition: 'ALTER TABLE branches ADD COLUMN emirate VARCHAR(50)',
      });
    }
    if (!existingColumns.includes('tradelicenseno')) {
      columnsToAdd.push({
        name: 'tradeLicenseNo',
        definition: 'ALTER TABLE branches ADD COLUMN tradeLicenseNo VARCHAR(100)',
      });
    }
    if (!existingColumns.includes('tradelicenseexpiry')) {
      columnsToAdd.push({
        name: 'tradeLicenseExpiry',
        definition: 'ALTER TABLE branches ADD COLUMN tradeLicenseExpiry DATE',
      });
    }
    if (!existingColumns.includes('establishmentcardno')) {
      columnsToAdd.push({
        name: 'establishmentCardNo',
        definition: 'ALTER TABLE branches ADD COLUMN establishmentCardNo VARCHAR(100)',
      });
    }
    if (!existingColumns.includes('establishmentcardexpiry')) {
      columnsToAdd.push({
        name: 'establishmentCardExpiry',
        definition: 'ALTER TABLE branches ADD COLUMN establishmentCardExpiry DATE',
      });
    }
    if (!existingColumns.includes('photopath')) {
      columnsToAdd.push({
        name: 'photoPath',
        definition: 'ALTER TABLE branches ADD COLUMN photoPath VARCHAR(255)',
      });
    }
    if (!existingColumns.includes('workhours')) {
      columnsToAdd.push({
        name: 'workHours',
        definition: 'ALTER TABLE branches ADD COLUMN workHours VARCHAR(20)',
      });
    }
    if (!existingColumns.includes('worktimingslots')) {
      columnsToAdd.push({
        name: 'workTimingSlots',
        definition: 'ALTER TABLE branches ADD COLUMN workTimingSlots TEXT',
      });
    }
    if (!existingColumns.includes('city')) {
      columnsToAdd.push({
        name: 'city',
        definition: 'ALTER TABLE branches ADD COLUMN city VARCHAR(100)',
      });
    }

    // Execute ALTER TABLE statements
    for (const column of columnsToAdd) {
      try {
        await queryRunner.query(column.definition);
        console.log(`✅ Added column: ${column.name}`);
      } catch (err) {
        console.warn(`⚠️ Column ${column.name} might already exist:`, err);
      }
    }

    // Ensure id is AUTOINCREMENT
    const createTable = await queryRunner.query(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='branches'"
    );
    if (createTable.length > 0 && !createTable[0].sql.includes('AUTOINCREMENT')) {
      console.warn('⚠️ Branches table ID might not be AUTOINCREMENT. Consider recreating table.');
    }
  } catch (error) {
    console.error('Error ensuring branch columns:', error);
    throw error;
  }
}
