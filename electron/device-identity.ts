import { app } from 'electron';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const IDENTITY_FILE = 'device-identity.json';

function platformLabel(): string {
  if (process.platform === 'win32') return 'Windows';
  if (process.platform === 'darwin') return 'macOS';
  return 'Linux';
}

/** First 4 hex chars of deviceId for display (distinguishes same hostname on LAN). */
export function shortDeviceIdSuffix(deviceId: string): string {
  return deviceId.slice(0, 4);
}

/**
 * Persistent per-installation ID under userData (survives app updates, not OS reinstall).
 */
export function getOrCreateDeviceId(): string {
  const fp = path.join(app.getPath('userData'), IDENTITY_FILE);
  try {
    if (fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf-8');
      const j = JSON.parse(raw) as { deviceId?: string };
      if (j.deviceId && /^[a-f0-9]{32}$/i.test(j.deviceId)) {
        return j.deviceId;
      }
    }
  } catch {
    /* create new */
  }
  const deviceId = randomBytes(16).toString('hex');
  try {
    fs.writeFileSync(
      fp,
      JSON.stringify({ deviceId, createdAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (e) {
    console.warn('device-identity: failed to persist', e);
  }
  return deviceId;
}

/** e.g. DESKTOP-ABC (Windows) - a1b2 */
export function buildDeviceLabel(deviceId: string): string {
  const host = (os.hostname() || 'Unknown-PC').trim() || 'Unknown-PC';
  return `${host} (${platformLabel()}) - ${shortDeviceIdSuffix(deviceId)}`;
}
