/**
 * Local Settings Store — JSON file in userData.
 * Used for device-specific preferences (language, notification toggles, expiry UI).
 * These settings are NOT synced to the remote MySQL database.
 *
 * File: <userData>/local-settings.json
 */
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const FILE_NAME = 'local-settings.json';

function filePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME);
}

function readAll(): Record<string, string> {
  try {
    const p = filePath();
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, string>): void {
  fs.writeFileSync(filePath(), JSON.stringify(data, null, 2), 'utf8');
}

/** Get a single local setting. Returns `undefined` if not set. */
export function getLocalSetting(key: string): string | undefined {
  return readAll()[key];
}

/** Get all local settings. */
export function getAllLocalSettings(): Record<string, string> {
  return readAll();
}

/** Set a single local setting. */
export function setLocalSetting(key: string, value: string): void {
  const data = readAll();
  data[key] = value;
  writeAll(data);
}

/** Set multiple local settings at once. */
export function setLocalSettings(entries: Record<string, string>): void {
  const data = readAll();
  for (const [k, v] of Object.entries(entries)) {
    data[k] = v;
  }
  writeAll(data);
}
