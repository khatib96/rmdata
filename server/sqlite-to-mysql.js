/**
 * Port of api-gateway-php/src/db.php sqlite_to_mysql().
 * Keep in sync with PHP when patterns change.
 * @param {string} sql
 * @returns {string}
 */
function sqliteToMysql(sql) {
  let out = String(sql);

  out = out.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');

  out = out.replace(
    /datetime\s*\(\s*'now'\s*,\s*'(-?\d+)\s+(day|days|hour|hours|minute|minutes|month|months|year|years)'\s*\)/gi,
    (_, nStr, unitRaw) => {
      const n = parseInt(nStr, 10);
      const unit = String(unitRaw).replace(/s$/i, '').toUpperCase();
      if (n < 0) {
        return `DATE_SUB(NOW(), INTERVAL ${Math.abs(n)} ${unit})`;
      }
      return `DATE_ADD(NOW(), INTERVAL ${n} ${unit})`;
    }
  );

  out = out.replace(/date\s*\(\s*'now'\s*\)/gi, 'CURDATE()');

  out = out.replace(
    /date\s*\(\s*'now'\s*,\s*'(-?\d+)\s+(day|days|hour|hours|minute|minutes|month|months|year|years)'\s*\)/gi,
    (_, nStr, unitRaw) => {
      const n = parseInt(nStr, 10);
      const unit = String(unitRaw).replace(/s$/i, '').toUpperCase();
      if (n < 0) {
        return `DATE_SUB(CURDATE(), INTERVAL ${Math.abs(n)} ${unit})`;
      }
      return `DATE_ADD(CURDATE(), INTERVAL ${n} ${unit})`;
    }
  );

  out = out.replace(/\bdatetime\s*\(\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\)/gi, '$1');

  out = out.replace(/\bINSERT\s+OR\s+IGNORE\b/gi, 'INSERT IGNORE');
  out = out.replace(/\bINSERT\s+OR\s+REPLACE\b/gi, 'REPLACE');
  out = out.replace(/\bAUTOINCREMENT\b/gi, 'AUTO_INCREMENT');
  out = out.replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTO_INCREMENT\b/gi, 'INT PRIMARY KEY AUTO_INCREMENT');

  out = out.replace(/\blast_insert_rowid\s*\(\s*\)/gi, 'LAST_INSERT_ID()');

  out = out.replace(/(\w+)\s+GLOB\s+'([^']+)'/gi, (_, col, pat) => {
    const pattern = String(pat).replace(/\*/g, '%').replace(/\?/g, '_');
    return `${col} LIKE '${pattern}'`;
  });

  if (/\bsqlite_master\b/i.test(out)) {
    out = out.replace(
      /SELECT\s+name\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'\s+AND\s+name\s*=\s*\?/gi,
      'SELECT TABLE_NAME as name FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
    );
  }

  const reserved = ['key', 'value', 'index'];
  for (const word of reserved) {
    const re = new RegExp(
      `(?<!\`)(?<![A-Za-z0-9_.])\\b${word}\\b(?!\`)(?![A-Za-z0-9_(])`,
      'gi'
    );
    out = out.replace(re, `\`${word}\``);
  }

  return out;
}

module.exports = { sqliteToMysql };
