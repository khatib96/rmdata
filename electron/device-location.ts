/**
 * Cross-platform device coordinates for prayer times and connected-device tracking.
 * Windows: System.Device.Location via PowerShell.
 * macOS: bundled CoreLocation helper, then Chromium geolocation on main window.
 */
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { sharedState } from './shared-state';

export type DeviceLocationResult = {
  success: boolean;
  lat?: number;
  lng?: number;
  error?: string;
  source?: 'windows' | 'macos-native' | 'macos-chromium';
};

const POWERSHELL_GEO_SCRIPT = `
Add-Type -AssemblyName System.Device
$w = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::Default)
$w.Start()
$timeout = 15
$elapsed = 0
while ($w.Status -ne 'Ready' -and $elapsed -lt $timeout) { Start-Sleep -Milliseconds 500; $elapsed += 0.5 }
if ($w.Status -eq 'Ready' -and $w.Position.Location.Latitude -ne [double]::NaN) {
  Write-Output "$($w.Position.Location.Latitude)|$($w.Position.Location.Longitude)"
} else { Write-Error "LOCATION_UNAVAILABLE: status=$($w.Status)" }
$w.Stop()
`;

const RENDERER_GEOLOCATION_JS = `
new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('NO_GEOLOCATION'));
    return;
  }
  let settled = false;
  let watchId = null;
  const done = (fn) => {
    if (settled) return;
    settled = true;
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    clearTimeout(timer);
    fn();
  };
  const timer = setTimeout(() => done(() => reject(new Error('GEO_TIMEOUT'))), 35000);
  watchId = navigator.geolocation.watchPosition(
    (pos) => done(() => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })),
    (err) => done(() => reject(new Error('GEO_' + (err && err.code != null ? err.code : 'UNKNOWN')))),
    { enableHighAccuracy: false, maximumAge: 300000, timeout: 30000 }
  );
})
`;

function parseLatLng(stdout: string): { lat: number; lng: number } | null {
  const parts = (stdout || '').trim().split('|');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function getWindowsLocation(): Promise<DeviceLocationResult> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', POWERSHELL_GEO_SCRIPT],
      { timeout: 25000 },
      (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr?.trim() || err.message });
          return;
        }
        const coords = parseLatLng(stdout);
        if (!coords) {
          resolve({ success: false, error: 'INVALID_OUTPUT' });
          return;
        }
        resolve({ success: true, ...coords, source: 'windows' });
      },
    );
  });
}

function getMacOSHelperPath(): string | null {
  const candidates = [
    path.join(process.resourcesPath, 'macos-location-helper'),
    path.join(__dirname, '..', 'bin', 'macos-location-helper'),
    path.join(app.getAppPath(), 'electron', 'bin', 'macos-location-helper'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function getMacOSNativeLocation(): Promise<DeviceLocationResult> {
  const helper = getMacOSHelperPath();
  if (!helper) {
    return Promise.resolve({ success: false, error: 'NO_MACOS_HELPER' });
  }
  return new Promise((resolve) => {
    execFile(helper, { timeout: 40_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: (stderr || err.message || '').trim() || 'MACOS_NATIVE_FAILED' });
        return;
      }
      const coords = parseLatLng(stdout);
      if (!coords) {
        resolve({ success: false, error: 'INVALID_OUTPUT' });
        return;
      }
      resolve({ success: true, ...coords, source: 'macos-native' });
    });
  });
}

async function waitForMainWindow(maxMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const win = sharedState.mainWindow;
    if (win && !win.isDestroyed() && !win.webContents.isLoading()) return win;
    await new Promise((r) => setTimeout(r, 300));
  }
  return sharedState.mainWindow && !sharedState.mainWindow.isDestroyed() ? sharedState.mainWindow : null;
}

async function getMacOSChromiumLocation(): Promise<DeviceLocationResult> {
  const win = await waitForMainWindow();
  if (!win || win.isDestroyed()) {
    return { success: false, error: 'NO_WINDOW' };
  }

  try {
    if (!win.isVisible()) win.show();
    const result = (await win.webContents.executeJavaScript(RENDERER_GEOLOCATION_JS, true)) as {
      lat?: number;
      lng?: number;
    };
    if (
      result?.lat != null &&
      result?.lng != null &&
      Number.isFinite(result.lat) &&
      Number.isFinite(result.lng)
    ) {
      return { success: true, lat: result.lat, lng: result.lng, source: 'macos-chromium' };
    }
    return { success: false, error: 'INVALID_COORDS' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

async function getMacOSLocation(): Promise<DeviceLocationResult> {
  const native = await getMacOSNativeLocation();
  if (native.success) return native;

  let chromium = await getMacOSChromiumLocation();
  if (!chromium.success && chromium.error === 'NO_WINDOW') {
    await new Promise((r) => setTimeout(r, 2000));
    chromium = await getMacOSChromiumLocation();
  }
  if (chromium.success) return chromium;

  return {
    success: false,
    error: chromium.error || native.error || 'MACOS_LOCATION_FAILED',
  };
}

/** Resolve coordinates from the OS / Electron main process. */
export async function resolveDeviceLocationInMain(): Promise<DeviceLocationResult> {
  if (process.platform === 'win32') {
    return getWindowsLocation();
  }
  if (process.platform === 'darwin') {
    return getMacOSLocation();
  }
  return { success: false, error: 'UNSUPPORTED_PLATFORM' };
}
