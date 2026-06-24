export type DeviceCoordinates = { lat: number; lng: number };

export type LocationResolveSource = 'ipc' | 'browser' | 'ip' | 'none';

type LocationApiResult = { success: boolean; lat?: number; lng?: number; error?: string };

function coordsFromApiResult(res: LocationApiResult | undefined): DeviceCoordinates | null {
  if (!res?.success || res.lat == null || res.lng == null) return null;
  if (!Number.isFinite(res.lat) || !Number.isFinite(res.lng)) return null;
  return { lat: res.lat, lng: res.lng };
}

/** Browser geolocation with watchPosition (more reliable than getCurrentPosition on macOS). */
function getBrowserGeolocation(): Promise<DeviceCoordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: DeviceCoordinates | null) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      resolve(value);
    };

    let watchId: number | null = null;
    const timer = window.setTimeout(() => finish(null), 35_000);

    watchId = navigator.geolocation.watchPosition(
      (pos) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 30_000 },
    );
  });
}

async function tryIpcLocation(): Promise<DeviceCoordinates | null> {
  const api = window.electronAPI;
  try {
    const res = await api?.getDeviceLocation?.();
    const coords = coordsFromApiResult(res);
    if (coords) return coords;
    if (res?.error) console.warn('DEVICE_LOCATION_IPC_FAILED:', res.error);
  } catch (err) {
    console.warn('DEVICE_LOCATION_IPC_FAILED (exception):', err);
  }

  try {
    const legacy = await api?.getWindowsLocation?.();
    return coordsFromApiResult(legacy);
  } catch {
    return null;
  }
}

export type ResolvedLocation = {
  coords: DeviceCoordinates;
  source: LocationResolveSource;
};

/**
 * Resolve device coordinates (best effort):
 * 1) Electron IPC (Windows PowerShell / macOS native helper or Chromium)
 * 2) Browser geolocation
 * 3) IP-based approximate location
 */
export async function resolveDeviceCoordinates(): Promise<DeviceCoordinates | null> {
  const result = await resolveDeviceCoordinatesDetailed();
  return result?.coords ?? null;
}

export async function resolveDeviceCoordinatesDetailed(): Promise<ResolvedLocation | null> {
  const ipc = await tryIpcLocation();
  if (ipc) return { coords: ipc, source: 'ipc' };

  const browser = await getBrowserGeolocation();
  if (browser) return { coords: browser, source: 'browser' };

  const { resolveLocationFromIP } = await import('./ipGeolocation');
  const ip = await resolveLocationFromIP();
  if (ip) {
    console.log('DEVICE_LOCATION_IP_FALLBACK:', ip.lat, ip.lng);
    return { coords: ip, source: 'ip' };
  }

  return null;
}
