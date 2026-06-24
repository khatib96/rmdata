import type { DeviceCoordinates } from './deviceLocation';

/** Approximate coordinates from public IP (fallback when GPS is unavailable). */
export async function resolveLocationFromIP(): Promise<DeviceCoordinates | null> {
  const endpoints = [
    async (): Promise<DeviceCoordinates | null> => {
      const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const data = (await res.json()) as { latitude?: string; longitude?: string };
      const lat = parseFloat(data.latitude ?? '');
      const lng = parseFloat(data.longitude ?? '');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    },
    async (): Promise<DeviceCoordinates | null> => {
      const res = await fetch('https://free.freeipapi.com/api/json', { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const data = (await res.json()) as { latitude?: number; longitude?: number };
      if (data.latitude == null || data.longitude == null) return null;
      return { lat: data.latitude, lng: data.longitude };
    },
  ];

  for (const load of endpoints) {
    try {
      const coords = await load();
      if (coords) return coords;
    } catch {
      /* try next provider */
    }
  }
  return null;
}
