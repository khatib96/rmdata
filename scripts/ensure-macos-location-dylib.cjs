#!/usr/bin/env node
/** Build libRmdataLocation.dylib on macOS when missing (dev mode). */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'darwin') process.exit(0);

const out = path.join(__dirname, '../electron/bin/libRmdataLocation.dylib');
const src = path.join(__dirname, '../electron/macos-location-lib.swift');
if (fs.existsSync(out)) process.exit(0);
if (!fs.existsSync(src)) process.exit(0);

fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync(
  'swiftc',
  ['-emit-library', '-o', out, '-framework', 'CoreLocation', src],
  { stdio: 'inherit' },
);
