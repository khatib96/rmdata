/**
 * Migration: Add contractBranchId to employees table
 * Separates contract establishment (المنشأة) from work branch (الفرع الذي يعمل فيه)
 * Run: node scripts/add-contract-branch-id.js
 */
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

const possiblePaths = [
  path.join(__dirname, '..', 'database', 'uniform_base.db'),
  path.join(__dirname, '..', 'dist-electron', 'database', 'uniform_base.db'),
  path.join(process.cwd(), 'database', 'uniform_base.db'),
  path.join(process.cwd(), 'dist-electron', 'database', 'uniform_base.db'),
];

const dbPath = possiblePaths.find((p) => fs.existsSync(p));
if (!dbPath) {
  console.error('Database not found. Run the app once, then run this script.');
  process.exit(1);
}
console.log('Using database:', dbPath);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all('PRAGMA table_info(employees)', (err, rows) => {
    if (err) {
      console.error('Error:', err.message);
      db.close();
      process.exit(1);
    }
    const hasContractBranchId = rows?.some((r) => (r.name || '').toLowerCase() === 'contractbranchid');
    if (hasContractBranchId) {
      console.log('✅ contractBranchId already exists.');
      db.close();
      return;
    }
    db.run('ALTER TABLE employees ADD COLUMN contractBranchId INTEGER', (err2) => {
      if (err2) {
        console.error('Error adding column:', err2.message);
        db.close();
        process.exit(1);
      }
      db.run('UPDATE employees SET contractBranchId = workBranchId WHERE contractBranchId IS NULL AND workBranchId IS NOT NULL', (err3) => {
        if (err3) console.error('Migration update:', err3.message);
        else console.log('✅ Migrated existing workBranchId to contractBranchId.');
        console.log('✅ contractBranchId added successfully.');
        db.close();
      });
    });
  });
});
