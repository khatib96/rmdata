/**
 * Migration: Add city column to branches table
 * Run: node scripts/add-city-column.js
 * (from project root)
 */
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

// Try multiple possible database locations (Electron may create DB in dist-electron)
const possiblePaths = [
  path.join(__dirname, '..', 'database', 'uniform_base.db'),
  path.join(__dirname, '..', 'dist-electron', 'database', 'uniform_base.db'),
  path.join(process.cwd(), 'database', 'uniform_base.db'),
  path.join(process.cwd(), 'dist-electron', 'database', 'uniform_base.db'),
];

const dbPath = possiblePaths.find((p) => fs.existsSync(p));
if (!dbPath) {
  console.error('Database not found. Tried:');
  possiblePaths.forEach((p) => console.error('  -', p));
  console.error('\nRun the app once to create the database, then run this script again.');
  process.exit(1);
}
console.log('Using database:', dbPath);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all('PRAGMA table_info(branches)', (err, rows) => {
    if (err) {
      console.error('Error reading schema:', err.message);
      db.close();
      process.exit(1);
    }
    const hasCity = rows && rows.some((r) => (r.name || '').toLowerCase() === 'city');
    if (hasCity) {
      console.log('✅ Column "city" already exists in branches table.');
      db.close();
      return;
    }
    db.run('ALTER TABLE branches ADD COLUMN city VARCHAR(100)', (err2) => {
      if (err2) {
        console.error('Error adding column:', err2.message);
        db.close();
        process.exit(1);
      }
      console.log('✅ Successfully added "city" column to branches table.');
      db.close();
    });
  });
});
