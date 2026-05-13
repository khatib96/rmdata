import { QueryRunner } from 'typeorm';

export const updatePhoneColumns = async (queryRunner: QueryRunner) => {
  const table = await queryRunner.getTable('phones');
  if (!table) return;

  const hasPhoneNumber = table.columns.find((c) => c.name === 'phoneNumber');
  const hasProvider = table.columns.find((c) => c.name === 'provider');

  // We only run this if the new columns don't exist
  if (!hasPhoneNumber && !hasProvider) {
    console.log('Migrating phones table to new architecture...');

    // 1. Add new columns
    await queryRunner.query(`ALTER TABLE phones ADD COLUMN phoneNumber varchar(20)`);
    await queryRunner.query(`ALTER TABLE phones ADD COLUMN provider varchar(50) DEFAULT 'etisalat'`);
    await queryRunner.query(`ALTER TABLE phones ADD COLUMN category varchar(50) DEFAULT 'postpaid'`);
    await queryRunner.query(`ALTER TABLE phones ADD COLUMN numberType varchar(50) DEFAULT 'mobile'`);
    
    // Additional info fields
    await queryRunner.query(`ALTER TABLE phones ADD COLUMN billAmount decimal(10,2)`);
    await queryRunner.query(`ALTER TABLE phones ADD COLUMN registeredName varchar(200)`);
    await queryRunner.query(`ALTER TABLE phones ADD COLUMN legalEntityId integer`);
    
    // Assignment to housing
    await queryRunner.query(`ALTER TABLE phones ADD COLUMN assignedHousingId integer`);

    // 2. Migrate existing data conceptually
    try {
      await queryRunner.query(`UPDATE phones SET phoneNumber = number WHERE number IS NOT NULL AND number != ''`);
    } catch(e) { console.warn(e) }
    
    // Notice: We don't drop deviceImei, deviceModel, simNumber in SQLite easily via ALTER TABLE DROP COLUMN 
    // depending on the SQLite version, but starting from SQLite 3.35.0 (2021) DROP COLUMN is supported.
    // However, to be safe and avoid "drop column not supported" in older embedded electron sqlites, 
    // it's functionally fine to leave them as orphaned unused columns, or try dropping them.
    try {
      await queryRunner.query(`ALTER TABLE phones DROP COLUMN simNumber`);
      await queryRunner.query(`ALTER TABLE phones DROP COLUMN deviceImei`);
      await queryRunner.query(`ALTER TABLE phones DROP COLUMN deviceModel`);
      await queryRunner.query(`ALTER TABLE phones DROP COLUMN lineType`); // Replacing lineType with numberType
    } catch (e) {
      console.warn('Could not drop old phone columns (SQLite version might not support it). Ignoring.', e);
    }
  }
};
