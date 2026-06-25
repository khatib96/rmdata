/**
 * Cross-platform device coordinates — GPS / OS location only (no IP).
 * Windows: System.Device.Location via PowerShell.
 * macOS: native CoreLocation dylib in main process, then Chromium geolocation fallback.
 */
import { execFile } from 'child_process';
import * as path from 'path';
import { Worker } from 'worker_threads';
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
  const opts = { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 };
  const timer = setTimeout(() => done(() => reject(new Error('GEO_TIMEOUT'))), 65000);
  const onOk = (pos) => done(() => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
  const onErr = (err) => done(() => reject(new Error('GEO_' + (err && err.code != null ? err.code : 'UNKNOWN'))));
  navigator.geolocation.getCurrentPosition(
    onOk,
    () => { watchId = navigator.geolocation.watchPosition(onOk, onErr, opts); },
    opts
  );
})
`;

const NATIVE_ERROR: Record<number, string> = {
  1: 'NATIVE_ERROR',
  2: 'PERMISSION_DENIED',
  3: 'TIMEOUT',
  4: 'POSITION_UNAVAILABLE',
  5: 'UNKNOWN_AUTH',
};

let cachedNativeDylibPath: string | null = null;

function resolveNativeDylibPath(): string {
  if (cachedNativeDylibPath) return cachedNativeDylibPath;
  cachedNativeDylibPath = app.isPackaged
    ? path.join(process.resourcesPath, 'libRmdataLocation.dylib')
    : path.join(__dirname, '../bin/libRmdataLocation.dylib');
  return cachedNativeDylibPath;
}

function getMacOSNativeLocation(): Promise<DeviceLocationResult> {
  const dylibPath = resolveNativeDylibPath();
  return new Promise((resolve) => {
    const worker = new Worker(
      `const { parentPort, workerData } = require('node:worker_threads');
       const koffi = require('koffi');
       try {
         const lib = koffi.load(workerData.dylibPath);
         const fn = lib.func('int32 rmdata_location_get(_Out_ double *outLat, _Out_ double *outLng, double timeoutSec)');
         const outLat = koffi.alloc('double', 1);
         const outLng = koffi.alloc('double', 1);
         const code = fn(outLat, outLng, workerData.timeoutSec);
         parentPort.postMessage({
           code,
           lat: koffi.decode(outLat, 'double'),
           lng: koffi.decode(outLng, 'double'),
         });
       } catch (e) {
         parentPort.postMessage({ code: -1, error: e && e.message ? e.message : String(e) });
       }`,
      { eval: true, workerData: { dylibPath, timeoutSec: 60 } },
    );
    worker.on('message', (msg: { code: number; lat?: number; lng?: number; error?: string }) => {
      void worker.terminate();
      if (
        msg.code === 0 &&
        msg.lat != null &&
        msg.lng != null &&
        Number.isFinite(msg.lat) &&
        Number.isFinite(msg.lng)
      ) {
        console.log('[device-location] native CoreLocation:', msg.lat, msg.lng);
        resolve({ success: true, lat: msg.lat, lng: msg.lng, source: 'macos-native' });
        return;
      }
      const err = msg.error ?? NATIVE_ERROR[msg.code] ?? `NATIVE_${msg.code}`;
      console.warn('[device-location] native CoreLocation failed:', err);
      resolve({ success: false, error: err });
    });
    worker.on('error', (err) => {
      console.warn('[device-location] native worker error:', err);
      resolve({ success: false, error: err.message });
    });
  });
}

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

async function waitForMainWindow(maxMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const win = sharedState.mainWindow;
    if (win && !win.isDestroyed() && !win.webContents.isLoading()) return win;
    await new Promise((r) => setTimeout(r, 300));
  }
  const win = sharedState.mainWindow;
  return win && !win.isDestroyed() ? win : null;
}

async function getMacOSChromiumLocation(): Promise<DeviceLocationResult> {
  const win = await waitForMainWindow();
  if (!win || win.isDestroyed()) {
    return { success: false, error: 'NO_WINDOW' };
  }

  try {
    win.show();
    win.focus();
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
    console.warn('[device-location] macOS Chromium geolocation failed:', msg);
    return { success: false, error: msg };
  }
}

/** Resolve coordinates from the OS — GPS only, no IP. */
export async function resolveDeviceLocationInMain(): Promise<DeviceLocationResult> {
  if (process.platform === 'win32') {
    return getWindowsLocation();
  }
  if (process.platform === 'darwin') {
    const native = await getMacOSNativeLocation();
    if (native.success) return native;
    return getMacOSChromiumLocation();
  }
  return { success: false, error: 'UNSUPPORTED_PLATFORM' };
}

/** Prime CoreLocation after the main window loads (macOS). */
export async function warmUpMacOSLocation(): Promise<void> {
  if (process.platform !== 'darwin') return;
  void getMacOSNativeLocation();
}
