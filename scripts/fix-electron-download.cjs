/**
 * Re-download Electron when postinstall was skipped. Usage: npm run fix:electron
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const extract = require('extract-zip');
const { downloadArtifact } = require('@electron/get');

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');
const { version } = require(path.join(electronDir, 'package.json'));

const platformPath = process.platform === 'darwin'
  ? 'Electron.app/Contents/MacOS/Electron'
  : process.platform === 'win32'
    ? 'electron.exe'
    : 'electron';

async function main() {
  const distPath = path.join(electronDir, 'dist');
  const binaryPath = path.join(distPath, platformPath);
  const frameworkPath = path.join(
    distPath,
    'Electron.app',
    'Contents',
    'Frameworks',
    'Electron Framework.framework',
  );
  const stat = fs.existsSync(binaryPath) ? fs.statSync(binaryPath) : null;
  if (stat && stat.size > 500_000 && fs.existsSync(frameworkPath)) {
    fs.writeFileSync(path.join(electronDir, 'path.txt'), platformPath, 'utf8');
    fs.writeFileSync(path.join(distPath, 'version'), String(version).replace(/^v/, ''), 'utf8');
    console.log('Electron binary already present.');
    return;
  }

  console.log('Downloading Electron', version, '...');
  if (fs.existsSync(distPath)) fs.rmSync(distPath, { recursive: true, force: true });
  fs.mkdirSync(distPath, { recursive: true });

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch,
    force: true,
    checksums: require(path.join(electronDir, 'checksums.json')),
  });

  if (process.platform === 'darwin') {
    execFileSync('unzip', ['-q', zipPath, '-d', distPath], { stdio: 'inherit' });
  } else {
    await extract(zipPath, { dir: distPath });
  }

  fs.writeFileSync(path.join(electronDir, 'path.txt'), platformPath, 'utf8');
  fs.writeFileSync(path.join(distPath, 'version'), String(version).replace(/^v/, ''), 'utf8');
  console.log('Electron installed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
