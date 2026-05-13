/**
 * Export local SQLite data to MySQL-compatible SQL file.
 * Run: node scripts/export-sqlite-to-mysql.js
 * Output: scripts/mysql-import.sql
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(
  process.env.APPDATA || path.join(require('os').homedir(), '.config'),
  'RMDATA.System',
  'uniform_base.db'
);

const userDataDir = path.join(
  process.env.APPDATA || path.join(require('os').homedir(), '.config'),
  'RMDATA.System'
);
const oldUserDataDir = path.join(
  process.env.APPDATA || path.join(require('os').homedir(), '.config'),
  'alredaa-erp-system'
);

const PATH_COLUMNS = new Set([
  'photoPath', 'imagePath', 'avatarPath', 'path',
]);

function normalizeFilePath(val) {
  if (typeof val !== 'string' || !val) return val;
  let rel = val;
  const normalized = val.replace(/\\/g, '/');
  for (const base of [userDataDir, oldUserDataDir]) {
    const normalizedBase = base.replace(/\\/g, '/');
    if (normalized.startsWith(normalizedBase + '/')) {
      rel = normalized.slice(normalizedBase.length + 1);
      break;
    }
  }
  rel = rel.replace(/\\/g, '/');
  if (/^[A-Z]:\//i.test(rel)) return rel;
  return rel;
}

if (!fs.existsSync(dbPath)) {
  console.error('Database not found at:', dbPath);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
const outFile = path.join(__dirname, 'mysql-import.sql');
const lines = [];

lines.push('\uFEFF-- RMDATA SQLite to MySQL data export');
lines.push(`-- Generated: ${new Date().toISOString()}`);
lines.push('/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;');
lines.push('/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;');
lines.push('/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;');
lines.push('/*!40101 SET NAMES utf8mb4 */;');
lines.push('SET NAMES utf8mb4;');
lines.push("SET CHARACTER SET 'utf8mb4';");
lines.push("SET collation_connection = 'utf8mb4_unicode_ci';");
lines.push('SET FOREIGN_KEY_CHECKS = 0;');
lines.push('');

function escapeValue(val, colName) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  let str = String(val);
  if (colName && PATH_COLUMNS.has(colName)) {
    str = normalizeFilePath(str);
  }
  const s = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return `'${s}'`;
}

function sqliteDefaultToMySQL(dflt) {
  if (dflt === null || dflt === undefined) return null;
  const s = String(dflt);
  if (/^datetime\s*\(\s*'now'\s*\)/i.test(s)) return 'CURRENT_TIMESTAMP';
  if (/^date\s*\(\s*'now'\s*\)/i.test(s)) return 'CURRENT_TIMESTAMP';
  if (/^CURRENT_TIMESTAMP$/i.test(s)) return 'CURRENT_TIMESTAMP';
  return s;
}

function sqliteTypeToMySQL(type) {
  const t = (type || '').toUpperCase();
  if (t.includes('INT')) return 'INT';
  if (t.includes('REAL') || t.includes('FLOAT') || t.includes('DOUBLE')) return 'DOUBLE';
  if (t.includes('BLOB')) return 'LONGBLOB';
  if (t.includes('TEXT') || t.includes('CLOB')) return 'LONGTEXT';
  if (t.includes('VARCHAR')) return type;
  if (t.includes('CHAR')) return type;
  if (t.includes('DATE') || t.includes('TIME')) return 'DATETIME';
  if (t.includes('BOOL')) return 'TINYINT(1)';
  if (t === '' || t === 'NUMERIC') return 'TEXT';
  return 'TEXT';
}

db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", [], (err, tables) => {
  if (err) { console.error(err); process.exit(1); }

  let pending = tables.length;
  if (pending === 0) {
    fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
    console.log('No tables found.');
    db.close();
    return;
  }

  tables.forEach(({ name }) => {
    db.all(`PRAGMA table_info("${name}")`, [], (err2, cols) => {
      if (err2) { console.error(err2); pending--; return; }

      const pkCols = cols.filter(c => c.pk);
      const isCompositePK = pkCols.length > 1;

      const colDefs = cols.map(c => {
        let mysqlType = sqliteTypeToMySQL(c.type);
        if (mysqlType.toUpperCase() === 'VARCHAR') mysqlType = 'varchar(255)';

        let def = `\`${c.name}\` ${mysqlType}`;
        if (!isCompositePK && c.pk) {
          def += ' PRIMARY KEY';
        }
        if (c.notnull && !(c.pk && !isCompositePK)) def += ' NOT NULL';
        const mysqlDefault = sqliteDefaultToMySQL(c.dflt_value);
        if (mysqlDefault !== null && !c.pk) def += ` DEFAULT ${mysqlDefault}`;
        return def;
      });

      if (!isCompositePK) {
        const pkCol = pkCols[0];
        if (pkCol && pkCol.type.toUpperCase().includes('INT')) {
          const idx = colDefs.findIndex(d => d.includes('PRIMARY KEY'));
          if (idx >= 0) {
            colDefs[idx] = colDefs[idx].replace('PRIMARY KEY', 'PRIMARY KEY AUTO_INCREMENT');
          }
        }
      } else {
        colDefs.push(`PRIMARY KEY (${pkCols.map(c => '\`' + c.name + '\`').join(', ')})`);
      }

      lines.push(`-- Table: ${name}`);
      lines.push(`DROP TABLE IF EXISTS \`${name}\`;`);
      lines.push(`CREATE TABLE \`${name}\` (`);
      lines.push('  ' + colDefs.join(',\n  '));
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
      lines.push('');

      // INSERT data
      db.all(`SELECT * FROM "${name}"`, [], (err3, rows) => {
        if (err3 || !rows || rows.length === 0) {
          lines.push(`-- (no data in ${name})`);
          lines.push('');
          pending--;
          if (pending === 0) finish();
          return;
        }

        const colNames = Object.keys(rows[0]);
        const header = colNames.map(c => `\`${c}\``).join(', ');

        // Batch inserts (500 rows per statement)
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const values = batch.map(row => {
            const vals = colNames.map(c => escapeValue(row[c], c));
            return `(${vals.join(', ')})`;
          });
          lines.push(`INSERT INTO \`${name}\` (${header}) VALUES`);
          lines.push(values.join(',\n') + ';');
        }
        lines.push('');

        pending--;
        if (pending === 0) finish();
      });
    });
  });

  function finish() {
    lines.push('SET FOREIGN_KEY_CHECKS = 1;');
    lines.push('/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;');
    lines.push('/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;');
    lines.push('/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;');
    lines.push('');
    const content = lines.join('\n');
    fs.writeFileSync(outFile, content, 'utf8');
    console.log(`Export complete: ${outFile}`);
    console.log(`Tables exported: ${tables.length}`);
    db.close();
  }
});
