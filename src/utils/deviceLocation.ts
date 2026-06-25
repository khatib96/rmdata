export type DeviceCoordinates = { lat: number; lng: number };

export type LocationResolveSource = 'ipc' | 'browser';

type LocationApiResult = { success: boolean; lat?: number; lng?: number; error?: string };

function coordsFromApiResult(res: LocationApiResult | undefined): DeviceCoordinates | null {
  if (!res?.success || res.lat == null || res.lng == null) return null;
  if (!Number.isFinite(res.lat) || !Number.isFinite(res.lng)) return null;
  return { lat: res.lat, lng: res.lng };
}

function geoOptions(highAccuracy: boolean): PositionOptions {
  return {
    enableHighAccuracy: highAccuracy,
    maximumAge: 0,
    timeout: 60_000,
  };
}

/**
 * Device GPS/Wi‑Fi location via navigator.geolocation (uses RMDATA.app permission on macOS).
 * No IP-based fallback — only real device location.
 */
function getBrowserGeolocation(highAccuracy = true): Promise<DeviceCoordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.warn('GEOLOCATION_UNAVAILABLE: navigator.geolocation missing');
    return Promise.resolve(null);
  }

  const options = geoOptions(highAccuracy);

  return new Promise((resolve) => {
    let settled = false;
    let watchId: number | null = null;

    const finish = (value: DeviceCoordinates | null) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      resolve(value);
    };

    const onSuccess = (pos: GeolocationPosition) => {
      console.log('GEOLOCATION_SUCCESS:', pos.coords.latitude, pos.coords.longitude, 'accuracy=', pos.coords.accuracy);
      finish({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };

    const onError = (err: GeolocationPositionError) => {
      console.warn('GEOLOCATION_ERROR:', err.code, err.message);
      finish(null);
    };

    const timer = window.setTimeout(() => {
      console.warn('GEOLOCATION_TIMEOUT');
      finish(null);
    }, 65_000);

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        console.warn('GEOLOCATION_GET_CURRENT_FAILED:', err.code, err.message, '- trying watchPosition');
        watchId = navigator.geolocation.watchPosition(onSuccess, onError, options);
      },
      options,
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

async function isMacOS(): Promise<boolean> {
  try {
    const p = await window.electronAPI?.getProcessPlatform?.();
    if (p === 'darwin') return true;
  } catch {
    /* ignore */
  }
  return /Macintosh|Mac OS X/i.test(navigator.userAgent);
}

export type ResolvedLocation = {
  coords: DeviceCoordinates;
  source: LocationResolveSource;
};

/** GPS/device location only — never IP. */
export async function resolveDeviceCoordinates(): Promise<DeviceCoordinates | null> {
  const result = await resolveDeviceCoordinatesDetailed();
  return result?.coords ?? null;
}

export async function resolveDeviceCoordinatesDetailed(): Promise<ResolvedLocation | null> {
  const mac = await isMacOS();

  if (mac) {
    // macOS: IPC uses native CoreLocation in main process (RMDATA.app permission).
    const ipc = await tryIpcLocation();
    if (ipc) return { coords: ipc, source: 'ipc' };

    const browser = await getBrowserGeolocation(true);
    if (browser) return { coords: browser, source: 'browser' };

    return null;
  }

  const ipc = await tryIpcLocation();
  if (ipc) return { coords: ipc, source: 'ipc' };

  const browser = await getBrowserGeolocation(false);
  if (browser) return { coords: browser, source: 'browser' };

  return null;
}
