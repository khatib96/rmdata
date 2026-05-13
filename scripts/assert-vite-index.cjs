/**
 * Vite expects the repo-root index.html to be the dev entry (script → /src/main.tsx).
 * If dist/index.html was copied over the root file, build fails with
 * "Could not resolve ./assets/index-XXXX.js from index.html".
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html;
try {
  html = fs.readFileSync(indexPath, 'utf8');
} catch {
  console.error('assert-vite-index: missing index.html at project root');
  process.exit(1);
}

if (/\.\/assets\/index-[^"'>\s]+\.js/.test(html) || /href=["']\.\/assets\/index-[^"'>\s]+\.css["']/.test(html)) {
  console.error(
    [
      'assert-vite-index: index.html looks like a Vite *build output* (references ./assets/index-*.js/css).',
      'Do not copy dist/index.html over the project root.',
      'Fix:  npm run restore:vite-index',
      '       (or: git checkout -- index.html  if this is a git clone)',
    ].join('\n')
  );
  process.exit(1);
}

if (!html.includes('/src/main.tsx')) {
  console.error(
    [
      'assert-vite-index: index.html must load the app entry:',
      '  <script type="module" src="/src/main.tsx"></script>',
      'Fix:  npm run restore:vite-index',
    ].join('\n')
  );
  process.exit(1);
}
