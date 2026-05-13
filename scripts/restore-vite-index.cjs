/**
 * Copies scripts/vite-index.html → project root index.html.
 * Use on deploy hosts without .git when dist/index.html was wrongly copied over the source entry.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'vite-index.html');
const dest = path.join(__dirname, '..', 'index.html');

if (!fs.existsSync(src)) {
  console.error('restore-vite-index: missing', src);
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log('restore-vite-index: wrote', dest);
