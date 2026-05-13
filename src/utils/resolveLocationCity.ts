/** Shared UAE emirate fallback + Nominatim reverse geocode (same strategy as PrayerTimesWidget). */

const UAE_EMIRATES: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'أبوظبي', lat: 24.4539, lng: 54.3773 },
  { name: 'دبي', lat: 25.2048, lng: 55.2708 },
  { name: 'الشارقة', lat: 25.3573, lng: 55.4033 },
  { name: 'عجمان', lat: 25.4052, lng: 55.5136 },
  { name: 'أم القيوين', lat: 25.5647, lng: 55.5554 },
  { name: 'رأس الخيمة', lat: 25.7895, lng: 55.9432 },
  { name: 'الفجيرة', lat: 25.1288, lng: 56.3265 },
];

export function getClosestEmirate(lat: number, lng: number): string {
  let closest = UAE_EMIRATES[0].name;
  let minDist = Infinity;
  for (const e of UAE_EMIRATES) {
    const d = Math.sqrt(Math.pow(lat - e.lat, 2) + Math.pow(lng - e.lng, 2));
    if (d < minDist) {
      minDist = d;
      closest = e.name;
    }
  }
  return closest;
}

async function fetchCityNameAr(lat: number, lng: number, fallback: string): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`;
    const res = await fetch(url, { headers: { 'User-Agent': 'RMDATA_System/1.0' } });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { address?: { city?: string; town?: string; state?: string } };
    let city = data?.address?.city || data?.address?.town || data?.address?.state || fallback;
    if (city.startsWith('إمارة ')) city = city.replace('إمارة ', '');
    return city;
  } catch {
    return fallback;
  }
}

/** Arabic city name when possible; otherwise nearest UAE emirate from coordinates. */
export async function resolveLocationCity(lat: number, lng: number): Promise<string> {
  const fallback = getClosestEmirate(lat, lng);
  const city = await fetchCityNameAr(lat, lng, fallback);
  return city || fallback;
}
