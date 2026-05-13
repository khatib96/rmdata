const STORAGE_KEY = 'rmdata_last_known_location';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface StoredLocation {
  lat: number;
  lng: number;
  city?: string;
  ts: number;
}

export function saveLastKnownLocation(lat: number, lng: number, city?: string): void {
  try {
    const data: StoredLocation = { lat, lng, city, ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be unavailable in some contexts
  }
}

export function getLastKnownLocation(): { lat: number; lng: number; city?: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredLocation;
    if (!data.lat || !data.lng) return null;
    if (Date.now() - (data.ts || 0) > MAX_AGE_MS) return null;
    return { lat: data.lat, lng: data.lng, city: data.city };
  } catch {
    return null;
  }
}
