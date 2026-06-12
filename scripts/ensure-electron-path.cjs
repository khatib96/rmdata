/**
 * npm may skip electron's postinstall (allowScripts). Repair path.txt when binary exists.
 */
const fs = require('fs');
const path = require('path');

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');
const platformPath = process.platform === 'darwin'
  ? 'Electron.app/Contents/MacOS/Electron'
  : process.platform === 'win32'
    ? 'electron.exe'
    : 'electron';
const binaryPath = path.join(electronDir, 'dist', platformPath);
const frameworkPath = path.join(
  electronDir,
  'dist',
  'Electron.app',
  'Contents',
  'Frameworks',
  'Electron Framework.framework',
);

if (!fs.existsSync(binaryPath)) process.exit(0);
if (process.platform === 'darwin' && !fs.existsSync(frameworkPath)) process.exit(0);

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'));
  const versionFile = path.join(electronDir, 'dist', 'version');
  if (!fs.existsSync(versionFile)) {
    fs.writeFileSync(versionFile, String(pkg.version || '').replace(/^v/, ''), 'utf8');
  }
  const pathFile = path.join(electronDir, 'path.txt');
  const current = fs.existsSync(pathFile) ? fs.readFileSync(pathFile, 'utf8').trim() : '';
  if (current !== platformPath) {
    fs.writeFileSync(pathFile, platformPath, 'utf8');
  }
} catch {
  /* best-effort */
}
