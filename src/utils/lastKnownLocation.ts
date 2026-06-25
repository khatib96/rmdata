const STORAGE_KEY = 'rmdata_gps_location_v1';
const LEGACY_KEY = 'rmdata_last_known_location';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredLocation {
  lat: number;
  lng: number;
  city?: string;
  ts: number;
  source: 'gps';
}

/** Drop legacy cache that may contain wrong IP-based coordinates. */
function migrateLegacyCache(): void {
  try {
    if (localStorage.getItem(LEGACY_KEY)) {
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function saveLastKnownLocation(lat: number, lng: number, city?: string): void {
  try {
    migrateLegacyCache();
    const data: StoredLocation = { lat, lng, city, ts: Date.now(), source: 'gps' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* localStorage might be unavailable */
  }
}

export function getLastKnownLocation(): { lat: number; lng: number; city?: string } | null {
  try {
    migrateLegacyCache();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredLocation;
    if (!data.lat || !data.lng || data.source !== 'gps') return null;
    if (Date.now() - (data.ts || 0) > MAX_AGE_MS) return null;
    return { lat: data.lat, lng: data.lng, city: data.city };
  } catch {
    return null;
  }
}

export function clearLastKnownLocation(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}
